

function createCutRow(length = "", quantity = "1") {

    const row = document.createElement("div");

    row.className = "cut-row";

    row.innerHTML = `
        <label class="form-field">
            <span>Kappaleen pituus (mm)</span>
            <input
                class="cut-length"
                type="number"
                step="0.1"
                inputmode="decimal"
                placeholder="Mitta"
            >
        </label>

        <label class="form-field">
            <span>Määrä (kpl)</span>
            <input
                class="cut-quantity"
                type="number"
                step="1"
                inputmode="numeric"
                placeholder="Kpl"
            >
        </label>

        <button
            class="remove-cut-button"
            type="button"
            onclick="removeCut(this)"
        >
            POISTA
        </button>
    `;

    row.querySelector(".cut-length").value = String(length);
    row.querySelector(".cut-quantity").value = String(quantity);

    return row;
}

function createRemnantRow(
    length = "",
    quantity = "1"
) {

    const row = document.createElement("div");

    row.className = "cut-row remnant-row";

    row.innerHTML = `
        <label class="form-field">
            <span>Jäännöksen pituus (mm)</span>
            <input
                class="remnant-length"
                type="number"
                step="0.1"
                inputmode="decimal"
                placeholder="Mitta"
            >
        </label>

        <label class="form-field">
            <span>Määrä (kpl)</span>
            <input
                class="remnant-quantity"
                type="number"
                step="1"
                inputmode="numeric"
                placeholder="Kpl"
            >
        </label>

        <button
            class="remove-cut-button"
            type="button"
            onclick="removeRemnant(this)"
        >
            POISTA
        </button>
    `;

    row.querySelector(".remnant-length").value =
        String(length);

    row.querySelector(".remnant-quantity").value =
        String(quantity);

    return row;
}


function addRemnant() {

    const remnantList =
        document.getElementById("remnantList");

    remnantList.appendChild(
        createRemnantRow()
    );

    handleOrderInputChange();
}


function removeRemnant(button) {

    const row = button.parentElement;

    row.remove();

    handleOrderInputChange();
}


function updateStockQuantityAvailability() {

    const unlimitedStock =
        document.getElementById("unlimitedStock");

    const stockQuantity =
        document.getElementById("stockQuantity");

    stockQuantity.disabled =
        unlimitedStock.checked;
}


function addCut() {

    const cutList = document.getElementById("cutList");

    cutList.appendChild(createCutRow());
    handleOrderInputChange();
}


function removeCut(button) {

    const row = button.parentElement;

    row.remove();
    handleOrderInputChange();
}


function getCutsFromForm() {

    const lengthInputs =
        document.querySelectorAll(".cut-length");

    const quantityInputs =
        document.querySelectorAll(".cut-quantity");

    const cuts = [];

    for (let i = 0; i < lengthInputs.length; i++) {

        const length = Number(lengthInputs[i].value);
        const quantity = Number(quantityInputs[i].value);

        cuts.push({
            length: length,
            quantity: quantity
        });
    }

    return cuts;
}

function getMaterialAvailabilityFromForm() {

    const stockLength =
        Number(
            document.getElementById("stockLength").value
        );

    const unlimitedStock =
        document.getElementById("unlimitedStock").checked;

    const stockQuantity =
        unlimitedStock
            ? null
            : Number(
                document.getElementById("stockQuantity").value
            );

    const remnantRows =
        document.querySelectorAll(".remnant-row");

    const remnants = [];

    for (const row of remnantRows) {

        const length =
            Number(
                row.querySelector(".remnant-length").value
            );

        const quantity =
            Number(
                row.querySelector(".remnant-quantity").value
            );

        remnants.push({
            length: length,
            quantity: quantity
        });
    }

    return {
        stockLength: stockLength,
        unlimitedStock: unlimitedStock,
        stockQuantity: stockQuantity,
        remnants: remnants
    };
}


function validateMaterialAvailability(materialAvailability) {

    const {
        stockLength,
        unlimitedStock,
        stockQuantity,
        remnants
    } = materialAvailability;


    if (
        !Number.isFinite(stockLength) ||
        stockLength <= 0
    ) {
        throw new Error(
            "Raakatangon pituuden pitää olla suurempi kuin 0."
        );
    }


    if (!hasSupportedMillimeterPrecision(stockLength)) {
        throw new Error(
            "Raakatangon pituudessa saa olla enintään 0,1 mm tarkkuus."
        );
    }


    if (typeof unlimitedStock !== "boolean") {
        throw new Error(
            "Raakatankojen saatavuustieto on virheellinen."
        );
    }


    if (!unlimitedStock) {

        if (
            !Number.isInteger(stockQuantity) ||
            stockQuantity < 0
        ) {
            throw new Error(
                "Uusien tankojen määrän pitää olla kokonaisluku, joka on vähintään 0."
            );
        }
    }


    if (!Array.isArray(remnants)) {
        throw new Error(
            "Jäännösten pitää olla taulukossa."
        );
    }


    for (const remnant of remnants) {

        if (
            !Number.isFinite(remnant.length) ||
            remnant.length <= 0
        ) {
            throw new Error(
                "Jäännöksen pituuden pitää olla suurempi kuin 0."
            );
        }


        if (!hasSupportedMillimeterPrecision(remnant.length)) {
            throw new Error(
                "Jäännöksen pituudessa saa olla enintään 0,1 mm tarkkuus."
            );
        }


        if (remnant.length > stockLength) {
            throw new Error(
                "Jäännös ei voi olla raakatankoa pidempi."
            );
        }


        if (
            !Number.isInteger(remnant.quantity) ||
            remnant.quantity <= 0
        ) {
            throw new Error(
                "Jäännöksen määrän pitää olla positiivinen kokonaisluku."
            );
        }
    }


    const remnantQuantity =
        remnants.reduce(
            (total, remnant) =>
                total + remnant.quantity,
            0
        );


    if (
        !unlimitedStock &&
        stockQuantity === 0 &&
        remnantQuantity === 0
    ) {
        throw new Error(
            "Käytettävissä ei ole yhtään materiaalikappaletta."
        );
    }


    return true;
}

function createMaterialInventory(
    materialAvailability
) {

    validateMaterialAvailability(
        materialAvailability
    );


    const quantitiesByLength = new Map();


    for (const remnant of materialAvailability.remnants) {

        const currentQuantity =
            quantitiesByLength.get(remnant.length) ?? 0;

        quantitiesByLength.set(
            remnant.length,
            currentQuantity + remnant.quantity
        );
    }


    const remnants =
        [...quantitiesByLength.entries()]
            .map(([length, quantity]) => ({
                length: length,
                quantity: quantity
            }))
            .sort(
                (first, second) =>
                    second.length - first.length
            );


    return {
        newStock: {
            length:
                materialAvailability.stockLength,

            unlimited:
                materialAvailability.unlimitedStock,

            quantity:
                materialAvailability.stockQuantity
        },

        remnants: remnants
    };
}

function cutPiece(remaining, piece, kerf) {

    const excess = remaining - piece;

    if (excess < 0) {

        return {
            possible: false,
            remaining: remaining,
            waste: 0
        };
    }

    if (excess >= kerf) {

        return {
            possible: true,
            remaining: excess - kerf,
            waste: kerf
        };
    }

    return {
        possible: true,
        remaining: 0,
        waste: excess
    };
}


const DP_DIMENSION_SCALE = 10;


function hasSupportedMillimeterPrecision(millimeters) {
    return Number.isFinite(millimeters) &&
        Number.isSafeInteger(
            millimeters * DP_DIMENSION_SCALE
        );
}


function millimetersToDpUnits(millimeters) {

    const units = millimeters * DP_DIMENSION_SCALE;


    if (!hasSupportedMillimeterPrecision(millimeters)) {

        throw new Error(
            "Mitan pitää käyttää enintään 0,1 mm tarkkuutta. " +
            "Arvoa ei pyöristetty: " +
            millimeters +
            " mm."
        );
    }


    return units;
}


function dpUnitsToMillimeters(units) {
    return units / DP_DIMENSION_SCALE;
}


function findBestPatternDP(items, stockLength, kerf) {

    if (!Array.isArray(items)) {

        throw new Error("Kappaleiden pitää olla taulukossa.");
    }


    if (!Number.isFinite(stockLength) || stockLength <= 0) {

        throw new Error(
            "Raakatangon pituuden pitää olla suurempi kuin 0."
        );
    }


    if (!Number.isFinite(kerf) || kerf < 0) {

        throw new Error(
            "Sahanterän leveyden pitää olla 0 tai suurempi."
        );
    }


    const stockLengthUnits =
        millimetersToDpUnits(stockLength);

    const kerfUnits = millimetersToDpUnits(kerf);

    const capacity = stockLengthUnits + kerfUnits;


    const chunks = [];


    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {

        const item = items[itemIndex];


        if (!Number.isFinite(item.length) || item.length <= 0) {

            throw new Error(
                "Kappaleen pituuden pitää olla suurempi kuin 0."
            );
        }


        if (
            !Number.isInteger(item.quantity) ||
            item.quantity <= 0
        ) {

            throw new Error(
                "Kappalemäärän pitää olla positiivinen kokonaisluku."
            );
        }


        const itemSize =
            millimetersToDpUnits(item.length) +
            kerfUnits;


        let remainingQuantity = Math.min(
            item.quantity,
            Math.floor(capacity / itemSize)
        );

        let chunkQuantity = 1;


        // Binääriryhmät pitävät suurenkin määrän ryhmämäärän pienenä.
        while (remainingQuantity > 0) {

            const quantity = Math.min(
                chunkQuantity,
                remainingQuantity
            );

            chunks.push({
                itemIndex: itemIndex,
                quantity: quantity,
                size: itemSize * quantity
            });

            remainingQuantity -= quantity;
            chunkQuantity *= 2;
        }
    }


    const reachable = new Uint8Array(capacity + 1);
    const previousCapacity = new Int32Array(capacity + 1);
    const previousChunk = new Int32Array(capacity + 1);

    previousCapacity.fill(-1);
    previousChunk.fill(-1);

    reachable[0] = 1;


    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {

        const chunk = chunks[chunkIndex];


        for (
            let usedCapacity = capacity;
            usedCapacity >= chunk.size;
            usedCapacity--
        ) {

            const sourceCapacity = usedCapacity - chunk.size;


            // Ensimmäinen reitti jää voimaan deterministiseksi tasatulokseksi.
            if (
                reachable[usedCapacity] === 0 &&
                reachable[sourceCapacity] === 1
            ) {

                reachable[usedCapacity] = 1;
                previousCapacity[usedCapacity] = sourceCapacity;
                previousChunk[usedCapacity] = chunkIndex;
            }
        }
    }


    let bestUsedCapacity = capacity;


    while (
        bestUsedCapacity > 0 &&
        reachable[bestUsedCapacity] === 0
    ) {

        bestUsedCapacity--;
    }


    const selectedQuantities =
        new Array(items.length).fill(0);

    let currentCapacity = bestUsedCapacity;


    while (currentCapacity > 0) {

        const chunk = chunks[previousChunk[currentCapacity]];

        selectedQuantities[chunk.itemIndex] +=
            chunk.quantity;

        currentCapacity =
            previousCapacity[currentCapacity];
    }


    const pattern = [];


    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {

        const quantity = selectedQuantities[itemIndex];


        if (quantity > 0) {

            pattern.push({
                length: items[itemIndex].length,
                quantity: quantity
            });
        }
    }


    let remaining = stockLength;
    let waste = 0;


    for (const item of pattern) {

        for (let i = 0; i < item.quantity; i++) {

            const result =
                cutPiece(
                    remaining,
                    item.length,
                    kerf
                );


            if (!result.possible) {

                throw new Error(
                    "DP-ratkaisu ei läpäissyt sahaustarkistusta."
                );
            }


            remaining = result.remaining;
            waste += result.waste;
        }
    }


    return {
        pattern: pattern,
        result: {
            possible: true,
            remaining: remaining,
            waste: waste
        }
    };
}


