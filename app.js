const PROFILE_TYPES = Object.freeze({
    uProfile: Object.freeze({
        label: "U-profiili",
        dimensionRole: "doorHeight"
    }),

    verticalProfile: Object.freeze({
        label: "Pystyprofiili",
        dimensionRole: "doorHeight"
    }),

    horizontalProfile: Object.freeze({
        label: "Vaakaprofiili",
        dimensionRole: "doorWidth"
    }),

    topRail: Object.freeze({
        label: "Yläkisko",
        dimensionRole: "openingWidth"
    }),

    bottomRail: Object.freeze({
        label: "Alakisko",
        dimensionRole: "openingWidth"
    })
});


function createProfileTypeOptions(
    selectedProfileType = "verticalProfile"
) {

    return Object.entries(PROFILE_TYPES)
        .map(([profileType, settings]) => `
            <option
                value="${profileType}"
                ${profileType === selectedProfileType
                ? "selected"
                : ""}
            >
                ${settings.label}
            </option>
        `)
        .join("");
}

function createStockProfileRow(
    profileType,
    quantity = "1",
    unlimited = true
) {

    const settings = PROFILE_TYPES[profileType];

    if (settings === undefined) {
        throw new Error(
            "Tuntematon profiilityyppi: " + profileType
        );
    }


    const row = document.createElement("div");

    row.className = "stock-profile-row";
    row.dataset.profileType = profileType;

    row.innerHTML = `
        <span class="stock-profile-name">
            ${settings.label}
        </span>

        <input
            class="stock-profile-quantity"
            type="number"
            min="0"
            step="1"
            inputmode="numeric"
            aria-label="${settings.label}, määrä"
        >

        <label class="stock-profile-unlimited">
            <input
                class="stock-profile-unlimited-checkbox"
                type="checkbox"
                ${unlimited ? "checked" : ""}
                onchange="updateStockProfileQuantityAvailability(this)"
            >
            <span>Rajaton</span>
        </label>
    `;

    const quantityInput =
        row.querySelector(".stock-profile-quantity");

    quantityInput.value = String(quantity);
    quantityInput.disabled = unlimited;

    return row;
}


function createDefaultStockProfileRows() {

    const stockProfileList =
        document.getElementById("stockProfileList");

    stockProfileList.replaceChildren(
        ...Object.keys(PROFILE_TYPES).map(
            profileType =>
                createStockProfileRow(profileType)
        )
    );
}

function updateStockProfileQuantityAvailability(
    unlimitedCheckbox
) {

    const row =
        unlimitedCheckbox.closest(".stock-profile-row");

    if (row === null) {
        return;
    }

    const quantityInput =
        row.querySelector(".stock-profile-quantity");

    quantityInput.disabled =
        unlimitedCheckbox.checked;
}

