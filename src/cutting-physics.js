// Puhdas sahausfysiikka: ei riippuvuuksia sovellukseen tai selainympäristöön.
const CUTTING_PHYSICS = (() => {
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


    function cutPiece(remaining, piece, kerf) {

        // Sahausfysiikka lasketaan samoissa 0,1 mm:n
        // kokonaislukuyksiköissä kuin DP-haku.
        const remainingUnits =
            millimetersToDpUnits(remaining);

        const pieceUnits =
            millimetersToDpUnits(piece);

        const kerfUnits =
            millimetersToDpUnits(kerf);

        const excessUnits =
            remainingUnits -
            pieceUnits;


        if (excessUnits < 0) {

            return {
                possible: false,
                remaining: remainingUnits /
                    DP_DIMENSION_SCALE,
                waste: 0
            };
        }


        if (excessUnits >= kerfUnits) {

            return {
                possible: true,
                remaining:
                    (
                        excessUnits -
                        kerfUnits
                    ) /
                    DP_DIMENSION_SCALE,
                waste:
                    kerfUnits /
                    DP_DIMENSION_SCALE
            };
        }


        return {
            possible: true,
            remaining: 0,
            waste:
                excessUnits /
                DP_DIMENSION_SCALE
        };
    }


    return Object.freeze({
        DP_DIMENSION_SCALE,
        hasSupportedMillimeterPrecision,
        millimetersToDpUnits,
        dpUnitsToMillimeters,
        cutPiece
    });
})();

// Sama toteutus on käytettävissä myös suoraan Node-moduulina.
if (typeof module !== "undefined" && module.exports) {
    module.exports = CUTTING_PHYSICS;
}
