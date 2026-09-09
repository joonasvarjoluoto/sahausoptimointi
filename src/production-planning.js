// Tuotantokerros ei muuta materiaaliratkaisua tai sen pisteytystä.
const PRODUCTION_PLANNING = (() => {
    const batchDefaults = Object.freeze({ minBatchPieces: 200, targetBatchPieces: 250, maxBatchPieces: 300 });
    const profileDefaults = Object.freeze(Object.fromEntries([
        ["uProfile", 4], ["verticalProfile", 4], ["closingProfile", 1],
        ["horizontalProfile", 4], ["topRail", 2], ["bottomRail", 2]
    ].map(([profile, maxStackSize]) => [profile, Object.freeze({ compatibilityGroup: profile, maxStackSize })])));
    const profileBlocks = Object.freeze([
        Object.freeze({ id: "verticalProfile", profileTypes: Object.freeze(["verticalProfile"]) }),
        Object.freeze({ id: "closingProfile", profileTypes: Object.freeze(["closingProfile"]) }),
        Object.freeze({ id: "horizontalProfile", profileTypes: Object.freeze(["horizontalProfile"]) }),
        Object.freeze({ id: "uProfile", profileTypes: Object.freeze(["uProfile"]) }),
        Object.freeze({ id: "rails", profileTypes: Object.freeze(["bottomRail", "topRail"]) })
    ]);
    const profileBlockByType = new Map(profileBlocks.flatMap((block, index) =>
        block.profileTypes.map(profileType => [profileType, { ...block, index }])));

    function getProfileBlock(profileType) {
        return profileBlockByType.get(profileType) ?? {
            id: "profile:" + profileType, profileTypes: [profileType], index: profileBlocks.length
        };
    }

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

    const railPairCompatibility = Object.freeze({
        profiles: Object.freeze(["bottomRail", "topRail"]),
        compatibilityGroup: "opening-rail-pair", maxStackSize: 2
    });
    const isRail = piece => railPairCompatibility.profiles.includes(piece.profileType);
    const openingKey = piece => piece.openingId?.trim()
        ? JSON.stringify([piece.orderId, piece.openingId]) : null;

    function createRailPairIndex(sources) {
        const openings = new Map(), pairs = new Map();
        for (const piece of sources.flatMap(source => source.pieces).filter(isRail)) {
            const key = openingKey(piece);
            if (!key) continue;
            if (!openings.has(key)) openings.set(key, []);
            openings.get(key).push(piece);
        }
        for (const [key, pieces] of openings) {
            if (pieces.length === 2 && pieces[0].profileType !== pieces[1].profileType &&
                pieces[0].length === pieces[1].length && pieces[0].color === pieces[1].color) {
                pieces.forEach(piece => pairs.set(piece.pieceId, key));
            }
        }
        return pairs;
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
        const railPairs = createRailPairIndex(sources);
        const operations = [];
        while ([...states.values()].some(s => s.pieces.length)) {
            const ready = [...states.values()].filter(s => s.pieces.length &&
                (!s.source.parentSourceId || !states.get(s.source.parentSourceId).pieces.length));
            if (!ready.length) throw new Error("Materiaaliriippuvuudet estävät suorituksen.");
            const pendingBlocks = [...states.values()].filter(s => s.pieces.length)
                .map(s => getProfileBlock(s.source.profileType));
            pendingBlocks.sort((a, b) => a.index - b.index || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
            const activeBlock = pendingBlocks[0];
            const activeReady = ready.filter(s => getProfileBlock(s.source.profileType).id === activeBlock.id);
            // Parenttilähde on validoitu samaan profiiliin, joten aikaisimmassa keskeneräisessä
            // blokissa on aina vähintään yksi topologisesti valmis lähde.
            if (!activeReady.length) throw new Error("Profiiliblokin materiaaliriippuvuudet estävät suorituksen.");
            // Jatkoleikkaus käyttää juuri syntynyttä, tarkasti tunnettua jäännöstä.
            const priority = s => s.lastOperation || s.source.parentSourceId ? 0 : 1;
            const previous = operations.at(-1);
            const previousRail = previous?.pieces.find(isRail);
            const adjacent = p => previousRail && isRail(p) && openingKey(p) &&
                openingKey(p) === openingKey(previousRail) && p.length === previous.length;
            // Aukon saman mitan kiskot pidetään lähellä toisiaan ilman materiaalipisteitä.
            for (const state of activeReady) {
                const index = state.pieces.findIndex(adjacent);
                if (index > 0) state.pieces.unshift(...state.pieces.splice(index, 1));
            }
            activeReady.sort((a, b) => Number(!adjacent(a.pieces[0])) - Number(!adjacent(b.pieces[0])) ||
                priority(a) - priority(b) || (a.source.id < b.source.id ? -1 : 1));
            const first = activeReady[0];
            const piece = first.pieces[0];
            // Täsmälleen valmis loppukappale poimitaan ilman sahausliikettä.
            const kind = first.remaining === piece.length ? "release" : "cut";
            const rule = getCompatibility(first.source, profiles);
            const group = [{ state: first, piece }];
            let limit = rule.maxStackSize;
            let compatibilityGroup = rule.compatibilityGroup;
            const pairKey = railPairs.get(piece.pieceId);
            // Eksplisiittinen poikkeus: vain nimetty aukko, yksi kumpaakin ja kaksi valmista lähdettä.
            if (kind === "cut" && pairKey && limit >= 2) {
                for (const state of activeReady.slice(1)) {
                    const partner = state.pieces.find(p => railPairs.get(p.pieceId) === pairKey &&
                        p.profileType !== piece.profileType);
                    const other = getCompatibility(state.source, profiles);
                    if (partner && state.remaining !== partner.length && other.maxStackSize >= 2) {
                        group.push({ state, piece: partner });
                        limit = railPairCompatibility.maxStackSize;
                        compatibilityGroup = railPairCompatibility.compatibilityGroup;
                        break;
                    }
                }
            }
            if (group.length === 1) for (const state of activeReady.slice(1)) {
                const other = getCompatibility(state.source, profiles);
                const nextLimit = Math.min(limit, other.maxStackSize);
                const candidate = state.pieces.find(p => p.length === piece.length &&
                    // Kiskosekanippua ei sallita edes yleisen compatibilityGroup-asetuksen kautta.
                    (!(isRail(piece) || isRail(p)) || p.profileType === piece.profileType) &&
                    (!pairKey && !railPairs.has(p.pieceId)));
                if (other.compatibilityGroup === rule.compatibilityGroup && group.length < nextLimit &&
                    candidate && (state.remaining === piece.length ? "release" : "cut") === kind) {
                    group.push({ state, piece: candidate });
                    limit = nextLimit;
                }
            }
            const dependencies = new Set();
            const operation = { id: `operation-${operations.length + 1}`, number: operations.length + 1, kind,
                compatibilityGroup, length: piece.length, sources: [], pieces: [], dependencyIds: [], maxStackSize: limit };
            for (const { state, piece: selectedPiece } of group) {
                const parentOp = state.lastOperation || (state.source.parentSourceId && states.get(state.source.parentSourceId).lastOperation);
                if (parentOp) dependencies.add(parentOp);
                const index = state.pieces.findIndex(p => p.pieceId === selectedPiece.pieceId);
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
    return Object.freeze({ batchDefaults, profileDefaults, profileBlocks, getProfileBlock,
        batchSettings, selectBatch, attachPieces, getCompatibility, railPairCompatibility, schedule });
})();

if (typeof module !== "undefined" && module.exports) module.exports = PRODUCTION_PLANNING;
