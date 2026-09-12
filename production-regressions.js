// Käsin määritelty materiaalijako: optimizer ei saa peittää väärän salon vaikutusta.
function createProductionSourceDeviationFixture(blocked = false, kerf = 3, allowances = MATERIAL.MATERIAL_CAPACITY_DEFAULTS) {
    const lengths = [[1000], [1000], [blocked ? 5000 : 2000], [1000], [800], [700], [1000]];
    const orders = [createOrderInput("deviation", "Väärä salko", "black", {
        verticalProfile: lengths.flatMap(items => items.map(length => ({ length: String(length), quantity: "1", openingId: "A" })))
    })];
    const plan = { complete: true, remainingItems: [], batch: { version: 1, orderIds: ["deviation"],
        settings: { minBatchPieces: 1, targetBatchPieces: 7, maxBatchPieces: 10 } },
        bars: lengths.map((items, index) => {
            const groupedCuts = items.map(length => ({ length, quantity: 1 }));
            const capacity = MATERIAL.calculateMaterialBarCapacity(6000, groupedCuts, kerf, allowances);
            return { id: "bar-" + (index + 1), number: index + 1, profileType: "verticalProfile", color: "black",
                source: "new", sourceLength: 6000, ...capacity, groupedCuts,
                remnantStatus: getRemnantStatus(capacity.remaining, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings) };
        }) };
    const execution = createProductionExecution(plan, orders, kerf);
    // Schedulerin nipussa ovat fyysiset salot 1/2/4/7. Slot-järjestystä ei muokata testissä.
    return { plan, orders, execution, kerf };
}

// Vain erillisellä testi-alkuperällä käsin kutsuttava loader; tiedostoa ei ladata sovelluksessa.
function loadProductionSourceDeviationTest(blocked = false) {
    const fixture = createProductionSourceDeviationFixture(blocked);
    const state = createStoredPlanSemanticRegressionState();
    Object.assign(state, { orders: fixture.orders, generatedPlan: fixture.plan,
        executionState: createInitialProductionExecutionState(fixture.plan, fixture.execution),
        completedBarIds: [], remnantRows: [],
        stockProfileRows: Object.keys(PROFILE_TYPES).map(profileType => ({ profileType, color: "black", quantity: "7", unlimited: false, additional: false }))
    });
    if (!isValidStoredWorkState(state) || !writeWorkStateSnapshot(state)) throw new Error("Testityötä ei voitu tallentaa.");
    return restoreSavedWorkState();
}

