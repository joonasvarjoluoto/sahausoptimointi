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