function findCandidatePatternsDP(
    items,
    stockLength,
    kerf,
    maxPatterns = 10
) {

    if (!Array.isArray(items)) {

        throw new Error("Kappaleiden pitää olla taulukossa.");
    }


    if (!Number.isInteger(maxPatterns) || maxPatterns <= 0) {

        throw new Error(
            "Ehdokasmäärän pitää olla positiivinen kokonaisluku."
        );
    }


    if (!Number.isFinite(stockLength) || stockLength <= 0) {

        throw new Error(
            "Raakatangon pituuden pitää olla suurempi kuin 0."
        );
    }


    if (!Number.isFinite(kerf) || kerf < 0) {

        throw new Error(
            "Sahanterän leveyden pitää olla 0 tai suurempi."
        );
    }


    const stockLengthUnits =
        millimetersToDpUnits(stockLength);

    const kerfUnits = millimetersToDpUnits(kerf);

    const capacity = stockLengthUnits + kerfUnits;


    const chunks = [];


    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {

        const item = items[itemIndex];


        if (!Number.isFinite(item.length) || item.length <= 0) {

            throw new Error(
                "Kappaleen pituuden pitää olla suurempi kuin 0."
            );
        }


        if (
            !Number.isInteger(item.quantity) ||
            item.quantity <= 0
        ) {

            throw new Error(
                "Kappalemäärän pitää olla positiivinen kokonaisluku."
            );
        }


        const itemSize =
            millimetersToDpUnits(item.length) +
            kerfUnits;


        let remainingQuantity = Math.min(
            item.quantity,
            Math.floor(capacity / itemSize)
        );

        let chunkQuantity = 1;


        while (remainingQuantity > 0) {

            const quantity = Math.min(
                chunkQuantity,
                remainingQuantity
            );

            chunks.push({
                itemIndex: itemIndex,
                quantity: quantity,
                size: itemSize * quantity
            });

            remainingQuantity -= quantity;
            chunkQuantity *= 2;
        }
    }


    function compareQuantities(first, second) {

        for (let i = 0; i < first.length; i++) {

            if (first[i] !== second[i]) {
                return second[i] - first[i];
            }
        }


        return 0;
    }


    function keepDistinctPatterns(patterns) {

        const distinctPatterns = new Map();


        for (const quantities of patterns) {

            const key = quantities.join(",");


            if (!distinctPatterns.has(key)) {
                distinctPatterns.set(key, quantities);
            }
        }


        return [...distinctPatterns.values()]
            .sort(compareQuantities)
            .slice(0, maxPatterns);
    }


    const states = Array.from(
        { length: capacity + 1 },
        () => []
    );

    states[0].push(new Array(items.length).fill(0));


    for (const chunk of chunks) {

        for (
            let sourceCapacity = capacity - chunk.size;
            sourceCapacity >= 0;
            sourceCapacity--
        ) {

            if (states[sourceCapacity].length === 0) {
                continue;
            }


            const targetCapacity = sourceCapacity + chunk.size;
            const newPatterns = [];


            for (const quantities of states[sourceCapacity]) {

                const nextQuantities = [...quantities];

                nextQuantities[chunk.itemIndex] +=
                    chunk.quantity;

                newPatterns.push(nextQuantities);
            }


            states[targetCapacity] = keepDistinctPatterns([
                ...states[targetCapacity],
                ...newPatterns
            ]);
        }
    }


    const candidates = [];
    const returnedPatterns = new Set();


    for (
        let usedCapacity = capacity;
        usedCapacity > 0 && candidates.length < maxPatterns;
        usedCapacity--
    ) {

        for (const quantities of states[usedCapacity]) {

            const key = quantities.join(",");


            if (returnedPatterns.has(key)) {
                continue;
            }


            const pattern = [];


            for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {

                if (quantities[itemIndex] > 0) {

                    pattern.push({
                        length: items[itemIndex].length,
                        quantity: quantities[itemIndex]
                    });
                }
            }


            let remaining = stockLength;
            let waste = 0;


            for (const item of pattern) {

                for (let i = 0; i < item.quantity; i++) {

                    const result =
                        cutPiece(
                            remaining,
                            item.length,
                            kerf
                        );


                    if (!result.possible) {

                        throw new Error(
                            "DP-ehdokas ei läpäissyt sahaustarkistusta."
                        );
                    }


                    remaining = result.remaining;
                    waste += result.waste;
                }
            }


            returnedPatterns.add(key);

            candidates.push({
                pattern: pattern,
                remaining: remaining,
                waste: waste,
                dpCapacityUsed:
                    dpUnitsToMillimeters(usedCapacity)
            });


            if (candidates.length === maxPatterns) {
                break;
            }
        }
    }


    return candidates;
}


function optimizeOrderDP(items, stockLength, kerf) {

    let remainingItems = items.map(item => ({
        length: item.length,
        quantity: item.quantity
    }));

    const bars = [];
    let failureReason = null;


    while (remainingItems.some(item => item.quantity > 0)) {

        const currentItems = remainingItems
            .filter(item => item.quantity > 0)
            .map(item => ({
                length: item.length,
                quantity: item.quantity
            }));

        const bestPattern =
            findBestPatternDP(
                currentItems,
                stockLength,
                kerf
            );

        const selectedQuantity = bestPattern.pattern.reduce(
            (total, item) => total + item.quantity,
            0
        );


        // Tyhjä kuvio ei saa jättää silmukkaa toistumaan ikuisesti.
        if (selectedQuantity <= 0) {

            failureReason =
                "DP ei löytänyt yhtään sahattavaa kappaletta.";

            break;
        }


        const nextRemainingItems = remainingItems.map(item => ({
            length: item.length,
            quantity: item.quantity
        }));

        let subtractionFailed = false;


        for (const patternItem of bestPattern.pattern) {

            let quantityToSubtract = patternItem.quantity;


            for (const remainingItem of nextRemainingItems) {

                if (
                    remainingItem.length !== patternItem.length ||
                    remainingItem.quantity <= 0
                ) {

                    continue;
                }


                const quantity = Math.min(
                    remainingItem.quantity,
                    quantityToSubtract
                );

                remainingItem.quantity -= quantity;
                quantityToSubtract -= quantity;


                if (quantityToSubtract === 0) {
                    break;
                }
            }


            if (quantityToSubtract > 0) {

                subtractionFailed = true;
                break;
            }
        }


        const quantityBefore = remainingItems.reduce(
            (total, item) => total + item.quantity,
            0
        );

        const quantityAfter = nextRemainingItems.reduce(
            (total, item) => total + item.quantity,
            0
        );


        if (
            subtractionFailed ||
            quantityAfter >= quantityBefore
        ) {

            failureReason =
                "DP-kuvion vähentäminen ei edennyt.";

            break;
        }


        bars.push({
            pattern: bestPattern.pattern.map(item => ({
                length: item.length,
                quantity: item.quantity
            })),
            remaining: bestPattern.result.remaining,
            waste: bestPattern.result.waste
        });

        remainingItems = nextRemainingItems;
    }


    const unprocessedItems = remainingItems
        .filter(item => item.quantity > 0)
        .map(item => ({
            length: item.length,
            quantity: item.quantity
        }));


    return {
        bars: bars,
        remainingItems: unprocessedItems,
        complete: unprocessedItems.length === 0,
        failureReason: failureReason
    };
}


function evaluateCuttingPlan(plan, stockLength) {

    if (
        plan === null ||
        typeof plan !== "object" ||
        Array.isArray(plan) ||
        !Array.isArray(plan.bars)
    ) {

        throw new Error(
            "Sahaussuunnitelman pitää sisältää tankojen taulukko."
        );
    }


    if (!Number.isFinite(stockLength) || stockLength <= 0) {

        throw new Error(
            "Raakatangon pituuden pitää olla suurempi kuin 0."
        );
    }


    if (plan.complete === false) {

        throw new Error(
            "Keskeneräisestä sahaussuunnitelmasta ei lasketa kokonaismittareita."
        );
    }


    const barRemnants = [];
    const barSourceLengths = [];

    let totalPieceLength = 0;
    let totalKerfWaste = 0;
    let totalStockLength = 0;


    for (const bar of plan.bars) {

        if (
            bar === null ||
            typeof bar !== "object" ||
            !Array.isArray(bar.pattern)
        ) {

            throw new Error(
                "Jokaisen tangon pitää sisältää ryhmitelty sahauskuvio."
            );
        }

        const sourceLength =
            bar.sourceLength ?? stockLength;


        if (
            !Number.isFinite(sourceLength) ||
            sourceLength <= 0
        ) {

            throw new Error(
                "Materiaalikappaleen lähtöpituuden pitää olla suurempi kuin 0."
            );
        }


        if (!hasSupportedMillimeterPrecision(sourceLength)) {

            throw new Error(
                "Materiaalikappaleen lähtöpituudessa saa olla enintään 0,1 mm tarkkuus."
            );
        }


        totalStockLength += sourceLength;
        barSourceLengths.push(sourceLength);


        if (!Number.isFinite(bar.remaining) || bar.remaining < 0) {

            throw new Error(
                "Tangon jäännöksen pitää olla nolla tai positiivinen luku."
            );
        }


        if (!Number.isFinite(bar.waste) || bar.waste < 0) {

            throw new Error(
                "Tangon sahahukan pitää olla nolla tai positiivinen luku."
            );
        }


        for (const item of bar.pattern) {

            if (!Number.isFinite(item.length) || item.length <= 0) {

                throw new Error(
                    "Kappaleen pituuden pitää olla suurempi kuin 0."
                );
            }


            if (
                !Number.isInteger(item.quantity) ||
                item.quantity <= 0
            ) {

                throw new Error(
                    "Kappalemäärän pitää olla positiivinen kokonaisluku."
                );
            }


            totalPieceLength +=
                item.length * item.quantity;
        }


        // Käytetään sahausfunktion jo tuottamia arvoja eikä lasketa terää uudelleen.
        totalKerfWaste += bar.waste;
        barRemnants.push(bar.remaining);
    }


    const positiveRemnants =
        barRemnants.filter(remaining => remaining > 0);

    const totalRemainingLength = barRemnants.reduce(
        (total, remaining) => total + remaining,
        0
    );


    const barCount = plan.bars.length;


    return {
        barCount: barCount,
        totalStockLength: totalStockLength,
        barSourceLengths: [...barSourceLengths],
        totalPieceLength: totalPieceLength,
        totalKerfWaste: totalKerfWaste,
        totalRemainingLength: totalRemainingLength,
        barRemnants: [...barRemnants],
        largestRemnant: barRemnants.length > 0
            ? Math.max(...barRemnants)
            : null,
        smallestPositiveRemnant: positiveRemnants.length > 0
            ? Math.min(...positiveRemnants)
            : null,
        zeroRemnantBarCount: barRemnants.filter(
            remaining => remaining === 0
        ).length,
        nonzeroRemnantCount: positiveRemnants.length
    };
}

