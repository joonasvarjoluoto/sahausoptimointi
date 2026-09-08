function runProductionRegressionTests() {
    let count = 0;
    const assert = (condition, message) => { if (!condition) throw new Error(message); count++; };
    const reject = (fn, message) => { let threw = false; try { fn(); } catch { threw = true; } assert(threw, message); };
    const P = PRODUCTION_PLANNING;
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

    // Aiemmat checkpointit ajetaan erikseen; tässä oikea materiaalihaku ja koko tuotantoputki.
    const orders = createDevelopmentOrdersFromCuts([
        { profileType: "verticalProfile", color: "black", length: 2200, quantity: 2 }
    ]);
    const inventory = createMaterialInventory({ stockLength: 6000,
        newStock: Object.keys(PROFILE_TYPES).map(profileType => ({ profileType, color: "black", unlimited: true, quantity: null })),
        remnants: [{ profileType: "verticalProfile", color: "black", length: 3900, quantity: 1 }] });
    const cuts = normalizeOrderCuts(orders);
    const baseline = optimizeOrderByProfileTypeWithInventory(cuts, inventory, 3, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS);
    const selected = selectProductionBatch(orders, inventory, 3);
    assert(JSON.stringify(selected.optimization) === JSON.stringify(baseline), "Scheduler-polku ei muuta optimizerin tulosta");
    const plan = adaptMaterialOptimizationForUi(baseline, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    plan.batch = { version: 1, orderIds: orders.map(o => o.id), settings: { ...P.batchDefaults } };
    const before = JSON.stringify(plan);
    const score = scoreCompleteMaterialTransitionPlan(baseline, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    assert(createProductionExecution(plan, orders, 3).operations.flatMap(o => o.pieces).length === 2, "Tuotantoputken kysyntä");
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
    assert(P.schedule([source("a"), source("b", [1000], "horizontalProfile")], 3, profileRules).operations.length === 1,
        "Yhteensopivuus laajenee datalla");
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
