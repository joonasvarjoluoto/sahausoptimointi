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

function renderProductionDetails(plan) {
    if (!plan.batch) return "";
    const orders = getOrdersFromForm();
    const selected = getPlanOrders(plan, orders);
    const execution = createProductionExecution(plan, orders, Number(document.getElementById("kerf").value));
    const score = scoreCompleteMaterialTransitionPlan(adaptStoredPlanForVerification(plan), PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    const count = normalizeOrderCuts(selected).reduce((n, cut) => n + cut.quantity, 0);
    const originLabels = { new: "uusi salko", "old-remnant": "vanha jäännös", "same-run-remnant": "saman batchin jäännös" };
    const names = new Map(orders.map(o => [o.id, o.name || o.id]));
    return `<section class="plan-summary"><h2>Tuotantobatch · ${count} kpl${count > plan.batch.settings.maxBatchPieces ? " · oversized" : ""}</h2>
        <p>Kokonaiset tilaukset; yhtäkään tilausta ei jaeta. Jonoon jää ${orders.length - selected.length} tilausta.</p>
        <ul>${selected.map(o => `<li>${escapeHtml(o.name || o.id)} · ${normalizeOrderCuts([o]).reduce((n, c) => n + c.quantity, 0)} kpl</li>`).join("")}</ul>
        <p>Min / tavoite / max: ${plan.batch.settings.minBatchPieces} / ${plan.batch.settings.targetBatchPieces} / ${plan.batch.settings.maxBatchPieces}.
        Valinta: nykyinen materiaalipiste; tavoitekoon etäisyys vain tasatilanteessa. Materiaaliratkaisu on heuristinen.</p>
        <p>Materiaalipiste ${score.totalCostEquivalent.toFixed(1)}: lähdearvo ${score.sourceValueEquivalent.toFixed(1)}
        − jäännöskrediitti ${score.recoveredRemnantValueEquivalent.toFixed(1)} − kerf-krediitti ${score.kerfRecoveredValueEquivalent.toFixed(1)}
        + jäännöskäsittely ${score.remnantHandlingPenaltyEquivalent.toFixed(1)} + uuden jäännöksen luonti ${score.newStockRemnantCreationPenaltyEquivalent.toFixed(1)}
        + suuri romu ${score.largeScrapPenaltyEquivalent.toFixed(1)}. Yksikkö: materiaalin ekvivalenttipituus, ei euro.</p></section>
        <details class="plan-summary"><summary>Sahausjärjestys · ${execution.metrics.cutOperationCount} sahausliikettä</summary>
        <p>Mittavasteen siirrot (ensimmäinen asetus mukana): ${execution.metrics.stopPositionChanges}. Nippukapasiteetin käyttö: ${Math.round(execution.metrics.bundleUtilization * 100)} %.
        Sahausliike on käynnistetyn sahan terän laskeminen leikkuuseen. Mittavaste asetetaan ensimmäiseen sahausmittaan ja siirretään mitan muuttuessa. Tuotantomittareita ei käytetä pisteytyksessä. Aukon tunnus tulee mittarivin valinnaisesta syötteestä.</p>
        <ol>${execution.operations.map(op => `<li><strong>${op.kind === "release" ? "Valmiin loppukappaleen poiminta" : "Sahausliike"} · ${escapeHtml(op.compatibilityGroup)} · ${formatMillimeters(op.length)} · ${op.sources.length} lähdettä</strong>
            <ul>${op.sources.map((s, i) => `<li>${escapeHtml(s.id)} · ${escapeHtml(PROFILE_TYPES[s.profileType].label)} · ${escapeHtml(getMaterialColorLabel(s.color))} · ${originLabels[s.origin]}
            (${formatMillimeters(s.before)} → ${formatMillimeters(s.after)}) · tilaus ${escapeHtml(names.get(op.pieces[i].orderId) || op.pieces[i].orderId)}
            · aukko ${escapeHtml(op.pieces[i].openingId ?? "ei annettu")} · ${escapeHtml(op.pieces[i].pieceId)}</li>`).join("")}</ul></li>`).join("")}</ol></details>`;
}