function calculateRemnantValueFactor(
    remaining,
    minimumLength,
    fullValueLength,
    curvePower,
    minimumValueFactor,
    maximumValueFactor
) {

    if (remaining <= minimumLength) {
        return minimumValueFactor;
    }


    if (remaining >= fullValueLength) {
        return maximumValueFactor;
    }


    const t =
        (remaining - minimumLength) /
        (fullValueLength - minimumLength);

    const risingPart = t ** curvePower;
    const fallingPart = (1 - t) ** curvePower;

    const usefulness =
        risingPart /
        (risingPart + fallingPart);


    return minimumValueFactor +
        (maximumValueFactor - minimumValueFactor) *
        usefulness;
}

function evaluateRemnantDisposition(
    remaining,
    settings = {}
) {

    const minimumLength =
        settings.minimumLength ?? 500;

    const fullValueLength =
        settings.fullValueLength ?? 4500;

    const curvePower =
        settings.curvePower ?? 2;

    const minimumValueFactor =
        settings.minimumValueFactor ?? 0.1;

    const maximumValueFactor =
        settings.maximumValueFactor ?? 0.95;

    const scrapValueFactor =
        settings.scrapValueFactor ?? 0.1;

    const handlingPenalty =
        settings.reusableRemnantHandlingPenalty ?? 20;


    const savedValueFactor =
        calculateRemnantValueFactor(
            remaining,
            minimumLength,
            fullValueLength,
            curvePower,
            minimumValueFactor,
            maximumValueFactor
        );


    const savedMaterialLossEquivalent =
        remaining * (1 - savedValueFactor);

    const savedTotalCostEquivalent =
        savedMaterialLossEquivalent +
        handlingPenalty;


    const scrapMaterialLossEquivalent =
        remaining * (1 - scrapValueFactor);

    const scrapTotalCostEquivalent =
        scrapMaterialLossEquivalent;


    const shouldSave =
        savedTotalCostEquivalent <
        scrapTotalCostEquivalent;


    return {
        remaining: remaining,
        disposition: shouldSave
            ? "reusable"
            : "scrap",
        savedValueFactor: savedValueFactor,
        savedMaterialLossEquivalent:
            savedMaterialLossEquivalent,
        scrapMaterialLossEquivalent:
            scrapMaterialLossEquivalent,
        savedTotalCostEquivalent:
            savedTotalCostEquivalent,
        scrapTotalCostEquivalent:
            scrapTotalCostEquivalent,
        chosenCostEquivalent: shouldSave
            ? savedTotalCostEquivalent
            : scrapTotalCostEquivalent
    };
}

function scoreCuttingPlan(metrics, settings = {}) {

    if (
        metrics === null ||
        typeof metrics !== "object" ||
        Array.isArray(metrics) ||
        !Array.isArray(metrics.barRemnants)
    ) {

        throw new Error(
            "Suunnitelmamittareiden pitää sisältää tankojen jäännökset."
        );
    }


    if (
        settings === null ||
        typeof settings !== "object" ||
        Array.isArray(settings)
    ) {

        throw new Error("Materiaaliasetusten pitää olla olio.");
    }


    if (
        !Number.isInteger(metrics.barCount) ||
        metrics.barCount < 0
    ) {

        throw new Error(
            "Tankojen määrän pitää olla nolla tai positiivinen kokonaisluku."
        );
    }


    if (
        !Number.isFinite(metrics.totalKerfWaste) ||
        metrics.totalKerfWaste < 0
    ) {

        throw new Error(
            "Sahahukan pitää olla nolla tai positiivinen luku."
        );
    }


    const minimumLength =
        settings.minimumLength ?? 500;

    const fullValueLength =
        settings.fullValueLength ?? 4500;

    const curvePower =
        settings.curvePower ?? 2;

    const minimumValueFactor =
        settings.minimumValueFactor ?? 0.1;

    const maximumValueFactor =
        settings.maximumValueFactor ?? 0.95;

    const scrapValueFactor =
        settings.scrapValueFactor ?? 0.1;

    const kerfRecoveryFactor =
        settings.kerfRecoveryFactor ?? 0;

    const reusableRemnantHandlingPenalty =
        settings.reusableRemnantHandlingPenalty ?? 20;

    const freeScrapLength =
        settings.freeScrapLength ?? 200;

    const largeScrapPenaltyFactor =
        settings.largeScrapPenaltyFactor ?? 1.7;

    if (
        !Number.isFinite(minimumLength) ||
        minimumLength < 0
    ) {

        throw new Error(
            "Jäännösarvokäyrän minimipituuden pitää olla nolla tai positiivinen luku."
        );
    }


    if (
        !Number.isFinite(fullValueLength) ||
        fullValueLength <= minimumLength
    ) {

        throw new Error(
            "Täyden jäännösarvon pituuden pitää olla minimipituutta suurempi."
        );
    }


    if (
        !Number.isFinite(curvePower) ||
        curvePower <= 0
    ) {

        throw new Error(
            "Jäännösarvokäyrän potenssin pitää olla suurempi kuin 0."
        );
    }


    if (
        !Number.isFinite(reusableRemnantHandlingPenalty) ||
        reusableRemnantHandlingPenalty < 0
    ) {

        throw new Error(
            "Säilytettävän jäännöksen käsittelyrangaistuksen pitää olla nolla tai positiivinen luku."
        );
    }

    if (
        !Number.isFinite(freeScrapLength) ||
        freeScrapLength < 0
    ) {

        throw new Error(
            "Ilman lisärangaistusta hyväksyttävän romupituuden pitää olla nolla tai positiivinen luku."
        );
    }


    if (
        !Number.isFinite(largeScrapPenaltyFactor) ||
        largeScrapPenaltyFactor < 0
    ) {

        throw new Error(
            "Ison romujäännöksen rangaistuskertoimen pitää olla nolla tai positiivinen luku."
        );
    }


    const valueFactors = [
        minimumValueFactor,
        maximumValueFactor,
        scrapValueFactor,
        kerfRecoveryFactor
    ];


    if (valueFactors.some(factor =>
        !Number.isFinite(factor) ||
        factor < 0 ||
        factor > 1
    )) {

        throw new Error(
            "Materiaalin arvo- ja palautuskertoimien pitää olla välillä 0–1."
        );
    }


    if (maximumValueFactor < minimumValueFactor) {

        throw new Error(
            "Jäännöksen maksimiarvo ei voi olla minimiarvoa pienempi."
        );
    }


    const reusableRemnants = [];
    const scrapRemnants = [];
    const remnantEvaluations = [];

    let reusableRecoveredValueEquivalentLength = 0;
    let scrapRecoveredValueEquivalentLength = 0;

    let reusableRemnantLossEquivalent = 0;
    let scrapRemnantLossEquivalent = 0;

    let remnantHandlingPenaltyEquivalent = 0;
    let largeScrapPenaltyEquivalent = 0;


    for (const remaining of metrics.barRemnants) {

        if (!Number.isFinite(remaining) || remaining < 0) {

            throw new Error(
                "Jäännösten pitää olla nolla tai positiivisia lukuja."
            );
        }


        if (remaining === 0) {
            continue;
        }


        const evaluation =
            evaluateRemnantDisposition(
                remaining,
                {
                    minimumLength: minimumLength,
                    fullValueLength: fullValueLength,
                    curvePower: curvePower,
                    minimumValueFactor:
                        minimumValueFactor,
                    maximumValueFactor:
                        maximumValueFactor,
                    scrapValueFactor:
                        scrapValueFactor,
                    reusableRemnantHandlingPenalty:
                        reusableRemnantHandlingPenalty
                }
            );


        remnantEvaluations.push(evaluation);


        if (evaluation.disposition === "reusable") {

            reusableRemnants.push(remaining);

            reusableRemnantLossEquivalent +=
                evaluation.savedMaterialLossEquivalent;

            reusableRecoveredValueEquivalentLength +=
                remaining *
                evaluation.savedValueFactor;

            remnantHandlingPenaltyEquivalent +=
                reusableRemnantHandlingPenalty;

        } else {

            scrapRemnants.push(remaining);

            scrapRemnantLossEquivalent +=
                evaluation.scrapMaterialLossEquivalent;

            scrapRecoveredValueEquivalentLength +=
                remaining *
                scrapValueFactor;

            largeScrapPenaltyEquivalent +=
                Math.max(
                    0,
                    remaining - freeScrapLength
                ) *
                largeScrapPenaltyFactor;
        }
    }


    reusableRemnants.sort(
        (first, second) => second - first
    );

    scrapRemnants.sort(
        (first, second) => second - first
    );


    const totalReusableRemnantLength =
        reusableRemnants.reduce(
            (total, remaining) =>
                total + remaining,
            0
        );

    const totalScrapRemnantLength =
        scrapRemnants.reduce(
            (total, remaining) =>
                total + remaining,
            0
        );


    const kerfRecoveredValueEquivalentLength =
        metrics.totalKerfWaste *
        kerfRecoveryFactor;

    const kerfLossEquivalent =
        metrics.totalKerfWaste *
        (1 - kerfRecoveryFactor);

    const materialLossEquivalent =
        kerfLossEquivalent +
        reusableRemnantLossEquivalent +
        scrapRemnantLossEquivalent;

    const totalCostEquivalent =
        materialLossEquivalent +
        remnantHandlingPenaltyEquivalent +
        largeScrapPenaltyEquivalent;


    return {
        barCount: metrics.barCount,

        reusableRemnants: [...reusableRemnants],
        scrapRemnants: [...scrapRemnants],

        totalReusableRemnantLength:
            totalReusableRemnantLength,

        totalScrapRemnantLength:
            totalScrapRemnantLength,

        largestReusableRemnant:
            reusableRemnants.length > 0
                ? reusableRemnants[0]
                : null,

        reusableRemnantCount:
            reusableRemnants.length,

        scrapRemnantCount:
            scrapRemnants.length,

        reusableRecoveredValueEquivalentLength:
            reusableRecoveredValueEquivalentLength,

        scrapRecoveredValueEquivalentLength:
            scrapRecoveredValueEquivalentLength,

        kerfRecoveredValueEquivalentLength:
            kerfRecoveredValueEquivalentLength,

        materialLossEquivalent:
            materialLossEquivalent,

        remnantHandlingPenaltyEquivalent:
            remnantHandlingPenaltyEquivalent,

        totalCostEquivalent:
            totalCostEquivalent,

        remnantEvaluations:
            remnantEvaluations,

        largeScrapPenaltyEquivalent:
            largeScrapPenaltyEquivalent,

        costBreakdown: {
            kerfLossEquivalent:
                kerfLossEquivalent,
            reusableRemnantLossEquivalent:
                reusableRemnantLossEquivalent,
            scrapRemnantLossEquivalent:
                scrapRemnantLossEquivalent,
            remnantHandlingPenaltyEquivalent:
                remnantHandlingPenaltyEquivalent,
            materialLossEquivalent:
                materialLossEquivalent,
            totalCostEquivalent:
                totalCostEquivalent,
            largeScrapPenaltyEquivalent:
                largeScrapPenaltyEquivalent,
        },

        settings: {
            minimumLength:
                minimumLength,
            fullValueLength:
                fullValueLength,
            curvePower:
                curvePower,
            minimumValueFactor:
                minimumValueFactor,
            maximumValueFactor:
                maximumValueFactor,
            scrapValueFactor:
                scrapValueFactor,
            kerfRecoveryFactor:
                kerfRecoveryFactor,
            reusableRemnantHandlingPenalty:
                reusableRemnantHandlingPenalty,
            freeScrapLength:
                freeScrapLength,

            largeScrapPenaltyFactor:
                largeScrapPenaltyFactor
        }
    };
}

