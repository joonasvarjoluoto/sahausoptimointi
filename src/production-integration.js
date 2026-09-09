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

function isValidProductionExecutionState(state, plan, execution) {
    if (!isPlainObject(state) || state.version !== 1 ||
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
                typeof sourceId === "string" && sourceId === plannedSourceIds[sourceIndex]);
    });
}

function completeNextProductionOperation(state, plan, execution, completedAt = new Date().toISOString()) {
    if (!isValidProductionExecutionState(state, plan, execution) || state.events.length >= execution.operations.length ||
        typeof completedAt !== "string" || !Number.isFinite(Date.parse(completedAt))) {
        throw new Error("Seuraavaa työvaihetta ei voida kuitata.");
    }
    const operation = execution.operations[state.events.length];
    return { ...state, events: [...state.events, {
        type: "operation-completed", operationId: operation.id, completedAt,
        actualSourceIds: operation.sources.map(source => source.id)
    }] };
}

function undoLatestProductionOperationState(state, plan, execution) {
    if (!isValidProductionExecutionState(state, plan, execution) || state.events.length === 0) {
        throw new Error("Peruttavaa työvaihetta ei ole.");
    }
    return { ...state, events: state.events.slice(0, -1) };
}

function renderProductionDetails(plan, productionState) {
    if (!plan.batch) return "";
    const orders = getOrdersFromForm();
    const selected = getPlanOrders(plan, orders);
    const execution = createProductionExecution(plan, orders, Number(document.getElementById("kerf").value));
    if (!isValidProductionExecutionState(productionState, plan, execution)) {
        throw new Error("Sahausten toteumatila ei vastaa nykyistä suunnitelmaa.");
    }
    const manifest = createWorkerSourceManifest(plan, execution);
    const workerSourceById = new Map(manifest.map(source => [source.sourceId, source]));
    const score = scoreCompleteMaterialTransitionPlan(adaptStoredPlanForVerification(plan), PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    const count = normalizeOrderCuts(selected).reduce((n, cut) => n + cut.quantity, 0);
    const names = new Map(orders.map(o => [o.id, o.name || o.id]));
    const completedCount = productionState.events.length;
    const current = execution.operations[completedCount] ?? null;
    const next = execution.operations[completedCount + 1] ?? null;
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
            const sources = manifest.filter(source => activeBlock.profileTypes.includes(source.profileType));
            const text = blockText[activeBlock.id] ?? {
                title: activeBlock.id.toUpperCase(), preparation: "Valmistele profiilin salot"
            };
            return `<details class="worker-preparation" open><summary>${text.preparation} · ${sources.length} kpl</summary>
                <p>Hae ja merkitse vain tämän profiiliblokin fyysiset salot.</p>
                <div class="worker-source-manifest">${sources.map(source => `<div class="worker-source-row">
                    <strong>${source.workerNumber}</strong><span>${escapeHtml(PROFILE_TYPES[source.profileType].label)} · ${escapeHtml(getMaterialColorLabel(source.color))}<br>${formatMillimeters(source.sourceLength)} · ${source.origin === "new" ? "uusi salko" : "olemassa oleva jäännös"}</span>
                </div>`).join("")}</div></details>`;
        })();
    const currentCard = current === null
        ? `<section class="production-current production-current--complete"><h2>Kaikki työvaiheet tehty ✓</h2>
            <p>Voit tarkistaa salot ja päättää työn, kun jokainen fyysinen salko on merkitty valmiiksi.</p></section>`
        : `<section class="production-current" data-operation-id="${escapeHtml(current.id)}">
            <h2 class="production-block-title">${blockText[activeBlock.id]?.title ?? escapeHtml(activeBlock.id)}</h2>
            <p class="production-operation-progress">${operationTitle(current)}</p>
            <div class="production-cut-length">${formatMillimeters(current.length)}</div>
            <p class="production-source-label">SALOT · ${current.sources.length} kpl</p>
            <div class="worker-source-chips" aria-label="Käytettävät salot">${sourceChips(current)}</div>
            <p class="production-piece-count">Tuota ${current.pieces.length} kappaletta</p>
            <p class="production-operation-secondary">${current.sources.map(source => escapeHtml(PROFILE_TYPES[source.profileType].label)).filter((value, index, values) => values.indexOf(value) === index).join(" / ")} · ${current.sources.map(source => escapeHtml(getMaterialColorLabel(source.color))).filter((value, index, values) => values.indexOf(value) === index).join(" / ")}<br>${operationOrders(current)}</p>
            <button class="operation-completion-button" type="button" onclick="completeCurrentProductionOperation()">
                ${current.kind === "cut" ? "SAHAUS TEHTY" : "POIMINTA TEHTY"}
            </button>
        </section>`;
    const completedOperations = execution.operations.slice(0, completedCount);
    const completedDetails = completedOperations.length
        ? `<details class="production-completed"><summary>Tehdyt työvaiheet · ${completedOperations.length}</summary><ol>
            ${completedOperations.map(operation => `<li>${operationTitle(operation)} · ${formatMillimeters(operation.length)} · ${operation.sources.map(source => `${escapeHtml(PROFILE_TYPES[source.profileType].label)} ${workerNumber(source.id)}`).join(", ")}</li>`).join("")}
            </ol></details>` : "";
    const nextPreview = next === null ? "" : `<aside class="production-next"><strong>Seuraavaksi:</strong> ${blockText[operationBlock(next).id]?.title ?? escapeHtml(operationBlock(next).id)} · ${operationTitle(next)} · ${formatMillimeters(next.length)} · ${next.sources.map(source => `${escapeHtml(PROFILE_TYPES[source.profileType].label)} ${workerNumber(source.id)}`).join(", ")}</aside>`;
    return `<section class="plan-summary"><h2>Tuotantobatch · ${count} kpl${count > plan.batch.settings.maxBatchPieces ? " · oversized" : ""}</h2>
        <p>Kokonaiset tilaukset; yhtäkään tilausta ei jaeta. Jonoon jää ${orders.length - selected.length} tilausta.</p>
        <ul>${selected.map(o => `<li>${escapeHtml(o.name || o.id)} · ${normalizeOrderCuts([o]).reduce((n, c) => n + c.quantity, 0)} kpl</li>`).join("")}</ul>
        <p>Min / tavoite / max: ${plan.batch.settings.minBatchPieces} / ${plan.batch.settings.targetBatchPieces} / ${plan.batch.settings.maxBatchPieces}.
        Valinta: nykyinen materiaalipiste; tavoitekoon etäisyys vain tasatilanteessa. Materiaaliratkaisu on heuristinen.</p>
        <p>Materiaalipiste ${score.totalCostEquivalent.toFixed(1)}: lähdearvo ${score.sourceValueEquivalent.toFixed(1)}
        − jäännöskrediitti ${score.recoveredRemnantValueEquivalent.toFixed(1)} − kerf-krediitti ${score.kerfRecoveredValueEquivalent.toFixed(1)}
        + jäännöskäsittely ${score.remnantHandlingPenaltyEquivalent.toFixed(1)} + uuden jäännöksen luonti ${score.newStockRemnantCreationPenaltyEquivalent.toFixed(1)}
        + suuri romu ${score.largeScrapPenaltyEquivalent.toFixed(1)}. Yksikkö: materiaalin ekvivalenttipituus, ei euro.</p></section>
        ${preparation}
        <section class="production-execution" aria-label="Sahausten eteneminen">
            <p class="production-total-progress" aria-live="polite">${activeBlock === null
                ? `Tehty ${completedCount} / ${execution.operations.length} työvaihetta`
                : `${blockText[activeBlock.id]?.title ?? escapeHtml(activeBlock.id)} ${activeBlockCompleted} / ${activeBlockOperations.length} · koko batch ${completedCount} / ${execution.operations.length}`}</p>
            ${currentCard}${nextPreview}${completedDetails}
            <button class="operation-undo-button" type="button" onclick="undoLatestProductionOperation()" ${completedCount ? "" : "disabled"}>Peru viimeisin kuittaus</button>
            <p id="operationStatus" class="finalization-status" aria-live="polite"></p>
        </section>
        <details class="plan-summary"><summary>Tuotantomittarit · ${execution.metrics.cutOperationCount} sahausliikettä</summary>
        <p>Mittavasteen siirrot (ensimmäinen asetus mukana): ${execution.metrics.stopPositionChanges}. Nippukapasiteetin käyttö: ${Math.round(execution.metrics.bundleUtilization * 100)} %.
        Sahausliike on käynnistetyn sahan terän laskeminen leikkuuseen. Mittavaste asetetaan ensimmäiseen sahausmittaan ja siirretään mitan muuttuessa. Tuotantomittareita ei käytetä pisteytyksessä.</p></details>`;
}
