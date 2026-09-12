// Sovittimet nykyisen lomake-/materiaalimallin ja puhtaan tuotantokerroksen välillä.
function getProductionSettingsForStorage() {
    return Object.fromEntries(Object.entries(PRODUCTION_PLANNING.batchDefaults).map(([key, value]) =>
        [key, typeof document === "undefined" ? String(value) : (document.getElementById(key)?.value ?? String(value))]));
}

function isValidStoredProductionSettings(settings) {
    return settings === undefined || (isPlainObject(settings) &&
        Object.keys(PRODUCTION_PLANNING.batchDefaults).every(key =>
            typeof settings[key] === "string" && settings[key].length <= 32 &&
            (settings[key] === "" || (/^-?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i.test(settings[key]) &&
                Number.isFinite(Number(settings[key]))))));
}

function restoreProductionSettings(settings = PRODUCTION_PLANNING.batchDefaults) {
    for (const [key, value] of Object.entries(PRODUCTION_PLANNING.batchDefaults)) {
        const input = document.getElementById(key);
        if (input) input.value = String(settings[key] ?? value);
    }
}

function selectProductionBatch(orders, inventory, kerf, settings) {
    if (!isValidStoredOrders(orders)) throw new Error("Virheellinen tilausrakenne.");
    for (const cut of normalizeOrderCuts(orders)) {
        if (!Number.isSafeInteger(cut.quantity) || cut.quantity <= 0 || cut.length <= 0 ||
            !hasSupportedMillimeterPrecision(cut.length) || !isSupportedMaterialColor(cut.color)) {
            throw new Error("Batchin tilauskysyntä on virheellinen.");
        }
    }
    const queue = orders.map(order => ({ ...order,
        pieceCount: normalizeOrderCuts([order]).reduce((n, cut) => n + cut.quantity, 0)
    })).filter(order => order.pieceCount > 0);
    return PRODUCTION_PLANNING.selectBatch(queue, selected => {
        const cuts = normalizeOrderCuts(selected);
        // Tyhjä varianttivarasto tekee tästä ehdokkaasta mahdottoman,
        // mutta muiden kokonaisten tilausten yhdistelmät tutkitaan silti.
        if (cuts.some(cut => getMaterialSourcesForProfile(inventory, cut.profileType, cut.color).length === 0)) {
            return { complete: false };
        }
        const optimization = optimizeOrderByProfileTypeWithInventory(cuts, inventory, kerf, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS);
        verifyOptimizationResult(cuts, inventory, optimization);
        return { complete: optimization.complete, optimization,
            materialScore: optimization.complete
                ? scoreCompleteMaterialTransitionPlan(optimization, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings).totalCostEquivalent : null };
    }, settings);
}

function getPlanOrders(plan, orders) {
    if (plan.batch === undefined) return orders; // Skeeman 4 vanha koko jonon suunnitelma.
    const batch = plan.batch;
    if (!batch || batch.version !== 1 || !Array.isArray(batch.orderIds) || !batch.orderIds.length ||
        batch.orderIds.some(id => typeof id !== "string") || new Set(batch.orderIds).size !== batch.orderIds.length) {
        throw new Error("Virheellinen tallennettu batch-jäsenyys.");
    }
    if (!isPlainObject(batch.settings) || Object.keys(PRODUCTION_PLANNING.batchDefaults).some(key =>
        !Object.prototype.hasOwnProperty.call(batch.settings, key))) throw new Error("Batchin asetukset puuttuvat.");
    const settings = PRODUCTION_PLANNING.batchSettings(batch.settings);
    const selected = batch.orderIds.map(id => {
        const order = orders.find(o => o.id === id);
        if (!order || normalizeOrderCuts([order]).length === 0) throw new Error("Batchin tilaus puuttuu.");
        return order;
    });
    const count = normalizeOrderCuts(selected).reduce((n, cut) => n + cut.quantity, 0);
    if (count > settings.maxBatchPieces && selected.length !== 1) throw new Error("Batchin maksimikoko ylittyy.");
    return selected;
}

function createProductionExecution(plan, orders, kerf) {
    const selected = getPlanOrders(plan, orders);
    return PRODUCTION_PLANNING.schedule(PRODUCTION_PLANNING.attachPieces(plan, normalizeOrderCuts(selected)), kerf);
}

function createWorkerSourceManifest(plan, execution) {
    const nextWorkerNumber = new Map();
    const manifest = plan.bars.map(bar => {
        const workerNumber = (nextWorkerNumber.get(bar.profileType) ?? 0) + 1;
        nextWorkerNumber.set(bar.profileType, workerNumber);
        return {
            sourceId: bar.id, workerNumber, profileType: bar.profileType,
            color: bar.color ?? null, sourceLength: bar.sourceLength,
            origin: bar.source === "new" ? "new" : "old-remnant"
        };
    });
    const byId = new Map(manifest.map(source => [source.sourceId, source]));
    if (byId.size !== plan.bars.length || manifest.some(source =>
        !Number.isSafeInteger(source.workerNumber) || source.workerNumber < 1) ||
        new Set(manifest.map(source => JSON.stringify([source.profileType, source.workerNumber]))).size !== manifest.length || execution.operations.some(operation =>
        operation.sources.some(source => !byId.has(source.id)))) {
        throw new Error("Sahausjärjestyksen fyysisiä salkoja ei voitu numeroida.");
    }
    return manifest;
}