function logCostBreakdown(score) {

    if (
        score === null ||
        typeof score !== "object" ||
        score.costBreakdown === undefined
    ) {
        console.log("Kustannusraporttia ei ole saatavilla.");
        return;
    }

    const roundForDisplay = value =>
        Math.round(value * 1000) / 1000;


    console.table({
        "Sahahukka": {
            equivalentMm: roundForDisplay(
                score.costBreakdown.kerfLossEquivalent
            )
        },
        "Säilytettävien jäännösten materiaalihäviö": {
            equivalentMm: roundForDisplay(
                score.costBreakdown.reusableRemnantLossEquivalent
            )
        },
        "Romujäännösten materiaalihäviö": {
            equivalentMm: roundForDisplay(
                score.costBreakdown.scrapRemnantLossEquivalent
            )
        },
        "Jäännösten käsittely": {
            equivalentMm: roundForDisplay(
                score.costBreakdown.remnantHandlingPenaltyEquivalent
            )
        },
        "Isojen romujäännösten lisärangaistus": {
            equivalentMm: roundForDisplay(
                score.costBreakdown
                    .largeScrapPenaltyEquivalent
            )
        },
        "Materiaalihäviö yhteensä": {
            equivalentMm: roundForDisplay(
                score.costBreakdown.materialLossEquivalent
            )
        },
        "Kokonaiskustannus": {
            equivalentMm: roundForDisplay(
                score.costBreakdown.totalCostEquivalent
            )
        }
    });
}

function compareCuttingPlanMaterialScores(
    firstScore,
    secondScore,
    materialLossTieTolerance = 1e-9
) {

    if (
        !Number.isFinite(materialLossTieTolerance) ||
        materialLossTieTolerance < 0
    ) {

        throw new Error(
            "Materiaalihukan tasatulostoleranssin pitää olla nolla tai positiivinen luku."
        );
    }


    const scores = [firstScore, secondScore];


    for (const score of scores) {

        if (
            score === null ||
            typeof score !== "object" ||
            !Number.isFinite(score.materialLossEquivalent) ||
            !Number.isFinite(score.totalCostEquivalent) ||
            !Number.isFinite(score.totalReusableRemnantLength) ||
            !Number.isFinite(score.totalScrapRemnantLength) ||
            !Array.isArray(score.reusableRemnants) ||
            !Array.isArray(score.scrapRemnants) ||
            !Number.isInteger(score.barCount)
        ) {

            throw new Error(
                "Vertailtavan materiaaliarvion tiedot ovat puutteelliset."
            );
        }
    }


    const costDifference =
        firstScore.totalCostEquivalent -
        secondScore.totalCostEquivalent;


    // Toleranssi rajaa vain liukulukulaskennan lähes samat kokonaiskustannukset.
    if (Math.abs(costDifference) > materialLossTieTolerance) {
        return costDifference < 0 ? -1 : 1;
    }

    if (
        firstScore.reusableRemnants.length !==
        secondScore.reusableRemnants.length
    ) {

        return firstScore.reusableRemnants.length -
            secondScore.reusableRemnants.length;
    }



    if (
        firstScore.totalReusableRemnantLength !==
        secondScore.totalReusableRemnantLength
    ) {

        return firstScore.totalReusableRemnantLength >
            secondScore.totalReusableRemnantLength
            ? -1
            : 1;
    }


    const reusableCount = Math.max(
        firstScore.reusableRemnants.length,
        secondScore.reusableRemnants.length
    );


    for (let i = 0; i < reusableCount; i++) {

        const firstRemaining =
            firstScore.reusableRemnants[i] ?? -Infinity;

        const secondRemaining =
            secondScore.reusableRemnants[i] ?? -Infinity;


        if (firstRemaining !== secondRemaining) {
            return firstRemaining > secondRemaining ? -1 : 1;
        }
    }


    if (
        firstScore.totalScrapRemnantLength !==
        secondScore.totalScrapRemnantLength
    ) {

        return firstScore.totalScrapRemnantLength <
            secondScore.totalScrapRemnantLength
            ? -1
            : 1;
    }


    if (firstScore.barCount !== secondScore.barCount) {
        return firstScore.barCount - secondScore.barCount;
    }


    const firstKey = JSON.stringify({
        reusableRemnants: firstScore.reusableRemnants,
        scrapRemnants: firstScore.scrapRemnants
    });

    const secondKey = JSON.stringify({
        reusableRemnants: secondScore.reusableRemnants,
        scrapRemnants: secondScore.scrapRemnants
    });


    if (firstKey < secondKey) {
        return -1;
    }


    if (firstKey > secondKey) {
        return 1;
    }


    return 0;
}


function calculateBarCountLowerBound(items, stockLength, kerf) {

    if (!Array.isArray(items)) {

        throw new Error("Kappaleiden pitää olla taulukossa.");
    }


    if (!Number.isFinite(stockLength) || stockLength <= 0) {

        throw new Error(
            "Raakatangon pituuden pitää olla suurempi kuin 0."
        );
    }


    if (!Number.isFinite(kerf) || kerf < 0) {

        throw new Error(
            "Sahanterän leveyden pitää olla 0 tai suurempi."
        );
    }


    const stockLengthUnits =
        millimetersToDpUnits(stockLength);

    const kerfUnits = millimetersToDpUnits(kerf);

    const capacity = stockLengthUnits + kerfUnits;


    let totalSize = 0;
    const perTypeBounds = [];
    const impossibleItems = [];


    for (const item of items) {

        if (!Number.isFinite(item.length) || item.length <= 0) {

            throw new Error(
                "Kappaleen pituuden pitää olla suurempi kuin 0."
            );
        }


        if (
            !Number.isInteger(item.quantity) ||
            item.quantity <= 0
        ) {

            throw new Error(
                "Kappalemäärän pitää olla positiivinen kokonaisluku."
            );
        }


        const itemSize =
            millimetersToDpUnits(item.length) +
            kerfUnits;


        totalSize += item.quantity * itemSize;

        const maxPerBar = Math.floor(capacity / itemSize);
        const requiredBarsForType = maxPerBar > 0
            ? Math.ceil(item.quantity / maxPerBar)
            : null;

        perTypeBounds.push({
            length: item.length,
            quantity: item.quantity,
            maxPerBar: maxPerBar,
            requiredBarsForType: requiredBarsForType
        });


        if (maxPerBar === 0) {

            impossibleItems.push({
                length: item.length,
                quantity: item.quantity
            });
        }
    }


    const totalCapacityBound = Math.ceil(
        totalSize / capacity
    );

    const possible = impossibleItems.length === 0;

    let lowerBound = null;


    if (possible) {

        lowerBound = totalCapacityBound;


        for (const itemBound of perTypeBounds) {

            lowerBound = Math.max(
                lowerBound,
                itemBound.requiredBarsForType
            );
        }
    }


    // Alaraja ei itsessään takaa toteuttamiskelpoista sahaussuunnitelmaa.
    return {
        lowerBound: lowerBound,
        totalCapacityBound: totalCapacityBound,
        perTypeBounds: perTypeBounds,
        possible: possible,
        impossibleItems: impossibleItems
    };
}


