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
        "stockLength", "kerf", "minBatchPieces", "targetBatchPieces", "maxBatchPieces"
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
    assert(elements.result.innerHTML.includes("Sahausjärjestys") && elements.result.innerHTML.includes("Tuotantobatch"), "Molemmat tulosnäkymät renderöidään");
    assert(elements.result.innerHTML.includes("A1"), "Aukkotunnus näkyy operaatiolla");
    assert(isValidStoredWorkState(JSON.parse(storage)), "Laskettu snapshot validoituu");
    const selectedIds = [...currentGeneratedPlan.batch.orderIds];
    const fullPlan = JSON.stringify(currentGeneratedPlan);
    currentGeneratedPlan.bars.forEach(bar => completedBarIds.add(bar.id));
    saveCurrentWorkState();
    const savedComplete = storage;
    currentGeneratedPlan = null;
    completedBarIds.clear();
    assert(restoreSavedWorkState(), "Todellinen palautusfunktio onnistuu");
    assert(JSON.stringify(currentGeneratedPlan) === fullPlan && completedBarIds.size === currentGeneratedPlan.bars.length, "Suunnitelma ja TEHTY palautuvat");
    assert(elements.maxBatchPieces.value === "1", "Batch-asetukset palautuvat");
    const before = JSON.stringify({ liveOrders, stockRows, remnantRows, currentGeneratedPlan, done: [...completedBarIds] });
    failWrite = true;
    finalizeCurrentWork();
    assert(before === JSON.stringify({ liveOrders, stockRows, remnantRows, currentGeneratedPlan, done: [...completedBarIds] }), "Tallennusvirhe säilyttää koko live-työn");
    assert(storage === savedComplete, "Tallennusvirhe ei muuta snapshotia");
    const expectedInventory = calculatePostOrderMaterialInventory(currentGeneratedPlan, createMaterialInventory(getMaterialAvailabilityFromForm()), PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    failWrite = false;
    finalizeCurrentWork();
    assert(currentGeneratedPlan === null && completedBarIds.size === 0, "Finalisointi tyhjentää valmiin batchin");
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
    console.log("Tuotannon ohjaus-/persistenssitestit: " + checks + " läpäisty");
})()`);

test.runInContext(context, { timeout: 60000 }).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