function hashProductionIdentity(value) {
    let hash = 0xcbf29ce484222325n;
    for (const character of value) {
        hash ^= BigInt(character.codePointAt(0));
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash.toString(16).padStart(16, "0");
}

function createProductionPlanDigest(plan, execution) {
    const identity = {
        version: 1,
        batch: plan.batch ?? null,
        bars: plan.bars.map(bar => ({
            id: bar.id, number: bar.number, profileType: bar.profileType,
            color: bar.color ?? null, source: bar.source, sourceLength: bar.sourceLength,
            usableCapacity: bar.usableCapacity,
            sourceCapacityAllowance: bar.sourceCapacityAllowance,
            pieceCapacityAllowance: bar.pieceCapacityAllowance,
            totalPieceCapacityAllowance: bar.totalPieceCapacityAllowance,
            totalCapacityAllowance: bar.totalCapacityAllowance,
            nominalRemaining: bar.nominalRemaining,
            groupedCuts: bar.groupedCuts.map(cut => ({ length: cut.length, quantity: cut.quantity })),
            remaining: bar.remaining, waste: bar.waste, remnantStatus: bar.remnantStatus
        })),
        operations: execution.operations.map(operation => ({
            id: operation.id, number: operation.number, kind: operation.kind,
            compatibilityGroup: operation.compatibilityGroup, length: operation.length,
            sourceIds: operation.sources.map(source => source.id),
            pieceIds: operation.pieces.map(piece => piece.pieceId),
            dependencyIds: operation.dependencyIds
        }))
    };
    return "production-plan-v1-" + hashProductionIdentity(JSON.stringify(identity));
}

function createInitialProductionExecutionState(plan, execution) {
    return { version: 1, planDigest: createProductionPlanDigest(plan, execution), events: [] };
}

function isProductionExecutionEventPrefix(state, plan, execution) {
    if (!isPlainObject(state) || ![1, 2].includes(state.version) || state.continuation !== undefined ||
        state.planDigest !== createProductionPlanDigest(plan, execution) ||
        !Array.isArray(state.events) || state.events.length > execution.operations.length) return false;
    return state.events.every((event, index) => {
        const operation = execution.operations[index];
        const plannedSourceIds = operation.sources.map(source => source.id);
        return isPlainObject(event) && event.type === "operation-completed" &&
            event.operationId === operation.id && typeof event.completedAt === "string" &&
            Number.isFinite(Date.parse(event.completedAt)) && Array.isArray(event.actualSourceIds) &&
            event.actualSourceIds.length === plannedSourceIds.length &&
            new Set(event.actualSourceIds).size === event.actualSourceIds.length &&
            event.actualSourceIds.every((sourceId, sourceIndex) =>
                typeof sourceId === "string" && (state.version === 2 || sourceId === plannedSourceIds[sourceIndex]));
    });
}

function isValidProductionExecutionState(state, plan, execution, kerf) {
    if (state?.version === 3) {
        try { replayProductionContinuationExecution(state, plan, execution, kerf); return true; } catch { return false; }
    }
    if (!isProductionExecutionEventPrefix(state, plan, execution)) return false;
    if (state.version === 1) return true; // V1 säilyttää vain suunniteltujen lähteiden sopimuksen.
    try { replayProductionExecution(state, plan, execution, kerf); return true; } catch { return false; }
}

// Ledger on aina johdettu ja paikallinen. Alkuperäistä plania tai operaatiota ei kirjoiteta.
function applyProductionOperation(ledger, operation, sourceIds, kerf) {
    if (!Array.isArray(sourceIds) || sourceIds.length !== operation.sources.length ||
        new Set(sourceIds).size !== sourceIds.length) throw new Error("Valitse nipun jokaiseen paikkaan eri fyysinen salko.");
    const updates = sourceIds.map((id, index) => {
        const bar = ledger.get(id), planned = operation.sources[index];
        const fail = reason => {
            const error = new Error(reason);
            error.productionConflict = { operationId: operation.id, sourceId: id, reason };
            throw error;
        };
        if (!bar || bar.profileType !== planned.profileType || (bar.color ?? null) !== (planned.color ?? null)) {
            fail("Salon profiili tai väri ei vastaa sahattavaa kappaletta.");
        }
        if ((bar.nominalRemaining === operation.length ? "release" : "cut") !== operation.kind) {
            fail("Salon pituus muuttaisi sahauksen ja loppukappaleen poiminnan välistä työvaihetta.");
        }
        const groupedCuts = [...bar.groupedCuts, { length: operation.length, quantity: 1 }];
        // Sama authoritative kapasiteetti- ja cutPiece-polku kuin materiaalissa ja schedulerissa.
        const capacity = MATERIAL.calculateMaterialBarCapacity(bar.sourceLength, groupedCuts, kerf, {
            sourceCapacityAllowance: bar.sourceCapacityAllowance ?? 0,
            pieceCapacityAllowance: bar.pieceCapacityAllowance ?? 0
        });
        if (!capacity.possible) fail("Salon jäljellä oleva turvallinen pituus ei riitä työvaiheeseen.");
        return { ...bar, ...capacity, groupedCuts };
    });
    updates.forEach(bar => ledger.set(bar.id, bar)); // Nippu muuttuu vasta kaikkien slotien validoinnin jälkeen.
}

function findRemainingProductionConflict(ledger, execution, start, kerf) {
    const future = new Map(ledger);
    for (const operation of execution.operations.slice(start)) {
        try { applyProductionOperation(future, operation, operation.sources.map(source => source.id), kerf); }
        catch (error) { return error.productionConflict ?? { operationId: operation.id, reason: error.message }; }
    }
    return null;
}

function replayProductionExecution(state, plan, execution, kerf) {
    if (state?.version === 3) return replayProductionContinuationExecution(state, plan, execution, kerf);
    if (!isProductionExecutionEventPrefix(state, plan, execution) || !Number.isFinite(kerf) || kerf < 0 ||
        !CUTTING_PHYSICS.hasSupportedMillimeterPrecision(kerf)) throw new Error("Virheellinen sahausten toteumatila tai sahausvara.");
    const ledger = new Map(plan.bars.map(bar => {
        // Ensiversio käsittelee manifestin fyysisiä salkoja. Erillistä parent/child-ID:tä
        // ei saa tulkita toiseksi riippumattomaksi fyysiseksi materiaaliksi.
        if (bar.parentSourceId || !["new", "remnant"].includes(bar.source)) throw new Error("Toteuma vaatii itsenäiset fyysiset salot.");
        return [bar.id, { ...bar, groupedCuts: [], nominalRemaining: bar.sourceLength,
            remaining: MATERIAL.getUsableMaterialCapacity(bar.sourceLength, {
                sourceCapacityAllowance: bar.sourceCapacityAllowance ?? 0, pieceCapacityAllowance: bar.pieceCapacityAllowance ?? 0
            }), waste: 0, totalPieceCapacityAllowance: 0,
            totalCapacityAllowance: bar.sourceCapacityAllowance ?? 0 }];
    }));
    if (ledger.size !== plan.bars.length) throw new Error("Fyysisen salon tunniste esiintyy kahdesti.");
    let hasDeviation = false;
    state.events.forEach((event, index) => {
        const operation = execution.operations[index];
        applyProductionOperation(ledger, operation, event.actualSourceIds, kerf);
        const differs = event.actualSourceIds.some((id, slot) => id !== operation.sources[slot].id);
        hasDeviation ||= differs;
        if (differs && index + 1 < state.events.length && findRemainingProductionConflict(ledger, execution, index + 1, kerf)) {
            throw new Error("Pysäytetyn suunnitelman jälkeen on kirjattu lisää työvaiheita.");
        }
    });
    const conflict = findRemainingProductionConflict(ledger, execution, state.events.length, kerf);
    return { bars: [...ledger.values()], hasDeviation, remainingFeasible: conflict === null, conflict,
        complete: state.events.length === execution.operations.length };
}

// Johdettu lähtötieto, ei jatkosuunnitelma. Execution tulee alkuperäisestä
// createProductionExecution()-kutsusta; kappaleita ei kohdisteta uudelleen.
function createProductionContinuationInput(state, plan, execution, kerf) {
    if (state?.version === 3) throw new Error("Jatkolähtötila johdetaan jäädytetystä alkuperäisestä etuliitteestä.");
    if (!plan.complete || plan.remainingItems.length) throw new Error("Jatkolähtötila vaatii täydellisen alkuperäisen suunnitelman.");
    const replay = replayProductionExecution(state, plan, execution, kerf);
    const plannedSources = new Map(plan.bars.map(bar => [bar.id, {
        bar, quantities: new Map()
    }]));
    for (const { bar, quantities } of plannedSources.values()) {
        for (const cut of bar.groupedCuts) {
            quantities.set(cut.length, (quantities.get(cut.length) ?? 0) + cut.quantity);
        }
    }
    const allPieces = [], pieceIds = new Set(), completedIds = new Set(), operationIds = new Set();
    execution.operations.forEach((operation, index) => {
        if (!operation.id || operationIds.has(operation.id) || !operation.pieces.length ||
            operation.pieces.length !== operation.sources.length) throw new Error("Alkuperäisen operaation kappaleslotit ovat virheelliset.");
        operationIds.add(operation.id);
        operation.pieces.forEach((piece, slot) => {
            const source = operation.sources[slot];
            const planned = plannedSources.get(source.id);
            if (typeof piece.pieceId !== "string" || !piece.pieceId || pieceIds.has(piece.pieceId) ||
                typeof piece.orderId !== "string" || !piece.orderId ||
                !(piece.openingId == null || typeof piece.openingId === "string") ||
                piece.quantity !== 1 || piece.length !== operation.length ||
                piece.sourceId !== source.id || !planned ||
                piece.profileType !== source.profileType || piece.profileType !== planned.bar.profileType ||
                (piece.color ?? null) !== (source.color ?? null) || (piece.color ?? null) !== (planned.bar.color ?? null) ||
                !(planned.quantities.get(piece.length) > 0)) {
                throw new Error("Alkuperäisen kappaleen tunniste tai provenance ei vastaa suunniteltua slottia.");
            }
            planned.quantities.set(piece.length, planned.quantities.get(piece.length) - 1);
            pieceIds.add(piece.pieceId);
            allPieces.push({ ...piece });
            // Toteutunut salko ei vaihda kuitatun kappaleslotin identiteettiä.
            if (index < state.events.length) completedIds.add(piece.pieceId);
        });
    });
    if ([...plannedSources.values()].some(source => [...source.quantities.values()].some(quantity => quantity !== 0))) {
        throw new Error("Alkuperäisen materiaaliplanin kappaleita puuttuu operaatiolistasta.");
    }
    const physicalSources = replay.bars.map(bar => ({
        sourceId: bar.id, profileType: bar.profileType, color: bar.color ?? null,
        source: bar.source, sourceLength: bar.sourceLength,
        sourceCapacityAllowance: bar.sourceCapacityAllowance ?? 0,
        pieceCapacityAllowance: bar.pieceCapacityAllowance ?? 0,
        nominalRemaining: bar.nominalRemaining, remaining: bar.remaining,
        // Erotus kantaa aiemmat varaukset; alkuperäisen sourceCapacityAllowance ei muutu.
        carriedSourceCapacityAllowance: CUTTING_PHYSICS.dpUnitsToMillimeters(
            CUTTING_PHYSICS.millimetersToDpUnits(bar.nominalRemaining) - CUTTING_PHYSICS.millimetersToDpUnits(bar.remaining)),
        totalPieceCapacityAllowance: bar.totalPieceCapacityAllowance,
        totalCapacityAllowance: bar.totalCapacityAllowance,
        waste: bar.waste, groupedCuts: bar.groupedCuts.map(cut => ({ ...cut }))
    }));
    return {
        allPieces,
        completedPieces: allPieces.filter(piece => completedIds.has(piece.pieceId)),
        remainingPieces: allPieces.filter(piece => !completedIds.has(piece.pieceId)),
        physicalSources
    };
}

// Yksi bar alkuperäistä fyysistä salkoa kohti. Virtuaalilähteen pituutta ei pisteytetä uutena materiaalina.
function createPredictedProductionMaterialPlan(physicalSources, continuationBars, kerf) {
    const sources = new Map(physicalSources.map(source => [source.sourceId, source]));
    const proposed = new Map();
    if (sources.size !== physicalSources.length) throw new Error("Fyysinen lähde esiintyy kahdesti.");
    for (const bar of continuationBars) {
        if (!sources.has(bar.sourceId) || proposed.has(bar.sourceId) || !bar.pattern.length) {
            throw new Error("Jatko käyttää tuntematonta tai kahdennettua fyysistä lähdettä.");
        }
        proposed.set(bar.sourceId, bar.pattern);
    }
    const bars = physicalSources.flatMap(source => {
        const groupedCuts = [...source.groupedCuts, ...(proposed.get(source.sourceId) ?? [])].map(cut => ({ ...cut }));
        if (!groupedCuts.length) return [];
        const capacity = MATERIAL.calculateMaterialBarCapacity(source.sourceLength, groupedCuts, kerf, source);
        if (!capacity.possible) throw new Error("Jatkon yhdistetty fyysinen materiaalitase on mahdoton.");
        return [{ sourceId: source.sourceId, source: source.source, sourceLength: source.sourceLength,
            profileType: source.profileType, color: source.color, ...capacity, groupedCuts }];
    });
    return { complete: true, bars };
}

// Input on createProductionContinuationInput()-tulos. ID-kohdistus on ainoa ehdotettu materiaalijako.
function evaluateProductionContinuationPlan(input, assignments, kerf) {
    const remaining = new Map(input.remainingPieces.map(piece => [piece.pieceId, piece]));
    const physical = new Map(input.physicalSources.map(source => [source.sourceId, source]));
    const assignedPieces = new Set(), assignedSources = new Set();
    if (remaining.size !== input.remainingPieces.length || physical.size !== input.physicalSources.length ||
        input.completedPieces.some(piece => remaining.has(piece.pieceId))) throw new Error("Virheellinen jatkon lähtöjoukko.");
    const sources = assignments.map(assignment => {
        const source = physical.get(assignment.sourceId);
        if (!source || assignedSources.has(source.sourceId) || !assignment.pieceIds.length) {
            throw new Error("Jatkon lähde puuttuu, on kahdennettu tai on tyhjä.");
        }
        assignedSources.add(source.sourceId);
        const pieces = assignment.pieceIds.map(id => {
            const piece = remaining.get(id);
            if (!piece || assignedPieces.has(id) || piece.profileType !== source.profileType || (piece.color ?? null) !== source.color) {
                throw new Error("Jatkon kappale on vieras, jo tehty, kahdennettu tai väärää materiaalia.");
            }
            assignedPieces.add(id);
            return { ...piece, sourceId: source.sourceId };
        });
        const capacity = MATERIAL.calculateMaterialBarCapacity(source.nominalRemaining,
            pieces.map(piece => ({ length: piece.length, quantity: 1 })), kerf, {
                sourceCapacityAllowance: source.carriedSourceCapacityAllowance, pieceCapacityAllowance: source.pieceCapacityAllowance
            });
        if (!capacity.possible || capacity.usableCapacity !== source.remaining) throw new Error("Jatkon kappaleet eivät mahdu fyysiseen lähtötilaan.");
        return { id: source.sourceId, profileType: source.profileType, color: source.color,
            origin: source.source === "new" ? "new" : "old-remnant", previouslyUsed: source.groupedCuts.length > 0,
            sourceLength: source.nominalRemaining, ...capacity, pieces };
    });
    if (!remaining.size || assignedPieces.size !== remaining.size) throw new Error("Jatkon pitää kattaa koko epätyhjä tekemätön kysyntä.");
    // Kiskon 1+1-erikoistapaus määräytyy jatkon aloituskysynnästä, ei jo tehdyistä kappaleista.
    const execution = PRODUCTION_PLANNING.schedule(sources, kerf, PRODUCTION_PLANNING.profileDefaults, input.remainingPieces);
    // Simuloi schedulerin todellinen järjestys alkuperäisistä fyysisistä lähteistä.
    const ledger = new Map(input.physicalSources.map(source => [source.sourceId, { ...source, id: source.sourceId }]));
    for (const operation of execution.operations) {
        if (operation.sources.some(source => source.before !== ledger.get(source.id).nominalRemaining)) throw new Error("Jatkon lähtöpituus ei täsmää.");
        applyProductionOperation(ledger, operation, operation.sources.map(source => source.id), kerf);
        if (operation.sources.some(source => source.after !== ledger.get(source.id).nominalRemaining)) throw new Error("Jatkon loppupituus ei täsmää.");
    }
    const predictedPlan = createPredictedProductionMaterialPlan(input.physicalSources, sources.map(source => ({
        sourceId: source.id, pattern: execution.operations.flatMap(operation => operation.pieces
            .filter(piece => piece.sourceId === source.id).map(piece => ({ length: piece.length, quantity: 1 })))
    })), kerf);
    for (const bar of predictedPlan.bars) {
        const actual = ledger.get(bar.sourceId);
        if (["nominalRemaining", "remaining", "waste", "totalCapacityAllowance"].some(key => actual[key] !== bar[key])) {
            throw new Error("Jatkon scheduler muutti ennustettua fyysistä tasetta.");
        }
    }
    return { complete: true, assignments: assignments.map(assignment => ({ sourceId: assignment.sourceId, pieceIds: [...assignment.pieceIds] })),
        predictedPlan, materialScore: scoreCompleteMaterialTransitionPlan(predictedPlan, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings), execution };
}

function createProductionContinuationPlan(state, plan, execution, kerf, options = {}) {
    const input = createProductionContinuationInput(state, plan, execution, kerf);
    if (!input.remainingPieces.length) return { complete: false, feasibilityStatus: "unknown", reason: "no-remaining-pieces" };
    const variants = new Map();
    for (const piece of input.remainingPieces) {
        const key = JSON.stringify([piece.profileType, piece.color ?? null]);
        if (!variants.has(key)) variants.set(key, []);
        variants.get(key).push(piece);
    }
    const assignments = [];
    for (const pieces of variants.values()) {
        const physicalSources = input.physicalSources.filter(source => source.profileType === pieces[0].profileType && source.color === (pieces[0].color ?? null));
        const materialSources = physicalSources.filter(source => source.nominalRemaining > 0 && source.remaining > 0).map(source => ({
            sourceId: source.sourceId, source: source.source, profileType: source.profileType, color: source.color,
            sourceLength: source.nominalRemaining, usableCapacity: source.remaining,
            sourceCapacityAllowance: source.carriedSourceCapacityAllowance, pieceCapacityAllowance: source.pieceCapacityAllowance,
            unlimited: false, quantity: 1
        }));
        const optimization = optimizeOrderInventoryBeamDP(mergeGroupedCuts(pieces), materialSources, kerf, {
            ...PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS,
            beamWidth: options.beamWidth ?? PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.beamWidth,
            patternsPerState: options.patternsPerState ?? PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.patternsPerState,
            skipFeasibilityFallback: true,
            // Score on lähdekohtaisesti additiivinen: materiaalivariantit voidaan ratkaista erikseen.
            evaluateCompletePlan: candidate => scoreCompleteMaterialTransitionPlan(
                createPredictedProductionMaterialPlan(physicalSources, candidate.bars, kerf), PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings)
        });
        if (!optimization.complete) return { complete: false, feasibilityStatus: "unknown", reason: "no-validated-continuation" };
        const pools = new Map();
        for (const piece of pieces) {
            if (!pools.has(piece.length)) pools.set(piece.length, []);
            pools.get(piece.length).push(piece.pieceId);
        }
        for (const bar of optimization.bars) assignments.push({ sourceId: bar.sourceId,
            pieceIds: bar.pattern.flatMap(cut => Array.from({ length: cut.quantity }, () => {
                const id = pools.get(cut.length)?.shift();
                if (!id) throw new Error("Materiaalihaku tuotti ylimääräisen kappaleen.");
                return id;
            })) });
        if ([...pools.values()].some(pool => pool.length)) throw new Error("Materiaalihaku jätti kappaleita kohdistamatta.");
    }
    return evaluateProductionContinuationPlan(input, assignments, kerf);
}

// Avainten järjestys ei muuta identiteettiä; taulukoiden (slotit, kappaleet, operaatiot)
// järjestys sen sijaan on osa sopimusta. Myös base-tapahtuman aikaleima sidotaan.
function createProductionContinuationDigest(base, input, continuationPlan, kerf) {
    const canonical = value => Array.isArray(value) ? value.map(canonical) :
        value !== null && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    return "production-continuation-v1-" + hashProductionIdentity(JSON.stringify(canonical({
        version: 1, planDigest: base.planDigest, baseEventCount: base.events.length,
        events: base.events.map(event => ({ type: event.type, operationId: event.operationId,
            completedAt: event.completedAt, actualSourceIds: event.actualSourceIds })),
        physicalSources: input.physicalSources, allPieces: input.allPieces,
        remainingPieces: input.remainingPieces, assignments: continuationPlan.assignments,
        execution: continuationPlan.execution, kerf, profiles: PRODUCTION_PLANNING.profileDefaults
    })));
}

function createProductionContinuationState(state, plan, execution, kerf) {
    if (state?.version !== 2 || replayProductionExecution(state, plan, execution, kerf).remainingFeasible) {
        throw new Error("Jatkosuunnitelma vaatii kelvollisen pysähtyneen V2-toteuman.");
    }
    const input = createProductionContinuationInput(state, plan, execution, kerf);
    const continuationPlan = createProductionContinuationPlan(state, plan, execution, kerf);
    if (!continuationPlan.complete) throw new Error("Täydellistä validoitua jatkosuunnitelmaa ei löytynyt. Työ säilyy pysähtyneenä.");
    const next = { version: 3, planDigest: state.planDigest,
        events: state.events.map(event => ({ ...event, actualSourceIds: [...event.actualSourceIds] })),
        continuation: { digest: createProductionContinuationDigest(state, input, continuationPlan, kerf),
            baseEventCount: state.events.length,
            assignments: continuationPlan.assignments.map(assignment => ({ sourceId: assignment.sourceId, pieceIds: [...assignment.pieceIds] })),
            events: [] }
    };
    replayProductionContinuationExecution(next, plan, execution, kerf);
    return next;
}

// Ainoa V3-replay: alkuperäiset fyysiset salot → base-prefix → jatkon prefix.
// Reload käyttää vain tallennettua kohdistusta. Haku ei kuulu tähän polkuun.
function replayProductionContinuationExecution(state, plan, execution, kerf) {
    const continuation = state?.continuation;
    if (!isPlainObject(state) || state.version !== 3 || !isPlainObject(continuation) ||
        !Array.isArray(state.events) || continuation.baseEventCount !== state.events.length ||
        !Array.isArray(continuation.assignments) || !Array.isArray(continuation.events)) {
        throw new Error("Virheellinen jatkosuunnitelman toteumatila.");
    }
    const base = { version: 2, planDigest: state.planDigest, events: state.events };
    const baseReplay = replayProductionExecution(base, plan, execution, kerf);
    if (baseReplay.remainingFeasible || !baseReplay.hasDeviation) throw new Error("Jatkon alkuperäinen etuliite ei ole pysähtynyt.");
    const input = createProductionContinuationInput(base, plan, execution, kerf);
    const continuationPlan = evaluateProductionContinuationPlan(input, continuation.assignments, kerf);
    if (continuation.digest !== createProductionContinuationDigest(base, input, continuationPlan, kerf)) {
        throw new Error("Jatkosuunnitelman identiteetti ei vastaa toteumaa ja kappalekohdistusta.");
    }
    const operations = continuationPlan.execution.operations;
    if (continuation.events.length > operations.length) throw new Error("Jatkossa on liikaa kuittauksia.");
    const ledger = new Map(baseReplay.bars.map(bar => [bar.id, bar]));
    const completedPieceIds = input.completedPieces.map(piece => piece.pieceId);
    continuation.events.forEach((event, index) => {
        const operation = operations[index];
        if (!isPlainObject(event) || event.type !== "operation-completed" || event.operationId !== operation.id ||
            typeof event.completedAt !== "string" || !Number.isFinite(Date.parse(event.completedAt)) ||
            !Array.isArray(event.actualSourceIds) || event.actualSourceIds.length !== operation.sources.length ||
            event.actualSourceIds.some((id, slot) => id !== operation.sources[slot].id)) {
            throw new Error("Jatkon kuittaus ei vastaa seuraavaa suunniteltua työvaihetta ja sen lähteitä.");
        }
        applyProductionOperation(ledger, operation, event.actualSourceIds, kerf);
        completedPieceIds.push(...operation.pieces.map(piece => piece.pieceId));
    });
    const allIds = new Set(input.allPieces.map(piece => piece.pieceId));
    if (new Set(completedPieceIds).size !== completedPieceIds.length || completedPieceIds.some(id => !allIds.has(id))) {
        throw new Error("Toteuma kahdentaa kappaleen tai sisältää vieraan kappaleen.");
    }
    const continuationComplete = continuation.events.length === operations.length;
    if (continuationComplete && completedPieceIds.length !== allIds.size) throw new Error("Valmis jatko ei kata koko alkuperäistä kysyntää.");
    const conflict = findRemainingProductionConflict(ledger, continuationPlan.execution, continuation.events.length, kerf);
    if (conflict) throw new Error("Jatkon fyysinen toteuma on ristiriitainen: " + conflict.reason);
    return { bars: [...ledger.values()], hasDeviation: true, remainingFeasible: true, conflict: null,
        complete: continuationComplete, continuationComplete, completedPieceIds,
        continuationExecution: continuationPlan.execution };
}

function discardProductionContinuationState(state, plan, execution, kerf) {
    replayProductionContinuationExecution(state, plan, execution, kerf);
    if (state.continuation.events.length) throw new Error("Kirjattua jatkosuunnitelmaa ei voi hylätä.");
    return { version: 2, planDigest: state.planDigest,
        events: state.events.map(event => ({ ...event, actualSourceIds: [...event.actualSourceIds] })) };
}

function recordProductionSourceDeviation(state, plan, execution, kerf, actualSourceIds, completedAt = new Date().toISOString()) {
    if (state?.version === 3) throw new Error("Jatkosuunnitelmassa kuitataan vain sen suunnitellut fyysiset lähteet.");
    const replay = replayProductionExecution(state, plan, execution, kerf);
    if (!replay.remainingFeasible || replay.complete) throw new Error("Pysäytettyä tai valmista työtä ei voi jatkaa.");
    const operation = execution.operations[state.events.length];
    const next = { ...state, version: 2, events: [...state.events, {
        type: "operation-completed", operationId: operation.id, completedAt, actualSourceIds: [...actualSourceIds]
    }] };
    // Havainto tallennetaan myös, jos vasta TULEVA työ muuttui mahdottomaksi.
    replayProductionExecution(next, plan, execution, kerf);
    return next;
}

function getProductionSourceAlternatives(state, plan, execution, kerf, slot) {
    if (state?.version === 3) return [];
    const replay = replayProductionExecution(state, plan, execution, kerf);
    const operation = execution.operations[state.events.length];
    if (!operation || !replay.remainingFeasible || !Number.isInteger(slot) || !operation.sources[slot]) return [];
    return replay.bars.filter(bar => {
        const ids = operation.sources.map(source => source.id);
        if (ids.includes(bar.id)) return false;
        ids[slot] = bar.id;
        try { applyProductionOperation(new Map(replay.bars.map(b => [b.id, b])), operation, ids, kerf); return true; }
        catch { return false; }
    });
}

function createExecutedMaterialPlan(state, plan, execution, kerf) {
    const replay = replayProductionExecution(state, plan, execution, kerf);
    if (!replay.complete || !replay.remainingFeasible) throw new Error("Kaikkien työvaiheiden pitää olla fyysisesti kelvollisina kuitattuja ennen työn päättämistä.");
    return { ...plan, bars: replay.bars.filter(bar => bar.groupedCuts.length).map(bar => ({ ...bar,
        remnantStatus: getRemnantStatus(bar.remaining, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings)
    })) };
}

function completeNextProductionOperation(state, plan, execution, completedAt = new Date().toISOString(), kerf) {
    if (state?.version === 3) {
        const replay = replayProductionContinuationExecution(state, plan, execution, kerf);
        if (replay.complete || typeof completedAt !== "string" || !Number.isFinite(Date.parse(completedAt))) {
            throw new Error("Seuraavaa jatkotyövaihetta ei voida kuitata.");
        }
        const operation = replay.continuationExecution.operations[state.continuation.events.length];
        const next = { ...state, continuation: { ...state.continuation, events: [...state.continuation.events, {
            type: "operation-completed", operationId: operation.id, completedAt,
            actualSourceIds: operation.sources.map(source => source.id)
        }] } };
        replayProductionContinuationExecution(next, plan, execution, kerf);
        return next;
    }
    if (!isValidProductionExecutionState(state, plan, execution, kerf) || state.events.length >= execution.operations.length ||
        typeof completedAt !== "string" || !Number.isFinite(Date.parse(completedAt))) {
        throw new Error("Seuraavaa työvaihetta ei voida kuitata.");
    }
    if (state.version === 2 && !replayProductionExecution(state, plan, execution, kerf).remainingFeasible) {
        throw new Error("Työ on pysäytetty. Jäljellä oleva suunnitelma vaatii uudelleenoptimoinnin.");
    }
    const operation = execution.operations[state.events.length];
    return { ...state, events: [...state.events, {
        type: "operation-completed", operationId: operation.id, completedAt,
        actualSourceIds: operation.sources.map(source => source.id)
    }] };
}

function undoLatestProductionOperationState(state, plan, execution, kerf) {
    if (state?.version === 3) {
        replayProductionContinuationExecution(state, plan, execution, kerf);
        if (!state.continuation.events.length) throw new Error("Jatkon undo-raja saavutettu. Tyhjä jatko voidaan hylätä erikseen.");
        return { ...state, continuation: { ...state.continuation, events: state.continuation.events.slice(0, -1) } };
    }
    if (!isValidProductionExecutionState(state, plan, execution, kerf) || state.events.length === 0) {
        throw new Error("Peruttavaa työvaihetta ei ole.");
    }
    return { ...state, events: state.events.slice(0, -1) };
}

// Fyysisen työn identiteetti: kappale-ID ja salon lyheneminen vaihtuvat jokaisella
// toistolla. Tilaus/aukko sen sijaan voi muuttaa nimeämistä, joten se katkaisee ryhmän.
function areProductionOperationsRepeatable(previous, next) {
    const identity = operation => JSON.stringify([
        operation.kind, operation.length, operation.compatibilityGroup, operation.maxStackSize,
        operation.sources.map(source => [source.id, source.profileType, source.color ?? null]),
        operation.pieces.map(piece => [piece.sourceId, piece.profileType, piece.color ?? null,
            piece.length, piece.quantity, piece.orderId, piece.openingId ?? null])
    ]);
    return identity(previous) === identity(next);
}

function createProductionOperationView(execution, completedCount) {
    const operations = execution.operations;
    if (!Number.isSafeInteger(completedCount) || completedCount < 0 || completedCount > operations.length) {
        throw new Error("Virheellinen työvaiheiden etenemiskohta.");
    }
    const groups = [];
    operations.forEach((operation, index) => {
        const group = groups.at(-1);
        if (group && areProductionOperationsRepeatable(operations[index - 1], operation)) {
            group.end = index + 1;
            group.total++;
        } else {
            groups.push({ start: index, end: index + 1, total: 1 });
        }
    });
    const group = groups.find(group => group.start <= completedCount && completedCount < group.end);
    return {
        groups,
        current: operations[completedCount] ?? null,
        currentGroup: group ? { ...group, completed: completedCount - group.start } : null,
        previous: operations.slice(Math.max(0, completedCount - 3), completedCount),
        // Toistot näkyvät pääkortin laskurissa; esikatselu jatkaa koko ryhmän jälkeen.
        next: group ? operations.slice(group.end, group.end + 3) : []
    };
}

function groupWorkerPreparationSources(manifest, profileTypes) {
    const groups = new Map();
    for (const source of manifest) {
        if (!profileTypes.includes(source.profileType)) continue;
        const key = JSON.stringify([source.profileType, source.color, source.origin]);
        if (!groups.has(key)) groups.set(key, {
            profileType: source.profileType, color: source.color, origin: source.origin, sources: []
        });
        groups.get(key).sources.push(source);
    }
    return [...groups.values()];
}

function renderProductionDetails(plan, productionState) {
    if (!plan.batch) return "";
    const orders = getOrdersFromForm();
    const selected = getPlanOrders(plan, orders);
    const kerf = Number(document.getElementById("kerf").value);
    const originalExecution = createProductionExecution(plan, orders, kerf);
    if (!isValidProductionExecutionState(productionState, plan, originalExecution, kerf)) {
        throw new Error("Sahausten toteumatila ei vastaa nykyistä suunnitelmaa.");
    }
    const manifest = createWorkerSourceManifest(plan, originalExecution);
    const physical = replayProductionExecution(productionState, plan, originalExecution, kerf);
    const isContinuation = productionState.version === 3;
    const execution = isContinuation ? physical.continuationExecution : originalExecution;
    const events = isContinuation ? productionState.continuation.events : productionState.events;
    const basePieceCount = isContinuation ? originalExecution.operations.slice(0, productionState.events.length)
        .reduce((sum, operation) => sum + operation.pieces.length, 0) : 0;
    const continuationPieceCount = isContinuation ? execution.operations.reduce((sum, operation) => sum + operation.pieces.length, 0) : 0;
    // Numerot tulevat aina alkuperäisestä manifestista. Jatkon valmistelu käyttää
    // sen omia lähteitä ja niiden ensimmäisiä lähtöpituuksia, ei uusia numeroita.
    const continuationSources = new Map();
    if (isContinuation) execution.operations.forEach(operation => operation.sources.forEach(source => {
        if (!continuationSources.has(source.id)) continuationSources.set(source.id, source);
    }));
    const preparationManifest = isContinuation ? manifest.filter(source => continuationSources.has(source.sourceId)).map(source => ({
        ...source, sourceLength: continuationSources.get(source.sourceId).before,
        origin: continuationSources.get(source.sourceId).origin
    })) : manifest;
    const workerSourceById = new Map(manifest.map(source => [source.sourceId, source]));
    const score = scoreCompleteMaterialTransitionPlan(adaptStoredPlanForVerification(plan), PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    const count = normalizeOrderCuts(selected).reduce((n, cut) => n + cut.quantity, 0);
    const names = new Map(orders.map(o => [o.id, o.name || o.id]));
    const completedCount = events.length;
    const view = createProductionOperationView(execution, completedCount);
    const { current, currentGroup } = view;
    const cutOperations = execution.operations.filter(operation => operation.kind === "cut");
    const blockText = {
        verticalProfile: { title: "PYSTY", preparation: "Valmistele Pysty-profiilin salot" },
        closingProfile: { title: "VASTE", preparation: "Valmistele Vasteprofiilin salot" },
        horizontalProfile: { title: "VAAKA", preparation: "Valmistele Vaaka-profiilin salot" },
        uProfile: { title: "U-PROFIILI", preparation: "Valmistele U-profiilin salot" },
        rails: { title: "KISKOT", preparation: "Valmistele kiskot" }
    };
    const operationBlock = operation => {
        const blocks = [...new Map(operation.sources.map(source => {
            const block = PRODUCTION_PLANNING.getProfileBlock(source.profileType);
            return [block.id, block];
        })).values()];
        if (blocks.length !== 1) throw new Error("Sahausoperaatio ylittää profiiliblokin.");
        return blocks[0];
    };
    const activeBlock = current === null ? null : operationBlock(current);
    const activeBlockOperations = activeBlock === null ? [] : execution.operations.filter(operation =>
        operationBlock(operation).id === activeBlock.id);
    const activeBlockCompleted = activeBlock === null ? 0 : execution.operations.slice(0, completedCount).filter(operation =>
        operationBlock(operation).id === activeBlock.id).length;
    const workerNumber = sourceId => workerSourceById.get(sourceId).workerNumber;
    const sourceLabel = id => `${escapeHtml(PROFILE_TYPES[workerSourceById.get(id).profileType].label)} ${workerNumber(id)}`;
    const differenceText = (operation, event = events[execution.operations.indexOf(operation)]) => {
        if (!event) return "";
        return operation.sources.flatMap((source, slot) => event.actualSourceIds[slot] === source.id ? [] :
            [`<strong class="production-source-difference">Suunniteltu ${sourceLabel(source.id)} → toteutunut ${sourceLabel(event.actualSourceIds[slot])}</strong>`]).join("; ");
    };
    const actualBalances = physical.hasDeviation ? `<details class="plan-summary production-actual-balances" open>
        <summary>Toteutuneiden sahausten materiaalitase</summary>
        <p>Alla oleva sahaussuunnitelma on alkuperäinen. Nämä pituudet perustuvat kirjattuihin sahauksiin.</p>
        <ul>${physical.bars.map(bar => `<li>${sourceLabel(bar.id)} · ${escapeHtml(getMaterialColorLabel(bar.color))}:
            ${bar.groupedCuts.length ? `${bar.groupedCuts.length} kpl tehty · nimellinen jäljellä ${formatMillimeters(bar.nominalRemaining)} · turvallinen jäljellä ${formatMillimeters(bar.remaining)} · sahahukka ${formatMillimeters(bar.waste)}`
                : `käyttämätön · ${formatMillimeters(bar.sourceLength)}`}</li>`).join("")}</ul></details>` : "";
    const conflictNotice = physical.remainingFeasible ? "" : `<div class="validation-message" role="alert">
        <strong>Työ pysäytetty</strong><p>Poikkeama on tallennettu. ${sourceLabel(physical.conflict.sourceId)} ei pysty toteuttamaan jäljellä olevaa työvaihetta ${execution.operations.find(operation => operation.id === physical.conflict.operationId).number}.
        ${escapeHtml(physical.conflict.reason)} Alkuperäistä suunnitelmaa ei voi jatkaa sellaisenaan. Jo tehdyt kappaleet säilyvät. Ohjelma voi yrittää muodostaa jatkosuunnitelman tekemättömille kappaleille.</p>
        <button type="button" onclick="activateCurrentProductionContinuationFromUi(this)">MUODOSTA JATKOSUUNNITELMA</button>
        <p>Peru viimeisin kuittaus vain, jos kirjaus oli virheellinen. Peruminen ei palauta fyysisesti sahattua materiaalia.</p></div>`;
    const changeableSlots = !isContinuation && current && physical.remainingFeasible ? current.sources.flatMap((source, slot) => {
        const alternatives = getProductionSourceAlternatives(productionState, plan, execution, kerf, slot);
        return alternatives.length ? [{ source, slot, alternatives }] : [];
    }) : [];
    const deviationForm = changeableSlots.length ? `<details class="production-source-deviation">
        <summary>Käytin eri salkoa</summary>
        <p>Kirjaa yksi korvattu salko. Kirjaus kuittaa tämän työvaiheen; alkuperäinen suunnitelma säilyy.</p>
        <label>Suunniteltu salko<select id="deviationPlannedSlot" onchange="updateProductionSourceChoices()">${changeableSlots.map(({ source, slot }) =>
            `<option value="${slot}">${sourceLabel(source.id)}</option>`).join("")}</select></label>
        <label>Toteutunut salko<select id="deviationActualSource">${changeableSlots[0].alternatives.map(bar =>
            `<option value="${escapeHtml(bar.id)}">${sourceLabel(bar.id)} · jäljellä ${formatMillimeters(bar.nominalRemaining)}</option>`).join("")}</select></label>
        <p>Valinta mahtuu tähän työvaiheeseen. Jos myöhempi työ muuttuu mahdottomaksi, kirjaus tallentuu ja työ pysähtyy.</p>
        <button type="button" onclick="completeCurrentProductionDeviation()">KIRJAA TOTEUTUNUT TYÖVAIHE</button>
        </details>` : "";
    const sourceChips = operation => {
        const mixedProfiles = new Set(operation.sources.map(source => source.profileType)).size > 1;
        return operation.sources.map(source => {
            const profile = mixedProfiles
                ? `<span>${escapeHtml(PROFILE_TYPES[source.profileType].label)}</span>` : "";
            return `<strong class="worker-source-chip${mixedProfiles ? " worker-source-chip--profiled" : ""}">${profile}${workerNumber(source.id)}</strong>`;
        }).join("");
    };
    const operationTitle = operation => operation.kind === "cut"
        ? `Sahaus ${cutOperations.indexOf(operation) + 1} / ${cutOperations.length}`
        : `Loppukappaleen poiminta · työvaihe ${operation.number} / ${execution.operations.length}`;
    const operationOrders = operation => [...new Set(operation.pieces.map(piece => {
        const opening = piece.openingId == null ? "" : ` · aukko ${escapeHtml(piece.openingId)}`;
        return `${escapeHtml(names.get(piece.orderId) || piece.orderId)}${opening}`;
    }))].join("; ");
    const preparation = activeBlock === null
        ? `<section class="worker-preparation worker-preparation--complete"><h2>Kaikki profiiliblokit valmisteltu ✓</h2></section>`
        : (() => {
            const groups = groupWorkerPreparationSources(preparationManifest, activeBlock.profileTypes);
            const sourceCount = groups.reduce((count, group) => count + group.sources.length, 0);
            const text = blockText[activeBlock.id] ?? {
                title: activeBlock.id.toUpperCase(), preparation: "Valmistele profiilin salot"
            };
            return `<details class="worker-preparation" open><summary>${text.preparation} · ${sourceCount} kpl</summary>
                <p>${isContinuation ? "Jatkosuunnitelman aktiivisen profiiliblokin materiaalitarve jatkon lähtöpituuksineen. Säilytä saloissa alkuperäiset numerot." : "Koko aktiivisen profiiliblokin materiaalitarve. Merkitse fyysisiin salkoihin alla olevat numerot."}</p>
                <div class="worker-source-manifest">${groups.map(group => `<section class="worker-material-group">
                    <h3>${escapeHtml(PROFILE_TYPES[group.profileType].label)} · ${escapeHtml(getMaterialColorLabel(group.color))}</h3>
                    <p><strong>${group.origin === "new" ? "Uudet salot" : group.origin === "same-run-remnant" ? "Jatkoleikattavat salot" : "Olemassa olevat jäännökset"} · ${group.sources.length} kpl</strong></p>
                    ${group.origin === "new"
                        ? `<p>Salot ${group.sources.map(source => source.workerNumber).join(", ")}</p><p>${[...new Set(group.sources.map(source => formatMillimeters(source.sourceLength)))].join(" / ")}</p>`
                        : `<ul>${group.sources.map(source => `<li>Salko ${source.workerNumber} · ${formatMillimeters(source.sourceLength)}</li>`).join("")}</ul>`}
                </section>`).join("")}</div></details>`;
        })();
    const currentCard = current === null
        ? `<section class="production-current production-current--complete"><h2>Kaikki työvaiheet tehty ✓</h2>
            <p>Voit tarkistaa salot ja päättää työn, kun jokainen fyysinen salko on merkitty valmiiksi.</p></section>`
        : `<section class="production-current" data-operation-id="${escapeHtml(current.id)}">
            <h2 class="production-block-title">${blockText[activeBlock.id]?.title ?? escapeHtml(activeBlock.id)}</h2>
            <p class="production-operation-progress">${operationTitle(current)}</p>
            <p class="production-action-label">${!physical.remainingFeasible ? "ÄLÄ JATKA TYÖTÄ" : current.kind === "cut" ? "SAHAA" : "POIMI"}</p>
            <div class="production-cut-length">${formatMillimeters(current.length)}</div>
            <p class="production-source-label">SALOT · ${current.sources.length} kpl</p>
            <div class="worker-source-chips" aria-label="Käytettävät salot">${sourceChips(current)}</div>
            <p class="production-piece-count">Tuota ${current.pieces.length} kappaletta</p>
            <p class="production-operation-secondary">${current.sources.map(source => escapeHtml(PROFILE_TYPES[source.profileType].label)).filter((value, index, values) => values.indexOf(value) === index).join(" / ")} · ${current.sources.map(source => escapeHtml(getMaterialColorLabel(source.color))).filter((value, index, values) => values.indexOf(value) === index).join(" / ")}<br>${operationOrders(current)}</p>
            ${currentGroup.total > 1 ? `<p class="production-repeat-progress" role="status">${currentGroup.completed} / ${currentGroup.total} tehty</p>
                <p class="production-repeat-remaining">${currentGroup.total - currentGroup.completed === 1
                    ? "1 samanlainen työvaihe jäljellä"
                    : `${currentGroup.total - currentGroup.completed} samanlaista työvaihetta jäljellä`}</p>` : ""}
            <button class="operation-completion-button" type="button" onclick="completeCurrentProductionOperation()" ${physical.remainingFeasible ? "" : "disabled"}>
                ${!physical.remainingFeasible ? "JATKAMINEN ESTETTY" : current.kind === "cut" ? "SAHAUS TEHTY" : "POIMINTA TEHTY"}
            </button>
            ${deviationForm}
        </section>`;
    const completedOperations = execution.operations.slice(0, completedCount);
    const completedDetails = completedOperations.length
        ? `<details class="production-completed"><summary>Tehdyt työvaiheet · ${completedOperations.length}</summary><ol>
            ${completedOperations.map(operation => `<li>${operationTitle(operation)} · ${formatMillimeters(operation.length)} · ${operation.sources.map(source => `${escapeHtml(PROFILE_TYPES[source.profileType].label)} ${workerNumber(source.id)}`).join(", ")} ${differenceText(operation)}</li>`).join("")}
            </ol></details>` : "";
    const baseDetails = isContinuation ? `<details class="production-completed"><summary>Alkuperäisen suunnitelman kirjatut työvaiheet · ${productionState.events.length}</summary><ol>
        ${originalExecution.operations.slice(0, productionState.events.length).map((operation, index) =>
            `<li>Työvaihe ${operation.number} · ${formatMillimeters(operation.length)} · ${operation.sources.map(source => sourceLabel(source.id)).join(", ")} ${differenceText(operation, productionState.events[index])}</li>`).join("")}</ol></details>` : "";
    const previewSources = operation => {
        const rows = [];
        for (const source of operation.sources) {
            const last = rows.at(-1);
            if (last && last.profileType === source.profileType && last.color === source.color) {
                last.numbers.push(workerNumber(source.id));
            } else {
                rows.push({ profileType: source.profileType, color: source.color, numbers: [workerNumber(source.id)] });
            }
        }
        return rows.map(row => `${escapeHtml(PROFILE_TYPES[row.profileType].label)} · ${escapeHtml(getMaterialColorLabel(row.color))} · salot ${row.numbers.join(", ")}`).join("; ");
    };
    const preview = (operations, done) => operations.length ? `<aside class="production-nearby ${done ? "production-previous" : "production-next"}" aria-label="${done ? "Viimeksi tehdyt työvaiheet" : "Seuraavat työvaiheet"}">
        <h3>${done ? "Viimeksi tehty" : currentGroup?.total > 1 ? "Toistoryhmän jälkeen" : "Seuraavaksi"}</h3>
        <ol>${operations.map(operation => `<li data-preview-operation-id="${escapeHtml(operation.id)}">
            <strong>${done ? "✓ " : ""}${operationTitle(operation)} · ${formatMillimeters(operation.length)}</strong>
            <span>${previewSources(operation)}</span>
            ${done ? differenceText(operation) : ""}
            <span>${operationOrders(operation)}</span></li>`).join("")}</ol></aside>` : "";
    return `<section class="plan-summary"><h2>Tuotantobatch · ${count} kpl${count > plan.batch.settings.maxBatchPieces ? " · oversized" : ""}</h2>
        <p>Kokonaiset tilaukset; yhtäkään tilausta ei jaeta. Jonoon jää ${orders.length - selected.length} tilausta.</p>
        <ul>${selected.map(o => `<li>${escapeHtml(o.name || o.id)} · ${normalizeOrderCuts([o]).reduce((n, c) => n + c.quantity, 0)} kpl</li>`).join("")}</ul>
        <p>Min / tavoite / max: ${plan.batch.settings.minBatchPieces} / ${plan.batch.settings.targetBatchPieces} / ${plan.batch.settings.maxBatchPieces}.
        Valinta: nykyinen materiaalipiste; tavoitekoon etäisyys vain tasatilanteessa. Materiaaliratkaisu on heuristinen.</p>
        <p>${physical.hasDeviation ? "Alkuperäisen suunnitelman materiaalipiste" : "Materiaalipiste"} ${score.totalCostEquivalent.toFixed(1)}: lähdearvo ${score.sourceValueEquivalent.toFixed(1)}
        − jäännöskrediitti ${score.recoveredRemnantValueEquivalent.toFixed(1)} − kerf-krediitti ${score.kerfRecoveredValueEquivalent.toFixed(1)}
        + jäännöskäsittely ${score.remnantHandlingPenaltyEquivalent.toFixed(1)} + uuden jäännöksen luonti ${score.newStockRemnantCreationPenaltyEquivalent.toFixed(1)}
        + suuri romu ${score.largeScrapPenaltyEquivalent.toFixed(1)}. Yksikkö: materiaalin ekvivalenttipituus, ei euro.</p></section>
        ${preparation}
        <section class="production-execution" aria-label="Sahausten eteneminen">
            ${isContinuation ? `<h2>JATKOSUUNNITELMA</h2><p>Jatkon alkaessa tehty ${basePieceCount} kappaletta, jäljellä ${continuationPieceCount} kappaletta.
                Koko työstä nyt tehty ${physical.completedPieceIds.length} / ${count} kappaletta. Alkuperäinen suunnitelma säilyy vertailuna.</p>` : ""}
            <p class="production-total-progress" aria-live="polite">${activeBlock === null
                ? `Tehty ${completedCount} / ${execution.operations.length} työvaihetta`
                : `${blockText[activeBlock.id]?.title ?? escapeHtml(activeBlock.id)} ${activeBlockCompleted} / ${activeBlockOperations.length} · ${isContinuation ? "jatko" : "koko batch"} ${completedCount} / ${execution.operations.length}`}</p>
            ${conflictNotice}${preview(view.previous, true)}${currentCard}${preview(view.next, false)}${completedDetails}${baseDetails}${actualBalances}
            <button class="operation-undo-button" type="button" onclick="undoLatestProductionOperation()" ${completedCount ? "" : "disabled"}>Peru viimeisin kuittaus</button>
            ${isContinuation ? `${completedCount ? "" : '<button type="button" onclick="discardCurrentProductionContinuation()">HYLKÄÄ JATKOSUUNNITELMA</button>'}
                <p>Peruminen ja tyhjän jatkon hylkäys korjaavat kirjauksia. Ne eivät palauta fyysisesti sahattua materiaalia.</p>` : ""}
            <p id="operationStatus" class="finalization-status" aria-live="polite"></p>
        </section>
        <details class="plan-summary"><summary>Tuotantomittarit · ${execution.metrics.cutOperationCount} sahausliikettä</summary>
        <p>Mittavasteen siirrot (ensimmäinen asetus mukana): ${execution.metrics.stopPositionChanges}. Nippukapasiteetin käyttö: ${Math.round(execution.metrics.bundleUtilization * 100)} %.
        Sahausliike on käynnistetyn sahan terän laskeminen leikkuuseen. Mittavaste asetetaan ensimmäiseen sahausmittaan ja siirretään mitan muuttuessa. Tuotantomittareita ei käytetä pisteytyksessä.</p></details>`;
}