function optimizeOrderBeamDP(
    items,
    stockLength,
    kerf,
    options = {}
) {

    if (
        options === null ||
        typeof options !== "object" ||
        Array.isArray(options)
    ) {

        throw new Error("Hakuasetusten pitää olla olio.");
    }


    const beamWidth = options.beamWidth ?? 20;
    const patternsPerState = options.patternsPerState ?? 10;


    if (!Number.isInteger(beamWidth) || beamWidth <= 0) {

        throw new Error(
            "Beam-leveyden pitää olla positiivinen kokonaisluku."
        );
    }


    if (
        !Number.isInteger(patternsPerState) ||
        patternsPerState <= 0
    ) {

        throw new Error(
            "Tilakohtaisen ehdokasmäärän pitää olla positiivinen kokonaisluku."
        );
    }


    function copyItems(sourceItems) {

        return sourceItems.map(item => ({
            length: item.length,
            quantity: item.quantity
        }));
    }


    function copyBars(sourceBars) {

        return sourceBars.map(bar => ({
            pattern: bar.pattern.map(item => ({
                length: item.length,
                quantity: item.quantity
            })),
            remaining: bar.remaining,
            waste: bar.waste
        }));
    }


    function getPositiveItems(sourceItems) {

        return sourceItems
            .filter(item => item.quantity > 0)
            .map(item => ({
                length: item.length,
                quantity: item.quantity
            }));
    }


    function subtractPattern(sourceItems, pattern) {

        const nextItems = copyItems(sourceItems);

        const quantityBefore = nextItems.reduce(
            (total, item) => total + item.quantity,
            0
        );


        for (const patternItem of pattern) {

            let quantityToSubtract = patternItem.quantity;


            for (const item of nextItems) {

                if (
                    item.length !== patternItem.length ||
                    item.quantity <= 0
                ) {

                    continue;
                }


                const quantity = Math.min(
                    item.quantity,
                    quantityToSubtract
                );

                item.quantity -= quantity;
                quantityToSubtract -= quantity;


                if (quantityToSubtract === 0) {
                    break;
                }
            }


            if (quantityToSubtract > 0) {
                return null;
            }
        }


        const quantityAfter = nextItems.reduce(
            (total, item) => total + item.quantity,
            0
        );


        if (quantityAfter >= quantityBefore) {
            return null;
        }


        return nextItems;
    }


    function getRemainingSize(remainingItems) {

        return remainingItems.reduce(
            (total, item) =>
                total + item.quantity * (item.length + kerf),
            0
        );
    }


    function getRemainingQuantity(remainingItems) {

        return remainingItems.reduce(
            (total, item) => total + item.quantity,
            0
        );
    }


    function getStateKey(state) {

        return state.remainingItems
            .map(item => item.quantity)
            .join(",");
    }


    function getBarsKey(bars) {

        return bars.map(bar =>
            bar.pattern.map(item =>
                item.length + ":" + item.quantity
            ).join(",")
        ).join("|");
    }


    function compareStates(first, second) {

        if (
            first.optimisticBarCount !==
            second.optimisticBarCount
        ) {

            return first.optimisticBarCount -
                second.optimisticBarCount;
        }


        if (first.remainingSize !== second.remainingSize) {
            return first.remainingSize - second.remainingSize;
        }


        if (first.remainingQuantity !== second.remainingQuantity) {
            return first.remainingQuantity - second.remainingQuantity;
        }


        for (let i = 0; i < first.remainingItems.length; i++) {

            const difference =
                first.remainingItems[i].quantity -
                second.remainingItems[i].quantity;


            if (difference !== 0) {
                return difference;
            }
        }


        const firstBarsKey = getBarsKey(first.bars);
        const secondBarsKey = getBarsKey(second.bars);


        if (firstBarsKey < secondBarsKey) {
            return -1;
        }


        if (firstBarsKey > secondBarsKey) {
            return 1;
        }


        return 0;
    }


    const stats = {
        statesExpanded: 0,
        statesGenerated: 0,
        statesPruned: 0,
        maxBeamSize: 0
    };

    const greedy = optimizeOrderDP(
        items,
        stockLength,
        kerf
    );

    const globalBound = calculateBarCountLowerBound(
        items,
        stockLength,
        kerf
    );

    const greedyBarCount = greedy.bars.length;


    function createResult(
        bars,
        remainingItems,
        complete,
        barCountOptimal,
        searchUsed
    ) {

        return {
            bars: copyBars(bars),
            remainingItems: copyItems(remainingItems),
            complete: complete,
            barCount: bars.length,
            lowerBound: globalBound.lowerBound,
            barCountOptimal: barCountOptimal,
            searchUsed: searchUsed,
            greedyBarCount: greedyBarCount,
            stats: {
                statesExpanded: stats.statesExpanded,
                statesGenerated: stats.statesGenerated,
                statesPruned: stats.statesPruned,
                maxBeamSize: stats.maxBeamSize
            }
        };
    }


    if (
        greedy.complete &&
        globalBound.possible &&
        greedyBarCount === globalBound.lowerBound
    ) {

        return createResult(
            greedy.bars,
            [],
            true,
            true,
            false
        );
    }


    if (!globalBound.possible) {

        return createResult(
            greedy.bars,
            greedy.remainingItems,
            greedy.complete,
            false,
            false
        );
    }


    let bestBars = greedy.complete
        ? copyBars(greedy.bars)
        : null;

    let bestBarCount = greedy.complete
        ? greedyBarCount
        : Infinity;

    let beam = [{
        remainingItems: copyItems(items),
        bars: [],
        barsUsed: 0,
        optimisticBarCount: globalBound.lowerBound,
        remainingSize: getRemainingSize(items),
        remainingQuantity: getRemainingQuantity(items)
    }];

    stats.maxBeamSize = 1;


    while (beam.length > 0) {

        const generatedStates = [];


        for (const state of beam) {

            stats.statesExpanded++;

            const currentItems =
                getPositiveItems(state.remainingItems);

            const candidates = findCandidatePatternsDP(
                currentItems,
                stockLength,
                kerf,
                patternsPerState
            );


            if (candidates.length === 0) {

                stats.statesPruned++;
                continue;
            }


            for (const candidate of candidates) {

                const childRemainingItems = subtractPattern(
                    state.remainingItems,
                    candidate.pattern
                );


                if (childRemainingItems === null) {

                    stats.statesPruned++;
                    continue;
                }


                stats.statesGenerated++;

                const childBars = [
                    ...state.bars,
                    {
                        pattern: candidate.pattern.map(item => ({
                            length: item.length,
                            quantity: item.quantity
                        })),
                        remaining: candidate.remaining,
                        waste: candidate.waste
                    }
                ];

                const childBarsUsed = state.barsUsed + 1;
                const childPositiveItems =
                    getPositiveItems(childRemainingItems);


                if (childPositiveItems.length === 0) {

                    if (childBarsUsed < bestBarCount) {

                        bestBars = childBars;
                        bestBarCount = childBarsUsed;
                    } else {

                        stats.statesPruned++;
                    }


                    if (
                        childBarsUsed === globalBound.lowerBound
                    ) {

                        return createResult(
                            childBars,
                            [],
                            true,
                            true,
                            true
                        );
                    }


                    continue;
                }


                const childBound = calculateBarCountLowerBound(
                    childPositiveItems,
                    stockLength,
                    kerf
                );


                if (!childBound.possible) {

                    stats.statesPruned++;
                    continue;
                }


                const optimisticBarCount =
                    childBarsUsed + childBound.lowerBound;


                if (optimisticBarCount >= bestBarCount) {

                    stats.statesPruned++;
                    continue;
                }


                generatedStates.push({
                    remainingItems: childRemainingItems,
                    bars: childBars,
                    barsUsed: childBarsUsed,
                    optimisticBarCount: optimisticBarCount,
                    remainingSize: getRemainingSize(
                        childRemainingItems
                    ),
                    remainingQuantity: getRemainingQuantity(
                        childRemainingItems
                    )
                });
            }
        }


        const distinctStates = new Map();


        for (const state of generatedStates) {

            const key = getStateKey(state);
            const existingState = distinctStates.get(key);


            if (existingState === undefined) {

                distinctStates.set(key, state);
                continue;
            }


            stats.statesPruned++;


            if (compareStates(state, existingState) < 0) {
                distinctStates.set(key, state);
            }
        }


        const rankedStates =
            [...distinctStates.values()].sort(compareStates);


        if (rankedStates.length > beamWidth) {

            stats.statesPruned +=
                rankedStates.length - beamWidth;
        }


        beam = rankedStates.slice(0, beamWidth);

        stats.maxBeamSize = Math.max(
            stats.maxBeamSize,
            beam.length
        );
    }


    if (bestBars !== null) {

        return createResult(
            bestBars,
            [],
            true,
            bestBarCount === globalBound.lowerBound,
            true
        );
    }


    return createResult(
        greedy.bars,
        greedy.remainingItems,
        greedy.complete,
        false,
        true
    );
}