function createCutRow(
    length = "",
    quantity = "1",
    profileType = "verticalProfile"
) {

    const row = document.createElement("div");

    row.className = "cut-row";

    row.innerHTML = `
        <label class="form-field">
            <span>Profiilityyppi</span>
            <select class="cut-profile-type">
                ${createProfileTypeOptions(profileType)}
            </select>
        </label>

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
    quantity = "1",
    profileType = "verticalProfile"
) {

    const row = document.createElement("div");

    row.className = "cut-row remnant-row";

    row.innerHTML = `
        <label class="form-field">
            <span>Profiilityyppi</span>
            <select class="remnant-profile-type">
                ${createProfileTypeOptions(profileType)}
            </select>
        </label>

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

    const profileTypeInputs =
        document.querySelectorAll(".cut-profile-type");

    const lengthInputs =
        document.querySelectorAll(".cut-length");

    const quantityInputs =
        document.querySelectorAll(".cut-quantity");

    const cuts = [];

    for (let i = 0; i < lengthInputs.length; i++) {

        const length = Number(lengthInputs[i].value);
        const quantity = Number(quantityInputs[i].value);

        cuts.push({
            profileType: profileTypeInputs[i].value,
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

    const stockProfileRows =
        document.querySelectorAll(".stock-profile-row");

    const newStock = [];


    for (const row of stockProfileRows) {

        const profileType =
            row.dataset.profileType;

        const unlimited =
            row.querySelector(
                ".stock-profile-unlimited-checkbox"
            ).checked;

        const quantity =
            unlimited
                ? null
                : Number(
                    row.querySelector(
                        ".stock-profile-quantity"
                    ).value
                );

        newStock.push({
            profileType: profileType,
            unlimited: unlimited,
            quantity: quantity
        });
    }

    const remnantRows =
        document.querySelectorAll(".remnant-row");

    const remnants = [];

    for (const row of remnantRows) {

        const profileType =
            row.querySelector(
                ".remnant-profile-type"
            ).value;

        const length =
            Number(
                row.querySelector(".remnant-length").value
            );

        const quantity =
            Number(
                row.querySelector(".remnant-quantity").value
            );

        remnants.push({
            profileType: profileType,
            length: length,
            quantity: quantity
        });
    }

    return {
        stockLength: stockLength,
        newStock: newStock,
        remnants: remnants
    };
}


function validateMaterialAvailability(
    materialAvailability
) {

    const {
        stockLength,
        newStock,
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


    if (!Array.isArray(newStock)) {
        throw new Error(
            "Uusien tankojen saatavuustietojen pitää olla taulukossa."
        );
    }


    const expectedProfileTypes =
        Object.keys(PROFILE_TYPES);

    if (
        newStock.length !==
        expectedProfileTypes.length
    ) {
        throw new Error(
            "Uusien tankojen saatavuustiedot ovat puutteelliset."
        );
    }


    const seenProfileTypes = new Set();


    for (const stock of newStock) {

        if (
            typeof stock.profileType !== "string" ||
            PROFILE_TYPES[stock.profileType] === undefined
        ) {
            throw new Error(
                "Uuden tangon profiilityyppi on virheellinen."
            );
        }


        if (seenProfileTypes.has(stock.profileType)) {
            throw new Error(
                "Sama profiilityyppi esiintyy uusien tankojen saatavuudessa useammin kuin kerran."
            );
        }

        seenProfileTypes.add(stock.profileType);


        if (typeof stock.unlimited !== "boolean") {
            throw new Error(
                "Uusien tankojen saatavuustieto on virheellinen."
            );
        }


        if (stock.unlimited) {

            if (stock.quantity !== null) {
                throw new Error(
                    "Rajattoman materiaalin määrän pitää olla null."
                );
            }

        } else {

            if (
                !Number.isInteger(stock.quantity) ||
                stock.quantity < 0
            ) {
                throw new Error(
                    "Uusien tankojen määrän pitää olla kokonaisluku, joka on vähintään 0."
                );
            }
        }
    }


    for (const profileType of expectedProfileTypes) {

        if (!seenProfileTypes.has(profileType)) {
            throw new Error(
                "Uusien tankojen saatavuustiedoista puuttuu profiilityyppi: " +
                PROFILE_TYPES[profileType].label
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
            typeof remnant.profileType !== "string" ||
            PROFILE_TYPES[remnant.profileType] === undefined
        ) {
            throw new Error(
                "Jäännöksen profiilityyppi on virheellinen."
            );
        }


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


    const hasNewStock =
        newStock.some(stock =>
            stock.unlimited ||
            stock.quantity > 0
        );

    const hasRemnants =
        remnants.some(remnant =>
            remnant.quantity > 0
        );


    if (!hasNewStock && !hasRemnants) {
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


    const remnantsByProfileAndLength =
        new Map();


    for (const remnant of materialAvailability.remnants) {

        const lengthUnits =
            millimetersToDpUnits(remnant.length);

        const key =
            remnant.profileType +
            ":" +
            lengthUnits;

        const existing =
            remnantsByProfileAndLength.get(key);


        if (existing === undefined) {

            remnantsByProfileAndLength.set(
                key,
                {
                    profileType:
                        remnant.profileType,

                    length:
                        remnant.length,

                    quantity:
                        remnant.quantity
                }
            );

            continue;
        }


        existing.quantity +=
            remnant.quantity;
    }


    const remnants =
        [...remnantsByProfileAndLength.values()]
            .sort((first, second) => {

                if (
                    first.profileType !==
                    second.profileType
                ) {
                    return first.profileType.localeCompare(
                        second.profileType
                    );
                }

                return second.length - first.length;
            });


    const newStock =
        materialAvailability.newStock.map(
            stock => ({
                profileType:
                    stock.profileType,

                unlimited:
                    stock.unlimited,

                quantity:
                    stock.quantity
            })
        );


    return {
        stockLength:
            materialAvailability.stockLength,

        newStock: newStock,

        remnants: remnants
    };
}

function getMaterialSourcesForProfile(
    materialInventory,
    profileType
) {

    validateMaterialAvailability(
        materialInventory
    );


    if (
        typeof profileType !== "string" ||
        PROFILE_TYPES[profileType] === undefined
    ) {
        throw new Error(
            "Materiaalilähteiden profiilityyppi on virheellinen."
        );
    }


    const sources = [];


    for (const remnant of materialInventory.remnants) {

        if (
            remnant.profileType !==
            profileType
        ) {
            continue;
        }


        sources.push({
            source:
                "remnant",

            profileType:
                profileType,

            sourceLength:
                remnant.length,

            unlimited:
                false,

            quantity:
                remnant.quantity
        });
    }


    const newStock =
        materialInventory.newStock.find(
            stock =>
                stock.profileType === profileType
        );


    if (newStock === undefined) {
        throw new Error(
            "Profiilityypille ei löydy uusien tankojen saatavuustietoa."
        );
    }


    if (
        newStock.unlimited ||
        newStock.quantity > 0
    ) {

        sources.push({
            source:
                "new",

            profileType:
                profileType,

            sourceLength:
                materialInventory.stockLength,

            unlimited:
                newStock.unlimited,

            quantity:
                newStock.unlimited
                    ? null
                    : newStock.quantity
        });
    }


    return sources;
}

function findMaterialSourceCandidates(
    items,
    materialSources,
    kerf,
    maxPatternsPerSource = 10
) {

    if (!Array.isArray(materialSources)) {
        throw new Error(
            "Materiaalilähteiden pitää olla taulukossa."
        );
    }


    if (
        !Number.isInteger(maxPatternsPerSource) ||
        maxPatternsPerSource <= 0
    ) {
        throw new Error(
            "Lähdekohtaisen ehdokasmäärän pitää olla positiivinen kokonaisluku."
        );
    }


    const candidates = [];


    for (const materialSource of materialSources) {

        if (
            !materialSource.unlimited &&
            materialSource.quantity <= 0
        ) {
            continue;
        }


        const sourceCandidates =
            findCandidatePatternsDP(
                items,
                materialSource.sourceLength,
                kerf,
                maxPatternsPerSource
            );


        for (const candidate of sourceCandidates) {

            candidates.push({
                ...candidate,

                source:
                    materialSource.source,

                profileType:
                    materialSource.profileType,

                sourceLength:
                    materialSource.sourceLength,

                sourceUnlimited:
                    materialSource.unlimited,

                sourceQuantity:
                    materialSource.quantity
            });
        }
    }


    return candidates;
}

function consumeMaterialSource(
    materialSources,
    candidate
) {

    const nextSources =
        materialSources.map(source => ({
            ...source
        }));


    const sourceIndex =
        nextSources.findIndex(source =>
            source.source === candidate.source &&
            source.profileType === candidate.profileType &&
            source.sourceLength === candidate.sourceLength
        );


    if (sourceIndex === -1) {
        return null;
    }


    const source =
        nextSources[sourceIndex];


    if (source.unlimited) {
        return nextSources;
    }


    if (source.quantity <= 0) {
        return null;
    }


    source.quantity--;


    return nextSources;
}

function calculateMaterialUsage(
    plan,
    materialInventory
) {

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


    if (
        materialInventory === null ||
        typeof materialInventory !== "object" ||
        Array.isArray(materialInventory)
    ) {
        throw new Error(
            "Materiaalivaraston tiedot ovat virheelliset."
        );
    }


    validateMaterialAvailability(
        materialInventory
    );


    const stockByProfileType = new Map(
        materialInventory.newStock.map(
            stock => [
                stock.profileType,
                stock
            ]
        )
    );


    const availableRemnants = new Map();
    const usedRemnants = new Map();
    const newStockUsedByProfileType = new Map();


    for (const remnant of materialInventory.remnants) {

        const lengthUnits =
            millimetersToDpUnits(
                remnant.length
            );

        const key =
            remnant.profileType +
            ":" +
            lengthUnits;

        availableRemnants.set(
            key,
            remnant.quantity
        );
    }


    for (const bar of plan.bars) {

        const profileType =
            bar.profileType;

        if (
            typeof profileType !== "string" ||
            PROFILE_TYPES[profileType] === undefined
        ) {
            throw new Error(
                "Sahaussuunnitelman tangon profiilityyppi on virheellinen."
            );
        }


        const source =
            bar.source ?? "new";

        const sourceLength =
            bar.sourceLength ??
            materialInventory.stockLength;


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


        if (source === "new") {

            if (
                millimetersToDpUnits(sourceLength) !==
                millimetersToDpUnits(
                    materialInventory.stockLength
                )
            ) {
                throw new Error(
                    "Uuden tangon lähtöpituus ei vastaa varaston raakatangon pituutta."
                );
            }


            const stock =
                stockByProfileType.get(
                    profileType
                );

            if (stock === undefined) {
                throw new Error(
                    "Profiilityypille ei löydy uusien tankojen saatavuustietoa."
                );
            }


            const usedQuantity =
                (
                    newStockUsedByProfileType.get(
                        profileType
                    ) ?? 0
                ) + 1;


            if (
                !stock.unlimited &&
                usedQuantity > stock.quantity
            ) {
                throw new Error(
                    "Suunnitelma käyttää enemmän " +
                    PROFILE_TYPES[profileType].label +
                    "-raakalistoja kuin varastossa on."
                );
            }


            newStockUsedByProfileType.set(
                profileType,
                usedQuantity
            );

            continue;
        }


        if (source !== "remnant") {
            throw new Error(
                "Materiaalilähteen pitää olla new tai remnant."
            );
        }


        const lengthUnits =
            millimetersToDpUnits(
                sourceLength
            );

        const key =
            profileType +
            ":" +
            lengthUnits;

        const availableQuantity =
            availableRemnants.get(key) ?? 0;

        const usedQuantity =
            (
                usedRemnants.get(key) ?? 0
            ) + 1;


        if (
            usedQuantity >
            availableQuantity
        ) {
            throw new Error(
                "Suunnitelma käyttää enemmän " +
                PROFILE_TYPES[profileType].label +
                " " +
                sourceLength +
                " mm jäännöksiä kuin varastossa on."
            );
        }


        usedRemnants.set(
            key,
            usedQuantity
        );
    }


    const newStockUsage =
        materialInventory.newStock.map(
            stock => {

                const usedQuantity =
                    newStockUsedByProfileType.get(
                        stock.profileType
                    ) ?? 0;

                return {
                    profileType:
                        stock.profileType,

                    unlimited:
                        stock.unlimited,

                    availableQuantity:
                        stock.quantity,

                    usedQuantity:
                        usedQuantity,

                    remainingQuantity:
                        stock.unlimited
                            ? null
                            : stock.quantity -
                            usedQuantity
                };
            }
        );


    const remnantUsage =
        materialInventory.remnants.map(
            remnant => {

                const lengthUnits =
                    millimetersToDpUnits(
                        remnant.length
                    );

                const key =
                    remnant.profileType +
                    ":" +
                    lengthUnits;

                const usedQuantity =
                    usedRemnants.get(key) ?? 0;

                return {
                    profileType:
                        remnant.profileType,

                    length:
                        remnant.length,

                    availableQuantity:
                        remnant.quantity,

                    usedQuantity:
                        usedQuantity,

                    remainingQuantity:
                        remnant.quantity -
                        usedQuantity
                };
            }
        );


    const unusedRemnants =
        remnantUsage
            .filter(
                remnant =>
                    remnant.remainingQuantity > 0
            )
            .map(remnant => ({
                profileType:
                    remnant.profileType,

                length:
                    remnant.length,

                quantity:
                    remnant.remainingQuantity
            }));


    return {
        newStockUsage:
            newStockUsage,

        remnantUsage:
            remnantUsage,

        unusedRemnants:
            unusedRemnants
    };
}

function calculatePostOrderMaterialInventory(
    plan,
    materialInventory,
    scoreSettings = {}
) {

    const usage =
        calculateMaterialUsage(
            plan,
            materialInventory
        );


    const remnantsByProfileAndLength =
        new Map();


    function addRemnant(
        profileType,
        length,
        quantity
    ) {

        const lengthUnits =
            millimetersToDpUnits(length);

        const key =
            profileType +
            ":" +
            lengthUnits;

        const existing =
            remnantsByProfileAndLength.get(key);


        if (existing === undefined) {

            remnantsByProfileAndLength.set(
                key,
                {
                    profileType:
                        profileType,

                    length:
                        length,

                    quantity:
                        quantity
                }
            );

            return;
        }


        existing.quantity += quantity;
    }


    for (const remnant of usage.unusedRemnants) {

        addRemnant(
            remnant.profileType,
            remnant.length,
            remnant.quantity
        );
    }


    const generatedRemnants = [];
    const scrapRemnants = [];


    for (const bar of plan.bars) {

        if (bar.remaining === 0) {
            continue;
        }


        const evaluation =
            evaluateRemnantDisposition(
                bar.remaining,
                scoreSettings
            );


        if (evaluation.disposition === "reusable") {

            generatedRemnants.push({
                profileType:
                    bar.profileType,

                length:
                    bar.remaining,

                quantity:
                    1
            });

            addRemnant(
                bar.profileType,
                bar.remaining,
                1
            );

        } else {

            scrapRemnants.push({
                profileType:
                    bar.profileType,

                length:
                    bar.remaining,

                quantity:
                    1
            });
        }
    }


    const remnants =
        [...remnantsByProfileAndLength.values()]
            .sort((first, second) => {

                if (
                    first.profileType !==
                    second.profileType
                ) {
                    return first.profileType.localeCompare(
                        second.profileType
                    );
                }

                return second.length -
                    first.length;
            });


    const newStock =
        usage.newStockUsage.map(
            stock => ({
                profileType:
                    stock.profileType,

                unlimited:
                    stock.unlimited,

                quantity:
                    stock.unlimited
                        ? null
                        : stock.remainingQuantity
            })
        );


    return {
        stockLength:
            materialInventory.stockLength,

        newStock:
            newStock,

        remnants:
            remnants,

        generatedRemnants:
            generatedRemnants,

        scrapRemnants:
            scrapRemnants
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
    const barSources = [];

    let totalPieceLength = 0;
    let totalKerfWaste = 0;
    let totalStockLength = 0;

    let newStockBarCount = 0;
    let remnantSourceBarCount = 0;


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

        const source =
            bar.source ?? "new";

        const sourceLength =
            bar.sourceLength ?? stockLength;


        if (
            source !== "new" &&
            source !== "remnant"
        ) {

            throw new Error(
                "Materiaalilähteen pitää olla new tai remnant."
            );
        }

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
        barSources.push(source);


        if (source === "new") {
            newStockBarCount++;
        } else {
            remnantSourceBarCount++;
        }


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
        barSources: [...barSources],

        newStockBarCount: newStockBarCount,
        remnantSourceBarCount: remnantSourceBarCount,

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


function scoreCompleteMaterialTransitionPlan(
    plan,
    settings = {}
) {

    if (
        plan === null ||
        typeof plan !== "object" ||
        Array.isArray(plan) ||
        plan.complete !== true ||
        !Array.isArray(plan.bars)
    ) {
        throw new Error(
            "Materiaalisiirtymä voidaan pisteyttää vain valmiille sahaussuunnitelmalle."
        );
    }


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


    let sourceValueEquivalent = 0;
    let recoveredRemnantValueEquivalent = 0;
    let kerfRecoveredValueEquivalent = 0;

    let remnantHandlingPenaltyEquivalent = 0;
    let largeScrapPenaltyEquivalent = 0;


    for (const bar of plan.bars) {

        const source =
            bar.source ?? "new";

        const sourceLength =
            bar.sourceLength;


        if (
            source !== "new" &&
            source !== "remnant"
        ) {
            throw new Error(
                "Materiaalilähteen pitää olla new tai remnant."
            );
        }


        if (
            !Number.isFinite(sourceLength) ||
            sourceLength <= 0
        ) {
            throw new Error(
                "Materiaalilähteen pituuden pitää olla suurempi kuin 0."
            );
        }


        if (
            !Number.isFinite(bar.remaining) ||
            bar.remaining < 0
        ) {
            throw new Error(
                "Tangon jäännöksen pitää olla nolla tai positiivinen luku."
            );
        }


        if (
            !Number.isFinite(bar.waste) ||
            bar.waste < 0
        ) {
            throw new Error(
                "Tangon sahahukan pitää olla nolla tai positiivinen luku."
            );
        }


        if (source === "new") {

            sourceValueEquivalent +=
                sourceLength;

        } else {

            const sourceEvaluation =
                evaluateRemnantDisposition(
                    sourceLength,
                    settings
                );

            sourceValueEquivalent +=
                sourceLength *
                sourceEvaluation.savedValueFactor;
        }


        kerfRecoveredValueEquivalent +=
            bar.waste *
            kerfRecoveryFactor;


        if (bar.remaining === 0) {
            continue;
        }


        const remnantEvaluation =
            evaluateRemnantDisposition(
                bar.remaining,
                settings
            );


        if (
            remnantEvaluation.disposition ===
            "reusable"
        ) {

            recoveredRemnantValueEquivalent +=
                bar.remaining *
                remnantEvaluation.savedValueFactor;

            remnantHandlingPenaltyEquivalent +=
                reusableRemnantHandlingPenalty;

        } else {

            recoveredRemnantValueEquivalent +=
                bar.remaining *
                scrapValueFactor;

            largeScrapPenaltyEquivalent +=
                Math.max(
                    0,
                    bar.remaining -
                    freeScrapLength
                ) *
                largeScrapPenaltyFactor;
        }
    }


    const totalCostEquivalent =
        sourceValueEquivalent -
        recoveredRemnantValueEquivalent -
        kerfRecoveredValueEquivalent +
        remnantHandlingPenaltyEquivalent +
        largeScrapPenaltyEquivalent;


    return {
        sourceValueEquivalent:
            sourceValueEquivalent,

        recoveredRemnantValueEquivalent:
            recoveredRemnantValueEquivalent,

        kerfRecoveredValueEquivalent:
            kerfRecoveredValueEquivalent,

        remnantHandlingPenaltyEquivalent:
            remnantHandlingPenaltyEquivalent,

        largeScrapPenaltyEquivalent:
            largeScrapPenaltyEquivalent,

        totalCostEquivalent:
            totalCostEquivalent
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


function optimizeOrderInventoryBeamDP(
    items,
    materialSources,
    kerf,
    options = {}
) {

    if (!Array.isArray(items)) {
        throw new Error(
            "Kappaleiden pitää olla taulukossa."
        );
    }


    if (!Array.isArray(materialSources)) {
        throw new Error(
            "Materiaalilähteiden pitää olla taulukossa."
        );
    }


    const beamWidth =
        options.beamWidth ?? 50;

    const patternsPerSource =
        options.patternsPerState ?? 10;

    const scoreSettings =
        options.scoreSettings ?? {};


    if (
        !Number.isInteger(beamWidth) ||
        beamWidth <= 0
    ) {
        throw new Error(
            "Beam-leveyden pitää olla positiivinen kokonaisluku."
        );
    }


    function copyItems(sourceItems) {

        return sourceItems.map(item => ({
            length: item.length,
            quantity: item.quantity
        }));
    }


    function copySources(sourceList) {

        return sourceList.map(source => ({
            ...source
        }));
    }


    function copyBars(sourceBars) {

        return sourceBars.map(bar => ({
            pattern: bar.pattern.map(item => ({
                length: item.length,
                quantity: item.quantity
            })),

            remaining: bar.remaining,
            waste: bar.waste,

            source: bar.source,
            profileType: bar.profileType,
            sourceLength: bar.sourceLength
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


    function subtractPattern(
        sourceItems,
        pattern
    ) {

        const nextItems =
            copyItems(sourceItems);


        for (const patternItem of pattern) {

            let quantityToSubtract =
                patternItem.quantity;


            for (const item of nextItems) {

                if (
                    item.length !==
                    patternItem.length ||
                    item.quantity <= 0
                ) {
                    continue;
                }


                const quantity =
                    Math.min(
                        item.quantity,
                        quantityToSubtract
                    );


                item.quantity -= quantity;

                quantityToSubtract -=
                    quantity;


                if (quantityToSubtract === 0) {
                    break;
                }
            }


            if (quantityToSubtract > 0) {
                return null;
            }
        }


        return nextItems;
    }


    function getRemainingQuantity(
        remainingItems
    ) {

        return remainingItems.reduce(
            (total, item) =>
                total + item.quantity,
            0
        );
    }


    function getRemainingSize(
        remainingItems
    ) {

        return remainingItems.reduce(
            (total, item) =>
                total +
                item.quantity *
                (item.length + kerf),
            0
        );
    }


    function getNewStockBarsUsed(bars) {

        return bars.filter(
            bar => bar.source === "new"
        ).length;
    }


    function getStateKey(state) {

        const itemKey =
            state.remainingItems
                .map(item => item.quantity)
                .join(",");


        const sourceKey =
            state.remainingMaterialSources
                .map(source =>
                    source.source +
                    ":" +
                    source.sourceLength +
                    ":" +
                    (
                        source.unlimited
                            ? "U"
                            : source.quantity
                    )
                )
                .join("|");


        return itemKey + "//" + sourceKey;
    }


    function getBarsKey(bars) {

        return bars
            .map(bar => {

                const patternKey =
                    bar.pattern
                        .map(item =>
                            item.length +
                            ":" +
                            item.quantity
                        )
                        .join(",");


                return (
                    bar.source +
                    ":" +
                    bar.sourceLength +
                    ":" +
                    patternKey
                );
            })
            .join("|");
    }


    function compareStates(
        first,
        second
    ) {

        if (
            first.remainingQuantity !==
            second.remainingQuantity
        ) {
            return (
                first.remainingQuantity -
                second.remainingQuantity
            );
        }


        if (
            first.newStockBarsUsed !==
            second.newStockBarsUsed
        ) {
            return (
                first.newStockBarsUsed -
                second.newStockBarsUsed
            );
        }


        if (
            first.remainingSize !==
            second.remainingSize
        ) {
            return (
                first.remainingSize -
                second.remainingSize
            );
        }


        const firstKey =
            getBarsKey(first.bars);

        const secondKey =
            getBarsKey(second.bars);


        if (firstKey < secondKey) {
            return -1;
        }


        if (firstKey > secondKey) {
            return 1;
        }


        return 0;
    }


    function createState(
        remainingItems,
        remainingMaterialSources,
        bars
    ) {

        return {
            remainingItems:
                remainingItems,

            remainingMaterialSources:
                remainingMaterialSources,

            bars:
                bars,

            remainingQuantity:
                getRemainingQuantity(
                    remainingItems
                ),

            remainingSize:
                getRemainingSize(
                    remainingItems
                ),

            newStockBarsUsed:
                getNewStockBarsUsed(
                    bars
                )
        };
    }


    const stats = {
        statesExpanded: 0,
        statesGenerated: 0,
        statesDeduplicated: 0,
        completeSolutionsEvaluated: 0,
        maxBeamSize: 1
    };


    const rootState =
        createState(
            copyItems(items),
            copySources(materialSources),
            []
        );


    let bestIncompleteState =
        rootState;

    let bestCompleteState =
        null;

    let bestCompleteScore =
        null;


    let beam = [
        rootState
    ];


    while (beam.length > 0) {

        const generatedStates = [];


        for (const state of beam) {

            stats.statesExpanded++;


            const currentItems =
                getPositiveItems(
                    state.remainingItems
                );


            if (currentItems.length === 0) {
                continue;
            }


            const candidates =
                findMaterialSourceCandidates(
                    currentItems,
                    state.remainingMaterialSources,
                    kerf,
                    patternsPerSource
                );


            for (const candidate of candidates) {

                const childRemainingItems =
                    subtractPattern(
                        state.remainingItems,
                        candidate.pattern
                    );


                if (
                    childRemainingItems === null
                ) {
                    continue;
                }


                const childMaterialSources =
                    consumeMaterialSource(
                        state.remainingMaterialSources,
                        candidate
                    );


                if (
                    childMaterialSources === null
                ) {
                    continue;
                }


                const childBars = [
                    ...state.bars,

                    {
                        pattern:
                            candidate.pattern.map(
                                item => ({
                                    length:
                                        item.length,

                                    quantity:
                                        item.quantity
                                })
                            ),

                        remaining:
                            candidate.remaining,

                        waste:
                            candidate.waste,

                        source:
                            candidate.source,

                        profileType:
                            candidate.profileType,

                        sourceLength:
                            candidate.sourceLength
                    }
                ];


                const childState =
                    createState(
                        childRemainingItems,
                        childMaterialSources,
                        childBars
                    );


                stats.statesGenerated++;


                if (
                    compareStates(
                        childState,
                        bestIncompleteState
                    ) < 0
                ) {
                    bestIncompleteState =
                        childState;
                }


                if (
                    childState.remainingQuantity ===
                    0
                ) {

                    stats.completeSolutionsEvaluated++;


                    const score =
                        scoreCompleteMaterialTransitionPlan(
                            {
                                complete: true,
                                bars:
                                    childState.bars
                            },
                            scoreSettings
                        );


                    if (
                        bestCompleteScore === null ||
                        score.totalCostEquivalent <
                        bestCompleteScore.totalCostEquivalent
                    ) {

                        bestCompleteState =
                            childState;

                        bestCompleteScore =
                            score;
                    }


                    continue;
                }


                generatedStates.push(
                    childState
                );
            }
        }


        const distinctStates =
            new Map();


        for (const state of generatedStates) {

            const key =
                getStateKey(state);

            const existing =
                distinctStates.get(key);


            if (existing === undefined) {

                distinctStates.set(
                    key,
                    state
                );

                continue;
            }


            stats.statesDeduplicated++;


            if (
                compareStates(
                    state,
                    existing
                ) < 0
            ) {

                distinctStates.set(
                    key,
                    state
                );
            }
        }


        const rankedStates =
            [...distinctStates.values()]
                .sort(compareStates);


        beam =
            rankedStates.slice(
                0,
                beamWidth
            );


        stats.maxBeamSize =
            Math.max(
                stats.maxBeamSize,
                beam.length
            );
    }


    const resultState =
        bestCompleteState ??
        bestIncompleteState;


    return {
        complete:
            bestCompleteState !== null,

        bars:
            copyBars(
                resultState.bars
            ),

        remainingItems:
            getPositiveItems(
                resultState.remainingItems
            ),

        remainingMaterialSources:
            copySources(
                resultState
                    .remainingMaterialSources
            ),

        barCount:
            resultState.bars.length,

        materialTransitionScore:
            bestCompleteScore,

        stats:
            stats
    };
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

function optimizeOrderByProfileType(
    cuts,
    stockLength,
    kerf,
    options = {}
) {

    const profileResults = [];


    for (const profileType of Object.keys(PROFILE_TYPES)) {

        const profileCuts =
            cuts.filter(
                cut =>
                    cut.profileType === profileType
            );


        if (profileCuts.length === 0) {
            continue;
        }


        const groupedCuts =
            mergeGroupedCuts(profileCuts);


        const optimization =
            optimizeOrderMaterialBeamDP(
                groupedCuts,
                stockLength,
                kerf,
                options
            );


        profileResults.push({
            profileType:
                profileType,

            optimization:
                optimization
        });
    }


    const bars =
        profileResults.flatMap(
            result =>
                result.optimization.bars.map(
                    bar => ({
                        ...bar,

                        profileType:
                            result.profileType,

                        source:
                            "new",

                        sourceLength:
                            stockLength
                    })
                )
        );


    const remainingItems =
        profileResults.flatMap(
            result =>
                result.optimization.remainingItems.map(
                    item => ({
                        profileType:
                            result.profileType,

                        length:
                            item.length,

                        quantity:
                            item.quantity
                    })
                )
        );


    return {
        complete:
            profileResults.every(
                result =>
                    result.optimization.complete
            ),

        bars:
            bars,

        remainingItems:
            remainingItems,

        barCount:
            bars.length,

        profileResults:
            profileResults
    };
}


function optimizeOrderByProfileTypeWithInventory(
    cuts,
    materialInventory,
    kerf,
    options = {}
) {

    validateMaterialAvailability(
        materialInventory
    );


    const profileResults = [];


    for (const profileType of Object.keys(PROFILE_TYPES)) {

        const profileCuts =
            cuts.filter(
                cut =>
                    cut.profileType === profileType
            );


        if (profileCuts.length === 0) {
            continue;
        }


        const groupedCuts =
            mergeGroupedCuts(
                profileCuts
            );


        const materialSources =
            getMaterialSourcesForProfile(
                materialInventory,
                profileType
            );


        const optimization =
            optimizeOrderInventoryBeamDP(
                groupedCuts,
                materialSources,
                kerf,
                options
            );


        profileResults.push({
            profileType:
                profileType,

            materialSources:
                materialSources,

            optimization:
                optimization
        });
    }


    const bars =
        profileResults.flatMap(
            result =>
                result.optimization.bars.map(
                    bar => ({
                        ...bar,

                        profileType:
                            result.profileType
                    })
                )
        );


    const remainingItems =
        profileResults.flatMap(
            result =>
                result.optimization
                    .remainingItems.map(
                        item => ({
                            profileType:
                                result.profileType,

                            length:
                                item.length,

                            quantity:
                                item.quantity
                        })
                    )
        );


    return {
        complete:
            profileResults.every(
                result =>
                    result.optimization.complete
            ),

        bars:
            bars,

        remainingItems:
            remainingItems,

        barCount:
            bars.length,

        profileResults:
            profileResults
    };
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
            profileType:
                bar.profileType,

            source:
                bar.source,

            sourceLength:
                bar.sourceLength,
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
const WORK_STATE_SCHEMA_VERSION = 3;
const WORK_STATE_ENGINE_VERSION = "material-v0.3";

const DEFAULT_STOCK_LENGTH = "6000";
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
            typeof row.profileType === "string" &&
            PROFILE_TYPES[row.profileType] !== undefined &&
            isStoredInputValue(row.length) &&
            isStoredInputValue(row.quantity)
        );
}

function isValidStoredStockProfileRows(
    stockProfileRows
) {

    if (
        !Array.isArray(stockProfileRows) ||
        stockProfileRows.length !==
        Object.keys(PROFILE_TYPES).length
    ) {
        return false;
    }


    const profileTypes =
        stockProfileRows.map(
            row => row.profileType
        );


    if (
        stockProfileRows.some(row =>
            !isPlainObject(row) ||
            typeof row.profileType !== "string" ||
            PROFILE_TYPES[row.profileType] === undefined ||
            !isStoredInputValue(row.quantity) ||
            typeof row.unlimited !== "boolean"
        )
    ) {
        return false;
    }


    return (
        new Set(profileTypes).size ===
        profileTypes.length
    ) &&
        Object.keys(PROFILE_TYPES).every(
            profileType =>
                profileTypes.includes(profileType)
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

    const validSources = new Set([
        "new",
        "remnant"
    ]);


    return plan.bars.every((bar, index) =>
        isPlainObject(bar) &&
        bar.id === "bar-" + (index + 1) &&
        bar.number === index + 1 &&
        typeof bar.profileType === "string" &&
        PROFILE_TYPES[bar.profileType] !== undefined &&
        validSources.has(bar.source) &&
        Number.isFinite(bar.sourceLength) &&
        bar.sourceLength > 0 &&
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
        !isStoredInputValue(state.kerf) ||
        !isValidStoredStockProfileRows(
            state.stockProfileRows
        ) ||
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
            profileType:
                row.querySelector(".cut-profile-type").value,

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
            profileType:
                row.querySelector(".remnant-profile-type").value,

            length:
                row.querySelector(".remnant-length").value,

            quantity:
                row.querySelector(".remnant-quantity").value
        })
    );
}

function getStockProfileRowsForStorage() {

    return [
        ...document.querySelectorAll(
            "#stockProfileList .stock-profile-row"
        )
    ].map(row => ({

        profileType:
            row.dataset.profileType,

        quantity:
            row.querySelector(
                ".stock-profile-quantity"
            ).value,

        unlimited:
            row.querySelector(
                ".stock-profile-unlimited-checkbox"
            ).checked
    }));
}


function createWorkStateSnapshot() {

    return {
        schemaVersion: WORK_STATE_SCHEMA_VERSION,
        engineVersion: WORK_STATE_ENGINE_VERSION,
        savedAt: new Date().toISOString(),

        stockLength:
            document.getElementById("stockLength").value,

        kerf:
            document.getElementById("kerf").value,

        stockProfileRows:
            getStockProfileRowsForStorage(),

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

    document.getElementById("kerf").value =
        DEFAULT_KERF;

    createDefaultStockProfileRows();

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

    document.getElementById("kerf").value =
        String(state.kerf);


    const stockProfileList =
        document.getElementById("stockProfileList");

    stockProfileList.replaceChildren(
        ...state.stockProfileRows.map(
            row =>
                createStockProfileRow(
                    row.profileType,
                    row.quantity,
                    row.unlimited
                )
        )
    );


    const remnantList =
        document.getElementById("remnantList");

    remnantList.replaceChildren();


    for (const remnantRow of state.remnantRows) {

        remnantList.appendChild(
            createRemnantRow(
                remnantRow.length,
                remnantRow.quantity,
                remnantRow.profileType
            )
        );
    }


    const cutList =
        document.getElementById("cutList");

    cutList.replaceChildren();


    for (const inputRow of state.inputRows) {
        cutList.appendChild(
            createCutRow(
                inputRow.length,
                inputRow.quantity,
                inputRow.profileType
            )
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
                    <span>
                        ${PROFILE_TYPES[bar.profileType].label}
                        · ${bar.number}/${plan.bars.length}
                     </span>
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

    const materialAvailability =
        getMaterialAvailabilityFromForm();

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

        const materialInventory =
            createMaterialInventory(
                materialAvailability
            );


        const optimization =
            optimizeOrderByProfileTypeWithInventory(
                cuts,
                materialInventory,
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

        for (const profileResult of optimization.profileResults) {

            console.log(
                PROFILE_TYPES[
                    profileResult.profileType
                ].label,
                profileResult.optimization
                    .materialTransitionScore
            );
        }

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

    createDefaultStockProfileRows();

    document.addEventListener("input", event => {

        if (
            event.target.matches(
                "#stockLength, " +
                "#kerf, " +
                ".stock-profile-quantity, " +
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

        if (
            event.target.matches(
                ".stock-profile-unlimited-checkbox, " +
                ".remnant-profile-type, " +
                ".cut-profile-type"
            )
        ) {
            handleOrderInputChange();
        }
    });


    restoreSavedWorkState();
}

function runPostOrderMaterialInventoryTest() {

    const materialAvailability = {
        stockLength: 6000,

        newStock: [
            {
                profileType: "uProfile",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "verticalProfile",
                unlimited: false,
                quantity: 2
            },
            {
                profileType: "horizontalProfile",
                unlimited: false,
                quantity: 1
            },
            {
                profileType: "topRail",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "bottomRail",
                unlimited: true,
                quantity: null
            }
        ],

        remnants: [
            {
                profileType: "verticalProfile",
                length: 2600,
                quantity: 2
            },
            {
                profileType: "horizontalProfile",
                length: 2600,
                quantity: 1
            }
        ]
    };


    const inventory =
        createMaterialInventory(
            materialAvailability
        );


    const plan = {
        complete: true,

        bars: [
            {
                source: "remnant",
                profileType: "verticalProfile",
                sourceLength: 2600,

                pattern: [
                    {
                        length: 1500,
                        quantity: 1
                    }
                ],

                remaining: 1097,
                waste: 3
            },

            {
                source: "remnant",
                profileType: "horizontalProfile",
                sourceLength: 2600,

                pattern: [
                    {
                        length: 1000,
                        quantity: 1
                    }
                ],

                remaining: 1597,
                waste: 3
            },

            {
                source: "new",
                profileType: "verticalProfile",
                sourceLength: 6000,

                pattern: [
                    {
                        length: 2000,
                        quantity: 1
                    }
                ],

                remaining: 3997,
                waste: 3
            }
        ]
    };


    const result =
        calculatePostOrderMaterialInventory(
            plan,
            inventory,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
                .scoreSettings
        );


    console.log(
        "POST-ORDER MATERIAL INVENTORY TEST"
    );

    console.log(result);

    return result;
}

function runProfileTypeOptimizationTest() {

    const separateProfiles = [
        {
            profileType: "verticalProfile",
            length: 3000,
            quantity: 1
        },
        {
            profileType: "horizontalProfile",
            length: 2997,
            quantity: 1
        }
    ];


    const sameProfile = [
        {
            profileType: "verticalProfile",
            length: 3000,
            quantity: 1
        },
        {
            profileType: "verticalProfile",
            length: 2997,
            quantity: 1
        }
    ];


    const separateResult =
        optimizeOrderByProfileType(
            separateProfiles,
            6000,
            3,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
        );


    const sameResult =
        optimizeOrderByProfileType(
            sameProfile,
            6000,
            3,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
        );


    console.log(
        "PROFILE TYPE OPTIMIZATION TEST"
    );

    console.log(
        "Eri profiilit:",
        separateResult
    );

    console.log(
        "Sama profiili:",
        sameResult
    );


    return {
        separateProfiles:
            separateResult,

        sameProfile:
            sameResult
    };
}


function runMaterialSourcesTest() {

    const materialAvailability = {
        stockLength: 6000,

        newStock: [
            {
                profileType: "uProfile",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "verticalProfile",
                unlimited: false,
                quantity: 3
            },
            {
                profileType: "horizontalProfile",
                unlimited: false,
                quantity: 0
            },
            {
                profileType: "topRail",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "bottomRail",
                unlimited: true,
                quantity: null
            }
        ],

        remnants: [
            {
                profileType: "verticalProfile",
                length: 2600,
                quantity: 2
            },
            {
                profileType: "verticalProfile",
                length: 3900,
                quantity: 1
            },
            {
                profileType: "horizontalProfile",
                length: 2800,
                quantity: 2
            }
        ]
    };


    const inventory =
        createMaterialInventory(
            materialAvailability
        );


    const verticalSources =
        getMaterialSourcesForProfile(
            inventory,
            "verticalProfile"
        );

    const horizontalSources =
        getMaterialSourcesForProfile(
            inventory,
            "horizontalProfile"
        );


    console.log(
        "Pystyprofiilin materiaalilähteet:",
        verticalSources
    );

    console.log(
        "Vaakaprofiilin materiaalilähteet:",
        horizontalSources
    );


    return {
        verticalSources:
            verticalSources,

        horizontalSources:
            horizontalSources
    };
}

function runMaterialSourceCandidateTest() {

    const materialAvailability = {
        stockLength: 6000,

        newStock: [
            {
                profileType: "uProfile",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "verticalProfile",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "horizontalProfile",
                unlimited: false,
                quantity: 0
            },
            {
                profileType: "topRail",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "bottomRail",
                unlimited: true,
                quantity: null
            }
        ],

        remnants: [
            {
                profileType: "horizontalProfile",
                length: 2800,
                quantity: 2
            }
        ]
    };


    const inventory =
        createMaterialInventory(
            materialAvailability
        );


    const sources =
        getMaterialSourcesForProfile(
            inventory,
            "horizontalProfile"
        );


    const items = [
        {
            length: 2700,
            quantity: 1
        },
        {
            length: 1000,
            quantity: 1
        }
    ];


    const candidates =
        findMaterialSourceCandidates(
            items,
            sources,
            3,
            10
        );


    console.log(
        "MATERIAALILÄHTEIDEN SAHAUSKUVIOEHDOKKAAT"
    );

    console.log(candidates);

    return candidates;
}


function runMaterialSourceConsumptionTest() {

    const sources = [
        {
            source: "remnant",
            profileType: "horizontalProfile",
            sourceLength: 2800,
            unlimited: false,
            quantity: 2
        },
        {
            source: "new",
            profileType: "horizontalProfile",
            sourceLength: 6000,
            unlimited: true,
            quantity: null
        }
    ];


    const remnantCandidate = {
        source: "remnant",
        profileType: "horizontalProfile",
        sourceLength: 2800
    };


    const newStockCandidate = {
        source: "new",
        profileType: "horizontalProfile",
        sourceLength: 6000
    };


    const afterFirstRemnant =
        consumeMaterialSource(
            sources,
            remnantCandidate
        );


    const afterSecondRemnant =
        consumeMaterialSource(
            afterFirstRemnant,
            remnantCandidate
        );


    const afterThirdRemnant =
        consumeMaterialSource(
            afterSecondRemnant,
            remnantCandidate
        );


    const afterUnlimitedNewStock =
        consumeMaterialSource(
            sources,
            newStockCandidate
        );


    console.log(
        "Alkuperäinen:",
        sources
    );

    console.log(
        "Yhden jäännöksen jälkeen:",
        afterFirstRemnant
    );

    console.log(
        "Kahden jäännöksen jälkeen:",
        afterSecondRemnant
    );

    console.log(
        "Kolmas jäännös:",
        afterThirdRemnant
    );

    console.log(
        "Rajattoman uuden tangon jälkeen:",
        afterUnlimitedNewStock
    );


    return {
        sources,
        afterFirstRemnant,
        afterSecondRemnant,
        afterThirdRemnant,
        afterUnlimitedNewStock
    };
}


function runMaterialTransitionScoreTest() {

    const remnantPlan = {
        complete: true,

        bars: [
            {
                source:
                    "remnant",

                profileType:
                    "verticalProfile",

                sourceLength:
                    1600,

                pattern: [
                    {
                        length: 1500,
                        quantity: 1
                    }
                ],

                remaining:
                    97,

                waste:
                    3
            }
        ]
    };


    const newStockPlan = {
        complete: true,

        bars: [
            {
                source:
                    "new",

                profileType:
                    "verticalProfile",

                sourceLength:
                    6000,

                pattern: [
                    {
                        length: 1500,
                        quantity: 1
                    }
                ],

                remaining:
                    4497,

                waste:
                    3
            }
        ]
    };


    const settings =
        PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
            .scoreSettings;


    const remnantScore =
        scoreCompleteMaterialTransitionPlan(
            remnantPlan,
            settings
        );


    const newStockScore =
        scoreCompleteMaterialTransitionPlan(
            newStockPlan,
            settings
        );


    console.log(
        "MATERIAALISIIRTYMÄN PISTEYTYSTESTI"
    );


    console.table({
        "1600 mm jäännös": {
            cost:
                remnantScore.totalCostEquivalent
        },

        "6000 mm uusi": {
            cost:
                newStockScore.totalCostEquivalent
        }
    });


    console.log(
        "Voittaja:",
        remnantScore.totalCostEquivalent <
            newStockScore.totalCostEquivalent
            ? "1600 mm jäännös"
            : "6000 mm uusi"
    );


    return {
        remnantScore:
            remnantScore,

        newStockScore:
            newStockScore
    };
}


function runInventoryBeamAvailabilityTest() {

    const noNewStockSources = [
        {
            source: "remnant",
            profileType: "horizontalProfile",
            sourceLength: 2800,
            unlimited: false,
            quantity: 1
        }
    ];


    const impossibleResult =
        optimizeOrderInventoryBeamDP(
            [
                {
                    length: 2700,
                    quantity: 2
                }
            ],
            noNewStockSources,
            3,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
        );


    const mixedSources = [
        {
            source: "remnant",
            profileType: "horizontalProfile",
            sourceLength: 2800,
            unlimited: false,
            quantity: 1
        },
        {
            source: "new",
            profileType: "horizontalProfile",
            sourceLength: 6000,
            unlimited: false,
            quantity: 1
        }
    ];


    const mixedResult =
        optimizeOrderInventoryBeamDP(
            [
                {
                    length: 2700,
                    quantity: 1
                },
                {
                    length: 3300,
                    quantity: 1
                }
            ],
            mixedSources,
            3,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
        );


    console.log(
        "EI UUTTA MATERIAALIA:",
        impossibleResult
    );


    console.log(
        "JÄÄNNÖS + UUSI:",
        mixedResult
    );


    return {
        impossibleResult:
            impossibleResult,

        mixedResult:
            mixedResult
    };
}


function runProfileInventoryOptimizationTest() {

    const materialAvailability = {
        stockLength: 6000,

        newStock: [
            {
                profileType: "uProfile",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "verticalProfile",
                unlimited: false,
                quantity: 0
            },
            {
                profileType: "horizontalProfile",
                unlimited: false,
                quantity: 1
            },
            {
                profileType: "topRail",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "bottomRail",
                unlimited: true,
                quantity: null
            }
        ],

        remnants: [
            {
                profileType: "verticalProfile",
                length: 2800,
                quantity: 1
            }
        ]
    };


    const inventory =
        createMaterialInventory(
            materialAvailability
        );


    const cuts = [
        {
            profileType: "verticalProfile",
            length: 2700,
            quantity: 1
        },
        {
            profileType: "horizontalProfile",
            length: 3300,
            quantity: 1
        }
    ];


    const result =
        optimizeOrderByProfileTypeWithInventory(
            cuts,
            inventory,
            3,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
        );


    console.log(
        "PROFIILIKOHTAINEN VARASTO-OPTIMOINTI:",
        result
    );


    console.table(
        result.bars.map(bar => ({
            profileType:
                bar.profileType,

            source:
                bar.source,

            sourceLength:
                bar.sourceLength,

            cuts:
                bar.pattern
                    .map(item =>
                        item.length +
                        " × " +
                        item.quantity
                    )
                    .join(", ")
        }))
    );


    return result;
}


function runProfileInventoryShortageTest() {

    const materialAvailability = {
        stockLength: 6000,

        newStock: [
            {
                profileType: "uProfile",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "verticalProfile",
                unlimited: false,
                quantity: 0
            },
            {
                profileType: "horizontalProfile",
                unlimited: false,
                quantity: 1
            },
            {
                profileType: "topRail",
                unlimited: true,
                quantity: null
            },
            {
                profileType: "bottomRail",
                unlimited: true,
                quantity: null
            }
        ],

        remnants: []
    };


    const inventory =
        createMaterialInventory(
            materialAvailability
        );


    const cuts = [
        {
            profileType: "verticalProfile",
            length: 2700,
            quantity: 1
        },
        {
            profileType: "horizontalProfile",
            length: 3300,
            quantity: 1
        }
    ];


    const result =
        optimizeOrderByProfileTypeWithInventory(
            cuts,
            inventory,
            3,
            PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS
        );


    console.log(
        "PROFIILIKOHTAINEN MATERIAALIPULA:",
        result
    );


    console.table(
        result.bars.map(bar => ({
            profileType:
                bar.profileType,

            source:
                bar.source,

            sourceLength:
                bar.sourceLength,

            cuts:
                bar.pattern
                    .map(item =>
                        item.length +
                        " × " +
                        item.quantity
                    )
                    .join(", ")
        }))
    );


    console.log(
        "Sahaamatta jääneet:",
        result.remainingItems
    );


    return result;
}



if (typeof document !== "undefined") {
    initializeWorkPersistence();
}