function runProductionSourceDeviationRegressionTests() {
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const reject = (fn, message) => { let threw = false; try { fn(); } catch { threw = true; } assert(threw, message); };
    for (const blocked of [false, true]) {
        const { plan, execution, kerf } = createProductionSourceDeviationFixture(blocked);
        const initial = createInitialProductionExecutionState(plan, execution);
        const before = JSON.stringify({ plan, execution, initial });
        // Siirrytään nipulle ilman sitä ennen mahdollisesti tehtyä bar-3:n leikkausta.
        const bundleIndex = execution.operations.findIndex(op => op.sources.some(s => s.id === "bar-7"));
        assert(bundleIndex === 0, "Fixture alkaa neljän salon nipulla");
        const actual = execution.operations[0].sources.map(s => s.id === "bar-7" ? "bar-3" : s.id);
        const state = recordProductionSourceDeviation(initial, plan, execution, kerf, actual, "2026-09-10T10:00:00Z");
        const replay = replayProductionExecution(state, plan, execution, kerf);
        assert(state.version === 2 && state.planDigest === initial.planDigest, "V2 toteuma säilyttää alkuperäisen digestin");
        assert(replay.hasDeviation && replay.remainingFeasible === !blocked, "Jäljellä olevan planin fyysinen kelvollisuus");
        assert(replay.bars.find(b => b.id === "bar-3").remaining === 4976 &&
            replay.bars.find(b => b.id === "bar-7").nominalRemaining === 6000, "Kulutus kohdistuu fyysiseen salon 3, salon 7 jää koskematta");
        const restored = JSON.parse(JSON.stringify(state));
        assert(isValidProductionExecutionState(restored, plan, execution, kerf), "Myös pysähtynyt toteuma kelpaa reloadiin");
        assert(JSON.stringify(replayProductionExecution(restored, plan, execution, kerf)) === JSON.stringify(replay), "Reload johtaa saman taseen ja eston");
        const undone = undoLatestProductionOperationState(restored, plan, execution, kerf);
        assert(!replayProductionExecution(undone, plan, execution, kerf).hasDeviation, "Undo palauttaa alkuperäisen fyysisen taseen");
        if (blocked) {
            reject(() => completeNextProductionOperation(state, plan, execution, undefined, kerf), "Estettyä työtä ei jatketa");
            reject(() => createExecutedMaterialPlan(state, plan, execution, kerf), "Estettyä työtä ei finalisoida");
            const forged = JSON.parse(JSON.stringify(state));
            forged.events.push({ type: "operation-completed", operationId: execution.operations[1].id,
                completedAt: "2026-09-10T10:01:00Z", actualSourceIds: ["bar-7"] });
            assert(!isValidProductionExecutionState(forged, plan, execution, kerf), "Pysähdystä ei voi kiertää myöhemmällä korjaavalla poikkeamalla tallenteessa");
        } else {
            let done = state;
            while (done.events.length < execution.operations.length) done = completeNextProductionOperation(done, plan, execution, undefined, kerf);
            const actualPlan = createExecutedMaterialPlan(done, plan, execution, kerf);
            const laterUndo = undoLatestProductionOperationState(done, plan, execution, kerf);
            assert(replayProductionExecution(laterUndo, plan, execution, kerf).hasDeviation && laterUndo.events.length === done.events.length - 1,
                "Myöhemmän normaalikuittauksen undo säilyttää aiemman lähdepoikkeaman");
            assert(actualPlan.bars.length === 6 && !actualPlan.bars.some(b => b.id === "bar-7"), "Käyttämätöntä salkoa ei kuluteta varastosta");
            assert(actualPlan.bars.find(b => b.id === "bar-3").remaining === 2972, "Koko toteuman turvallinen loppujäännös");
        }
        assert(JSON.stringify({ plan, execution, initial }) === before, "Plan, scheduler ja lähtöloki eivät mutatoidu");
        reject(() => recordProductionSourceDeviation(initial, plan, execution, kerf, actual.map(() => "bar-3")), "Samaa salkoa ei voi käyttää kahdesti nipussa");
        reject(() => recordProductionSourceDeviation(initial, plan, execution, kerf, actual.map(() => "unknown")), "Ulkopuolinen lähde hylätään");
    }
    for (const blocked of [false, true]) {
        const { plan, execution, kerf } = createProductionSourceDeviationFixture(blocked);
        const initial = createInitialProductionExecutionState(plan, execution);
        const first = completeNextProductionOperation(initial, plan, execution);
        const options = getProductionSourceAlternatives(first, plan, execution, kerf, 0);
        assert(options.some(bar => bar.id === "bar-1") === !blocked,
            "Jo sahatun salon tämänhetkinen pituus määrää valintakelpoisuuden");
        if (blocked) {
            reject(() => recordProductionSourceDeviation(first, plan, execution, kerf, ["bar-1"]),
                "Alkupituudeltaan sopiva mutta jo lyhentynyt salko hylätään");
        } else {
            const changed = recordProductionSourceDeviation(first, plan, execution, kerf, ["bar-1"]);
            const replay = replayProductionExecution(changed, plan, execution, kerf);
            assert(replay.bars.find(bar => bar.id === "bar-1").remaining === 2972 &&
                replay.bars.find(bar => bar.id === "bar-3").nominalRemaining === 6000,
                "Lähdevara vähenee kerran samasta fyysisestä salosta ja aiemman sahauksen kulutus säilyy");
            const restored = undoLatestProductionOperationState(changed, plan, execution, kerf);
            assert(restored.events.length === 1 && replayProductionExecution(restored, plan, execution, kerf).bars.find(bar => bar.id === "bar-1").remaining === 4976,
                "Poikkeaman undo säilyttää sitä edeltäneen tavallisen sahauksen");
        }
    }
    const setup = (sourceLength, lengths, color = "black", profileType = "verticalProfile", kerf = 3, allowances = MATERIAL.MATERIAL_CAPACITY_DEFAULTS) => {
        const fixture = createProductionSourceDeviationFixture(false, kerf, allowances);
        const bar = fixture.plan.bars[2];
        Object.assign(bar, { sourceLength, color, profileType, source: "remnant",
            groupedCuts: lengths.map(length => ({ length, quantity: 1 })) });
        Object.assign(bar, MATERIAL.calculateMaterialBarCapacity(sourceLength, bar.groupedCuts, kerf, allowances));
        bar.remnantStatus = getRemnantStatus(bar.remaining, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
        // Suorat core-kysyntärivit säilyttävät jokaisen kappaleen profiilin/värin.
        const cuts = fixture.plan.bars.flatMap(b => b.groupedCuts.map(c => ({ ...c, color: b.color, profileType: b.profileType, orderId: "deviation", openingId: "A" })));
        fixture.execution = PRODUCTION_PLANNING.schedule(PRODUCTION_PLANNING.attachPieces(fixture.plan, cuts), kerf);
        return fixture;
    };
    for (const fixture of [setup(6000, [2000], "gray"), setup(6000, [2000], "black", "horizontalProfile"),
        setup(1023, [500]), setup(1000, [500], "black", "verticalProfile", 3, { sourceCapacityAllowance: 0, pieceCapacityAllowance: 0 })]) {
        const { plan, execution, kerf } = fixture;
        const initial = createInitialProductionExecutionState(plan, execution);
        const slot = execution.operations[0].sources.findIndex(s => s.id === "bar-7");
        assert(slot >= 0 && !getProductionSourceAlternatives(initial, plan, execution, kerf, slot).some(b => b.id === "bar-3"),
            "Väärä väri/profiili, riittämätön turvakapasiteetti ja cut→release eivät näy valintoina");
        const ids = execution.operations[0].sources.map(s => s.id === "bar-7" ? "bar-3" : s.id);
        reject(() => recordProductionSourceDeviation(initial, plan, execution, kerf, ids), "Myös suora virheellinen kirjaus hylätään");
    }
    for (const kerf of [0, 3.4]) {
        const { plan, execution } = setup(6000, [2000], "black", "verticalProfile", kerf);
        const initial = createInitialProductionExecutionState(plan, execution);
        const ids = execution.operations[0].sources.map(s => s.id === "bar-7" ? "bar-3" : s.id);
        let done = recordProductionSourceDeviation(initial, plan, execution, kerf, ids);
        while (done.events.length < execution.operations.length) done = completeNextProductionOperation(done, plan, execution, undefined, kerf);
        const actual = createExecutedMaterialPlan(done, plan, execution, kerf);
        const bar = actual.bars.find(b => b.id === "bar-3");
        assert(Math.abs(bar.nominalRemaining - (3000 - 2 * kerf)) < 1e-9 && Math.abs(bar.remaining - (2978 - 2 * kerf)) < 1e-9,
            "Nollakerf ja desimaalikerf säilyvät toteumassa");
        const inventory = createMaterialInventory({ stockLength: 6000,
            newStock: Object.keys(PROFILE_TYPES).map(profileType => ({ profileType, color: "black", unlimited: false, quantity: 7 })),
            remnants: [{ profileType: "verticalProfile", color: "black", length: 6000, quantity: 1 }] });
        const post = calculatePostOrderMaterialInventory(actual, inventory, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
        assert(post.newStock.find(s => s.profileType === "verticalProfile").quantity === 2 && !post.remnants.some(r => r.length === 6000) && post.remnants.some(r => r.length === bar.remaining),
            "Todella käytetty vanha jäännös kuluu kerran; käyttämätön uusi säilyy; uusi jäännös vastaa toteumaa");
        const invalid = JSON.parse(JSON.stringify(done));
        invalid.planDigest += "bad";
        assert(!isValidProductionExecutionState(invalid, plan, execution, kerf), "V2 hylkää vieraan digestin");
        invalid.planDigest = done.planDigest;
        invalid.events[0].completedAt = "invalid";
        assert(!isValidProductionExecutionState(invalid, plan, execution, kerf), "V2 hylkää virheellisen tapahtuman");
        invalid.events[0].completedAt = done.events[0].completedAt;
        invalid.version = 1;
        assert(!isValidProductionExecutionState(invalid, plan, execution, kerf), "V1:tä ei tulkita jälkikäteen poikkeamaskeemaksi");
    }
    assert(runProductionContinuationInputRegressionTests(), "Jatkolähtötilan regressiot");
    assert(runProductionContinuationPlanRegressionTests(), "Jatkosuunnitelman regressiot");
    assert(runProductionContinuationStateRegressionTests(), "Jatkon V3-tilakoneen regressiot");
    return true;
}

// Riippumaton tunnettu materiaalijako, ei optimizerin tämänhetkisen valinnan checkpoint.
function createProductionContinuationStateFixture(oldRemnant = false) {
    const fixture = createProductionSourceDeviationFixture(true);
    if (oldRemnant) {
        fixture.plan.bars[2].source = "remnant";
        fixture.execution = createProductionExecution(fixture.plan, fixture.orders, fixture.kerf);
    }
    const { plan, execution, kerf } = fixture;
    const base = recordProductionSourceDeviation(createInitialProductionExecutionState(plan, execution), plan, execution, kerf,
        execution.operations[0].sources.map(source => source.id === "bar-7" ? "bar-3" : source.id), "2026-09-12T09:00:00Z");
    const input = createProductionContinuationInput(base, plan, execution, kerf);
    const continuationPlan = evaluateProductionContinuationPlan(input, [
        { sourceId: "bar-7", pieceIds: ["piece-3-1"] },
        { sourceId: "bar-3", pieceIds: ["piece-5-1", "piece-6-1"] }
    ], kerf);
    const state = { version: 3, planDigest: base.planDigest, events: JSON.parse(JSON.stringify(base.events)), continuation: {
        digest: createProductionContinuationDigest(base, input, continuationPlan, kerf),
        baseEventCount: base.events.length, assignments: continuationPlan.assignments, events: []
    } };
    return { ...fixture, base, input, continuationPlan, state };
}

function runProductionContinuationStateRegressionTests() {
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const reject = (fn, message) => { let threw = false; try { fn(); } catch { threw = true; } assert(threw, message); };
    const copy = value => JSON.parse(JSON.stringify(value));
    const { plan, execution, kerf, base, input, continuationPlan, state } = createProductionContinuationStateFixture();
    const original = JSON.stringify({ plan, execution, base, state });
    const activated = createProductionContinuationState(base, plan, execution, kerf);
    assert(activated.version === 3 && isValidProductionExecutionState(activated, plan, execution, kerf), "Pysähtynyt V2 aktivoituu V3:ksi");
    for (const version of [1, 2]) reject(() => createProductionContinuationState({ ...base, version, events: [] }, plan, execution, kerf), "Jatko vaatii pysähtyneen V2:n");
    reject(() => createProductionContinuationState(state, plan, execution, kerf), "Toista jatkoa ei aktivoida");
    for (const mutate of [
        s => s.planDigest += "x", s => s.events[0].operationId += "x",
        s => s.events[0].completedAt = "2026-09-12T10:00:00Z",
        s => s.events[0].actualSourceIds.reverse(), s => s.continuation.baseEventCount++,
        s => s.continuation.digest += "x", s => s.continuation.assignments[0].sourceId = "foreign",
        s => s.continuation.assignments[0].pieceIds[0] = "piece-7-1",
        s => s.continuation.assignments[0].pieceIds.push("piece-3-1"),
        s => s.continuation.assignments.pop(), s => s.continuation.events.push({})
    ]) {
        const changed = copy(state); mutate(changed);
        assert(!isValidProductionExecutionState(changed, plan, execution, kerf), "Muutettu jatkotallenne hylätään");
    }
    const digest = (b = base, i = input, c = continuationPlan, k = kerf) => createProductionContinuationDigest(b, i, c, k);
    for (const mutate of [i => i.remainingPieces[0].pieceId += "x", i => i.remainingPieces[0].openingId += "x",
        i => i.physicalSources[0].sourceCapacityAllowance++, i => i.physicalSources[0].remaining--]) {
        const changed = copy(input); mutate(changed);
        assert(digest(base, changed) !== state.continuation.digest, "Digest sitoo kappaleet, provenancen ja fyysisen kapasiteetin");
    }
    const changedScheduler = copy(continuationPlan); changedScheduler.execution.operations[0].id += "x";
    assert(digest(base, input, changedScheduler) !== digest() && digest(base, input, continuationPlan, 3.4) !== digest(), "Digest sitoo schedulerin ja kerfin");
    const reorderedInput = Object.fromEntries(Object.entries(input).reverse());
    assert(digest(base, reorderedInput) === digest(), "Olioavainten järjestys ei muuta kanonista digestiä");
    const reSigned = copy(state);
    reSigned.continuation.assignments[0].sourceId = "bar-3";
    reSigned.continuation.digest = digest(base, input, { ...continuationPlan, assignments: reSigned.continuation.assignments });
    assert(!isValidProductionExecutionState(reSigned, plan, execution, kerf), "Uudelleen laskettu digest ei ohita kapasiteettia ja kohdistuksen validointia");
    const changedExecution = copy(execution); changedExecution.operations[1].pieces[0].openingId = "other";
    assert(!isValidProductionExecutionState(state, plan, changedExecution, kerf), "Reload hylkää muuttuneen alkuperäisen provenancen");
    const changedPlan = copy(plan); changedPlan.bars[0].sourceCapacityAllowance++;
    assert(!isValidProductionExecutionState(state, changedPlan, execution, kerf) && !isValidProductionExecutionState(state, plan, execution, 3.4), "Reload hylkää kapasiteetin ja kerfin muutoksen");
    reject(() => undoLatestProductionOperationState(state, plan, execution, kerf), "Tyhjä jatko ei ylitä undo-rajaa");
    const discarded = discardProductionContinuationState(state, plan, execution, kerf);
    assert(JSON.stringify(discarded) === JSON.stringify(base) && undoLatestProductionOperationState(discarded, plan, execution, kerf).events.length === 0,
        "Vasta erillinen hylkäys sallii alkuperäisen kirjauksen korjauksen");
    assert(JSON.stringify(replayProductionExecution(state, plan, execution, kerf).bars) === JSON.stringify(replayProductionExecution(base, plan, execution, kerf).bars), "Aktivointi/hylkäys ei muuta fyysistä tasetta");
    let current = state;
    for (let n = 0; n < continuationPlan.execution.operations.length; n++) {
        current = completeNextProductionOperation(current, plan, execution, "2026-09-12T11:00:00Z", kerf);
        const replay = replayProductionExecution(current, plan, execution, kerf);
        assert(JSON.stringify(current.events) === JSON.stringify(base.events), "Alkuperäinen prefix on jäädytetty");
        assert(JSON.stringify(replayProductionExecution(copy(current), plan, execution, kerf)) === JSON.stringify(replay), "Osittainen ja valmis V3 palautuvat identtisinä");
        const undone = undoLatestProductionOperationState(current, plan, execution, kerf);
        assert(undone.continuation.events.length === n && JSON.stringify(undone.events) === JSON.stringify(base.events), "Undo poistaa vain jatkon viimeisen eventin");
        reject(() => discardProductionContinuationState(current, plan, execution, kerf), "Kirjattua jatkoa ei hylätä");
    }
    const wrongSource = copy(current); wrongSource.continuation.events[0].actualSourceIds[0] = "bar-6";
    assert(!isValidProductionExecutionState(wrongSource, plan, execution, kerf), "Jatkossa hyväksytään vain suunnitellut fyysiset lähteet");
    reject(() => recordProductionSourceDeviation(state, plan, execution, kerf, ["bar-6"]), "Jatkon poikkeamaa ei tulkita V2:ksi");
    reject(() => completeNextProductionOperation(current, plan, execution, undefined, kerf), "Valmista jatkoa ei kuitata kahdesti");
    const replay = replayProductionExecution(current, plan, execution, kerf);
    assert(replay.complete && replay.continuationComplete && replay.conflict === null &&
        replay.completedPieceIds.slice().sort().join() === input.allPieces.map(p => p.pieceId).sort().join(), "Koko alkuperäinen kysyntä valmistuu kerran");
    const actual = createExecutedMaterialPlan(current, plan, execution, kerf);
    assert(actual.bars.length === 5 && new Set(actual.bars.map(b => b.id)).size === 5, "Yksi bar per oikeasti käytetty fyysinen lähde");
    const continued = actual.bars.find(b => b.id === "bar-3");
    assert(continued.sourceLength === 6000 && continued.nominalRemaining === 3491 && continued.remaining === 3468 && continued.waste === 9,
        "1000+800+700 käyttää yhden 6000 mm salon, kolmen leikkauksen kerfin ja alkuperäiset varat");
    assert(actual.bars.find(b => b.id === "bar-7").remaining === 976, "5000 mm jättää 976 mm turvallisen jäännöksen");
    assert(JSON.stringify({ plan, execution, base, state }) === original, "Siirtymät eivät mutatoi syötteitä");
    return true;
}

function runProductionContinuationInputRegressionTests() {
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const reject = (fn, message) => { let threw = false; try { fn(); } catch { threw = true; } assert(threw, message); };
    const clone = value => JSON.parse(JSON.stringify(value));
    const ids = pieces => pieces.map(piece => piece.pieceId);
    const fixture = createProductionSourceDeviationFixture(true);
    const { plan, execution, kerf } = fixture;
    const initial = createInitialProductionExecutionState(plan, execution);
    const state = recordProductionSourceDeviation(initial, plan, execution, kerf,
        execution.operations[0].sources.map(source => source.id === "bar-7" ? "bar-3" : source.id), "2026-09-10T10:00:00Z");
    const before = JSON.stringify({ plan, execution, initial, state });
    const input = createProductionContinuationInput(state, plan, execution, kerf);
    const originalPieces = execution.operations.flatMap(operation => operation.pieces);
    assert(JSON.stringify(input.allPieces) === JSON.stringify(originalPieces), "Alkuperäiset kappaleet ja koko provenance säilyvät schedulerin slottijärjestyksessä");
    assert(ids(input.completedPieces).join() === "piece-1-1,piece-2-1,piece-4-1,piece-7-1", "7 → 3 valmistaa suunnitellut neljä piece-ID:tä");
    assert(input.remainingPieces.map(piece => `${piece.pieceId}:${piece.length}`).join() === "piece-3-1:5000,piece-5-1:800,piece-6-1:700",
        "5000 mm kappale on edelleen tekemättä; jäljellä olevien järjestys säilyy");
    const completedIds = new Set(ids(input.completedPieces));
    const partition = [...input.completedPieces, ...input.remainingPieces];
    assert(partition.length === input.allPieces.length && new Set(ids(partition)).size === input.allPieces.length &&
        input.remainingPieces.every(piece => !completedIds.has(piece.pieceId)) &&
        input.allPieces.every(piece => partition.includes(piece)), "Completed ja remaining ovat alkuperäisen kappalejoukon erillinen, kattava jako");
    const physical = input.physicalSources.find(source => source.sourceId === "bar-3");
    assert(physical.source === "new" && physical.sourceLength === 6000 && physical.nominalRemaining === 4997 && physical.remaining === 4976 &&
        physical.sourceCapacityAllowance === 20 && physical.pieceCapacityAllowance === 1 && physical.carriedSourceCapacityAllowance === 21 &&
        physical.totalPieceCapacityAllowance === 1 && physical.totalCapacityAllowance === 21 && physical.waste === 3 &&
        JSON.stringify(physical.groupedCuts) === JSON.stringify([{ length: 1000, quantity: 1 }]), "Salon 3 alkuperä, toteutunut leikkaus ja fyysinen kapasiteetti säilyvät");
    const unused = input.physicalSources.find(source => source.sourceId === "bar-7");
    assert(unused.sourceLength === 6000 && unused.nominalRemaining === 6000 && unused.remaining === 5980 &&
        unused.carriedSourceCapacityAllowance === 20 && unused.groupedCuts.length === 0 && unused.waste === 0,
        "Käyttämätön salko 7 säilyy kokonaisena alkuperäisellä kapasiteetilla");
    assert(input.physicalSources.map(source => source.sourceId).join() === plan.bars.map(bar => bar.id).join() &&
        input.physicalSources.length === 7 && new Set(input.physicalSources.map(source => source.sourceId)).size === 7,
        "Samamittaiset fyysiset salot säilyvät erillisinä manifestin järjestyksessä");
    assert(JSON.stringify(input) === JSON.stringify(createProductionContinuationInput(clone(state), clone(plan), clone(execution), kerf)),
        "Jatkolähtötilan johtaminen on deterministinen");
    assert(JSON.stringify({ plan, execution, initial, state }) === before, "Johtaminen ei mutatoi syötteitä");
    input.allPieces[0].openingId = "changed";
    physical.groupedCuts[0].length = 1;
    unused.nominalRemaining = 1;
    assert(JSON.stringify({ plan, execution, initial, state }) === before &&
        createProductionContinuationInput(state, plan, execution, kerf).physicalSources.find(source => source.sourceId === "bar-3").groupedCuts[0].length === 1000,
        "Tuloksen muokkaus ei muuta alkuperäistä provenancea tai seuraavan kutsun fyysistä tasetta");
    assert(!replayProductionExecution(state, plan, execution, kerf).remainingFeasible, "Apurin kutsuminen ei poista B-009-pysähdystä");
    reject(() => completeNextProductionOperation(state, plan, execution, undefined, kerf), "Jatkolähtötieto ei avaa kuittausta");
    reject(() => createExecutedMaterialPlan(state, plan, execution, kerf), "Jatkolähtötieto ei avaa finalisointia");
    const empty = createProductionContinuationInput(initial, plan, execution, kerf);
    assert(empty.completedPieces.length === 0 && empty.remainingPieces.length === 7 && empty.physicalSources.every(source => source.groupedCuts.length === 0),
        "Tyhjä V1-prefix jättää kaikki kappaleet ja salot käyttämättömiksi");
    let done = initial;
    while (done.events.length < execution.operations.length) done = completeNextProductionOperation(done, plan, execution, undefined, kerf);
    const finished = createProductionContinuationInput(done, plan, execution, kerf);
    assert(finished.remainingPieces.length === 0 && finished.completedPieces.length === 7, "Valmis V1-prefix jättää tekemättömän kysynnän tyhjäksi");

    const repeated = createProductionSourceDeviationFixture(false);
    repeated.plan.bars[2].groupedCuts = [{ length: 1000, quantity: 2 }];
    Object.assign(repeated.plan.bars[2], MATERIAL.calculateMaterialBarCapacity(6000, repeated.plan.bars[2].groupedCuts, 3));
    const repeatedOrders = [createOrderInput("deviation", "", "black", { verticalProfile: repeated.plan.bars.flatMap(bar =>
        bar.groupedCuts.map(cut => ({ length: String(cut.length), quantity: String(cut.quantity), openingId: "A" }))) })];
    const repeatedExecution = createProductionExecution(repeated.plan, repeatedOrders, 3);
    const repeatedState = completeNextProductionOperation(createInitialProductionExecutionState(repeated.plan, repeatedExecution), repeated.plan, repeatedExecution,
        "2026-09-10T10:00:00Z", 3);
    const repeatedInput = createProductionContinuationInput(repeatedState, repeated.plan, repeatedExecution, 3);
    assert(repeatedInput.completedPieces.some(piece => piece.pieceId === "piece-3-1") &&
        repeatedInput.remainingPieces.some(piece => piece.pieceId === "piece-3-2" && piece.sourceId === "bar-3" && piece.length === 1000),
        "Samasta salosta tehty 1000 mm kappale ei valmista seuraavaa samanmittaista kappaletta");

    // Eri tilaukset ja aukot, sama mitta: valmistuminen ei saa perustua mittaryhmään.
    const provenanceFixture = createProductionSourceDeviationFixture(false);
    provenanceFixture.plan.bars[4].profileType = "horizontalProfile";
    provenanceFixture.plan.bars[4].color = "gray";
    const orders = provenanceFixture.plan.bars.map((bar, index) => createOrderInput(`order-${index}`, "", bar.color, {
        [bar.profileType]: [{ length: String(bar.groupedCuts[0].length), quantity: "1", openingId: index % 2 ? "" : `opening-${index}` }]
    }));
    provenanceFixture.plan.batch.orderIds = orders.map(order => order.id);
    provenanceFixture.plan.bars[2].source = "remnant";
    const provenanceExecution = createProductionExecution(provenanceFixture.plan, orders, 3);
    const provenanceState = completeNextProductionOperation(createInitialProductionExecutionState(provenanceFixture.plan, provenanceExecution),
        provenanceFixture.plan, provenanceExecution, "2026-09-10T10:00:00Z", 3);
    const provenanceInput = createProductionContinuationInput(provenanceState, provenanceFixture.plan, provenanceExecution, 3);
    assert(JSON.stringify(provenanceInput.allPieces) === JSON.stringify(provenanceExecution.operations.flatMap(operation => operation.pieces)) &&
        new Set(provenanceInput.completedPieces.map(piece => piece.orderId)).size === 4 &&
        provenanceInput.allPieces.some(piece => piece.openingId === null) && provenanceInput.allPieces.some(piece => piece.openingId === "opening-0"),
        "Samamittaisten eri tilausten provenance ja puuttuvat aukot säilyvät");
    assert(provenanceInput.physicalSources.find(source => source.sourceId === "bar-3").source === "remnant", "Alkuperäinen vanha jäännöslähde säilyttää lähdelajinsa");
    assert(provenanceInput.remainingPieces.some(piece => piece.profileType === "horizontalProfile" && piece.color === "gray") &&
        provenanceInput.physicalSources.every(source => {
            const bar = provenanceFixture.plan.bars.find(bar => bar.id === source.sourceId);
            return source.profileType === bar.profileType && source.color === bar.color;
        }), "Jatkossa kappaleiden ja fyysisten lähteiden profiilit ja värit säilyvät");

    for (const change of [
        copy => { copy.planDigest += "wrong"; },
        copy => { copy.events[0].operationId = "unknown"; },
        copy => { copy.events[0].operationId = execution.operations[1].id; },
        copy => { copy.events.push(clone(copy.events[0])); },
        copy => { copy.events[0].actualSourceIds[0] = "unknown"; },
        copy => { copy.events.push({ type: "operation-completed", operationId: execution.operations[1].id,
            actualSourceIds: ["bar-7"], completedAt: "2026-09-10T10:01:00Z" }); }
    ]) {
        const corrupt = clone(state);
        change(corrupt);
        reject(() => createProductionContinuationInput(corrupt, plan, execution, kerf), "Vierasta digestiä, virheellistä prefixiä tai pysähdyksen jälkeistä kirjausta ei hyväksytä");
    }
    for (const change of [
        copy => { copy.operations[0].pieces[1].pieceId = copy.operations[0].pieces[0].pieceId; },
        copy => { copy.operations[1].pieces[0].pieceId = copy.operations[0].pieces[0].pieceId; },
        copy => { copy.operations[0].pieces[0].pieceId = ""; },
        copy => { copy.operations[0].pieces.pop(); },
        copy => { copy.operations[0].pieces[0].sourceId = "bar-3"; },
        copy => { copy.operations[0].pieces[0].length = 999; },
        copy => { copy.operations[0].pieces[0].quantity = 2; },
        copy => { copy.operations[0].pieces[0].profileType = "horizontalProfile"; },
        copy => { copy.operations[0].pieces[0].color = "gray"; },
        copy => { copy.operations[0].pieces[0].orderId = ""; },
        copy => { copy.operations[1].id = copy.operations[0].id; },
        copy => { copy.operations.pop(); }
    ]) {
        const corruptExecution = clone(execution);
        change(corruptExecution);
        // Päivitetty digest ei saa peittää rikkinäistä kappalejoukkoa tai slottikohdistusta.
        const corruptState = { ...state, planDigest: createProductionPlanDigest(plan, corruptExecution) };
        reject(() => createProductionContinuationInput(corruptState, plan, corruptExecution, kerf), "Virheellinen alkuperäinen kappalejoukko hylätään myös täsmäävällä digestillä");
    }

    const units = CUTTING_PHYSICS.millimetersToDpUnits;
    function checkCapacityContinuation(source, future, testKerf) {
        const full = MATERIAL.calculateMaterialBarCapacity(source.sourceLength, [...source.groupedCuts, ...future], testKerf, source);
        const tail = MATERIAL.calculateMaterialBarCapacity(source.nominalRemaining, future, testKerf, {
            sourceCapacityAllowance: source.carriedSourceCapacityAllowance, pieceCapacityAllowance: source.pieceCapacityAllowance
        });
        assert(full.possible && tail.possible && full.nominalRemaining === tail.nominalRemaining && full.remaining === tail.remaining &&
            units(full.waste) === units(source.waste) + units(tail.waste) &&
            units(full.totalCapacityAllowance) === units(tail.totalCapacityAllowance) &&
            units(full.totalPieceCapacityAllowance) === units(source.totalPieceCapacityAllowance) + units(tail.totalPieceCapacityAllowance) &&
            full.sourceCapacityAllowance === source.sourceCapacityAllowance && tail.usableCapacity === source.remaining,
            "Yhdistetty laskenta ja replaysta jatkaminen säilyttävät pituudet, kumulatiivisen sahahukan ja varat");
        return full;
    }
    for (const testKerf of [3, 0, 3.4]) {
        const setup = createProductionSourceDeviationFixture(true, testKerf);
        const start = createInitialProductionExecutionState(setup.plan, setup.execution);
        const actual = setup.execution.operations[0].sources.map(source => source.id === "bar-7" ? "bar-3" : source.id);
        const recorded = recordProductionSourceDeviation(start, setup.plan, setup.execution, testKerf, actual, "2026-09-10T10:00:00Z");
        const derived = createProductionContinuationInput(recorded, setup.plan, setup.execution, testKerf);
        const source = derived.physicalSources.find(source => source.sourceId === "bar-3");
        const full = checkCapacityContinuation(source, [{ length: 800, quantity: 1 }, { length: 700, quantity: 1 }], testKerf);
        if (testKerf === 3) assert(full.nominalRemaining === 3491 && full.remaining === 3468 && full.waste === 9 && full.totalCapacityAllowance === 23,
            "6000 → 1000 + 800 + 700: nimellinen 3491, turvallinen 3468, sahahukka 9 ja varat 23 mm");
        const safeFitLength = CUTTING_PHYSICS.dpUnitsToMillimeters(units(source.remaining) - units(testKerf) - units(source.pieceCapacityAllowance));
        const safeFit = checkCapacityContinuation(source, [{ length: safeFitLength, quantity: 1 }], testKerf);
        assert(safeFit.remaining === 0 && safeFit.nominalRemaining > 0 && source.nominalRemaining !== safeFitLength,
            "Turvallisen kapasiteetin nolla on edelleen cut, ei nimellinen release");
        assert(!MATERIAL.calculateMaterialBarCapacity(source.nominalRemaining, [{ length: 5000, quantity: 1 }], testKerf, {
            sourceCapacityAllowance: source.carriedSourceCapacityAllowance, pieceCapacityAllowance: source.pieceCapacityAllowance
        }).possible, "Jo kulutettua kapasiteettia ei tarjota uudelleen 5000 mm kappaleelle");
    }
    const zero = createProductionSourceDeviationFixture(true, 3, { sourceCapacityAllowance: 0, pieceCapacityAllowance: 0 });
    const zeroStart = createInitialProductionExecutionState(zero.plan, zero.execution);
    const zeroRecorded = recordProductionSourceDeviation(zeroStart, zero.plan, zero.execution, 3,
        zero.execution.operations[0].sources.map(source => source.id === "bar-7" ? "bar-3" : source.id));
    const zeroSource = createProductionContinuationInput(zeroRecorded, zero.plan, zero.execution, 3).physicalSources.find(source => source.sourceId === "bar-3");
    const exact = checkCapacityContinuation(zeroSource, [{ length: zeroSource.nominalRemaining, quantity: 1 }], 3);
    const release = CUTTING_PHYSICS.cutPiece(zeroSource.nominalRemaining, zeroSource.nominalRemaining, 3);
    assert(zeroSource.carriedSourceCapacityAllowance === 0 && release.possible && release.waste === 0 &&
        exact.nominalRemaining === 0 && exact.remaining === 0 && exact.waste === zeroSource.waste,
        "Nollavaroilla nimellinen täsmäsovitus on release ilman uutta sahahukkaa");
    const releasePlan = { ...zero.plan, bars: [{ ...zero.plan.bars[0], groupedCuts: [{ length: 1000, quantity: 1 }, { length: 4997, quantity: 1 }],
        ...MATERIAL.calculateMaterialBarCapacity(6000, [{ length: 1000, quantity: 1 }, { length: 4997, quantity: 1 }], 3,
            { sourceCapacityAllowance: 0, pieceCapacityAllowance: 0 }) }] };
    const releaseOrders = [createOrderInput("deviation", "", "black", { verticalProfile:
        [1000, 4997].map(length => ({ length: String(length), quantity: "1" })) })];
    const releaseExecution = createProductionExecution(releasePlan, releaseOrders, 3);
    let releaseState = createInitialProductionExecutionState(releasePlan, releaseExecution);
    for (const operation of releaseExecution.operations) {
        const derived = createProductionContinuationInput(releaseState, releasePlan, releaseExecution, 3);
        const source = derived.physicalSources[0];
        assert((source.nominalRemaining === operation.length ? "release" : "cut") === operation.kind,
            "Johdettu nimellispituus säilyttää alkuperäisen schedulerin cut/release-rajan");
        releaseState = completeNextProductionOperation(releaseState, releasePlan, releaseExecution, undefined, 3);
    }
    const exhausted = createProductionContinuationInput(releaseState, releasePlan, releaseExecution, 3);
    assert(exhausted.remainingPieces.length === 0 && exhausted.physicalSources.length === 1 &&
        exhausted.physicalSources[0].nominalRemaining === 0 && exhausted.physicalSources[0].remaining === 0 &&
        exhausted.physicalSources[0].groupedCuts.length === 2, "Myös loppuun käytetyn fyysisen salon identiteetti ja leikkaukset säilyvät");
    return true;
}

// Tavallinen scheduler tekee ensin saman aukon 1000 mm kiskot yksittäin.
// Toisen lähdepoikkeama jättää molemmat 5000 mm kappaleet tekemättä ja pysäyttää työn.
function createRailContinuationRegressionFixture() {
    const orders = [createOrderInput("rail-continuation", "", "black", { rails: [
        { length: "1000", quantity: "2", openingId: "A" },
        { length: "5000", quantity: "2", openingId: "A" }
    ] })];
    const bars = [["bottomRail", 1000], ["topRail", 1000], ["bottomRail", 5000], ["topRail", 5000]].map(([profileType, length], index) => {
        const groupedCuts = [{ length, quantity: 1 }];
        const capacity = MATERIAL.calculateMaterialBarCapacity(6000, groupedCuts, 3);
        return { id: `bar-${index + 1}`, number: index + 1, profileType, color: "black", source: "new", sourceLength: 6000,
            groupedCuts, ...capacity, remnantStatus: getRemnantStatus(capacity.remaining, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings) };
    });
    const plan = { complete: true, remainingItems: [], bars, batch: { version: 1, orderIds: [orders[0].id],
        settings: { minBatchPieces: 1, targetBatchPieces: 4, maxBatchPieces: 4 } } };
    const execution = createProductionExecution(plan, orders, 3);
    let base = completeNextProductionOperation(createInitialProductionExecutionState(plan, execution), plan, execution, "2026-09-12T12:00:00Z", 3);
    base = recordProductionSourceDeviation(base, plan, execution, 3, ["bar-4"], "2026-09-12T12:01:00Z");
    return { orders, plan, execution, base, input: createProductionContinuationInput(base, plan, execution, 3) };
}

function runProductionContinuationPlanRegressionTests() {
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const reject = (fn, message) => { let threw = false; try { fn(); } catch { threw = true; } assert(threw, message); };
    const clone = value => JSON.parse(JSON.stringify(value));
    const { plan, execution, kerf } = createProductionSourceDeviationFixture(true);
    const state = recordProductionSourceDeviation(createInitialProductionExecutionState(plan, execution), plan, execution, kerf,
        execution.operations[0].sources.map(source => source.id === "bar-7" ? "bar-3" : source.id), "2026-09-10T10:00:00Z");
    const input = createProductionContinuationInput(state, plan, execution, kerf);
    const before = JSON.stringify({ plan, execution, state, input });
    const result = createProductionContinuationPlan(state, plan, execution, kerf);
    assert(result.complete, "Pysähtyneelle B-009-fixturelle löytyy täydellinen jatko");
    const pieces = result.execution.operations.flatMap(operation => operation.pieces);
    assert(pieces.length === 3 && new Set(pieces.map(piece => piece.pieceId)).size === 3 &&
        pieces.map(piece => piece.pieceId).sort().join() === "piece-3-1,piece-5-1,piece-6-1" &&
        pieces.every(piece => !input.completedPieces.some(done => done.pieceId === piece.pieceId)), "Vain kolme tekemätöntä piece-ID:tä kohdistuu kerran");
    assert(result.assignments.every(assignment => input.physicalSources.some(source => source.sourceId === assignment.sourceId)) &&
        new Set(result.assignments.map(assignment => assignment.sourceId)).size === result.assignments.length,
        "Vain alkuperäisen manifestin yksilölliset fyysiset salot kelpaavat");
    const known = evaluateProductionContinuationPlan(input, [
        { sourceId: "bar-7", pieceIds: ["piece-3-1"] }, { sourceId: "bar-3", pieceIds: ["piece-5-1", "piece-6-1"] }
    ], kerf);
    assert(known.predictedPlan.bars.find(bar => bar.sourceId === "bar-3").remaining === 3468 &&
        known.predictedPlan.bars.find(bar => bar.sourceId === "bar-3").waste === 9 && known.predictedPlan.bars.length === 5,
        "Käsin tunnettu jatko säilyttää yhdistetyn fyysisen taseen ja viisi käytettyä salkoa");
    assert(result.materialScore.totalCostEquivalent <= known.materialScore.totalCostEquivalent,
        "Fixturen tutkittu ratkaisu ei ole tunnettua kelvollista jatkoa kalliimpi");
    for (const candidate of [result, known]) {
        const ledger = new Map(replayProductionExecution(state, plan, execution, kerf).bars.map(bar => [bar.id, bar]));
        for (const operation of candidate.execution.operations) {
            for (const source of operation.sources) assert(source.before === ledger.get(source.id).nominalRemaining,
                "Scheduler alkaa fyysisen salon todellisesta pituudesta");
            applyProductionOperation(ledger, operation, operation.sources.map(source => source.id), kerf);
            for (const source of operation.sources) assert(source.after === ledger.get(source.id).nominalRemaining,
                "Schedulerin jälkipituus vastaa yhdistettyä replayta");
        }
        for (const bar of candidate.predictedPlan.bars) {
            const actual = ledger.get(bar.sourceId);
            const direct = MATERIAL.calculateMaterialBarCapacity(bar.sourceLength, bar.groupedCuts, kerf, bar);
            assert(direct.possible && direct.nominalRemaining === actual.nominalRemaining && direct.remaining === actual.remaining &&
                direct.waste === actual.waste && bar.remaining === actual.remaining && bar.waste === actual.waste,
                "Ennuste vastaa koko alkuperäisestä lähteestä laskettua leikkaussarjaa");
        }
        assert(JSON.stringify(candidate.materialScore) === JSON.stringify(scoreCompleteMaterialTransitionPlan(candidate.predictedPlan,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings)), "Score tulee yhdistetystä toteumasta");
        assert(candidate.materialScore.sourceValueEquivalent === candidate.predictedPlan.bars.length * 6000,
            "Käytetty uusi salko veloitetaan alkuperäisenä kerran; käyttämättömiä ei veloiteta");
    }
    assert(known.execution.operations.some(operation => operation.sources.some(source => source.id === "bar-3" && source.before === 4997)) &&
        known.execution.operations.some(operation => operation.sources.some(source => source.id === "bar-7" && source.before === 6000)),
        "Käytetty ja käyttämätön fyysinen lähde aloittavat oikeista pituuksista");
    assert(JSON.stringify(result) === JSON.stringify(createProductionContinuationPlan(state, plan, execution, kerf)) &&
        JSON.stringify({ plan, execution, state, input }) === before, "Lähteet, piece-kohdistus, scheduler ja score toistuvat ilman mutaatioita");
    reject(() => completeNextProductionOperation(state, plan, execution, undefined, kerf), "Puhdas jatkohaku ei avaa alkuperäisen työn kuittausta");
    for (const assignments of [
        [{ sourceId: "outside", pieceIds: ["piece-3-1", "piece-5-1", "piece-6-1"] }],
        [{ sourceId: "bar-7", pieceIds: ["piece-3-1"] }, { sourceId: "bar-7", pieceIds: ["piece-5-1", "piece-6-1"] }],
        [{ sourceId: "bar-7", pieceIds: ["piece-3-1", "piece-5-1", "piece-5-1"] }],
        [{ sourceId: "bar-7", pieceIds: ["piece-3-1", "piece-5-1", "piece-7-1"] }],
        [{ sourceId: "bar-7", pieceIds: ["piece-3-1", "unknown"] }],
        [{ sourceId: "bar-7", pieceIds: ["piece-3-1"] }],
        [{ sourceId: "bar-3", pieceIds: ["piece-3-1", "piece-5-1", "piece-6-1"] }]
    ]) reject(() => evaluateProductionContinuationPlan(input, assignments, kerf), "Virheelliset kappaleet, lähteet ja ylikulutus hylätään");

    const oldPlan = clone(plan);
    oldPlan.bars[2].source = "remnant";
    const oldExecution = createProductionExecution(oldPlan, createProductionSourceDeviationFixture(true).orders, kerf);
    const oldState = { ...state, planDigest: createProductionPlanDigest(oldPlan, oldExecution) };
    const oldInput = createProductionContinuationInput(oldState, oldPlan, oldExecution, kerf);
    const oldKnown = evaluateProductionContinuationPlan(oldInput, known.assignments, kerf);
    const oldBar = oldKnown.predictedPlan.bars.find(bar => bar.sourceId === "bar-3");
    assert(oldBar.source === "remnant" && oldBar.sourceLength === 6000 && oldBar.sourceCapacityAllowance === 20 && oldBar.remaining === 3468 &&
        oldKnown.materialScore.sourceValueEquivalent === 4 * 6000 + 6000 * evaluateRemnantDisposition(6000,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings).savedValueFactor,
        "Vanhan jäännöksen alkuperäinen lähdearvo ja kapasiteettivarat säilyvät yhdistetyssä scoressa");
    assert(createProductionContinuationPlan(oldState, oldPlan, oldExecution, kerf).complete, "Haku tukee myös jo käytettyä vanhaa jäännöstä");

    function twoSources(lengths, cuts) {
        const twoPlan = { ...clone(plan), bars: lengths.map((length, index) => ({ ...clone(plan.bars[index]),
            source: length === 6000 ? "new" : "remnant", sourceLength: length,
            groupedCuts: [{ length: cuts[index], quantity: 1 }],
            ...MATERIAL.calculateMaterialBarCapacity(length, [{ length: cuts[index], quantity: 1 }], 3)
        })) };
        const orders = [createOrderInput("deviation", "", "black", { verticalProfile: cuts.map(length => ({ length: String(length), quantity: "1" })) })];
        const scheduled = createProductionExecution(twoPlan, orders, 3);
        return { plan: twoPlan, execution: scheduled, state: createInitialProductionExecutionState(twoPlan, scheduled) };
    }
    const twins = twoSources([6000, 6000], [5000, 5000]);
    const twinResult = createProductionContinuationPlan(twins.state, twins.plan, twins.execution, 3);
    assert(twinResult.complete && twinResult.assignments.length === 2 &&
        twinResult.assignments.map(assignment => assignment.sourceId).sort().join() === "bar-1,bar-2" &&
        twinResult.execution.operations[0].sources.length === 2, "Identtiset fyysiset lähteet kuluvat kumpikin kerran ja säilyvät schedulerissa erillisinä");
    const sourceRows = ["a", "b"].map(sourceId => ({ sourceId, source: "new", profileType: "verticalProfile", color: "black",
        sourceLength: 6000, usableCapacity: 5980, sourceCapacityAllowance: 20, pieceCapacityAllowance: 1, quantity: 1, unlimited: false }));
    const sourceBefore = JSON.stringify(sourceRows);
    const candidates = findMaterialSourceCandidates([{ length: 5000, quantity: 2 }], sourceRows, 3);
    const candidateB = candidates.find(candidate => candidate.sourceId === "b");
    const afterB = consumeMaterialSource(sourceRows, candidateB);
    assert(afterB[0].quantity === 1 && afterB[1].quantity === 0 && consumeMaterialSource(afterB, candidateB) === null &&
        JSON.stringify(sourceRows) === sourceBefore, "Kulutus kohdistuu sourceId:hen eikä ensimmäiseen samanmittaiseen lähteeseen; haarat eivät mutatoidu");
    for (const badSources of [[sourceRows[0], sourceRows[0]], [{ ...sourceRows[0], quantity: 2 }],
        [{ ...sourceRows[0], unlimited: true }], [sourceRows[0], { ...sourceRows[1], sourceId: undefined }]]) {
        reject(() => optimizeOrderInventoryBeamDP([{ length: 5000, quantity: 1 }], badSources, 3), "Fyysisten lähteiden kaksoiskäyttö, ryhmittely ja rajattomuus hylätään");
    }
    const shortage = twoSources([2000, 6000], [1000, 5000]);
    const stopped = recordProductionSourceDeviation(shortage.state, shortage.plan, shortage.execution, 3, ["bar-2"]);
    const savedFallback = findExactFiniteInventoryFeasibilityPlan;
    try {
        findExactFiniteInventoryFeasibilityPlan = () => { throw new Error("Continuation ei saa käyttää yhteisten varojen exact-fallbackia"); };
        const failed = createProductionContinuationPlan(stopped, shortage.plan, shortage.execution, 3);
        assert(!failed.complete && failed.feasibilityStatus === "unknown" && failed.reason === "no-validated-continuation" &&
            !failed.execution && !failed.assignments && !failed.predictedPlan && !failed.materialScore,
            "Riittämätön alkuperäinen manifesti palauttaa unknown-tuloksen ilman osittaista jatkoa tai ulkopuolista materiaalia");
        const physicalFailure = optimizeOrderInventoryBeamDP([{ length: 7000, quantity: 1 }], sourceRows, 3);
        assert(!physicalFailure.complete && physicalFailure.feasibilityStatus === "unknown" && !physicalFailure.stats.feasibilityFallback.attempted,
            "Myös fyysisen beamin suora käyttö jättää exact-fallbackin ajamatta");
    } finally { findExactFiniteInventoryFeasibilityPlan = savedFallback; }
    let finishedState = twins.state;
    while (finishedState.events.length < twins.execution.operations.length) finishedState = completeNextProductionOperation(finishedState, twins.plan, twins.execution, undefined, 3);
    const noDemand = createProductionContinuationPlan(finishedState, twins.plan, twins.execution, 3);
    assert(!noDemand.complete && noDemand.reason === "no-remaining-pieces" && !noDemand.execution, "Tyhjälle kysynnälle ei muodosteta jatkosuunnitelmaa");

    // Jatkon 1+1-kelpoisuus määräytyy jatkon alussa jäljellä olevasta kysynnästä.
    function rails(count, completedBottom = count / 2 - 1, completedTop = count / 2 - 1) {
        const orders = [createOrderInput("rails", "", "black", { rails: [{ length: "4000", quantity: String(count), openingId: "A" }] })];
        const cuts = normalizeOrderCuts(orders);
        const bars = cuts.flatMap(cut => Array.from({ length: cut.quantity }, () => ({
            profileType: cut.profileType, color: cut.color, source: "new", sourceLength: 6000,
            groupedCuts: [{ length: 4000, quantity: 1 }], ...MATERIAL.calculateMaterialBarCapacity(6000, [{ length: 4000, quantity: 1 }], 3)
        }))).map((bar, index) => ({ ...bar, id: `bar-${index + 1}`, number: index + 1, remnantStatus: "reusable" }));
        const railPlan = { complete: true, remainingItems: [], bars, batch: { version: 1, orderIds: ["rails"], settings: { minBatchPieces: 1, targetBatchPieces: count, maxBatchPieces: count } } };
        // Erilliset yhden salon operaatiot mahdollistavat 2+2-kysynnän puolikkaan prefixin.
        const profiles = Object.fromEntries(Object.entries(PRODUCTION_PLANNING.profileDefaults).map(([key, rule]) => [key, { ...rule, maxStackSize: 1 }]));
        const scheduled = PRODUCTION_PLANNING.schedule(PRODUCTION_PLANNING.attachPieces(railPlan, cuts), 3, profiles);
        const bottom = scheduled.operations.filter(op => op.pieces[0].profileType === "bottomRail");
        const top = scheduled.operations.filter(op => op.pieces[0].profileType === "topRail");
        const chosen = [...bottom.slice(0, completedBottom), ...top.slice(0, completedTop),
            ...bottom.slice(completedBottom), ...top.slice(completedTop)];
        const railExecution = { ...scheduled, operations: chosen.map((operation, index) => ({ ...operation, id: `operation-${index + 1}`, number: index + 1 })) };
        let railState = createInitialProductionExecutionState(railPlan, railExecution);
        for (let i = 0; i < completedBottom + completedTop; i++) railState = completeNextProductionOperation(railState, railPlan, railExecution, "2026-09-12T12:00:00Z", 3);
        return createProductionContinuationPlan(railState, railPlan, railExecution, 3);
    }
    const four = rails(4), two = rails(2);
    assert(four.complete && four.execution.operations.length === 1 && four.execution.operations[0].sources.length === 2,
        "Alkuperäisen 2+2:n jäljellä oleva 1+1 muodostaa kiskosekaparin");
    assert(rails(6).execution.metrics.cutOperationCount === 1, "Myös alkuperäisen 3+3:n jäljellä oleva 1+1 muodostaa sekaparin");
    for (const result of [rails(4, 0, 0), rails(4, 0, 1)]) assert(result.execution.operations.every(op =>
        new Set(op.pieces.map(p => p.profileType)).size === 1), "Jatkon 2+2 ja 2+1 säilyvät profiilikohtaisina");
    assert(two.complete && two.execution.operations.length === 1 && two.execution.operations[0].sources.length === 2,
        "Alkuperäinen aito 1+1 säilyttää sallitun kiskosekaparin");
    const fixture = createRailContinuationRegressionFixture();
    const corrected = createProductionContinuationPlan(fixture.base, fixture.plan, fixture.execution, 3);
    // Ennen korjausta talteen otettu koko kohdistus ja materiaalipisteen erittely.
    assert(JSON.stringify(corrected.assignments) === JSON.stringify([
        { sourceId: "bar-3", pieceIds: ["piece-4-1"] }, { sourceId: "bar-2", pieceIds: ["piece-3-1"] }
    ]), "Kiskokorjaus säilyttää materiaalihakijan koko kohdistuksen");
    assert(JSON.stringify(corrected.materialScore) === JSON.stringify({ sourceValueEquivalent: 24000,
        recoveredRemnantValueEquivalent: 8853.44, kerfRecoveredValueEquivalent: 0,
        newStockRemnantCreationPenaltyEquivalent: 100, remnantHandlingPenaltyEquivalent: 40,
        largeScrapPenaltyEquivalent: 2638.4, totalCostEquivalent: 17924.96 }), "Koko materiaalipiste säilyy ennen korjausta otettuna checkpointina");
    assert(corrected.execution.metrics.cutOperationCount === 1 && corrected.execution.metrics.bundleUtilization === 1,
        "Jäljellä olevat kaksi 5000 mm kiskoa: sahausliikkeet 2 → 1 ja nippukäyttö 0,5 → 1");
    for (const field of ["length", "color", "openingId", "orderId"]) {
        const changed = JSON.parse(JSON.stringify(fixture.input));
        const piece = changed.remainingPieces[0];
        piece[field] = field === "length" ? 4900 : field === "color" ? "gray" : "other";
        Object.assign(changed.allPieces.find(p => p.pieceId === piece.pieceId), piece);
        if (field === "color") changed.physicalSources.find(s => s.sourceId === corrected.assignments[0].sourceId).color = "gray";
        assert(evaluateProductionContinuationPlan(changed, corrected.assignments, 3).execution.operations.length === 2,
            "Jatkon eri mitta, väri, aukko tai tilaus estää parin: " + field);
    }
    const missingOpening = JSON.parse(JSON.stringify(fixture.input));
    missingOpening.remainingPieces.forEach(p => p.openingId = "");
    assert(evaluateProductionContinuationPlan(missingOpening, corrected.assignments, 3).execution.operations.length === 2,
        "Puuttuvia aukkoja ei arvata jatkossakaan");
    const v3 = createProductionContinuationState(fixture.base, fixture.plan, fixture.execution, 3);
    const stored = Object.assign(createStoredPlanSemanticRegressionState(), { orders: fixture.orders, generatedPlan: fixture.plan,
        executionState: v3, completedBarIds: [], remnantRows: [], stockProfileRows: Object.keys(PROFILE_TYPES).map(profileType =>
            ({ profileType, color: "black", quantity: "7", unlimited: false, additional: false })) });
    assert(isValidStoredWorkState(JSON.parse(JSON.stringify(stored))), "V3:n tallennevalidointi regeneroi korjatun kiskoschedulerin");
    assert(v3.continuation.digest === createProductionContinuationState(fixture.base, fixture.plan, fixture.execution, 3).continuation.digest &&
        v3.planDigest === fixture.base.planDigest, "Jatkodigest on deterministinen; alkuperäinen V1/V2-digest säilyy");
    const completed = completeNextProductionOperation(v3, fixture.plan, fixture.execution, "2026-09-12T12:02:00Z", 3);
    assert(replayProductionExecution(completed, fixture.plan, fixture.execution, 3).completedPieceIds.length === 4 &&
        isValidStoredWorkState({ ...stored, executionState: completed }), "Yksi jatkon sekakuittaus valmistaa molemmat kappaleet ja palautuu");
    stored.executionState = JSON.parse(JSON.stringify(v3));
    stored.executionState.continuation.digest = "production-continuation-v1-90c382a4698e4e0b";
    assert(!isValidStoredWorkState(stored), "Ennen korjausta talteen otettu kahden erillissahauksen digest hylätään");
    return true;
}

function runProductionRegressionTests() {
    let count = 0;
    const assert = (condition, message) => { if (!condition) throw new Error(message); count++; };
    const reject = (fn, message) => { let threw = false; try { fn(); } catch { threw = true; } assert(threw, message); };
    const P = PRODUCTION_PLANNING;
    for (const total of [2, 4, 6]) {
        const rails = normalizeOrderCuts([createOrderInput("rail-order", "", "black", {
            rails: [{ length: "4000", quantity: String(total), openingId: "A" }]
        })]);
        assert(rails.length === 2 && rails.every(p => p.quantity === total / 2), "Kiskojen yhteismäärä " + total);
    }
    const order = (id, pieceCount) => ({ id, pieceCount });
    const evaluate = orders => ({ complete: true, materialScore: orders.reduce((n, o) => n + o.pieceCount, 0) });
    const queue = [order("a", 90), order("b", 90), order("c", 70), order("d", 60)];
    const snapshot = JSON.stringify(queue);
    const batch = P.selectBatch(queue, evaluate);
    assert(batch.pieceCount >= 200 && batch.pieceCount <= 300, "Pienet tilaukset tavoitealueelle");
    assert(batch.orders.every(o => queue.includes(o)) && new Set(batch.orders.map(o => o.id)).size === batch.orders.length, "Vain kokonaisia tilauksia");
    const rest = queue.filter(o => !batch.orders.includes(o));
    const next = P.selectBatch(rest, evaluate);
    assert(next.orders.every(o => !batch.orders.includes(o)), "Tilaus ei kuulu kahteen batchiin");
    assert(P.selectBatch([order("a", 220)], evaluate).pieceCount === 220, "Alle tavoitteen");
    assert(P.selectBatch([order("a", 280)], evaluate).pieceCount === 280, "Yli tavoitteen");
    assert(P.selectBatch([order("a", 350)], evaluate).oversized, "Oversized sallittu");
    assert(P.selectBatch([order("a", 20)], evaluate).pieceCount === 20, "Pieni jono sallittu");
    assert(JSON.stringify(batch) === JSON.stringify(P.selectBatch(queue, evaluate)), "Batch deterministinen");
    assert(JSON.stringify(queue) === snapshot, "Jono ei mutatoidu");
    const preferred = P.selectBatch([order("a", 100), order("b", 100), order("c", 100)], selected => ({
        complete: true, materialScore: selected.some(o => o.id === "a") ? 100 : 1
    }));
    assert(preferred.orders.map(o => o.id).join() === "b,c", "Materiaalipiste ohittaa FIFO:n");
    assert(!P.selectBatch(queue, () => ({ complete: false })).complete, "Osittainen batch hylätään");
    reject(() => P.selectBatch(queue, evaluate, { minBatchPieces: 301 }), "Virheelliset asetukset");
    reject(() => P.selectBatch([order("a", 1), order("a", 2)], evaluate), "Duplikaattitilaus");

    const shortQueue = [order("short-a", 40), order("short-b", 50), order("short-c", 60)];
    const shortBatch = P.selectBatch(shortQueue, evaluate);
    assert(shortBatch.pieceCount === 150 && shortBatch.orders.length === 3 && shortBatch.evaluatedCount === 1,
        "Alle minimin jäävä koko jono otetaan yhteen batchiin");
    assert(!P.selectBatch(shortQueue, selected => ({ complete: selected.length < 3, materialScore: 1 })).complete,
        "Lyhyestä jonosta ei poimita osajoukkoa materiaalipuutteen vuoksi");
    assert(!P.selectBatch([order("large-a", 150), order("large-b", 150)], selected => ({ complete: selected.length === 1, materialScore: 1 })).complete,
        "Riittävän suuresta jonosta ei muodosteta alle minimin batchia");
    assert(P.selectBatch([order("edge-a", 100), order("edge-b", 100)], evaluate).pieceCount === 200,
        "Minimirajalla batch kattaa vähintään minimin");

    function source(id, lengths = [1000], profileType = "verticalProfile", color = "black", sourceLength = 6000, extra = {}) {
        let remaining = sourceLength, waste = 0;
        const pieces = lengths.map((length, i) => {
            const cut = CUTTING_PHYSICS.cutPiece(remaining, length, 3);
            remaining = cut.remaining; waste += cut.waste;
            return { pieceId: id + "-" + i, orderId: "order-" + id, openingId: "opening-" + id,
                profileType, color, length, quantity: 1 };
        });
        return { id, profileType, color, sourceLength, remaining, waste, origin: "new", pieces, ...extra };
    }
    const sources = Array.from({ length: 6 }, (_, i) => source("s" + i, [1772], "verticalProfile", i % 2 ? "white" : "black"));
    const railSources = (total, openingId = "A", orderId = "rails") => ["bottomRail", "topRail"].flatMap(profile =>
        Array.from({ length: total / 2 }, (_, i) => {
            const item = source(orderId + openingId + profile + i, [4000], profile);
            item.pieces.forEach(p => Object.assign(p, { orderId, openingId }));
            return item;
        }));
    for (const total of [2, 4, 6]) {
        const input = railSources(total), before = JSON.stringify(input);
        const result = P.schedule(input, 3);
        assert(result.operations.length === (total === 2 ? 1 : total === 4 ? 2 : 4), "Kiskoliikkeet " + total);
        assert(result.operations.every(o => o.sources.length <= 2), "Kiskokapasiteetti " + total);
        assert(result.operations.every(o => new Set(o.pieces.map(p => p.profileType)).size === (total === 2 ? 2 : 1)), "Sekanippu vain 1+1 " + total);
        assert(result.operations.flatMap(o => o.pieces).length === total && result.metrics.stopPositionChanges === 1, "Kappaleet ja mittavaste " + total);
        assert(JSON.stringify(input) === before && JSON.stringify(result) === JSON.stringify(P.schedule(input, 3)), "Kiskojen determinismi ja mutatoimattomuus");
        assert(result.operations.every(o => o.sources.every(s => {
            const cut = CUTTING_PHYSICS.cutPiece(s.before, o.length, 3);
            return cut.possible && cut.remaining === s.after && cut.waste === s.waste;
        })), "Kiskonipun materiaalitase " + total);
    }
    const differentOpenings = P.schedule([...railSources(2, "A"), ...railSources(2, "B"), ...railSources(2, "A", "other")], 3);
    assert(differentOpenings.operations.length === 3 && differentOpenings.operations.every(o =>
        new Set(o.pieces.map(p => JSON.stringify([p.orderId, p.openingId]))).size === 1), "Eri aukkoja ja tilauksia ei pariteta");
    assert(P.schedule(railSources(2, ""), 3).operations.length === 2, "Puuttuvaa aukkoa ei arvata");
    const exactRails = railSources(2);
    exactRails[0] = source(exactRails[0].id, [4000], "bottomRail", "black", 4000);
    Object.assign(exactRails[0].pieces[0], { orderId: "rails", openingId: "A" });
    assert(P.schedule(exactRails, 3).metrics.cutOperationCount === 1 && P.schedule(exactRails, 3).operations.length === 2,
        "Valmiin kiskon poimintaa ei muuteta sekanipun sahausliikkeeksi");
    const restricted = { ...P.profileDefaults, bottomRail: { compatibilityGroup: "topRail", maxStackSize: 1 } };
    assert(P.schedule(railSources(2), 3, restricted).operations.length === 2, "Pari kunnioittaa kapasiteettia");
    const restrictedPair = railSources(2);
    assert(P.schedule(restrictedPair, 3, restricted, restrictedPair.flatMap(s => s.pieces)).operations.length === 2,
        "Myös jatkon eksplisiittinen kysyntäkonteksti kunnioittaa nippukapasiteettia");
    const railParent = source("z-parent", [1000], "bottomRail");
    const railChild = source("zz-child", [4000], "bottomRail", "black", railParent.remaining,
        { origin: "same-run-remnant", parentSourceId: railParent.id });
    const readyTop = source("a-ready-top", [4000], "topRail");
    for (const s of [railChild, readyTop]) Object.assign(s.pieces[0], { orderId: "ready-rails", openingId: "A" });
    const dependentRails = [railParent, railChild, readyTop];
    const readyResult = P.schedule(dependentRails, 3, P.profileDefaults, dependentRails.flatMap(s => s.pieces));
    const childOperation = readyResult.operations.find(op => op.sources.some(s => s.id === railChild.id));
    const parentOperation = readyResult.operations.find(op => op.sources.some(s => s.id === railParent.id));
    assert(readyResult.operations[0].sources[0].id === readyTop.id && readyResult.operations.every(op => op.sources.length === 1) &&
        childOperation.dependencyIds.includes(parentOperation.id), "Kelvollinen 1+1-pari ei ohita keskeneräistä parent-lähdettä");
    const shared = { ...P.profileDefaults, bottomRail: { compatibilityGroup: "topRail", maxStackSize: 2 } };
    assert(P.schedule(railSources(4), 3, shared).operations.every(o => new Set(o.pieces.map(p => p.profileType)).size === 1), "Yleinen ryhmä ei ohita kiskosääntöä");
    const adjacentRails = railSources(4);
    adjacentRails[2].id = "z-top"; adjacentRails[3].id = "zz-top";
    const adjacentResult = P.schedule([...adjacentRails, source("s-other", [1200])], 3);
    const adjacentRailIndexes = adjacentResult.operations.map((operation, index) =>
        operation.pieces.every(piece => ["bottomRail", "topRail"].includes(piece.profileType)) ? index : -1).filter(index => index >= 0);
    assert(adjacentRailIndexes.length === 2 && adjacentRailIndexes[1] === adjacentRailIndexes[0] + 1 &&
        adjacentRailIndexes.every(index => adjacentResult.operations[index].length === 4000),
        "Saman aukon kiskot pysyvät peräkkäin kiskoblokissa");
    for (const quantity of ["1", "3", "0", "-2", "2.5", ""]) reject(() => normalizeOrderCuts([
        createOrderInput("invalid-rails", "", "black", { rails: [{ length: "4000", quantity }] })
    ]), "Virheellinen yhteismäärä " + quantity);
    const legacy = createStoredPlanSemanticRegressionState();
    legacy.schemaVersion = 4;
    legacy.orders.forEach(o => o.sections.filter(s => s.key === "rails").forEach(s => s.rows.forEach(r => r.quantity = String(Number(r.quantity) / 2))));
    const migrated = migrateStoredWorkState(legacy);
    assert(migrated.schemaVersion === 6 && migrated.executionState === null && isValidStoredWorkState(migrated),
        "Vanha laskettu työ migroituu kysyntää muuttamatta");
    assert(legacy.schemaVersion === 4 && JSON.stringify(migrated) === JSON.stringify(migrateStoredWorkState(migrated)),
        "Migraatio on mutatoimaton ja idempotentti");
    const original = JSON.stringify(sources);
    assert(P.schedule(sources, 3).metrics.stopPositionChanges === 1,
        "Kaksi samanmitan nippusahausta tarvitsee vain ensimmäisen mittavasteen siirron");
    assert(P.schedule([source("moves", [1000, 2000, 1000])], 3).metrics.stopPositionChanges === 3,
        "Ensimmäinen asetus ja molemmat mittamuutokset lasketaan");
    assert(P.schedule([source("single")], 3).metrics.stopPositionChanges === 1,
        "Yksi sahaus vaatii yhden mittavasteen siirron");
    assert(P.schedule([source("release", [6000])], 3).metrics.stopPositionChanges === 0 &&
        P.schedule([], 3).metrics.stopPositionChanges === 0, "Ilman sahausliikkeitä ei siirretä mittavastetta");
    const execution = P.schedule(sources, 3);
    assert(execution.operations.length === 2, "Kuusi lähdettä kahteen operaatioon");
    assert(execution.operations[0].sources.length === 4 && execution.operations[1].sources.length === 2, "Kapasiteetti 4 + 2");
    assert(new Set(execution.operations[0].sources.map(s => s.color)).size === 2, "Eri värit nipussa");
    assert(execution.operations.flatMap(o => o.pieces).length === 6, "Kappalemäärä säilyy");
    assert(execution.operations.flatMap(o => o.pieces).every(p => p.openingId === "opening-" + p.sourceId && p.orderId === "order-" + p.sourceId), "Provenance säilyy");
    assert(original === JSON.stringify(sources), "Scheduler ei mutatoi materiaalia");
    assert(JSON.stringify(execution) === JSON.stringify(P.schedule(sources, 3)), "Scheduler deterministinen");
    assert(P.schedule([source("a"), source("b", [1000], "horizontalProfile")], 3).operations.length === 2, "Profiilit erillään");
    assert(P.schedule(Array.from({ length: 3 }, (_, i) => source("r" + i, [1000], "topRail")), 3).operations.length === 2, "Kiskon kapasiteetti 2");
    const parent = source("a", [1000]);
    const child = source("b", [1200], "verticalProfile", "black", parent.remaining, { origin: "same-run-remnant", parentSourceId: "a" });
    const dependent = P.schedule([child, source("z", [1500]), parent], 3);
    assert(dependent.operations.map(o => o.sources[0].id).join() === "a,b,z", "Ready jäännös ennen riippumatonta uutta");
    assert(dependent.operations[1].dependencyIds[0] === dependent.operations[0].id, "Eksplisiittinen A → B");
    const crossProfileChild = source("cross-child", [1200], "horizontalProfile", "black", parent.remaining,
        { origin: "same-run-remnant", parentSourceId: "a" });
    reject(() => P.schedule([parent, crossProfileChild], 3), "Profiilien välinen jäännösriippuvuus hylätään");
    reject(() => P.schedule([child], 3), "Puuttuva vanhempi hylätään");
    reject(() => P.schedule([parent, child, { ...child, id: "c", pieces: child.pieces.map(p => ({ ...p, pieceId: "c" })) }], 3), "Jäännöksen kaksoiskäyttö estetään");
    reject(() => P.schedule([{ ...parent, origin: "same-run-remnant", parentSourceId: "b" }, child], 3), "Sykli tai mahdoton riippuvuus hylätään");
    reject(() => P.schedule([{ ...parent, remaining: 1 }], 3), "Materiaalitase tarkistetaan");
    reject(() => P.schedule([parent, { ...source("c"), pieces: parent.pieces }], 3), "Kappaleen kaksoiskäyttö estetään");
    const continuation = P.schedule([source("a", [2000, 1000]), source("b", [1000])], 3);
    assert(continuation.operations.length === 2 && continuation.operations[1].sources.length === 2, "Muuttuva nippu ja jatkoleikkaus");
    assert(continuation.operations[1].sources[0].origin === "same-run-remnant", "Saman ajon jäännös erotetaan vanhasta");
    assert(P.schedule([source("a", [6000])], 3).operations[0].sources[0].waste === 0, "Täsmäsovituksen kerf säilyy");
    const exact = P.schedule([source("a", [6000])], 3);
    assert(exact.metrics.cutOperationCount === 0 && exact.operations[0].kind === "release", "Valmis loppukappale ei keksi sahausliikettä");

    const blockSources = [
        ...railSources(2, "BLOCK", "block-order"),
        source("u-block", [900], "uProfile"),
        source("horizontal-block", [1100], "horizontalProfile"),
        source("closing-block", [1200], "closingProfile"),
        source("vertical-block", [1300, 800], "verticalProfile")
    ];
    const blockExecution = P.schedule(blockSources, 3);
    const operationBlocks = blockExecution.operations.map(operation =>
        P.getProfileBlock(operation.sources[0].profileType).id);
    const distinctBlocks = operationBlocks.filter((block, index) => index === 0 || block !== operationBlocks[index - 1]);
    assert(distinctBlocks.join() === "verticalProfile,closingProfile,horizontalProfile,uProfile,rails",
        "Scheduler käyttää Pysty–Vaste–Vaaka–U–kiskot-blokkijärjestystä");
    assert(operationBlocks.every((block, index) => block !== "verticalProfile" ||
        !operationBlocks.slice(0, index).includes("horizontalProfile")), "Pystyä ei esiinny Vaaka-blokin jälkeen");
    assert(blockExecution.operations.at(-1).pieces.every(piece => ["bottomRail", "topRail"].includes(piece.profileType)) &&
        new Set(blockExecution.operations.at(-1).pieces.map(piece => piece.profileType)).size === 2,
        "Ala- ja yläkisko säilyvät yhteisen viimeisen blokin railPair-nipussa");
    assert(blockExecution.operations.flatMap(operation => operation.pieces).length ===
        blockSources.reduce((total, blockSource) => total + blockSource.pieces.length, 0),
        "Profiiliblokit valmistavat jokaisen kappaleen täsmälleen kerran");
    const missingBlocks = P.schedule([
        ...railSources(2, "SKIP", "skip-order"),
        source("u-skip", [900], "uProfile"), source("vertical-skip", [1300], "verticalProfile")
    ], 3).operations.map(operation => P.getProfileBlock(operation.sources[0].profileType).id)
        .filter((block, index, blocks) => index === 0 || block !== blocks[index - 1]);
    assert(missingBlocks.join() === "verticalProfile,uProfile,rails", "Puuttuvat profiiliblokit ohitetaan");

    // Aiemmat checkpointit ajetaan erikseen; tässä oikea materiaalihaku ja koko tuotantoputki.
    const orders = createDevelopmentOrdersFromCuts([
        { profileType: "verticalProfile", color: "black", length: 2200, quantity: 2 }
    ]);
    const inventory = createMaterialInventory({ stockLength: 6000,
        newStock: Object.keys(PROFILE_TYPES).map(profileType => ({ profileType, color: "black", unlimited: true, quantity: null })),
        remnants: [{ profileType: "verticalProfile", color: "black", length: 3900, quantity: 1 }] });
    const cuts = normalizeOrderCuts(orders);
    const migratedRailOrders = [createOrderInput("legacy-rail", "", "black", {
        rails: [{ length: "4000", quantity: "2", openingId: "A" }]
    })];
    const railOptimization = optimizeOrderByProfileTypeWithInventory(normalizeOrderCuts(migratedRailOrders), inventory, 3, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS);
    const oldRailState = createStoredPlanSemanticRegressionState();
    oldRailState.schemaVersion = 4;
    oldRailState.stockProfileRows.forEach(row => { row.color = "black"; row.unlimited = true; });
    oldRailState.orders = migratedRailOrders;
    oldRailState.orders[0].sections.find(s => s.key === "rails").rows[0].quantity = "1";
    oldRailState.generatedPlan = adaptMaterialOptimizationForUi(railOptimization, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    oldRailState.completedBarIds = [oldRailState.generatedPlan.bars[0].id];
    const migratedRailState = migrateStoredWorkState(oldRailState);
    assert(isValidStoredWorkState(migratedRailState) && normalizeOrderCuts(migratedRailState.orders).every(p => p.quantity === 1), "Vanhan kiskotyön 1+1 kysyntä säilyy");
    assert(JSON.stringify(migratedRailState.generatedPlan) === JSON.stringify(oldRailState.generatedPlan) &&
        JSON.stringify(migratedRailState.completedBarIds) === JSON.stringify(oldRailState.completedBarIds), "Kiskomigraatio säilyttää materiaalin ja TEHTY-tilan");
    const baseline = optimizeOrderByProfileTypeWithInventory(cuts, inventory, 3, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS);
    const selected = selectProductionBatch(orders, inventory, 3);
    assert(JSON.stringify(selected.optimization) === JSON.stringify(baseline), "Scheduler-polku ei muuta optimizerin tulosta");
    const plan = adaptMaterialOptimizationForUi(baseline, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    plan.batch = { version: 1, orderIds: orders.map(o => o.id), settings: { ...P.batchDefaults } };
    const before = JSON.stringify(plan);
    const score = scoreCompleteMaterialTransitionPlan(baseline, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    const productionExecution = createProductionExecution(plan, orders, 3);
    assert(productionExecution.operations.flatMap(o => o.pieces).length === 2, "Tuotantoputken kysyntä");
    const schedulerSnapshot = JSON.stringify(productionExecution);
    const manifest = createWorkerSourceManifest(plan, productionExecution);
    assert(manifest.length === plan.bars.length &&
        new Set(manifest.map(source => JSON.stringify([source.profileType, source.workerNumber]))).size === manifest.length,
        "Työntekijän salonumerot ovat profiilin sisällä yksilöllisiä");
    const repeatedSourceId = productionExecution.operations[0].sources[0].id;
    assert(productionExecution.operations.every(operation => operation.sources.some(source => source.id === repeatedSourceId)) &&
        productionExecution.operations[1].sources.find(source => source.id === repeatedSourceId).origin === "same-run-remnant" &&
        manifest.find(source => source.sourceId === repeatedSourceId).workerNumber === 1,
        "Sama fyysinen salko ja saman ajon jäännös säilyttävät salonumeron");
    const initialExecutionState = createInitialProductionExecutionState(plan, productionExecution);
    assert(isValidProductionExecutionState(initialExecutionState, plan, productionExecution), "Tyhjä toteumaloki validoituu");
    const firstCompleted = completeNextProductionOperation(initialExecutionState, plan, productionExecution, "2026-09-09T10:00:00.000Z");
    assert(firstCompleted.events.length === 1 && firstCompleted.events[0].operationId === productionExecution.operations[0].id &&
        JSON.stringify(firstCompleted.events[0].actualSourceIds) === JSON.stringify(productionExecution.operations[0].sources.map(source => source.id)),
        "Ensimmäinen operaatio kirjataan suunnitelluilla toteutuneilla lähteillä");
    const skipped = JSON.parse(JSON.stringify(firstCompleted));
    skipped.events[0].operationId = productionExecution.operations[1].id;
    assert(!isValidProductionExecutionState(skipped, plan, productionExecution), "Operaatioita ei voi kuitata epäjärjestyksessä");
    const wrongSource = JSON.parse(JSON.stringify(firstCompleted));
    wrongSource.events[0].actualSourceIds[0] = "bar-wrong";
    assert(!isValidProductionExecutionState(wrongSource, plan, productionExecution), "Väärä toteutunut lähde hylätään ensimmäisessä versiossa");
    const secondCompleted = completeNextProductionOperation(firstCompleted, plan, productionExecution, "2026-09-09T10:01:00.000Z");
    const undone = undoLatestProductionOperationState(secondCompleted, plan, productionExecution);
    assert(JSON.stringify(undone) === JSON.stringify(firstCompleted), "Viimeisin operaatio voidaan perua yksiselitteisesti");
    const changedPlan = JSON.parse(JSON.stringify(plan));
    changedPlan.bars[0].remaining += 1;
    assert(!isValidProductionExecutionState(firstCompleted, changedPlan, productionExecution), "Toteumaloki ei sovi eri plan-digestiin");
    assert(JSON.stringify(createProductionExecution(plan, orders, 3)) === schedulerSnapshot,
        "Toteumaloki ja worker-numerot eivät muuta schedulerin operaatioita");
    const workerSources = [
        source("worker-v-first", [1000, 900], "verticalProfile"),
        source("worker-h-first", [1100], "horizontalProfile"),
        source("worker-v-second", [1200], "verticalProfile")
    ];
    const workerPlan = { bars: workerSources.map((workerSource, index) => ({
        id: workerSource.id, number: 90 - index, profileType: workerSource.profileType,
        color: workerSource.color, source: "new", sourceLength: workerSource.sourceLength
    })) };
    const workerExecution = P.schedule(workerSources, 3);
    const workerManifest = createWorkerSourceManifest(workerPlan, workerExecution);
    const workerLabels = Object.fromEntries(workerManifest.map(source => [source.sourceId,
        `${source.profileType}:${source.workerNumber}`]));
    assert(workerLabels["worker-v-first"] === "verticalProfile:1" &&
        workerLabels["worker-v-second"] === "verticalProfile:2" &&
        workerLabels["worker-h-first"] === "horizontalProfile:1",
        "Pysty numeroituu 1..N ja Vaaka alkaa omasta numerosta 1");
    assert(workerManifest.filter(source => source.workerNumber === 1).length === 2 &&
        new Set(workerManifest.map(source => source.sourceId)).size === workerManifest.length,
        "Pysty 1 ja Vaaka 1 käyttävät eri sisäisiä sourceId-tunnisteita");
    assert(workerExecution.operations.filter(operation => operation.sources.some(source => source.id === "worker-v-first"))
        .every(operation => workerLabels[operation.sources.find(source => source.id === "worker-v-first").id] === "verticalProfile:1") &&
        JSON.stringify(workerManifest) === JSON.stringify(createWorkerSourceManifest(workerPlan, P.schedule(workerSources, 3))),
        "Jatkoleikkaus ja deterministinen uudelleenmuodostus säilyttävät worker-numeron");
    assert(JSON.stringify(plan) === before && JSON.stringify(score) === JSON.stringify(scoreCompleteMaterialTransitionPlan(baseline, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings)), "Materiaali ja piste-erittely säilyvät");
    reject(() => P.attachPieces({ ...plan, complete: false }, cuts), "Osittaista suunnitelmaa ei aikatauluteta");
    reject(() => getPlanOrders({ ...plan, batch: { ...plan.batch, orderIds: ["missing"] } }, orders), "Tuntematon tallennettu batch-jäsen");
    const realQueue = [2200, 3800, 3797].map((length, i) => createOrderInput("real-" + i, "", "black", {
        verticalProfile: [{ length: String(length), quantity: "1", openingId: "A" + i }]
    }));
    const noRemnants = { ...inventory, remnants: [] };
    const wholeShortQueue = selectProductionBatch(realQueue, noRemnants, 3);
    assert(wholeShortQueue.complete && wholeShortQueue.orders.length === 3 && wholeShortQueue.pieceCount === 3,
        "Todellinen kolmen tilauksen lyhyt jono sahataan kokonaan oletusrajoilla");
    assert(P.schedule([source("a", [6000]), source("b", [1000])], 3).metrics.stopPositionChanges === 1,
        "Poiminta ennen ensimmäistä sahausta ei poista ensimmäistä mittavasteen siirtoa");
    const realBatch = selectProductionBatch(realQueue, noRemnants, 3, { minBatchPieces: 2, targetBatchPieces: 2, maxBatchPieces: 2 });
    assert(realBatch.orders.map(o => o.id).join() === "real-0,real-2", "Oikea materiaalihaku ohittaa FIFO:n: 2200 + 3797");
    const unavailable = createOrderInput("unavailable", "", "white", { verticalProfile: [{ length: "1000", quantity: "1" }] });
    const availableBatch = selectProductionBatch([realQueue[0], unavailable], noRemnants, 3, { minBatchPieces: 1, targetBatchPieces: 1, maxBatchPieces: 1 });
    assert(availableBatch.complete && availableBatch.orders[0].id === "real-0", "Puuttuva variantti ei keskeytä muiden batchien hakua");
    const realPlan = adaptMaterialOptimizationForUi(realBatch.optimization, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    realPlan.batch = { version: 1, orderIds: realBatch.orders.map(o => o.id), settings: realBatch.settings };
    const realExecution = createProductionExecution(realPlan, realQueue, 3);
    assert(realExecution.operations.flatMap(o => o.pieces).every(p => p.openingId === "A" + p.orderId.slice(-1)), "Aukkotieto koko polun läpi");
    const state = createStoredPlanSemanticRegressionState();
    state.generatedPlan.batch = { version: 1, orderIds: [state.orders[0].id], settings: { ...P.batchDefaults } };
    const stateExecution = createProductionExecution(state.generatedPlan, state.orders, Number(state.kerf));
    state.executionState = createInitialProductionExecutionState(state.generatedPlan, stateExecution);
    const schemaFiveState = JSON.parse(JSON.stringify(state));
    schemaFiveState.schemaVersion = 5;
    delete schemaFiveState.executionState;
    const migratedExecutionState = migrateStoredWorkState(schemaFiveState);
    assert(migratedExecutionState.schemaVersion === 6 && migratedExecutionState.executionState.events.length === 0 &&
        isValidStoredWorkState(migratedExecutionState), "Skeeman 5 batch palautuu nollasta alkavaan toteumatilaan");
    const corruptExecutionState = JSON.parse(JSON.stringify(state));
    corruptExecutionState.executionState.planDigest = "production-plan-v1-wrong";
    assert(!isValidStoredWorkState(corruptExecutionState), "Eri suunnitelman toteumatila hylätään");
    const corruptEventState = JSON.parse(JSON.stringify(state));
    corruptEventState.executionState.events = [{
        type: "operation-completed", operationId: stateExecution.operations[0].id,
        completedAt: "invalid", actualSourceIds: stateExecution.operations[0].sources.map(source => source.id)
    }];
    assert(!isValidStoredWorkState(corruptEventState), "Korrupti toteumatapahtuma hylätään");
    state.orders.push(createOrderInput("waiting", "Jonossa", "black", { verticalProfile: [{ length: "1000", quantity: "1" }] }));
    assert(isValidStoredWorkState(state), "Tallenne sallii batchin ulkopuolisen jonon");
    const invalidState = transform => { const copy = JSON.parse(JSON.stringify(state)); transform(copy); return !isValidStoredWorkState(copy); };
    assert(invalidState(s => s.generatedPlan.batch.orderIds.push("waiting")), "Puuttuva kokonainen tilaus hylätään palautuksessa");
    assert(invalidState(s => s.generatedPlan.batch.orderIds.push(s.generatedPlan.batch.orderIds[0])), "Duplikaattijäsen hylätään palautuksessa");
    assert(invalidState(s => s.generatedPlan.batch.settings.maxBatchPieces = 0), "Rikkoutuneet batch-asetukset hylätään");
    assert(invalidState(s => delete s.generatedPlan.batch.settings), "Puuttuvat batch-asetukset hylätään");
    assert(invalidState(s => s.orders[0].sections[0].rows[0].openingId = {}), "Virheellinen aukkotunniste hylätään");
    assert(isValidStoredProductionSettings({ minBatchPieces: "-1", targetBatchPieces: "2.5", maxBatchPieces: "" }), "Korjattavat batch-luvut säilyvät luonnoksessa");
    reject(() => selectProductionBatch([createOrderInput("bad", "", "black", { verticalProfile: [{ length: "1000", quantity: "-1" }] })], noRemnants, 3), "Virheellistä kysyntää ei pudoteta jonosta hiljaa");
    const profileRules = { ...P.profileDefaults, horizontalProfile: { compatibilityGroup: "verticalProfile", maxStackSize: 2 } };
    assert(P.schedule([source("a"), source("b", [1000], "horizontalProfile")], 3, profileRules).operations.length === 2,
        "Yhteensopivuus ei yhdistä eri tuotantoblokkeja");
    const reverse = P.schedule([source("a", [1000, 2000]), source("b", [2000, 1000])], 3);
    assert(reverse.operations.length === 2 && reverse.operations.every(o => o.sources.length === 2), "Niputus löytää saman mitan myös eri pattern-järjestyksestä");
    for (const op of reverse.operations) {
        assert(op.dependencyIds.every(id => Number(id.split("-")[1]) < op.number), "Topologinen operaatiojärjestys");
        assert(op.sources.every(s => {
            const cut = CUTTING_PHYSICS.cutPiece(s.before, op.length, 3);
            return cut.possible && cut.remaining === s.after && cut.waste === s.waste;
        }), "Operaation riippumaton sahausfysiikan tarkistus");
    }
    console.log("Tuotantoregressiot: " + count + " tarkistusta läpäisty");
    return true;
}
function runProductionPresentationRegressionTests() {
    const assert = (condition, message) => { if (!condition) throw new Error(message); };
    const operation = (number, length = 950, sourceId = "bar-1") => ({
        id: `operation-${number}`, number, kind: "cut", length, compatibilityGroup: "verticalProfile", maxStackSize: 4,
        sources: [{ id: sourceId, profileType: "verticalProfile", color: "black",
            origin: number === 1 ? "new" : "same-run-remnant", before: 6000 - number * 953, after: 5047 - number * 953 }],
        pieces: [{ pieceId: `piece-${number}`, sourceId, profileType: "verticalProfile", color: "black",
            orderId: "order-1", openingId: "A", length, quantity: 1 }], dependencyIds: number > 1 ? [`operation-${number - 1}`] : []
    });
    const operations = [1, 2, 3, 4].map(number => operation(number));
    operations.push(operation(5, 1000), operation(6, 1100), operation(7, 1200));
    const execution = { operations };
    const original = JSON.stringify(execution);
    const initial = createProductionOperationView(execution, 0);
    assert(initial.groups.length === 4 && initial.currentGroup.total === 4 && initial.currentGroup.completed === 0,
        "Neljä identtistä operaatiota on yksi UI-ryhmä");
    assert(initial.previous.length === 0 && initial.next.map(o => o.number).join() === "5,6,7", "Esikatselu alkaa nykyisen ryhmän jälkeen");
    const plan = createStoredPlanSemanticRegressionState().generatedPlan;
    let state = createInitialProductionExecutionState(plan, execution);
    state = completeNextProductionOperation(state, plan, execution);
    assert(state.events.length === 1 && createProductionOperationView(execution, state.events.length).currentGroup.completed === 1,
        "Yksi painallus kirjaa yhden alkuperäisen operaation");
    state = JSON.parse(JSON.stringify(state));
    assert(isValidProductionExecutionState(state, plan, execution) &&
        createProductionOperationView(execution, state.events.length).currentGroup.completed === 1, "Reload johtaa 1/4 eventistä");
    state = completeNextProductionOperation(state, plan, execution);
    assert(createProductionOperationView(execution, state.events.length).currentGroup.completed === 2, "Toinen kuittaus näyttää 2/4");
    state = undoLatestProductionOperationState(state, plan, execution);
    assert(createProductionOperationView(execution, state.events.length).currentGroup.completed === 1, "Undo näyttää 1/4");
    while (state.events.length < 4) state = completeNextProductionOperation(state, plan, execution);
    assert(createProductionOperationView(execution, state.events.length).current.id === "operation-5", "Neljännen jälkeen seuraava työ");
    state = undoLatestProductionOperationState(state, plan, execution);
    assert(createProductionOperationView(execution, state.events.length).currentGroup.completed === 3, "Undo ryhmärajan yli");
    for (const changed of [operation(2, 950, "bar-2"), operation(2, 951),
        { ...operation(2), kind: "release" }, { ...operation(2), maxStackSize: 2 },
        { ...operation(2), pieces: [{ ...operation(2).pieces[0], openingId: "B" }] },
        { ...operation(2), pieces: [{ ...operation(2).pieces[0], orderId: "other" }] },
        { ...operation(2), sources: [{ ...operation(2).sources[0], profileType: "horizontalProfile" }] },
        { ...operation(2), sources: [{ ...operation(2).sources[0], color: "gray" }] }]) {
        assert(!areProductionOperationsRepeatable(operation(1), changed), "Työn ero katkaisee ryhmän");
    }
    const pair = { ...operation(1), sources: [operation(1).sources[0], operation(1, 950, "bar-2").sources[0]] };
    assert(!areProductionOperationsRepeatable(pair, { ...pair, sources: [...pair.sources].reverse() }), "Lähteiden järjestys säilyy");
    const distinct = { operations: Array.from({ length: 7 }, (_, i) => operation(i + 1, 950 + i)) };
    assert(createProductionOperationView({ operations: [operation(1), operation(2, 1000), operation(3)] }, 0).groups.length === 3,
        "Erillään olevia samanlaisia operaatioita ei yhdistetä");
    assert(createProductionOperationView({ operations: [] }, 0).groups.length === 0, "Tyhjä jono toimii");
    const middle = createProductionOperationView(distinct, 3);
    assert(middle.previous.map(o => o.number).join() === "1,2,3" && middle.current.number === 4 &&
        middle.next.map(o => o.number).join() === "5,6,7", "Keskellä näkyy 3+1+3");
    const end = createProductionOperationView(distinct, 7);
    assert(end.current === null && end.currentGroup === null && end.next.length === 0 &&
        end.previous.map(o => o.number).join() === "5,6,7", "Lopussa näkyy vain kolme viimeistä");
    assert(createProductionOperationView(distinct, 6).previous.map(o => o.number).join() === "4,5,6", "Undo lopussa palauttaa indeksit");
    const manifest = [
        { sourceId: "v1", profileType: "verticalProfile", color: "gray", origin: "new", workerNumber: 1, sourceLength: 6000 },
        { sourceId: "v2", profileType: "verticalProfile", color: "gray", origin: "new", workerNumber: 2, sourceLength: 6000 },
        { sourceId: "v3", profileType: "verticalProfile", color: "gray", origin: "old-remnant", workerNumber: 3, sourceLength: 1740 },
        { sourceId: "v4", profileType: "verticalProfile", color: "gray", origin: "old-remnant", workerNumber: 4, sourceLength: 1510 },
        { sourceId: "v5", profileType: "verticalProfile", color: "black", origin: "new", workerNumber: 5, sourceLength: 6000 },
        { sourceId: "h1", profileType: "horizontalProfile", color: "gray", origin: "new", workerNumber: 1, sourceLength: 6000 }
    ];
    const inventoryBefore = JSON.stringify(manifest);
    const groups = groupWorkerPreparationSources(manifest, ["verticalProfile"]);
    assert(groups.length === 3 && groups.map(group => group.sources.length).join() === "2,2,1", "Valmistelu erottelee värin ja lähdetyypin");
    assert(groups[1].sources.map(s => `${s.workerNumber}:${s.sourceLength}`).join() === "3:1740,4:1510", "Jäännösten tunnukset ja pituudet säilyvät");
    assert(JSON.stringify(manifest) === inventoryBefore && JSON.stringify(execution) === original, "Esitysmalli ei mutatoi authoritative-dataa");
    return true;
}
