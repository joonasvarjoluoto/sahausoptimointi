// Puhdas materiaalivarasto ja lähteiden kulutus; riippuu vain sahausfysiikan mitta-apureista.
const MATERIAL = (() => {
    const {
        cutPiece,
        hasSupportedMillimeterPrecision,
        millimetersToDpUnits,
        dpUnitsToMillimeters
    } =
        typeof module !== "undefined" && module.exports
            ? require("./cutting-physics.js") : CUTTING_PHYSICS;

    const MATERIAL_CAPACITY_DEFAULTS = Object.freeze({
        sourceCapacityAllowance: 20,
        pieceCapacityAllowance: 1
    });

    function normalizeMaterialCapacitySettings(settings = {}) {

        const sourceCapacityAllowance =
            settings.sourceCapacityAllowance ??
            MATERIAL_CAPACITY_DEFAULTS.sourceCapacityAllowance;

        const pieceCapacityAllowance =
            settings.pieceCapacityAllowance ??
            MATERIAL_CAPACITY_DEFAULTS.pieceCapacityAllowance;


        for (const [name, value] of [
            ["Lähdekohtaisen kapasiteettivaran", sourceCapacityAllowance],
            ["Kappalekohtaisen kapasiteettivaran", pieceCapacityAllowance]
        ]) {

            if (
                !Number.isFinite(value) ||
                value < 0 ||
                !hasSupportedMillimeterPrecision(value)
            ) {
                throw new Error(
                    name +
                    " pitää olla nolla tai positiivinen enintään 0,1 mm tarkkuudella."
                );
            }
        }


        return {
            sourceCapacityAllowance:
                sourceCapacityAllowance,

            pieceCapacityAllowance:
                pieceCapacityAllowance
        };
    }

    function getUsableMaterialCapacity(
        sourceLength,
        settings = {}
    ) {

        if (
            !Number.isFinite(sourceLength) ||
            sourceLength <= 0 ||
            !hasSupportedMillimeterPrecision(sourceLength)
        ) {
            throw new Error(
                "Materiaalilähteen nimellispituuden pitää olla suurempi kuin 0 enintään 0,1 mm tarkkuudella."
            );
        }


        const capacitySettings =
            normalizeMaterialCapacitySettings(settings);

        const usableUnits = Math.max(
            0,
            millimetersToDpUnits(sourceLength) -
            millimetersToDpUnits(
                capacitySettings.sourceCapacityAllowance
            )
        );


        return dpUnitsToMillimeters(usableUnits);
    }

    function calculateMaterialBarCapacity(
        sourceLength,
        pattern,
        kerf,
        settings = {}
    ) {

        if (!Array.isArray(pattern) || pattern.length === 0) {
            throw new Error(
                "Materiaalikappaleen sahauskuvion pitää olla epätyhjä taulukko."
            );
        }

        if (
            !Number.isFinite(kerf) ||
            kerf < 0 ||
            !hasSupportedMillimeterPrecision(kerf)
        ) {
            throw new Error(
                "Sahanterän leveyden pitää olla nolla tai positiivinen enintään 0,1 mm tarkkuudella."
            );
        }


        const capacitySettings =
            normalizeMaterialCapacitySettings(settings);

        const usableCapacity =
            getUsableMaterialCapacity(
                sourceLength,
                capacitySettings
            );

        let remainingCapacityUnits =
            millimetersToDpUnits(usableCapacity);

        let nominalRemaining = sourceLength;
        let wasteUnits = 0;
        let pieceCount = 0;


        for (const item of pattern) {

            if (
                item === null ||
                typeof item !== "object" ||
                !Number.isFinite(item.length) ||
                item.length <= 0 ||
                !hasSupportedMillimeterPrecision(item.length) ||
                !Number.isSafeInteger(item.quantity) ||
                item.quantity <= 0
            ) {
                throw new Error(
                    "Materiaalikappaleen sahauskuvio on virheellinen."
                );
            }


            for (let quantity = 0; quantity < item.quantity; quantity++) {

                const physicalCut =
                    cutPiece(
                        nominalRemaining,
                        item.length,
                        kerf
                    );


                if (!physicalCut.possible) {
                    return {
                        possible: false,
                        usableCapacity: usableCapacity
                    };
                }


                const capacityUseUnits =
                    millimetersToDpUnits(item.length) +
                    millimetersToDpUnits(
                        capacitySettings.pieceCapacityAllowance
                    ) +
                    millimetersToDpUnits(
                        physicalCut.waste
                    );


                if (capacityUseUnits > remainingCapacityUnits) {
                    return {
                        possible: false,
                        usableCapacity: usableCapacity
                    };
                }


                remainingCapacityUnits -=
                    capacityUseUnits;

                nominalRemaining =
                    physicalCut.remaining;

                wasteUnits +=
                    millimetersToDpUnits(
                        physicalCut.waste
                    );

                pieceCount++;
            }
        }


        const totalPieceCapacityAllowance =
            pieceCount *
            capacitySettings.pieceCapacityAllowance;


        return {
            possible: true,
            usableCapacity: usableCapacity,
            remaining:
                dpUnitsToMillimeters(
                    remainingCapacityUnits
                ),
            nominalRemaining:
                nominalRemaining,
            waste:
                dpUnitsToMillimeters(wasteUnits),
            sourceCapacityAllowance:
                capacitySettings.sourceCapacityAllowance,
            pieceCapacityAllowance:
                capacitySettings.pieceCapacityAllowance,
            totalPieceCapacityAllowance:
                totalPieceCapacityAllowance,
            totalCapacityAllowance:
                capacitySettings.sourceCapacityAllowance +
                totalPieceCapacityAllowance
        };
    }

    const PROFILE_TYPES = Object.freeze({
        uProfile: Object.freeze({
            label: "U-profiili",
            dimensionRole: "doorHeight"
        }),

        verticalProfile: Object.freeze({
            label: "Pystyprofiili",
            dimensionRole: "doorHeight"
        }),

        closingProfile: Object.freeze({
            label: "Vasteprofiili",
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

    function isSupportedProfileType(profileType) {

        return typeof profileType === "string" &&
            Object.prototype.hasOwnProperty.call(
                PROFILE_TYPES,
                profileType
            );
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


        const seenProfileTypes = new Set();

        const seenVariants = new Set();


        for (const stock of newStock) {

            if (!isSupportedProfileType(stock.profileType)) {
                throw new Error(
                    "Uuden tangon profiilityyppi on virheellinen."
                );
            }


            const normalizedColor =
                stock.color ?? null;

            const variantKey =
                stock.profileType +
                ":" +
                JSON.stringify(normalizedColor);


            if (seenVariants.has(variantKey)) {
                throw new Error(
                    "Sama profiilityypin ja värin yhdistelmä esiintyy uusien tankojen saatavuudessa useammin kuin kerran."
                );
            }

            seenVariants.add(variantKey);

            seenProfileTypes.add(
                stock.profileType
            );



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

            if (!isSupportedProfileType(remnant.profileType)) {
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


        const remnantsByVariantAndLength =
            new Map();


        for (const remnant of materialAvailability.remnants) {

            const color =
                remnant.color ?? null;

            const lengthUnits =
                millimetersToDpUnits(
                    remnant.length
                );

            const key =
                remnant.profileType +
                ":" +
                JSON.stringify(color) +
                ":" +
                lengthUnits;

            const existing =
                remnantsByVariantAndLength.get(
                    key
                );


            if (existing === undefined) {

                remnantsByVariantAndLength.set(
                    key,
                    {
                        profileType:
                            remnant.profileType,

                        color:
                            color,

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
            [...remnantsByVariantAndLength.values()]
                .sort((first, second) => {

                    if (
                        first.profileType !==
                        second.profileType
                    ) {
                        return first.profileType.localeCompare(
                            second.profileType
                        );
                    }


                    const firstColor =
                        JSON.stringify(
                            first.color ?? null
                        );

                    const secondColor =
                        JSON.stringify(
                            second.color ?? null
                        );


                    if (firstColor !== secondColor) {
                        return firstColor.localeCompare(
                            secondColor
                        );
                    }


                    return second.length -
                        first.length;
                });


        const newStock =
            materialAvailability.newStock.map(
                stock => ({
                    profileType:
                        stock.profileType,

                    color:
                        stock.color ?? null,

                    unlimited:
                        stock.unlimited,

                    quantity:
                        stock.quantity
                })
            );


        return {
            stockLength:
                materialAvailability.stockLength,

            newStock:
                newStock,

            remnants:
                remnants
        };
    }

    function getMaterialSourcesForProfile(
        materialInventory,
        profileType,
        color = null,
        capacitySettings = {}
    ) {

        validateMaterialAvailability(
            materialInventory
        );


        if (!isSupportedProfileType(profileType)) {
            throw new Error(
                "Materiaalilähteiden profiilityyppi on virheellinen."
            );
        }


        const normalizedColor =
            color ?? null;

        const normalizedCapacitySettings =
            normalizeMaterialCapacitySettings(
                capacitySettings
            );

        const sources = [];


        for (const remnant of materialInventory.remnants) {

            if (
                remnant.profileType !==
                profileType ||
                (remnant.color ?? null) !==
                normalizedColor
            ) {
                continue;
            }


            sources.push({
                source:
                    "remnant",

                profileType:
                    profileType,

                color:
                    normalizedColor,

                sourceLength:
                    remnant.length,

                usableCapacity:
                    getUsableMaterialCapacity(
                        remnant.length,
                        normalizedCapacitySettings
                    ),

                sourceCapacityAllowance:
                    normalizedCapacitySettings
                        .sourceCapacityAllowance,

                pieceCapacityAllowance:
                    normalizedCapacitySettings
                        .pieceCapacityAllowance,

                unlimited:
                    false,

                quantity:
                    remnant.quantity
            });
        }


        const newStock =
            materialInventory.newStock.find(
                stock =>
                    stock.profileType === profileType &&
                    (stock.color ?? null) ===
                    normalizedColor
            );


        if (
            newStock !== undefined &&
            (
                newStock.unlimited ||
                newStock.quantity > 0
            )
        ) {

            sources.push({
                source:
                    "new",

                profileType:
                    profileType,

                color:
                    normalizedColor,

                sourceLength:
                    materialInventory.stockLength,

                usableCapacity:
                    getUsableMaterialCapacity(
                        materialInventory.stockLength,
                        normalizedCapacitySettings
                    ),

                sourceCapacityAllowance:
                    normalizedCapacitySettings
                        .sourceCapacityAllowance,

                pieceCapacityAllowance:
                    normalizedCapacitySettings
                        .pieceCapacityAllowance,

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
                (source.color ?? null) ===
                (candidate.color ?? null) &&
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


        function getVariantKey(
            profileType,
            color
        ) {

            return (
                profileType +
                ":" +
                JSON.stringify(
                    color ?? null
                )
            );
        }


        function getRemnantKey(
            profileType,
            color,
            length
        ) {

            return (
                getVariantKey(
                    profileType,
                    color
                ) +
                ":" +
                millimetersToDpUnits(
                    length
                )
            );
        }


        const stockByVariant =
            new Map(
                materialInventory.newStock.map(
                    stock => [
                        getVariantKey(
                            stock.profileType,
                            stock.color
                        ),
                        stock
                    ]
                )
            );


        const availableRemnants = new Map();
        const usedRemnants = new Map();
        const newStockUsedByVariant = new Map();


        for (const remnant of materialInventory.remnants) {

            const key =
                getRemnantKey(
                    remnant.profileType,
                    remnant.color,
                    remnant.length
                );


            availableRemnants.set(
                key,
                (
                    availableRemnants.get(key) ??
                    0
                ) +
                remnant.quantity
            );
        }


        for (const bar of plan.bars) {

            const profileType =
                bar.profileType;

            const color =
                bar.color ?? null;


            if (!isSupportedProfileType(profileType)) {
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


                const variantKey =
                    getVariantKey(
                        profileType,
                        color
                    );

                const stock =
                    stockByVariant.get(
                        variantKey
                    );


                if (stock === undefined) {
                    throw new Error(
                        "Profiilityypille ja värille ei löydy uusien tankojen saatavuustietoa."
                    );
                }


                const usedQuantity =
                    (
                        newStockUsedByVariant.get(
                            variantKey
                        ) ?? 0
                    ) + 1;


                if (
                    !stock.unlimited &&
                    usedQuantity > stock.quantity
                ) {
                    throw new Error(
                        "Suunnitelma käyttää enemmän materiaalia kuin varastossa on: " +
                        variantKey +
                        "."
                    );
                }


                newStockUsedByVariant.set(
                    variantKey,
                    usedQuantity
                );

                continue;
            }


            if (source !== "remnant") {
                throw new Error(
                    "Materiaalilähteen pitää olla new tai remnant."
                );
            }


            const key =
                getRemnantKey(
                    profileType,
                    color,
                    sourceLength
                );

            const availableQuantity =
                availableRemnants.get(key) ??
                0;

            const usedQuantity =
                (
                    usedRemnants.get(key) ??
                    0
                ) + 1;


            if (
                usedQuantity >
                availableQuantity
            ) {
                throw new Error(
                    "Suunnitelma käyttää jäännöstä yli saatavilla olevan määrän: " +
                    key +
                    "."
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

                    const variantKey =
                        getVariantKey(
                            stock.profileType,
                            stock.color
                        );

                    const usedQuantity =
                        newStockUsedByVariant.get(
                            variantKey
                        ) ?? 0;


                    return {
                        profileType:
                            stock.profileType,

                        color:
                            stock.color ?? null,

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

                    const key =
                        getRemnantKey(
                            remnant.profileType,
                            remnant.color,
                            remnant.length
                        );

                    const usedQuantity =
                        usedRemnants.get(key) ??
                        0;


                    return {
                        profileType:
                            remnant.profileType,

                        color:
                            remnant.color ?? null,

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

                    color:
                        remnant.color,

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

    return Object.freeze({
        PROFILE_TYPES,
        MATERIAL_CAPACITY_DEFAULTS,
        isSupportedProfileType,
        normalizeMaterialCapacitySettings,
        getUsableMaterialCapacity,
        calculateMaterialBarCapacity,
        validateMaterialAvailability,
        createMaterialInventory,
        getMaterialSourcesForProfile,
        consumeMaterialSource,
        calculateMaterialUsage
    });
})();

if (typeof module !== "undefined" && module.exports) module.exports = MATERIAL;
