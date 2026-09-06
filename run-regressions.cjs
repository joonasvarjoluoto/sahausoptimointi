const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Lista on tarkoituksellinen: DOM-testit ja pelkät tulostavat demoajot
// eivät kuulu tähän ajuriin. Odotukset pysyvät app.js:n testifunktioissa.
const suites = [
    { name: "runCoreRegressionTests", expectedRows: 4 },
    { name: "runCutPieceBoundaryTests", expectedRows: 5 },
    { name: "runCuttingPhysicsRegressionTests", expectedRows: 23 },
    { name: "runDecimalExactFitRegressionTest", expectedRows: 2 },
    ...[
        "runOrderInputRegressionTests",
        "runStoredOrderValidationRegressionTests",
        "runUnknownProfileRegressionTest",
        "runCoreProfileTypeValidationRegressionTests",
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
        "runStoredProfileTypeValidationRegressionTests",
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
    // Sama riippuvuusjärjestys kuin index.html:ssä, ei erillistä Node-toteutusta.
    const sourceFiles = ["src/cutting-physics.js", "app.js"];
    const scripts = [];

    for (const filename of sourceFiles) {
        const sourcePath = path.join(__dirname, filename);
        try {
            scripts.push(new vm.Script(fs.readFileSync(sourcePath, "utf8"), {
                filename: sourcePath
            }));
        } catch (error) {
            console.error("ERROR " + filename + ": " + error.message);
            return 1;
        }
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
            for (const script of scripts) {
                script.runInContext(context, { timeout: 10000 });
            }
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
