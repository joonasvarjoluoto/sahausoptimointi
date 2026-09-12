// Ohjaus- ja persistenssitestit pienellä DOM-rajapinnan testikaksoisella.
// Tämä ei korvaa oikean selaimen DOM-/asettelutestiä.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({ console, setTimeout });
for (const file of ["src/cutting-physics.js", "src/material.js", "src/production-planning.js", "src/production-integration.js", "app.js", "production-regressions.js"]) {
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
        "stockLength", "kerf", "minBatchPieces", "targetBatchPieces", "maxBatchPieces", "operationStatus",
        "deviationPlannedSlot", "deviationActualSource"
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
    liveOrders = [createOrderInput("repeat", "Toistot", "black", {
        verticalProfile: [{ length: "1300", quantity: "16", openingId: "A" }],
        horizontalProfile: [{ length: "1000", quantity: "20", openingId: "B" }]
    })];
    elements.maxBatchPieces.value = "100";
    await calculate();
    const repeatExecution = createProductionExecution(currentGeneratedPlan, liveOrders, 3);
    const repeatSnapshot = JSON.stringify({ plan: currentGeneratedPlan, execution: repeatExecution });
    const repeatDigest = currentProductionExecutionState.planDigest;
    const repeatView = () => createProductionOperationView(repeatExecution, currentProductionExecutionState.events.length);
    assert(repeatView().currentGroup.total === 4 && repeatExecution.operations.length >= 7 &&
        elements.result.innerHTML.includes("0 / 4 tehty"), "Neljä oikean schedulerin toistoa yhdellä kortilla");
    assert(elements.result.innerHTML.includes('aria-label="Seuraavat työvaiheet"') &&
        repeatView().next.length === 3 && repeatView().previous.length === 0, "Ryhmän alussa 0 edellistä ja 3 seuraavaa");
    completeCurrentProductionOperation();
    assert(currentProductionExecutionState.events.length === 1 && JSON.parse(storage).executionState.events.length === 1 &&
        elements.result.innerHTML.includes("1 / 4 tehty") && repeatView().previous[0].id === repeatExecution.operations[0].id,
        "Ensimmäinen painallus näyttää laskurin ja juuri tehdyn operaation");
    currentGeneratedPlan = null;
    currentProductionExecutionState = null;
    assert(restoreSavedWorkState() && elements.result.innerHTML.includes("1 / 4 tehty") &&
        currentProductionExecutionState.planDigest === repeatDigest, "Todellinen reload palauttaa ryhmän 1/4 ilman ryhmästatea");
    completeCurrentProductionOperation();
    assert(elements.result.innerHTML.includes("2 / 4 tehty"), "Toinen painallus näyttää 2/4");
    undoLatestProductionOperation();
    assert(elements.result.innerHTML.includes("1 / 4 tehty") && repeatView().previous.length === 1,
        "Undo ryhmän sisällä palauttaa laskurin ja historian");
    completeCurrentProductionOperation();
    completeCurrentProductionOperation();
    assert(elements.result.innerHTML.includes("3 / 4 tehty") && repeatView().previous.length === 3 && repeatView().next.length === 3,
        "Ryhmän lopulla näkyy kolme tehtyä ja kolme seuraavaa");
    completeCurrentProductionOperation();
    assert(repeatView().current.id === repeatExecution.operations[4].id && !elements.result.innerHTML.includes("4 / 4 tehty"),
        "Neljäs kuittaus avaa seuraavan työvaiheen");
    undoLatestProductionOperation();
    assert(elements.result.innerHTML.includes("3 / 4 tehty"), "Undo ryhmärajan yli palauttaa saman ryhmän");
    assert(JSON.stringify({ plan: currentGeneratedPlan, execution: createProductionExecution(currentGeneratedPlan, liveOrders, 3) }) === repeatSnapshot &&
        currentProductionExecutionState.planDigest === repeatDigest && isValidStoredWorkState(JSON.parse(storage)),
        "Ryhmittely ei muuta materiaalia, scheduleria, digestiä tai tallenteen kelvollisuutta");
    assert(Object.keys(JSON.parse(storage).executionState).sort().join() === "events,planDigest,version",
        "Persistenssi ei sisällä rinnakkaista ryhmälaskuria");
    // Renderöi valmisteluryhmät oikean materiaaliplanin mukaan; testissä lisätään
    // seuraavaksi harmaat jäännökset aidon calculate-polun kautta.
    stockRows.push(...Object.keys(PROFILE_TYPES).map(profileType => ({
        profileType, color: "gray", quantity: "1", unlimited: true, additional: true
    })));
    remnantRows = [1740, 1510].map(length => ({profileType: "verticalProfile", color: "gray", length: String(length), quantity: "1"}));
    liveOrders.push(createOrderInput("gray", "Harmaat", "gray", {
        verticalProfile: [{ length: "1300", quantity: "10", openingId: "C" }]
    }));
    elements.minBatchPieces.value = "200";
    elements.targetBatchPieces.value = "250";
    elements.maxBatchPieces.value = "300";
    await calculate();
    const prepExecution = createProductionExecution(currentGeneratedPlan, liveOrders, 3);
    const prepGroups = groupWorkerPreparationSources(createWorkerSourceManifest(currentGeneratedPlan, prepExecution), ["verticalProfile"]);
    assert(prepGroups.some(group => group.color === "gray" && group.origin === "old-remnant" && group.sources.length === 2) &&
        prepGroups.some(group => group.color === "gray" && group.origin === "new") &&
        prepGroups.some(group => group.color === "black" && group.origin === "new"), "Aktiivinen blokki sisältää kaksi väriä sekä uudet ja jäännökset");
    assert(preparationHtml().includes("1740 mm") && preparationHtml().includes("1510 mm") &&
        preparationHtml().includes("Harmaa") && preparationHtml().includes("Musta") &&
        !preparationHtml().includes("Vaakaprofiili") && !preparationHtml().includes("HAE NYT"),
        "Valmistelu näyttää koko blokin materiaalitarpeen tunnisteineen ilman kantomääräohjetta");
    for (const blocked of [false, true]) {
        const fixture = createProductionSourceDeviationFixture(blocked);
        liveOrders = fixture.orders;
        currentGeneratedPlan = fixture.plan;
        currentProductionExecutionState = createInitialProductionExecutionState(fixture.plan, fixture.execution);
        stockRows = Object.keys(PROFILE_TYPES).map(profileType => ({ profileType, color: "black", quantity: "7", unlimited: false, additional: false }));
        remnantRows = [];
        completedBarIds.clear();
        currentGeneratedPlan.bars.forEach(bar => completedBarIds.add(bar.id));
        saveCurrentWorkState();
        assert(!isCurrentPlanReadyForFinalization(), "Pelkkä salon valmistumismerkintä ei ohita toteumalokia");
        const original = JSON.stringify(currentGeneratedPlan);
        elements.deviationPlannedSlot.value = String(fixture.execution.operations[0].sources.findIndex(s => s.id === "bar-7"));
        updateProductionSourceChoices();
        assert(elements.deviationActualSource.innerHTML.includes('value="bar-3"'), "Vaihtoehdot tulevat fyysisestä taseesta");
        elements.deviationActualSource.value = "bar-3";
        const beforeDeviation = storage;
        failWrite = true;
        completeCurrentProductionDeviation();
        assert(currentProductionExecutionState.events.length === 0 && storage === beforeDeviation && completedBarIds.size === 7,
            "Poikkeaman tallennusvirhe säilyttää lokin ja salon valmistumiset");
        failWrite = false;
        completeCurrentProductionDeviation();
        assert(currentProductionExecutionState.version === 2 && currentProductionExecutionState.events.length === 1 &&
            !completedBarIds.has("bar-3"), "Poikkeama kirjautuu ja oikean salon valmistumismerkintä poistuu");
        assert(JSON.stringify(currentGeneratedPlan) === original && elements.result.innerHTML.includes("Suunniteltu Pystyprofiili 7 → toteutunut Pystyprofiili 3"),
            "Alkuperäinen plan säilyy ja molemmat salot näkyvät");
        assert(isValidStoredWorkState(JSON.parse(storage)), "Poikkeamasnapshot validoituu myös estotilassa");
        const savedDeviation = storage;
        currentProductionExecutionState = null;
        currentGeneratedPlan = null;
        assert(restoreSavedWorkState() && currentProductionExecutionState.version === 2 && JSON.stringify(currentGeneratedPlan) === original,
            "Reload palauttaa poikkeaman ja alkuperäisen planin");
        assert(elements.result.innerHTML.includes("Työ pysäytetty") === blocked, "Reload johtaa oikean jatkoeston");
        await calculate();
        startNewWork();
        handleOrderInputChange();
        assert(storage === savedDeviation && JSON.stringify(currentGeneratedPlan) === original, "Laskenta, uusi työ tai syötemuutos eivät hävitä toteutunutta poikkeamaa");
        failWrite = true;
        undoLatestProductionOperation();
        assert(storage === savedDeviation && currentProductionExecutionState.events.length === 1, "Undon tallennusvirhe säilyttää poikkeaman");
        failWrite = false;
        undoLatestProductionOperation();
        assert(currentProductionExecutionState.events.length === 0 && !hasCurrentProductionDeviation() && !elements.result.innerHTML.includes("Työ pysäytetty"),
            "Undo palauttaa fyysiset pituudet, poistaa eston ja vapauttaa syötteet");
        completeCurrentProductionDeviation();
        if (blocked) {
            const stopped = storage;
            completeCurrentProductionOperation();
            currentGeneratedPlan.bars.forEach(bar => completedBarIds.add(bar.id));
            finalizeCurrentWork();
            assert(currentProductionExecutionState.events.length === 1 && storage === stopped && currentGeneratedPlan !== null,
                "Mahdotonta työtä ei voi jatkaa tai finalisoida edes kaikilla salon kuittauksilla");
        } else {
            while (currentProductionExecutionState.events.length < fixture.execution.operations.length) completeCurrentProductionOperation();
            currentGeneratedPlan.bars.forEach(bar => completedBarIds.add(bar.id));
            const actualPlan = createExecutedMaterialPlan(currentProductionExecutionState, currentGeneratedPlan, fixture.execution, 3);
            const expected = calculatePostOrderMaterialInventory(actualPlan, createMaterialInventory(getMaterialAvailabilityFromForm()), PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
            failWrite = true;
            const beforeFinal = storage;
            finalizeCurrentWork();
            assert(storage === beforeFinal && currentGeneratedPlan !== null, "Poikkeaman finalisointivirhe säilyttää työn");
            failWrite = false;
            finalizeCurrentWork();
            assert(currentGeneratedPlan === null && liveOrders.length === 0 &&
                JSON.stringify(createMaterialInventory(getMaterialAvailabilityFromForm())) === JSON.stringify(createMaterialInventory(expected)),
                "Finalisointi käyttää toteutunutta varastosiirtymää");
            assert(stockRows.find(row => row.profileType === "verticalProfile").quantity === "1" && remnantRows.some(row => row.length === "2972"),
                "Kuusi uutta salkoa kuluu seitsemästä ja salon 3 toteutunut jäännös tallentuu");
        }
    }
    const continuationFixture = createProductionContinuationStateFixture();
    const prepareContinuation = (fixture = continuationFixture) => {
        liveOrders = fixture.orders;
        currentGeneratedPlan = fixture.plan;
        currentProductionExecutionState = JSON.parse(JSON.stringify(fixture.base));
        stockRows = Object.keys(PROFILE_TYPES).map(profileType => ({ profileType, color: "black", quantity: fixture.plan.bars.some(b => b.source === "remnant") ? "6" : "7", unlimited: false, additional: false }));
        remnantRows = fixture.plan.bars.some(b => b.source === "remnant")
            ? [{ profileType: "verticalProfile", color: "black", length: "6000", quantity: "1" }] : [];
        completedBarIds.clear();
        fixture.plan.bars.forEach(bar => completedBarIds.add(bar.id));
        saveCurrentWorkState();
    };
    prepareContinuation();
    renderCuttingPlan(currentGeneratedPlan);
    assert(elements.result.innerHTML.includes('onclick="activateCurrentProductionContinuationFromUi(this)"') &&
        elements.result.innerHTML.includes("MUODOSTA JATKOSUUNNITELMA"), "V2-pysähdys tarjoaa jatkon aktivoinnin");
    const stoppedSnapshot = storage;
    const search = createProductionContinuationPlan;
    createProductionContinuationPlan = () => ({ complete: false, feasibilityStatus: "unknown" });
    assert(!activateCurrentProductionContinuation() && storage === stoppedSnapshot && currentProductionExecutionState.version === 2 && completedBarIds.size === 7,
        "Ratkaisematon haku säilyttää V2:n ja kaikki valmistumismerkinnät");
    const activationButton = { disabled: false, textContent: "MUODOSTA JATKOSUUNNITELMA", isConnected: true };
    const pendingActivation = activateCurrentProductionContinuationFromUi(activationButton);
    assert(activationButton.disabled && productionContinuationActivationPending &&
        !(await activateCurrentProductionContinuationFromUi(activationButton)), "Aktivoinnin UI lukitsee painikkeen ja estää tuplapainalluksen");
    assert(!(await pendingActivation) && !activationButton.disabled && !productionContinuationActivationPending &&
        storage === stoppedSnapshot && elements.operationStatus.textContent.includes("ei löytynyt"), "Ratkaisematon UI-haku palauttaa painikkeen ja näyttää virheen");
    createProductionContinuationPlan = search;
    failWrite = true;
    assert(!(await activateCurrentProductionContinuationFromUi(activationButton)) && storage === stoppedSnapshot && currentProductionExecutionState.version === 2 && completedBarIds.size === 7,
        "Aktivoinnin tallennusvirhe säilyttää V2:n atomisesti");
    failWrite = false;
    assert(await activateCurrentProductionContinuationFromUi(activationButton) && currentProductionExecutionState.version === 3, "UI-controller aktivoi validoidun V3:n");
    const assignedIds = new Set(currentProductionExecutionState.continuation.assignments.map(a => a.sourceId));
    assert(continuationFixture.plan.bars.every(b => completedBarIds.has(b.id) === !assignedIds.has(b.id)) &&
        JSON.parse(storage).completedBarIds.join() === [...completedBarIds].join(), "Aktivointi tyhjentää vain jatkon käyttämät valmistumismerkinnät samassa snapshotissa");
    const emptyV3 = storage;
    createProductionContinuationPlan = () => { throw new Error("Reload ei saa hakea"); };
    currentProductionExecutionState = null;
    assert(restoreSavedWorkState() && JSON.stringify(currentProductionExecutionState) === JSON.stringify(JSON.parse(emptyV3).executionState), "Tyhjä V3 palautuu ilman optimizeria");
    assert(elements.result.innerHTML.includes('onclick="completeCurrentProductionOperation()"') && elements.result.innerHTML.includes("JATKOSUUNNITELMA") &&
        !elements.result.innerHTML.includes("Käytin eri salkoa") && elements.result.innerHTML.includes("HYLKÄÄ JATKOSUUNNITELMA") &&
        elements.result.innerHTML.includes("Alkuperäinen sahaussuunnitelma · vertailu"),
        "V3 näyttää jatkon kuittauksen ja tyhjän jatkon hylkäyksen ilman lähdepoikkeamaa");
    const activeContinuation = replayProductionExecution(currentProductionExecutionState, currentGeneratedPlan, continuationFixture.execution, 3).continuationExecution;
    assert(elements.result.innerHTML.includes('data-operation-id="' + activeContinuation.operations[0].id + '"') &&
        elements.result.innerHTML.includes("Salot 5</p>") &&
        elements.result.innerHTML.includes("Suunniteltu Pystyprofiili 7 → toteutunut Pystyprofiili 3"),
        "Jatkon operaatio käyttää omaa scheduleria, valmistelu säilyttää Pysty 5 -numeron ja poikkeamahistoria säilyy");
    failWrite = true;
    assert(!discardCurrentProductionContinuation() && storage === emptyV3 && currentProductionExecutionState.version === 3, "Hylkäyksen tallennusvirhe säilyttää V3:n");
    completeCurrentProductionOperation();
    assert(storage === emptyV3 && currentProductionExecutionState.continuation.events.length === 0, "Jatkokuittauksen tallennusvirhe säilyttää tyhjän lokin");
    failWrite = false;
    undoLatestProductionOperation();
    assert(storage === emptyV3 && currentProductionExecutionState.events.length === 1, "Tavallinen undo ei ylitä tyhjää jatkorajaa");
    assert(discardCurrentProductionContinuation() && currentProductionExecutionState.version === 2 &&
        JSON.stringify(currentProductionExecutionState.events) === JSON.stringify(continuationFixture.base.events), "Erillinen hylkäys palauttaa alkuperäisen V2-pysähdyksen");
    undoLatestProductionOperation();
    assert(currentProductionExecutionState.events.length === 0, "V2:ssa alkuperäisen kirjauksen undo toimii edelleen");
    createProductionContinuationPlan = search;
    for (const oldRemnant of [false, true]) {
        const fixture = createProductionContinuationStateFixture(oldRemnant);
        prepareContinuation(fixture);
        liveOrders = [...liveOrders, createOrderInput("waiting-v3", "Odottava", "black", {
            verticalProfile: [{ length: "1200", quantity: "1", openingId: "W" }]
        })];
        assert(persistProductionExecutionState(fixture.state), "Tunnettu riippumaton jatkojako tallentuu");
        const baseEvents = JSON.stringify(currentProductionExecutionState.events);
        for (let index = 0; index < fixture.continuationPlan.execution.operations.length; index++) {
            currentGeneratedPlan.bars.forEach(b => completedBarIds.add(b.id));
            completeCurrentProductionOperation();
            const event = currentProductionExecutionState.continuation.events[index];
            assert(!elements.result.innerHTML.includes("HYLKÄÄ JATKOSUUNNITELMA") &&
                elements.result.innerHTML.includes('onclick="undoLatestProductionOperation()" >'), "Kirjatulla jatkolla on käytettävä undo mutta ei hylkäystä");
            assert(event.actualSourceIds.every(id => !completedBarIds.has(id)), "Kuittaus poistaa muutettujen fyysisten salojen valmistumismerkinnät");
            const beforeReload = storage;
            const renderedBeforeReload = elements.result.innerHTML;
            createProductionContinuationPlan = () => { throw new Error("Reload ei saa hakea"); };
            assert(restoreSavedWorkState() && storage === beforeReload && JSON.stringify(currentProductionExecutionState) === JSON.stringify(JSON.parse(beforeReload).executionState), "Osittainen/valmis V3 palautuu täsmälleen ilman hakua");
            assert(elements.result.innerHTML === renderedBeforeReload, "V3 reload säilyttää koko renderöidyn kortin, numerot, esikatselun ja valmistumismerkinnät");
            createProductionContinuationPlan = search;
            failWrite = true;
            undoLatestProductionOperation();
            assert(storage === beforeReload && currentProductionExecutionState.continuation.events.length === index + 1, "V3-undon tallennusvirhe ei muuta lokia");
            failWrite = false;
            event.actualSourceIds.forEach(id => completedBarIds.add(id));
            undoLatestProductionOperation();
            assert(currentProductionExecutionState.continuation.events.length === index && JSON.stringify(currentProductionExecutionState.events) === baseEvents &&
                event.actualSourceIds.every(id => !completedBarIds.has(id)), "Undo säilyttää base-prefixin ja poistaa valmistumismerkinnät");
            completeCurrentProductionOperation();
        }
        assert(!isCurrentPlanReadyForFinalization(), "Kaikki kappaleet eivät yksin riitä ilman salon valmistumismerkintöjä");
        const markButton = id => ({ dataset: { barId: id, barNumber: id }, closest: () => ({}) });
        const missingId = currentGeneratedPlan.bars.find(b => !completedBarIds.has(b.id)).id;
        const beforeMark = storage;
        failWrite = true;
        toggleBarCompletion(markButton(missingId));
        assert(!completedBarIds.has(missingId) && storage === beforeMark, "V3-salon valmistumismerkintä tallentuu ennen live-tilan vaihtoa");
        failWrite = false;
        currentGeneratedPlan.bars.filter(b => !completedBarIds.has(b.id)).forEach(b => toggleBarCompletion(markButton(b.id)));
        assert(isCurrentPlanReadyForFinalization(), "Valmis yhdistetty toteuma ja koko manifestin merkinnät sallivat finalisoinnin");
        saveCurrentWorkState();
        const beforeFinal = storage, originalStock = JSON.stringify(stockRows), originalOrders = JSON.stringify(liveOrders);
        failWrite = true;
        finalizeCurrentWork();
        assert(storage === beforeFinal && JSON.stringify(stockRows) === originalStock && JSON.stringify(liveOrders) === originalOrders &&
            JSON.stringify(currentProductionExecutionState) === JSON.stringify(JSON.parse(beforeFinal).executionState), "Finalisoinnin tallennusvirhe säilyttää koko V3:n, varaston ja tilaukset");
        failWrite = false;
        finalizeCurrentWork();
        assert(currentGeneratedPlan === null && currentProductionExecutionState === null && liveOrders.length === 1 && liveOrders[0].id === "waiting-v3" && JSON.parse(storage).orders[0].id === "waiting-v3",
            "Batch poistuu vasta lopullisen snapshotin onnistuttua");
        assert(stockRows.find(r => r.profileType === "verticalProfile").quantity === "2", "Vain käytetyt alkuperäiset uudet salot kuluvat, kaksi käyttämätöntä säilyy");
        assert(remnantRows.length === 2 && remnantRows.some(r => r.length === "4976" && r.quantity === "3") &&
            remnantRows.some(r => r.length === "3468" && r.quantity === "1"), "Yhdistetyt riippumattomat jäännökset: 4976 × 3 ja 3468 × 1; 976 on romua ja vanha 6000 kului kerran");
    }
    prepareContinuation();
    persistProductionExecutionState(continuationFixture.state);
    completeCurrentProductionOperation();
    const validRecoverySnapshot = storage;
    const corrupt = JSON.parse(storage); corrupt.executionState.continuation.digest += "broken";
    storage = JSON.stringify(corrupt);
    const corruptRaw = storage;
    assert(!restoreSavedWorkState() && workRecoveryLocked && storage === corruptRaw, "Korruptoitunut V3 lukitsee palautuksen ja säilyttää raakatallenteen");
    assert(elements.result.textContent.includes("tallenne säilytettiin") && elements.result.textContent.includes("Uutta työtä ei voi aloittaa"),
        "Recovery-ilmoitus kertoo säilytetystä tallenteesta ja uuden työn estosta");
    assert(!saveCurrentWorkState() && !writeWorkStateSnapshot(createWorkStateSnapshot()), "Automaattinen ja suora tallennus eivät ohita recovery-lukkoa");
    removeSavedWorkState(); resetWorkToDefaults(); startNewWork(); handleOrderInputChange();
    await calculate(); completeCurrentProductionOperation(); undoLatestProductionOperation(); finalizeCurrentWork();
    assert(storage === corruptRaw, "Tyhjennys, syötteet, laskenta ja tuotannon controllerit eivät hävitä korruptoitunutta toteumaa");
    storage = validRecoverySnapshot;
    assert(restoreSavedWorkState() && !workRecoveryLocked && currentProductionExecutionState.version === 3, "Vain kelvollinen palautus vapauttaa recovery-lukon");
    for (const mutate of [s => s.schemaVersion = 5, s => s.engineVersion = "wrong", s => s.executionState.version = 2,
        s => delete s.executionState.continuation, s => s.completedBarIds.push("foreign")]) {
        const invalid = JSON.parse(validRecoverySnapshot); mutate(invalid); storage = JSON.stringify(invalid);
        const raw = storage;
        assert(!restoreSavedWorkState() && workRecoveryLocked && !saveCurrentWorkState() && storage === raw,
            "V3:n outer-, engine-, version-, rakenne- ja manifestivirheitä ei migroida tai ylikirjoiteta");
        storage = validRecoverySnapshot; restoreSavedWorkState();
    }
    const railsFixture = createRailContinuationRegressionFixture();
    liveOrders = railsFixture.orders;
    currentGeneratedPlan = railsFixture.plan;
    currentProductionExecutionState = railsFixture.base;
    completedBarIds.clear();
    assert(activateCurrentProductionContinuation(), "Kiskojatko aktivoituu controllerista");
    assert(elements.result.innerHTML.includes("JATKOSUUNNITELMA") && elements.result.innerHTML.includes("SALOT · 2 kpl") &&
        elements.result.innerHTML.includes("Alakisko") && elements.result.innerHTML.includes("Yläkisko") &&
        elements.result.innerHTML.includes("5000 mm"), "Continuationin 1+1 näkyy yhtenä kiskosekanippuna");
    storage = validRecoverySnapshot.slice(0, -1);
    const brokenJson = storage;
    assert(!restoreSavedWorkState() && workRecoveryLocked && !saveCurrentWorkState() && storage === brokenJson, "Katkennut V3-JSON säilyy palautusta varten");
    console.log("Tuotannon ohjaus-/persistenssitestit: " + checks + " läpäisty");
})()`);

test.runInContext(context, { timeout: 60000 }).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
