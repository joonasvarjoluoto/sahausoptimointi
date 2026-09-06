const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Lista on tarkoituksellinen: DOM-testit ja pelkät tulostavat demoajot
// eivät kuulu tähän ajuriin. Odotukset pysyvät app.js:n testifunktioissa.
const suites = [
    { name: "runCoreRegressionTests", expectedRows: 4 },
    { name: "runCutPieceBoundaryTests", expectedRows: 5 },
    { name: "runDecimalExactFitRegressionTest", expectedRows: 2 },
    ...[
        "runUnknownProfileRegressionTest",
        "runClosingProfileRegressionTest",
        "runMaterialVariantIsolationRegressionTest",
        "runMixedMaterialVariantRegressionTest",
        "runDemandAccountingColorRegressionTest",
        "runSourceUsageColorRegressionTest",
        "runPostOrderInventoryColorRegressionTest",
        "runCreateMaterialInventoryColorRegressionTest",
        "runMultipleNewStockColorValidationRegressionTest",
        "runDuplicateNewStockVariantValidationRegressionTest",
        "runStoredNewStockColorValidationRegressionTest",
        "runStoredDuplicateNewStockVariantRegressionTest",
        "runStoredStockRowCountValidationRegressionTest",
        "runStoredCanonicalNewStockVariantRegressionTest",
        "runStoredStockDefaultRowValidationRegressionTests",
        "runStoredWorkStateColorRegressionTest",
        "runWorkFinalizationRegressionTest",
        "runWorkFinalizationPersistenceRegressionTest",
        "runOptimizationResultVerifierTest",
        "runSourceUsageVerifierTest",
        "runRemnantUsageVerifierTest",
        "runBarBalanceVerifierTest",
        "runDemandAccountingVerifierTest",
        "runAdaptedPlanColorRegressionTest",
        "runStoredPlanSemanticValidationRegressionTests",
        "runInventoryBeamFeasibilityRegressionTest"
    ].map(name => ({ name: name }))
];


function main() {

    // Toimii myös, kun komento käynnistetään muusta työhakemistosta.
    const appPath = path.join(__dirname, "app.js");
    let appScript;

    try {
        appScript = new vm.Script(fs.readFileSync(appPath, "utf8"), {
            filename: appPath
        });
    } catch (error) {
        console.error("ERROR app.js: " + error.message);
        return 1;
    }

    let passedCount = 0;

    for (const suite of suites) {
        const logs = [];
        const testConsole = Object.fromEntries(
            ["log", "table", "warn", "error"].map(method => [
                method,
                (...args) => logs.push({ method: method, args: args })
            ])
        );

        try {
            // Tuore ympäristö estää testiryhmien välisen tilavuodon.
            // Ei DOM-/storage-mockeja eikä selaimen tai Node-isännän API:ja.
            const context = vm.createContext({ console: testConsole });
            appScript.runInContext(context, { timeout: 10000 });
            const result = vm.runInContext(suite.name + "()", context, {
                timeout: 60000
            });

            // Tyhjä taulukko, undefined tai muu truthy-arvo ei ole PASS.
            const passed = suite.expectedRows === undefined
                ? result === true
                : Array.isArray(result) &&
                    result.length === suite.expectedRows &&
                    Array.from(result).every(row => row?.result === "PASS");

            if (!passed) {
                console.error("FAIL " + suite.name);
                console.error("Palautettu tulos:", result);
            } else {
                passedCount++;
                console.log("PASS " + suite.name);
                continue;
            }
        } catch (error) {
            console.error("ERROR " + suite.name + ": " + error.message);
        }

        // Tavallinen ajo pysyy lyhyenä; virheessä näytetään testin erittely.
        for (const entry of logs) {
            console[entry.method](...entry.args);
        }
    }

    console.log(
        "Regressioryhmät: " + passedCount + "/" + suites.length + " läpäisty"
    );

    return passedCount === suites.length ? 0 : 1;
}


process.exitCode = main();
