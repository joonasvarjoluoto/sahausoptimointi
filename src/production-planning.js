// Tuotantokerros ei muuta materiaaliratkaisua tai sen pisteytystä.
const PRODUCTION_PLANNING = (() => {
    const batchDefaults = Object.freeze({ minBatchPieces: 200, targetBatchPieces: 250, maxBatchPieces: 300 });
    const profileDefaults = Object.freeze(Object.fromEntries([
        ["uProfile", 4], ["verticalProfile", 4], ["closingProfile", 1],
        ["horizontalProfile", 4], ["topRail", 2], ["bottomRail", 2]
    ].map(([profile, maxStackSize]) => [profile, Object.freeze({ compatibilityGroup: profile, maxStackSize })])));

    function batchSettings(options = {}) {
        const settings = { ...batchDefaults, ...options };
        const { minBatchPieces: min, targetBatchPieces: target, maxBatchPieces: max } = settings;
        if (![min, target, max].every(n => Number.isSafeInteger(n) && n > 0) || min > target || target > max) {
            throw new Error("Batch-rajat: 0 < min ≤ tavoite ≤ max.");
        }
        return settings;
    }

    // Vaihdettava hakurajapinta: evaluate saa vain kokonaisia tilauksia.
    function selectBatch(orders, evaluate, options = {}) {
        const settings = batchSettings(options);
        const ids = new Set();
        for (const order of orders) {
            if (!order.id || ids.has(order.id) || !Number.isSafeInteger(order.pieceCount) || order.pieceCount <= 0) {
                throw new Error("Batchin tilaukset tarvitsevat yksilöllisen id:n ja positiivisen kappalemäärän.");
            }
            ids.add(order.id);
        }
        const candidates = [];
        function visit(index, selected, count) {
            if (index === orders.length) {
                if (selected.length) candidates.push({ orders: [...selected], pieceCount: count });
                return;
            }
            visit(index + 1, selected, count);
            const order = orders[index];
            if (count + order.pieceCount <= settings.maxBatchPieces) {
                selected.push(order);
                visit(index + 1, selected, count + order.pieceCount);
                selected.pop();
            }
        }
        const totalPieces = orders.reduce((sum, order) => sum + order.pieceCount, 0);
        // Minimi estää pienten erien poiminnan suuresta jonosta, ei lyhyen jonon valmistamista.
        if (orders.length && totalPieces < settings.minBatchPieces) {
            candidates.push({ orders: [...orders], pieceCount: totalPieces });
        } else {
            visit(0, [], 0);
        }
        orders.filter(o => o.pieceCount > settings.maxBatchPieces).forEach(order => {
            candidates.push({ orders: [order], pieceCount: order.pieceCount });
        });
        let evaluatedCount = 0;
        const eligible = totalPieces < settings.minBatchPieces
            ? candidates
            : candidates.filter(candidate => candidate.pieceCount >= settings.minBatchPieces);
        let best = null;
        for (const candidate of eligible) {
            const result = evaluate(candidate.orders);
            evaluatedCount++;
            if (!result.complete) continue;
            if (!Number.isFinite(result.materialScore)) throw new Error("Materiaalipiste puuttuu.");
            const key = JSON.stringify(candidate.orders.map(o => o.id).sort());
            const distance = Math.abs(candidate.pieceCount - settings.targetBatchPieces);
            if (!best || result.materialScore < best.materialScore ||
                (result.materialScore === best.materialScore && (distance < best.distance ||
                    (distance === best.distance && key < best.key)))) {
                best = { ...candidate, ...result, distance, key };
            }
        }
        if (best) return { ...best, settings, evaluatedCount, oversized: best.pieceCount > settings.maxBatchPieces };
        return { complete: false, evaluatedCount, settings };
    }

    function attachPieces(plan, cuts) {
        if (!plan.complete || plan.remainingItems.length) throw new Error("Osittaista suunnitelmaa ei aikatauluteta.");
        const pools = new Map();
        const key = p => JSON.stringify([p.profileType, p.color ?? null, p.length]);
        cuts.forEach((cut, row) => {
            if (!cut.orderId || !Number.isSafeInteger(cut.quantity) || cut.quantity <= 0) throw new Error("Kappaleen tilaus tai määrä puuttuu.");
            if (!pools.has(key(cut))) pools.set(key(cut), []);
            for (let i = 0; i < cut.quantity; i++) {
                pools.get(key(cut)).push({ ...cut, quantity: 1, openingId: cut.openingId ?? null, pieceId: `piece-${row + 1}-${i + 1}` });
            }
        });
        const sources = plan.bars.map(bar => ({
            id: bar.id, profileType: bar.profileType, color: bar.color ?? null,
            origin: bar.source === "new" ? "new" : "old-remnant", sourceLength: bar.sourceLength,
            remaining: bar.remaining, waste: bar.waste,
            pieces: bar.groupedCuts.flatMap(cut => Array.from({ length: cut.quantity }, () => {
                const piece = pools.get(key({ ...bar, length: cut.length }))?.shift();
                if (!piece) throw new Error("Materiaaliratkaisun kappalekohdistus ei täsmää.");
                return piece;
            }))
        }));
        if ([...pools.values()].some(pool => pool.length)) throw new Error("Tilauksen kappaleita jäi kohdistamatta.");
        return sources;
    }

    function getCompatibility(source, profiles) {
        if (!Object.prototype.hasOwnProperty.call(profiles, source.profileType)) throw new Error("Profiilin nippusääntö puuttuu.");
        const rule = profiles[source.profileType];
        if (!rule.compatibilityGroup || !Number.isSafeInteger(rule.maxStackSize) || rule.maxStackSize < 1) throw new Error("Virheellinen nippusääntö.");
        return rule;
    }

    function schedule(sources, kerf, profiles = profileDefaults) {
        const physics = typeof CUTTING_PHYSICS !== "undefined" ? CUTTING_PHYSICS : require("./cutting-physics.js");
        if (kerf < 0 || !physics.hasSupportedMillimeterPrecision(kerf)) throw new Error("Virheellinen sahausvara.");
        const states = new Map();
        const pieceIds = new Set();
        for (const source of sources) {
            getCompatibility(source, profiles);
            if (!source.id || states.has(source.id) || !["new", "old-remnant", "same-run-remnant"].includes(source.origin) ||
                (source.origin === "same-run-remnant") !== Boolean(source.parentSourceId) ||
                !source.pieces.length || source.sourceLength <= 0) throw new Error("Virheellinen materiaalilähde.");
            let remaining = source.sourceLength;
            let waste = 0;
            for (const piece of source.pieces) {
                if (typeof piece.pieceId !== "string" || !piece.pieceId || pieceIds.has(piece.pieceId) ||
                    typeof piece.orderId !== "string" || !piece.orderId || piece.quantity !== 1 || piece.length <= 0 ||
                    !(piece.openingId == null || typeof piece.openingId === "string") ||
                    piece.profileType !== source.profileType || (piece.color ?? null) !== (source.color ?? null)) throw new Error("Virheellinen kappaleprovenance.");
                pieceIds.add(piece.pieceId);
                const cut = physics.cutPiece(remaining, piece.length, kerf);
                if (!cut.possible) throw new Error("Kappale ei mahdu lähteeseen.");
                remaining = cut.remaining;
                waste += physics.millimetersToDpUnits(cut.waste);
            }
            if (remaining !== source.remaining || waste !== physics.millimetersToDpUnits(source.waste)) throw new Error("Lähteen materiaalitase ei täsmää.");
            states.set(source.id, { source, pieces: [...source.pieces], remaining: source.sourceLength, lastOperation: null });
        }
        const visiting = new Set(), visited = new Set(), consumedParents = new Set();
        function check(state) {
            if (visiting.has(state.source.id)) throw new Error("Syklinen materiaaliriippuvuus.");
            if (visited.has(state.source.id)) return;
            visiting.add(state.source.id);
            const parentId = state.source.parentSourceId;
            if (parentId) {
                const parent = states.get(parentId);
                if (!parent || consumedParents.has(parentId) || parent.source.remaining !== state.source.sourceLength ||
                    parent.source.profileType !== state.source.profileType || (parent.source.color ?? null) !== (state.source.color ?? null)) throw new Error("Mahdoton jäännösriippuvuus.");
                consumedParents.add(parentId);
                check(parent);
            }
            visiting.delete(state.source.id);
            visited.add(state.source.id);
        }
        states.forEach(check);
        const operations = [];
        while ([...states.values()].some(s => s.pieces.length)) {
            const ready = [...states.values()].filter(s => s.pieces.length &&
                (!s.source.parentSourceId || !states.get(s.source.parentSourceId).pieces.length));
            if (!ready.length) throw new Error("Materiaaliriippuvuudet estävät suorituksen.");
            // Jatkoleikkaus käyttää juuri syntynyttä, tarkasti tunnettua jäännöstä.
            const priority = s => s.lastOperation || s.source.parentSourceId ? 0 : 1;
            ready.sort((a, b) => priority(a) - priority(b) || (a.source.id < b.source.id ? -1 : 1));
            const first = ready[0];
            const piece = first.pieces[0];
            // Täsmälleen valmis loppukappale poimitaan ilman sahausliikettä.
            const kind = first.remaining === piece.length ? "release" : "cut";
            const rule = getCompatibility(first.source, profiles);
            const group = [first];
            let limit = rule.maxStackSize;
            for (const state of ready.slice(1)) {
                const other = getCompatibility(state.source, profiles);
                const nextLimit = Math.min(limit, other.maxStackSize);
                if (other.compatibilityGroup === rule.compatibilityGroup && group.length < nextLimit &&
                    state.pieces.some(p => p.length === piece.length) &&
                    (state.remaining === piece.length ? "release" : "cut") === kind) {
                    group.push(state);
                    limit = nextLimit;
                }
            }
            const dependencies = new Set();
            const operation = { id: `operation-${operations.length + 1}`, number: operations.length + 1, kind,
                compatibilityGroup: rule.compatibilityGroup, length: piece.length, sources: [], pieces: [], dependencyIds: [], maxStackSize: limit };
            for (const state of group) {
                const parentOp = state.lastOperation || (state.source.parentSourceId && states.get(state.source.parentSourceId).lastOperation);
                if (parentOp) dependencies.add(parentOp);
                const index = state.pieces.findIndex(p => p.length === piece.length);
                const [output] = state.pieces.splice(index, 1);
                const cut = physics.cutPiece(state.remaining, output.length, kerf);
                if (!cut.possible) throw new Error("Järjestetty sahaus ei mahdu lähteeseen.");
                operation.sources.push({ id: state.source.id, profileType: state.source.profileType, color: state.source.color,
                    origin: state.lastOperation ? "same-run-remnant" : state.source.origin,
                    before: state.remaining, after: cut.remaining, waste: cut.waste });
                operation.pieces.push({ ...output, sourceId: state.source.id });
                state.remaining = cut.remaining;
                state.lastOperation = operation.id;
            }
            operation.dependencyIds = [...dependencies];
            operations.push(operation);
        }
        for (const state of states.values()) {
            if (state.remaining !== state.source.remaining) throw new Error("Sahausjärjestys muutti materiaalitulosta.");
        }
        const cuts = operations.filter(o => o.kind === "cut");
        return { operations, metrics: {
            cutOperationCount: cuts.length,
            // Batch alkaa mittavasteen asettamisesta ensimmäiseen sahausmittaan.
            stopPositionChanges: cuts.filter((o, i) => i === 0 || o.length !== cuts[i - 1].length).length,
            stackChanges: cuts.filter((o, i) => i > 0 && JSON.stringify(o.sources.map(s => s.id)) !== JSON.stringify(cuts[i - 1].sources.map(s => s.id))).length,
            handledSourceCount: sources.length,
            bundleUtilization: cuts.length ? cuts.reduce((n, o) => n + o.sources.length, 0) / cuts.reduce((n, o) => n + o.maxStackSize, 0) : 0
        } };
    }
    return Object.freeze({ batchDefaults, profileDefaults, batchSettings, selectBatch, attachPieces, getCompatibility, schedule });
})();

if (typeof module !== "undefined" && module.exports) module.exports = PRODUCTION_PLANNING;