function optimizeOrderMaterialBeamDP(
    items,
    stockLength,
    kerf,
    options = {}
) {

    if (
        options === null ||
        typeof options !== "object" ||
        Array.isArray(options)
    ) {

        throw new Error("Hakuasetusten pitää olla olio.");
    }


    const beamWidth = options.beamWidth ?? 20;
    const patternsPerState = options.patternsPerState ?? 10;
    const candidatePoolSize = options.candidatePoolSize ?? 50;
    const maxExtraBars = options.maxExtraBars ?? 2;
    const materialLossTieTolerance =
        options.materialLossTieTolerance ?? 1e-9;

    const scoreSettings = options.scoreSettings ?? {};


    if (!Number.isInteger(beamWidth) || beamWidth <= 0) {

        throw new Error(
            "Beam-leveyden pitää olla positiivinen kokonaisluku."
        );
    }


    if (
        !Number.isInteger(patternsPerState) ||
        patternsPerState <= 0
    ) {

        throw new Error(
            "Tilakohtaisen ehdokasmäärän pitää olla positiivinen kokonaisluku."
        );
    }

    if (
        !Number.isInteger(candidatePoolSize) ||
        candidatePoolSize < patternsPerState
    ) {

        throw new Error(
            "Ehdokaspoolin koon pitää olla kokonaisluku ja vähintään tilakohtaisen ehdokasmäärän suuruinen."
        );
    }


    if (!Number.isInteger(maxExtraBars) || maxExtraBars < 0) {

        throw new Error(
            "Lisätankojen enimmäismäärän pitää olla nolla tai positiivinen kokonaisluku."
        );
    }


    if (
        !Number.isFinite(materialLossTieTolerance) ||
        materialLossTieTolerance < 0
    ) {

        throw new Error(
            "Materiaalihukan tasatulostoleranssin pitää olla nolla tai positiivinen luku."
        );
    }


    function copyItems(sourceItems) {

        return sourceItems.map(item => ({
            length: item.length,
            quantity: item.quantity
        }));
    }


    function copyBars(sourceBars) {

        return sourceBars.map(bar => ({
            pattern: bar.pattern.map(item => ({
                length: item.length,
                quantity: item.quantity
            })),
            remaining: bar.remaining,
            waste: bar.waste
        }));
    }


    function getPositiveItems(sourceItems) {

        return sourceItems
            .filter(item => item.quantity > 0)
            .map(item => ({
                length: item.length,
                quantity: item.quantity
            }));
    }


    function subtractPattern(sourceItems, pattern) {

        const nextItems = copyItems(sourceItems);

        const quantityBefore = nextItems.reduce(
            (total, item) => total + item.quantity,
            0
        );


        for (const patternItem of pattern) {

            let quantityToSubtract = patternItem.quantity;


            for (const item of nextItems) {

                if (
                    item.length !== patternItem.length ||
                    item.quantity <= 0
                ) {

                    continue;
                }


                const quantity = Math.min(
                    item.quantity,
                    quantityToSubtract
                );

                item.quantity -= quantity;
                quantityToSubtract -= quantity;


                if (quantityToSubtract === 0) {
                    break;
                }
            }


            if (quantityToSubtract > 0) {
                return null;
            }
        }


        const quantityAfter = nextItems.reduce(
            (total, item) => total + item.quantity,
            0
        );


        if (quantityAfter >= quantityBefore) {
            return null;
        }


        return nextItems;
    }


    function getRemainingSize(remainingItems) {

        return remainingItems.reduce(
            (total, item) =>
                total + item.quantity * (item.length + kerf),
            0
        );
    }


    function getRemainingQuantity(remainingItems) {

        return remainingItems.reduce(
            (total, item) => total + item.quantity,
            0
        );
    }


    function getStateKey(state) {

        return state.remainingItems
            .map(item => item.quantity)
            .join(",");
    }


    function getBarsKey(bars) {

        return bars.map(bar =>
            bar.pattern.map(item =>
                item.length + ":" + item.quantity
            ).join(",")
        ).join("|");
    }


    function evaluateBars(bars) {

        const metrics = evaluateCuttingPlan(
            {
                bars: bars,
                complete: true
            },
            stockLength
        );

        const score = scoreCuttingPlan(
            metrics,
            scoreSettings
        );


        return {
            metrics: metrics,
            score: score
        };
    }


    function compareStates(first, second) {

        const materialComparison =
            compareCuttingPlanMaterialScores(
                first.materialScore,
                second.materialScore,
                materialLossTieTolerance
            );


        if (materialComparison !== 0) {
            return materialComparison;
        }


        if (first.remainingSize !== second.remainingSize) {
            return first.remainingSize - second.remainingSize;
        }


        if (first.remainingQuantity !== second.remainingQuantity) {
            return first.remainingQuantity - second.remainingQuantity;
        }


        if (
            first.remainingLowerBound !==
            second.remainingLowerBound
        ) {

            return first.remainingLowerBound -
                second.remainingLowerBound;
        }


        for (let i = 0; i < first.remainingItems.length; i++) {

            const difference =
                first.remainingItems[i].quantity -
                second.remainingItems[i].quantity;


            if (difference !== 0) {
                return difference;
            }
        }


        const firstBarsKey = getBarsKey(first.bars);
        const secondBarsKey = getBarsKey(second.bars);


        if (firstBarsKey < secondBarsKey) {
            return -1;
        }


        if (firstBarsKey > secondBarsKey) {
            return 1;
        }


        return 0;
    }


    const stats = {
        statesExpanded: 0,
        statesGenerated: 0,
        statesPruned: 0,
        statesPrunedByMaterial: 0,
        statesPrunedByHorizon: 0,
        statesDeduplicated: 0,
        candidateCalls: 0,
        completeSolutionsEvaluated: 0,
        incumbentUpdates: 0,
        maxBeamSize: 0
    };

    const truncation = {
        byBeamWidth: false,
        byCandidateLimit: false,
        byMaxExtraBars: false
    };

    const emptyEvaluation = evaluateBars([]);

    const greedy = optimizeOrderDP(
        items,
        stockLength,
        kerf
    );

    const globalBound = calculateBarCountLowerBound(
        items,
        stockLength,
        kerf
    );

    const greedyBarCount = greedy.bars.length;
    const maximumBarsConsidered =
        greedyBarCount + maxExtraBars;

    const greedyEvaluation = greedy.complete
        ? evaluateBars(greedy.bars)
        : null;

    let bestBars = greedy.complete
        ? copyBars(greedy.bars)
        : null;

    let bestMaterialScore = greedyEvaluation === null
        ? null
        : greedyEvaluation.score;


    function createResult(
        bars,
        remainingItems,
        complete,
        searchUsed
    ) {

        const finalEvaluation = complete
            ? evaluateBars(bars)
            : null;


        return {
            bars: copyBars(bars),
            remainingItems: copyItems(remainingItems),
            complete: complete,
            materialScore: finalEvaluation === null
                ? null
                : finalEvaluation.score,
            materialMetrics: finalEvaluation === null
                ? null
                : finalEvaluation.metrics,
            barCount: bars.length,
            barCountLowerBound: globalBound.lowerBound,
            greedyBarCount: greedyBarCount,
            greedyMaterialScore: greedyEvaluation === null
                ? null
                : greedyEvaluation.score,
            searchUsed: searchUsed,
            materialOptimalityProven: false,
            searchSettings: {
                beamWidth: beamWidth,
                patternsPerState: patternsPerState,
                maxExtraBars: maxExtraBars,
                maximumBarsConsidered: maximumBarsConsidered,
                materialLossTieTolerance:
                    materialLossTieTolerance,
                scoreSettings: {
                    ...emptyEvaluation.score.settings
                }
            },
            truncation: {
                byBeamWidth: truncation.byBeamWidth,
                byCandidateLimit:
                    truncation.byCandidateLimit,
                byMaxExtraBars: truncation.byMaxExtraBars
            },
            stats: {
                statesExpanded: stats.statesExpanded,
                statesGenerated: stats.statesGenerated,
                statesPruned: stats.statesPruned,
                statesPrunedByMaterial:
                    stats.statesPrunedByMaterial,
                statesPrunedByHorizon:
                    stats.statesPrunedByHorizon,
                statesDeduplicated:
                    stats.statesDeduplicated,
                candidateCalls: stats.candidateCalls,
                completeSolutionsEvaluated:
                    stats.completeSolutionsEvaluated,
                incumbentUpdates: stats.incumbentUpdates,
                maxBeamSize: stats.maxBeamSize
            }
        };
    }


    if (!globalBound.possible) {

        return createResult(
            greedy.bars,
            greedy.remainingItems,
            greedy.complete,
            false
        );
    }


    const rootItems = copyItems(items);
    const rootPositiveItems = getPositiveItems(rootItems);


    if (rootPositiveItems.length === 0) {

        return createResult(
            greedy.bars,
            [],
            true,
            false
        );
    }


    let beam = [{
        remainingItems: rootItems,
        bars: [],
        barsUsed: 0,
        materialScore: emptyEvaluation.score,
        remainingLowerBound: globalBound.lowerBound,
        remainingSize: getRemainingSize(rootItems),
        remainingQuantity: getRemainingQuantity(rootItems)
    }];

    stats.maxBeamSize = 1;


    while (beam.length > 0) {

        const generatedStates = [];


        for (const state of beam) {

            stats.statesExpanded++;


            if (state.barsUsed >= maximumBarsConsidered) {

                truncation.byMaxExtraBars = true;
                stats.statesPruned++;
                stats.statesPrunedByHorizon++;
                continue;
            }


            const currentItems =
                getPositiveItems(state.remainingItems);

            stats.candidateCalls++;

            const candidatePool = findCandidatePatternsDP(
                currentItems,
                stockLength,
                kerf,
                candidatePoolSize + 1
            );


            if (candidatePool.length > candidatePoolSize) {
                truncation.byCandidateLimit = true;
            }


            const rankedCandidates = candidatePool
                .slice(0, candidatePoolSize)
                .map(candidate => {

                    const evaluation = evaluateBars([
                        {
                            pattern: candidate.pattern,
                            remaining: candidate.remaining,
                            waste: candidate.waste
                        }
                    ]);

                    return {
                        ...candidate,
                        materialScore: evaluation.score
                    };
                })
                .sort((first, second) => {

                    const materialComparison =
                        compareCuttingPlanMaterialScores(
                            first.materialScore,
                            second.materialScore,
                            materialLossTieTolerance
                        );

                    if (materialComparison !== 0) {
                        return materialComparison;
                    }

                    return second.dpCapacityUsed - first.dpCapacityUsed;
                });


            const candidates = rankedCandidates.slice(
                0,
                patternsPerState
            );


            if (candidates.length === 0) {

                stats.statesPruned++;
                continue;
            }


            for (const candidate of candidates) {

                const childRemainingItems = subtractPattern(
                    state.remainingItems,
                    candidate.pattern
                );


                if (childRemainingItems === null) {

                    stats.statesPruned++;
                    continue;
                }


                stats.statesGenerated++;

                const childBars = [
                    ...state.bars,
                    {
                        pattern: candidate.pattern.map(item => ({
                            length: item.length,
                            quantity: item.quantity
                        })),
                        remaining: candidate.remaining,
                        waste: candidate.waste
                    }
                ];

                const childBarsUsed = state.barsUsed + 1;
                const childEvaluation = evaluateBars(childBars);

                const childPositiveItems =
                    getPositiveItems(childRemainingItems);


                if (childPositiveItems.length === 0) {

                    stats.completeSolutionsEvaluated++;


                    if (
                        bestMaterialScore === null ||
                        compareCuttingPlanMaterialScores(
                            childEvaluation.score,
                            bestMaterialScore,
                            materialLossTieTolerance
                        ) < 0
                    ) {

                        bestBars = childBars;
                        bestMaterialScore = childEvaluation.score;
                        stats.incumbentUpdates++;
                    }


                    continue;
                }


                if (
                    bestMaterialScore !== null &&
                    childEvaluation.score.totalCostEquivalent >
                    bestMaterialScore.totalCostEquivalent +
                    materialLossTieTolerance
                ) {

                    // Valmiiden tankojen materiaalihukka ja jäännösten käsittelyrangaistus
                    // eivät voi pienentyä myöhemmin.
                    // Tasatulos jätetään silti hakuun jäännösjakauman vertailua varten.
                    stats.statesPruned++;
                    stats.statesPrunedByMaterial++;
                    continue;
                }


                const childBound = calculateBarCountLowerBound(
                    childPositiveItems,
                    stockLength,
                    kerf
                );


                if (!childBound.possible) {

                    stats.statesPruned++;
                    continue;
                }


                if (
                    childBarsUsed + childBound.lowerBound >
                    maximumBarsConsidered
                ) {

                    truncation.byMaxExtraBars = true;
                    stats.statesPruned++;
                    stats.statesPrunedByHorizon++;
                    continue;
                }


                generatedStates.push({
                    remainingItems: childRemainingItems,
                    bars: childBars,
                    barsUsed: childBarsUsed,
                    materialScore: childEvaluation.score,
                    remainingLowerBound: childBound.lowerBound,
                    remainingSize: getRemainingSize(
                        childRemainingItems
                    ),
                    remainingQuantity: getRemainingQuantity(
                        childRemainingItems
                    )
                });
            }
        }


        const distinctStates = new Map();


        for (const state of generatedStates) {

            const key = getStateKey(state);
            const existingState = distinctStates.get(key);


            if (existingState === undefined) {

                distinctStates.set(key, state);
                continue;
            }


            stats.statesPruned++;
            stats.statesDeduplicated++;


            if (compareStates(state, existingState) < 0) {
                distinctStates.set(key, state);
            }
        }


        const rankedStates =
            [...distinctStates.values()].sort(compareStates);


        if (rankedStates.length > beamWidth) {

            truncation.byBeamWidth = true;

            stats.statesPruned +=
                rankedStates.length - beamWidth;
        }


        beam = rankedStates.slice(0, beamWidth);

        stats.maxBeamSize = Math.max(
            stats.maxBeamSize,
            beam.length
        );
    }


    if (bestBars !== null) {

        return createResult(
            bestBars,
            [],
            true,
            true
        );
    }


    return createResult(
        greedy.bars,
        greedy.remainingItems,
        greedy.complete,
        true
    );
}


function generateCombinations(pieces) {

    const combinations = [];

    function buildCombination(startIndex, currentCombination) {

        for (let i = startIndex; i < pieces.length; i++) {

            const newCombination =
                [...currentCombination, pieces[i]];

            combinations.push(newCombination);

            buildCombination(
                i + 1,
                newCombination
            );
        }
    }

    buildCombination(0, []);

    return combinations;
}

function evaluateCombination(combination, stockLength, kerf) {

    let remaining = stockLength;
    let waste = 0;

    for (const piece of combination) {

        const result =
            cutPiece(
                remaining,
                piece,
                kerf
            );

        if (!result.possible) {

            return {
                possible: false,
                remaining: remaining,
                waste: waste
            };
        }

        remaining = result.remaining;
        waste += result.waste;
    }

    return {
        possible: true,
        remaining: remaining,
        waste: waste
    };
}

function findBestCombination(pieces, stockLength, kerf) {

    const combinations = generateCombinations(pieces);

    let bestCombination = null;
    let bestResult = null;
    let bestIsUseful = false;

    for (const combination of combinations) {

        const result = evaluateCombination(
            combination,
            stockLength,
            kerf
        );

        // Ohitetaan yhdistelmät,
        // jotka eivät mahdu tankoon
        if (!result.possible) {
            continue;
        }

        // Onko jäännöspala käyttökelpoinen?
        const remnantEvaluation = evaluateRemnant(
            result.remaining,
            pieces,
            kerf
        );

        const isUseful = remnantEvaluation.piece !== null;

        // Ensimmäinen mahdollinen yhdistelmä
        if (bestCombination === null) {

            bestCombination = combination;
            bestResult = result;
            bestIsUseful = isUseful;

            continue;
        }

        // Käyttökelpoinen jäännös
        // voittaa käyttökelvottoman
        if (isUseful && !bestIsUseful) {

            bestCombination = combination;
            bestResult = result;
            bestIsUseful = isUseful;

            continue;
        }

        // Jos molemmat ovat joko
        // käyttökelpoisia tai käyttökelvottomia,
        // valitaan pienempi jäännös
        if (
            isUseful === bestIsUseful &&
            result.remaining < bestResult.remaining
        ) {

            bestCombination = combination;
            bestResult = result;
            bestIsUseful = isUseful;
        }
    }

    return {
        combination: bestCombination,
        result: bestResult
    };
}

function evaluateRemnant(remnant, pieces, kerf) {

    let bestRemaining = Infinity;
    let bestPiece = null;

    for (const piece of pieces) {

        const result =
            cutPiece(remnant, piece, kerf);

        if (!result.possible) {
            continue;
        }

        if (result.remaining < bestRemaining) {

            bestRemaining = result.remaining;
            bestPiece = piece;
        }
    }

    return {
        piece: bestPiece,
        remaining: bestRemaining
    };
}

function optimizeOrder(pieces, stockLength, kerf) {

    const remainingPieces = [...pieces];

    const bars = [];

    while (remainingPieces.length > 0) {

        const best = findBestCombination(
            remainingPieces,
            stockLength,
            kerf
        );

        // Jos sopivaa yhdistelmää ei löydy,
        // lopetetaan
        if (best.combination === null) {
            break;
        }

        // Luodaan uusi tanko
        bars.push({
            cuts: best.combination,
            remaining: best.result.remaining,
            waste: best.result.waste
        });

        // Poistetaan käytetyt kappaleet
        for (const piece of best.combination) {

            const index =
                remainingPieces.indexOf(piece);

            if (index !== -1) {
                remainingPieces.splice(index, 1);
            }
        }
    }

    return bars;
}


