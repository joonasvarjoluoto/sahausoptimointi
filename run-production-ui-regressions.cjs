// Ohjaus- ja persistenssitestit pienellä DOM-rajapinnan testikaksoisella.
// Tämä ei korvaa oikean selaimen DOM-/asettelutestiä.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({ console, setTimeout });
for (const file of ["src/cutting-physics.js", "src/production-planning.js", "src/production-integration.js", "app.js"]) {
    new vm.Script(fs.readFileSync(path.join(__dirname, file), "utf8"), { filename: file }).runInContext(context);
}

const test = new vm.Script(`(async () => {
    let checks = 0;
    const assert = (condition, message) => { if (!condition) throw new Error(message); checks++; };
    let state = createStoredPlanSemanticRegressionState();
    state.orders.push(createOrderInput("waiting", "Toinen", "black", {
        verticalProfile: [{ length: "1000", quantity: "1", openingId: "A1" }]
    }));
    let liveOrders = state.orders;
    let stockRows = state.stockProfileRows;
    let remnantRows = state.remnantRows;
    let storage = null;
    let failWrite = false;
    const elements = Object.fromEntries([
        "result", "calculateButton", "cutList", "stockProfileList", "remnantList", "finalizationStatus",
        "stockLength", "kerf", "minBatchPieces", "targetBatchPieces", "maxBatchPieces", "operationStatus"
    ].map(id => [id, { value: "", textContent: "", innerHTML: "", className: "", disabled: false }]));
    elements.stockLength.value = "6000";
    elements.kerf.value = "3";
    elements.minBatchPieces.value = "1";
    elements.targetBatchPieces.value = "1";
    elements.maxBatchPieces.value = "1";
    elements.cutList.replaceChildren = (...orders) => { liveOrders = orders; };
    elements.cutList.append = (...orders) => { liveOrders.push(...orders); };
    elements.stockProfileList.replaceChildren = (...rows) => { stockRows = rows; };
    elements.remnantList.replaceChildren = (...rows) => { remnantRows = rows; };
    elements.remnantList.appendChild = row => { remnantRows.push(row); };
    globalThis.document = { getElementById: id => elements[id], querySelectorAll: () => [] };
    globalThis.localStorage = {
        setItem: (key, value) => { if (failWrite) throw new Error("full"); storage = value; },
        getItem: () => storage,
        removeItem: () => { storage = null; }
    };
    getOrdersFromForm = () => liveOrders;
    getCutsFromForm = () => normalizeOrderCuts(liveOrders);
    getStockProfileRowsForStorage = () => stockRows;
    getRemnantRowsForStorage = () => remnantRows;
    getMaterialAvailabilityFromForm = () => ({ stockLength: 6000,
        newStock: stockRows.map(row => ({ ...row, quantity: row.unlimited ? null : Number(row.quantity) })),
        remnants: remnantRows.map(row => ({ ...row, length: Number(row.length), quantity: Number(row.quantity) })) });
    createOrderCard = order => JSON.parse(JSON.stringify(order));
    createStockProfileGroupsFromRows = rows => rows;
    createFinalizedRemnantRows = rows => rows;
    restoreStockProfileRows = (container, rows) => { stockRows = rows; };
    createRemnantRow = (length, quantity, profileType, color) => ({ length, quantity, profileType, color });

    await calculate();
    assert(currentGeneratedPlan?.complete === true, "Laskenta muodostaa batchin");
    assert(currentGeneratedPlan.batch.orderIds.length === 1, "Kokonainen tilaus valitaan");
    assert(elements.result.innerHTML.includes("Valmistele Pysty-profiilin salot") && elements.result.innerHTML.includes("Tuotantobatch"), "Nykyisen profiiliblokin valmistelu ja batch renderöidään");
    assert(elements.result.innerHTML.includes("Sahaus 1 / 1") && elements.result.innerHTML.includes("SALOT · 1 kpl"), "Nykyinen sahaus ja salonumero hallitsevat näkymää");
    assert(elements.result.innerHTML.includes("A1"), "Aukkotunnus näkyy operaatiolla");
    assert(isValidStoredWorkState(JSON.parse(storage)), "Laskettu snapshot validoituu");
    const selectedIds = [...currentGeneratedPlan.batch.orderIds];
    const fullPlan = JSON.stringify(currentGeneratedPlan);
    const scheduledBefore = JSON.stringify(createProductionExecution(currentGeneratedPlan, liveOrders, 3));
    const schemaFive = JSON.parse(storage);
    schemaFive.schemaVersion = 5;
    delete schemaFive.executionState;
    storage = JSON.stringify(schemaFive);
    currentGeneratedPlan = null;
    currentProductionExecutionState = null;
    assert(restoreSavedWorkState() && currentProductionExecutionState.events.length === 0,
        "Vanha workspace ilman toteumatilaa palautuu nollaan");
    completeCurrentProductionOperation();
    assert(currentProductionExecutionState.events.length === 1 && JSON.parse(storage).executionState.events.length === 1,
        "Ensimmäinen sahaus kuittaantuu ja tallentuu");
    assert(elements.result.innerHTML.includes("Kaikki työvaiheet tehty"), "Seuraava työvaihe päivittyy kuittauksen jälkeen");
    undoLatestProductionOperation();
    assert(currentProductionExecutionState.events.length === 0 && elements.result.innerHTML.includes("Sahaus 1 / 1"),
        "Viimeisin kuittaus voidaan perua");
    completeCurrentProductionOperation();
    assert(JSON.stringify(createProductionExecution(currentGeneratedPlan, liveOrders, 3)) === scheduledBefore,
        "Kuittaukset eivät muuta schedulerin operaatioita");
    currentGeneratedPlan.bars.forEach(bar => completedBarIds.add(bar.id));
    saveCurrentWorkState();
    const savedComplete = storage;
    currentGeneratedPlan = null;
    currentProductionExecutionState = null;
    completedBarIds.clear();
    assert(restoreSavedWorkState(), "Todellinen palautusfunktio onnistuu");
    assert(JSON.stringify(currentGeneratedPlan) === fullPlan && completedBarIds.size === currentGeneratedPlan.bars.length &&
        currentProductionExecutionState.events.length === 1, "Suunnitelma, salon tila ja sahausten eteneminen palautuvat");
    assert(elements.maxBatchPieces.value === "1", "Batch-asetukset palautuvat");
    const before = JSON.stringify({ liveOrders, stockRows, remnantRows, currentGeneratedPlan, execution: currentProductionExecutionState, done: [...completedBarIds] });
    failWrite = true;
    finalizeCurrentWork();
    assert(before === JSON.stringify({ liveOrders, stockRows, remnantRows, currentGeneratedPlan, execution: currentProductionExecutionState, done: [...completedBarIds] }), "Tallennusvirhe säilyttää koko live-työn");
    assert(storage === savedComplete, "Tallennusvirhe ei muuta snapshotia");
    const expectedInventory = calculatePostOrderMaterialInventory(currentGeneratedPlan, createMaterialInventory(getMaterialAvailabilityFromForm()), PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    failWrite = false;
    finalizeCurrentWork();
    assert(currentGeneratedPlan === null && currentProductionExecutionState === null && completedBarIds.size === 0, "Finalisointi tyhjentää valmiin batchin");
    assert(liveOrders.length === 1 && liveOrders.every(order => !selectedIds.includes(order.id)), "Finalisointi jättää jonoon vain valitsemattomat");
    assert(JSON.stringify(createMaterialInventory(getMaterialAvailabilityFromForm())) === JSON.stringify(createMaterialInventory(expectedInventory)), "Varasto vastaa authoritative jälkivarastoa");
    assert(isValidStoredWorkState(JSON.parse(storage)), "Finalisoitu snapshot on kelvollinen");
    await calculate();
    assert(currentGeneratedPlan?.complete && currentGeneratedPlan.batch.orderIds.every(id => !selectedIds.includes(id)), "Seuraava batch ei tee tilausta uudelleen");
    stockRows = stockRows.map(row => ({ ...row, unlimited: false, quantity: "0" }));
    remnantRows = [];
    await calculate();
    assert(currentGeneratedPlan === null && JSON.parse(storage).generatedPlan === null, "Epäonnistunut laskenta ei jätä vanhaa valmista suunnitelmaa");
    assert(elements.result.innerHTML.includes("Käytettävissä ei ole yhtään materiaalikappaletta."), "Epäonnistuminen näkyy käyttäjälle");
    liveOrders = [createOrderInput("invalid-rails", "", "black", { rails: [{ length: "4000", quantity: "3" }] })];
    await calculate();
    assert(elements.result.textContent.includes("positiivinen parillinen kokonaisluku"), "Pariton kiskomäärä näyttää virheen ilman hylättyä Promisea");

    stockRows = Object.keys(PROFILE_TYPES).map(profileType => ({
        profileType, color: "black", quantity: "1", unlimited: true, additional: false
    }));
    remnantRows = [];
    liveOrders = [createOrderInput("profile-blocks", "Profiiliblokit", "black", {
        verticalProfile: [{ length: "4000", quantity: "2", openingId: "P" }],
        horizontalProfile: [{ length: "4000", quantity: "2", openingId: "V" }],
        uProfile: [{ length: "1000", quantity: "2", openingId: "U" }],
        rails: [{ length: "4000", quantity: "2", openingId: "K" }]
    })];
    elements.minBatchPieces.value = "1";
    elements.targetBatchPieces.value = "8";
    elements.maxBatchPieces.value = "8";
    await calculate();
    const profilePlan = JSON.stringify(currentGeneratedPlan);
    const profileExecution = createProductionExecution(currentGeneratedPlan, liveOrders, 3);
    const profileManifest = createWorkerSourceManifest(currentGeneratedPlan, profileExecution);
    const profileLabels = profileType => profileManifest.filter(source => source.profileType === profileType)
        .map(source => source.workerNumber).join();
    assert(profileLabels("verticalProfile") === "1,2" && profileLabels("horizontalProfile") === "1,2" &&
        profileLabels("uProfile") === "1" && profileLabels("bottomRail") === "1" && profileLabels("topRail") === "1",
        "Worker-numerointi alkaa jokaisessa profiilityypissä numerosta 1");
    assert(new Set(profileManifest.map(source => source.sourceId)).size === profileManifest.length,
        "Profiilityyppikohtaiset numerot eivät muuta sisäisten lähteiden yksilöllisyyttä");
    const preparationHtml = () => {
        const start = elements.result.innerHTML.indexOf('class="worker-preparation');
        const end = elements.result.innerHTML.indexOf('class="production-execution', start);
        return elements.result.innerHTML.slice(start, end);
    };
    assert(preparationHtml().includes("Valmistele Pysty-profiilin salot") &&
        !preparationHtml().includes("Vaakaprofiili") && !preparationHtml().includes("U-profiili"),
        "Valmistelulista näyttää aluksi vain Pysty-blokin salot");
    assert(elements.result.innerHTML.includes("MERKITSE SALKO VALMIIKSI"), "SALKO VALMIS -toiminto säilyy");
    const firstBlockLength = profileExecution.operations.findIndex(operation =>
        PRODUCTION_PLANNING.getProfileBlock(operation.sources[0].profileType).id !== "verticalProfile");
    for (let index = 0; index < firstBlockLength; index++) completeCurrentProductionOperation();
    assert(preparationHtml().includes("Valmistele Vaaka-profiilin salot") &&
        !preparationHtml().includes("Pystyprofiili"), "Seuraava käytössä oleva profiiliblokki aktivoituu");
    const boundaryEvents = JSON.stringify(currentProductionExecutionState.events);
    currentGeneratedPlan = null;
    currentProductionExecutionState = null;
    completedBarIds.clear();
    assert(restoreSavedWorkState() && JSON.stringify(currentProductionExecutionState.events) === boundaryEvents &&
        JSON.stringify(createWorkerSourceManifest(currentGeneratedPlan,
            createProductionExecution(currentGeneratedPlan, liveOrders, 3))) === JSON.stringify(profileManifest) &&
        preparationHtml().includes("Valmistele Vaaka-profiilin salot"),
        "Reload säilyttää profiilirajan, eventit ja worker-labelit");
    undoLatestProductionOperation();
    assert(preparationHtml().includes("Valmistele Pysty-profiilin salot"),
        "Viimeisimmän kuittauksen peruminen toimii profiilirajan yli");
    completeCurrentProductionOperation();
    assert(preparationHtml().includes("Valmistele Vaaka-profiilin salot") &&
        JSON.stringify(currentGeneratedPlan) === profilePlan,
        "Profiilirajan uudelleenkuittaus ei muuta materiaaliplania");
    console.log("Tuotannon ohjaus-/persistenssitestit: " + checks + " läpäisty");
})()`);

test.runInContext(context, { timeout: 60000 }).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