function optimizeCuts(cuts, stockLength, kerf) {

    // Muutetaan kappalemäärät yksittäisiksi kappaleiksi
    const pieces = [];

    for (const cut of cuts) {

        for (let i = 0; i < cut.quantity; i++) {

            pieces.push(cut.length);
        }
    }


    // Järjestetään pisimmästä lyhimpään
    pieces.sort((a, b) => b - a);


    const bars = [];
    const rejectedPieces = [];


    // Käydään kaikki kappaleet läpi
    for (const piece of pieces) {

        let placed = false;


        // Etsitään paras olemassa oleva tanko
        let bestBar = null;
        let bestRemaining = Infinity;
        let bestIsUseful = false;


        for (const bar of bars) {

            if (bar.remaining >= piece) {

                const result =
                    cutPiece(
                        bar.remaining,
                        piece,
                        kerf
                    );


                // Onko jäännöspala käyttökelpoinen?
                const isUseful =
                    result.remaining >= 1000;


                // Ensimmäinen sopiva tanko
                if (bestBar === null) {

                    bestBar = bar;
                    bestRemaining = result.remaining;
                    bestIsUseful = isUseful;


                    // Käyttökelpoinen jäännös voittaa
                } else if (
                    isUseful && !bestIsUseful
                ) {

                    bestBar = bar;
                    bestRemaining = result.remaining;
                    bestIsUseful = isUseful;


                    // Jos käyttökelpoisuus on sama,
                    // valitaan lyhyempi jäännös
                } else if (
                    isUseful === bestIsUseful &&
                    result.remaining < bestRemaining
                ) {

                    bestBar = bar;
                    bestRemaining = result.remaining;
                    bestIsUseful = isUseful;
                }
            }
        }


        // Jos sopiva tanko löytyi
        if (bestBar !== null) {

            const result =
                cutPiece(
                    bestBar.remaining,
                    piece,
                    kerf
                );


            bestBar.cuts.push(piece);

            bestBar.remaining =
                result.remaining;

            bestBar.waste +=
                result.waste;

            placed = true;
        }


        // Jos kappale ei mahtunut mihinkään,
        // aloitetaan uusi tanko
        if (!placed) {

            const result =
                cutPiece(
                    stockLength,
                    piece,
                    kerf
                );


            if (!result.possible) {

                rejectedPieces.push(piece);
                continue;
            }


            bars.push({

                cuts: [piece],

                used: piece,

                remaining: result.remaining,

                waste: result.waste
            });
        }
    }


    return {
        bars: bars,
        rejectedPieces: rejectedPieces
    };
}


const PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS = Object.freeze({
    beamWidth: 20,
    patternsPerState: 10,
    candidatePoolSize: 50,
    maxExtraBars: 2,
    scoreSettings: Object.freeze({
        minimumLength: 500,
        fullValueLength: 4500,
        curvePower: 2,
        minimumValueFactor: 0.1,
        maximumValueFactor: 0.95,
        scrapValueFactor: 0.1,
        kerfRecoveryFactor: 0,
        reusableRemnantHandlingPenalty: 20,
        freeScrapLength: 200,
        largeScrapPenaltyFactor: 1.7
    })
});


function mergeGroupedCuts(cuts) {

    const quantitiesByLength = new Map();


    for (const cut of cuts) {

        const currentQuantity =
            quantitiesByLength.get(cut.length) ?? 0;

        quantitiesByLength.set(
            cut.length,
            currentQuantity + cut.quantity
        );
    }


    return [...quantitiesByLength.entries()].map(
        ([length, quantity]) => ({
            length: length,
            quantity: quantity
        })
    );
}


function getRemnantStatus(
    remaining,
    scoreSettings
) {

    if (remaining === 0) {
        return "none";
    }


    return evaluateRemnantDisposition(
        remaining,
        scoreSettings
    ).disposition;
}


function adaptMaterialOptimizationForUi(
    optimization,
    scoreSettings
) {

    return {
        complete: optimization.complete,
        bars: optimization.bars.map((bar, index) => ({
            id: "bar-" + (index + 1),
            number: index + 1,
            groupedCuts: bar.pattern.map(item => ({
                length: item.length,
                quantity: item.quantity
            })),
            remaining: bar.remaining,
            waste: bar.waste,
            remnantStatus: getRemnantStatus(
                bar.remaining,
                scoreSettings
            )
        })),
        remainingItems: optimization.remainingItems.map(item => ({
            length: item.length,
            quantity: item.quantity
        }))
    };
}


function formatMillimeters(value) {

    if (!Number.isFinite(value)) {
        throw new Error("Näytettävän mitan pitää olla luku.");
    }


    const rounded = Math.round(
        value * DP_DIMENSION_SCALE
    ) / DP_DIMENSION_SCALE;

    const normalized = Object.is(rounded, -0)
        ? 0
        : rounded;


    return String(normalized).replace(".", ",") + " mm";
}


function getRemnantStatusLabel(remnantStatus) {

    if (remnantStatus === "reusable") {
        return "SÄÄSTÄ JÄÄNNÖS";
    }


    if (remnantStatus === "scrap") {
        return "ROMU";
    }


    return "EI JÄÄNNÖSTÄ";
}


const WORK_STORAGE_KEY = "sahausoptimointi.currentWork";
const WORK_STATE_SCHEMA_VERSION = 2;
const WORK_STATE_ENGINE_VERSION = "material-v0.2";

const DEFAULT_STOCK_LENGTH = "6000";
const DEFAULT_STOCK_QUANTITY = "1";
const DEFAULT_UNLIMITED_STOCK = true;
const DEFAULT_KERF = "3";

const completedBarIds = new Set();
let currentGeneratedPlan = null;
let workInputRevision = 0;


function isPlainObject(value) {
    return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);
}


function isStoredInputValue(value) {
    return typeof value === "string" ||
        (typeof value === "number" && Number.isFinite(value));
}


function isValidStoredInputRows(inputRows) {

    return Array.isArray(inputRows) &&
        inputRows.length <= 1000 &&
        inputRows.every(row =>
            isPlainObject(row) &&
            isStoredInputValue(row.length) &&
            isStoredInputValue(row.quantity)
        );
}


function isValidStoredPlan(plan) {

    if (
        !isPlainObject(plan) ||
        plan.complete !== true ||
        !Array.isArray(plan.bars) ||
        plan.bars.length === 0 ||
        plan.bars.length > 10000 ||
        !Array.isArray(plan.remainingItems)
    ) {
        return false;
    }


    const validRemnantStatuses = new Set([
        "none",
        "reusable",
        "scrap"
    ]);


    return plan.bars.every((bar, index) =>
        isPlainObject(bar) &&
        bar.id === "bar-" + (index + 1) &&
        bar.number === index + 1 &&
        Array.isArray(bar.groupedCuts) &&
        bar.groupedCuts.length > 0 &&
        bar.groupedCuts.every(cut =>
            isPlainObject(cut) &&
            Number.isFinite(cut.length) &&
            cut.length > 0 &&
            Number.isInteger(cut.quantity) &&
            cut.quantity > 0
        ) &&
        Number.isFinite(bar.remaining) &&
        bar.remaining >= 0 &&
        Number.isFinite(bar.waste) &&
        bar.waste >= 0 &&
        validRemnantStatuses.has(bar.remnantStatus)
    ) &&
        plan.remainingItems.every(item =>
            isPlainObject(item) &&
            Number.isFinite(item.length) &&
            item.length > 0 &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0
        );
}


function isValidStoredWorkState(state) {

    if (
        !isPlainObject(state) ||
        state.schemaVersion !== WORK_STATE_SCHEMA_VERSION ||
        state.engineVersion !== WORK_STATE_ENGINE_VERSION ||
        typeof state.savedAt !== "string" ||
        !Number.isFinite(Date.parse(state.savedAt)) ||
        !isStoredInputValue(state.stockLength) ||
        !isStoredInputValue(state.stockQuantity) ||
        typeof state.unlimitedStock !== "boolean" ||
        !isStoredInputValue(state.kerf) ||
        !isValidStoredInputRows(state.remnantRows) ||
        !isValidStoredInputRows(state.inputRows) ||
        !Array.isArray(state.completedBarIds)
    ) {
        return false;
    }


    if (state.generatedPlan === null) {
        return state.completedBarIds.length === 0;
    }


    if (!isValidStoredPlan(state.generatedPlan)) {
        return false;
    }


    const validBarIds = new Set(
        state.generatedPlan.bars.map(bar => bar.id)
    );


    return state.completedBarIds.every(barId =>
        typeof barId === "string" &&
        validBarIds.has(barId)
    ) &&
        new Set(state.completedBarIds).size ===
        state.completedBarIds.length;
}


function getInputRowsForStorage() {

    return [...document.querySelectorAll("#cutList .cut-row")].map(
        row => ({
            length:
                row.querySelector(".cut-length").value,

            quantity:
                row.querySelector(".cut-quantity").value
        })
    );
}


function getRemnantRowsForStorage() {

    return [...document.querySelectorAll(".remnant-row")].map(
        row => ({
            length:
                row.querySelector(".remnant-length").value,

            quantity:
                row.querySelector(".remnant-quantity").value
        })
    );
}


function createWorkStateSnapshot() {

    return {
        schemaVersion: WORK_STATE_SCHEMA_VERSION,
        engineVersion: WORK_STATE_ENGINE_VERSION,
        savedAt: new Date().toISOString(),

        stockLength:
            document.getElementById("stockLength").value,

        stockQuantity:
            document.getElementById("stockQuantity").value,

        unlimitedStock:
            document.getElementById("unlimitedStock").checked,

        kerf:
            document.getElementById("kerf").value,

        remnantRows:
            getRemnantRowsForStorage(),

        inputRows:
            getInputRowsForStorage(),

        generatedPlan: currentGeneratedPlan,
        completedBarIds: [...completedBarIds]
    };
}

function saveCurrentWorkState() {

    try {
        localStorage.setItem(
            WORK_STORAGE_KEY,
            JSON.stringify(createWorkStateSnapshot())
        );
    } catch {
        // Tallennuksen estyminen ei saa rikkoa laskentaa tai sahausnäkymää.
    }
}


function removeSavedWorkState() {

    try {
        localStorage.removeItem(WORK_STORAGE_KEY);
    } catch {
        // Työ voidaan silti nollata muistissa, vaikka selain estäisi tallennuksen.
    }
}


function resetWorkToDefaults() {

    document.getElementById("stockLength").value =
        DEFAULT_STOCK_LENGTH;

    document.getElementById("stockQuantity").value =
        DEFAULT_STOCK_QUANTITY;

    document.getElementById("unlimitedStock").checked =
        DEFAULT_UNLIMITED_STOCK;

    document.getElementById("kerf").value =
        DEFAULT_KERF;

    updateStockQuantityAvailability();

    const remnantList =
        document.getElementById("remnantList");

    remnantList.replaceChildren();

    const cutList =
        document.getElementById("cutList");

    cutList.replaceChildren(createCutRow());

    currentGeneratedPlan = null;
    resetCompletedBarState();

    const resultElement = document.getElementById("result");

    resultElement.className = "";
    resultElement.replaceChildren();
}


function startNewWork() {

    const confirmed = window.confirm(
        "Aloitetaanko uusi työ? Tallennettu sahaussuunnitelma poistetaan."
    );


    if (!confirmed) {
        return;
    }


    removeSavedWorkState();
    resetWorkToDefaults();
    workInputRevision++;
}


function restoreSavedWorkState() {

    let serializedState;


    try {
        serializedState = localStorage.getItem(WORK_STORAGE_KEY);
    } catch {
        return false;
    }


    if (serializedState === null) {
        return false;
    }


    let state;


    try {
        state = JSON.parse(serializedState);
    } catch {
        removeSavedWorkState();
        resetWorkToDefaults();
        return false;
    }


    if (!isValidStoredWorkState(state)) {
        removeSavedWorkState();
        resetWorkToDefaults();
        return false;
    }


    document.getElementById("stockLength").value =
        String(state.stockLength);

    document.getElementById("stockQuantity").value =
        String(state.stockQuantity);

    document.getElementById("unlimitedStock").checked =
        state.unlimitedStock;

    document.getElementById("kerf").value =
        String(state.kerf);

    updateStockQuantityAvailability();


    const remnantList =
        document.getElementById("remnantList");

    remnantList.replaceChildren();


    for (const remnantRow of state.remnantRows) {

        remnantList.appendChild(
            createRemnantRow(
                remnantRow.length,
                remnantRow.quantity
            )
        );
    }


    const cutList =
        document.getElementById("cutList");

    cutList.replaceChildren();


    for (const inputRow of state.inputRows) {
        cutList.appendChild(
            createCutRow(inputRow.length, inputRow.quantity)
        );
    }


    currentGeneratedPlan = state.generatedPlan;
    resetCompletedBarState();


    for (const barId of state.completedBarIds) {
        completedBarIds.add(barId);
    }


    if (currentGeneratedPlan !== null) {
        renderCuttingPlan(currentGeneratedPlan);
    }


    return true;
}


function handleOrderInputChange() {

    workInputRevision++;

    const hadGeneratedPlan = currentGeneratedPlan !== null;

    currentGeneratedPlan = null;
    resetCompletedBarState();


    if (hadGeneratedPlan) {

        const resultElement = document.getElementById("result");

        resultElement.className = "work-state-message";
        resultElement.textContent =
            "Syötteitä muutettiin. Laske uusi sahaussuunnitelma.";
    }


    saveCurrentWorkState();
}


function resetCompletedBarState() {
    completedBarIds.clear();
}


function updateCompletionProgress() {

    const completedCountElement =
        document.getElementById("completedBarCount");


    if (completedCountElement !== null) {
        completedCountElement.textContent = completedBarIds.size;
    }
}


function toggleBarCompletion(button) {

    const barId = button.dataset.barId;
    const barNumber = button.dataset.barNumber;
    const barCard = button.closest(".bar-card");


    if (!barId || barCard === null) {
        return;
    }


    const isCompleted = completedBarIds.has(barId);


    if (isCompleted) {
        completedBarIds.delete(barId);
    } else {
        completedBarIds.add(barId);
    }


    const isNowCompleted = !isCompleted;

    barCard.classList.toggle(
        "bar-card--completed",
        isNowCompleted
    );

    button.classList.toggle(
        "bar-completion-button--completed",
        isNowCompleted
    );

    button.textContent = isNowCompleted
        ? "TEHTY ✓"
        : "VALMIS";

    button.setAttribute(
        "aria-pressed",
        String(isNowCompleted)
    );

    button.setAttribute(
        "aria-label",
        isNowCompleted
            ? "Merkitse tanko " + barNumber + " keskeneräiseksi"
            : "Merkitse tanko " + barNumber + " tehdyksi"
    );


    updateCompletionProgress();
    saveCurrentWorkState();
}


function renderCuttingPlan(plan) {

    let result = `
        <section class="plan-summary">
            <h2>Laskettu sahaussuunnitelma</h2>
            <p>
                Tankoja tarvitaan:
                <strong>${plan.bars.length}</strong>
            </p>
        </section>
        <p
            id="completionProgress"
            class="completion-progress"
            aria-live="polite"
            aria-atomic="true"
        >
            Valmiina <strong id="completedBarCount">${completedBarIds.size}</strong>
            / ${plan.bars.length} tankoa
        </p>
        <div class="bar-list">
    `;



    for (const bar of plan.bars) {

        const isCompleted = completedBarIds.has(bar.id);

        result += `
            <article
                class="bar-card${isCompleted ? " bar-card--completed" : ""}"
                data-bar-id="${bar.id}"
            >
                <h3 class="bar-card-title">
                    TANKO ${bar.number}
                    <span>/ ${plan.bars.length}</span>
                </h3>
                <div class="bar-cuts">
        `;


        for (const cut of bar.groupedCuts) {

            result += `
                <div class="bar-cut">
                    ${formatMillimeters(cut.length)} × ${cut.quantity}
                </div>
            `;
        }


        result += `
                </div>
                <dl class="bar-metrics">
                    <div>
                        <dt>Jäännös:</dt>
                        <dd>${formatMillimeters(bar.remaining)}</dd>
                    </div>
                    <div>
                        <dt>Sahahukka:</dt>
                        <dd>${formatMillimeters(bar.waste)}</dd>
                    </div>
                </dl>
                <p class="remnant-status remnant-status--${bar.remnantStatus}">
                    ${getRemnantStatusLabel(bar.remnantStatus)}
                </p>
                <button
                    class="bar-completion-button${isCompleted ? " bar-completion-button--completed" : ""}"
                    type="button"
                    data-bar-id="${bar.id}"
                    data-bar-number="${bar.number}"
                    aria-pressed="${isCompleted}"
                    aria-label="${isCompleted
                ? "Merkitse tanko " + bar.number + " keskeneräiseksi"
                : "Merkitse tanko " + bar.number + " tehdyksi"
            }"
                    onclick="toggleBarCompletion(this)"
                >
                    ${isCompleted ? "TEHTY ✓" : "VALMIS"}
                </button>
            </article>
        `;
    }


    result += "</div>";


    const resultElement = document.getElementById("result");

    resultElement.className = "plan-result";
    resultElement.innerHTML = result;
}


function renderOptimizationFailure(
    title,
    details,
    remainingItems = []
) {

    let result =
        "<div class=\"message-content\">" +
        "<strong>" +
        title +
        "</strong>";


    if (details) {
        result += "<br>" + details;
    }


    if (remainingItems.length > 0) {

        result += "<br><br>Käsittelemättä jäivät:<br>";


        for (const item of remainingItems) {

            result +=
                formatMillimeters(item.length) +
                " × " +
                item.quantity +
                "<br>";
        }
    }


    result += "</div>";


    const resultElement = document.getElementById("result");

    resultElement.className = "validation-message";
    resultElement.innerHTML = result;
}


async function calculate() {

    const stockLength =
        Number(
            document.getElementById("stockLength").value
        );


    const kerf =
        Number(
            document.getElementById("kerf").value
        );


    const cuts =
        getCutsFromForm();


    const validationErrors = [];


    if (!Number.isFinite(stockLength) || stockLength <= 0) {

        validationErrors.push(
            "Raakatangon pituuden pitää olla suurempi kuin 0."
        );

    } else if (!hasSupportedMillimeterPrecision(stockLength)) {

        validationErrors.push(
            "Raakatangon pituudessa saa olla enintään yksi desimaali. " +
            "Arvoa ei pyöristetä."
        );
    }


    if (!Number.isFinite(kerf) || kerf < 0) {

        validationErrors.push(
            "Sahanterän leveyden pitää olla 0 tai suurempi."
        );

    } else if (!hasSupportedMillimeterPrecision(kerf)) {

        validationErrors.push(
            "Sahanterän leveydessä saa olla enintään yksi desimaali. " +
            "Arvoa ei pyöristetä."
        );
    }


    if (cuts.length === 0) {

        validationErrors.push(
            "Anna vähintään yksi sahattava kappale."
        );
    }


    for (let i = 0; i < cuts.length; i++) {

        const cut = cuts[i];
        const rowNumber = i + 1;


        if (!Number.isFinite(cut.length) || cut.length <= 0) {

            validationErrors.push(
                "Rivi " +
                rowNumber +
                ": kappaleen pituuden pitää olla suurempi kuin 0."
            );

        } else if (!hasSupportedMillimeterPrecision(cut.length)) {

            validationErrors.push(
                "Rivi " +
                rowNumber +
                ": kappaleen pituudessa saa olla enintään yksi desimaali. " +
                "Arvoa ei pyöristetä."
            );

        } else if (
            stockLength > 0 &&
            cut.length > stockLength
        ) {

            validationErrors.push(
                "Rivi " +
                rowNumber +
                ": " +
                cut.length +
                " mm kappale ei mahdu " +
                stockLength +
                " mm raakatankoon."
            );
        }


        if (
            !Number.isInteger(cut.quantity) ||
            cut.quantity <= 0
        ) {

            validationErrors.push(
                "Rivi " +
                rowNumber +
                ": määrän pitää olla positiivinen kokonaisluku."
            );
        }
    }


    if (validationErrors.length > 0) {

        const resultElement = document.getElementById("result");

        resultElement.className = "validation-message";
        resultElement.innerHTML =
            "<div class=\"message-content\">" +
            "<strong>Tarkista syötteet:</strong><br>" +
            validationErrors.join("<br>") +
            "</div>";

        return;
    }


    const groupedCuts = mergeGroupedCuts(cuts);
    const calculationInputRevision = workInputRevision;
    const calculateButton =
        document.getElementById("calculateButton");

    const originalButtonText = calculateButton.textContent;


    calculateButton.disabled = true;
    calculateButton.textContent = "Lasketaan…";

    const resultElement = document.getElementById("result");

    resultElement.className = "calculation-status";
    resultElement.textContent = "Lasketaan…";


    // Annetaan selaimelle mahdollisuus näyttää laskentatila ennen synkronista hakua.
    await new Promise(resolve => setTimeout(resolve, 0));


    try {

        const optimization =
            optimizeOrderMaterialBeamDP(
                groupedCuts,
                stockLength,
                kerf,
                PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
            );


        if (!optimization.complete) {

            renderOptimizationFailure(
                "Sahaussuunnitelmaa ei voitu muodostaa loppuun.",
                "Osittaista tulosta ei näytetä valmiina sahaussuunnitelmana.",
                optimization.remainingItems
            );

            return;
        }

        logCostBreakdown(optimization.materialScore);

        const plan = adaptMaterialOptimizationForUi(
            optimization,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
                .scoreSettings
        );


        if (calculationInputRevision !== workInputRevision) {

            resultElement.className = "work-state-message";
            resultElement.textContent =
                "Syötteitä muutettiin laskennan aikana. Laske uudelleen.";

            return;
        }


        resetCompletedBarState();
        currentGeneratedPlan = plan;
        renderCuttingPlan(plan);
        saveCurrentWorkState();

    } catch (error) {

        renderOptimizationFailure(
            "Sahaussuunnitelmaa ei voitu laskea.",
            error instanceof Error
                ? error.message
                : "Tuntematon laskentavirhe."
        );

    } finally {

        calculateButton.disabled = false;
        calculateButton.textContent = originalButtonText;
    }
}

function initializeWorkPersistence() {

    document.addEventListener("input", event => {

        if (
            event.target.matches(
                "#stockLength, " +
                "#stockQuantity, " +
                "#kerf, " +
                ".remnant-length, " +
                ".remnant-quantity, " +
                ".cut-length, " +
                ".cut-quantity"
            )
        ) {
            handleOrderInputChange();
        }
    });


    document.addEventListener("change", event => {

        if (event.target.matches("#unlimitedStock")) {
            handleOrderInputChange();
        }
    });


    restoreSavedWorkState();
}


if (typeof document !== "undefined") {
    initializeWorkPersistence();
}
