// Moduulirajan ja ennen irrotusta tallennettujen kokonaisten fixturetulosten regressiot.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const material = require('./src/material.js');
const source = file => fs.readFileSync(path.join(__dirname, file), 'utf8');
const isolated = vm.createContext({});
for (const file of ['src/cutting-physics.js', 'src/material.js']) {
    new vm.Script(source(file), { filename: file }).runInContext(isolated);
}
const browserMaterial = vm.runInContext('MATERIAL', isolated);

for (const core of [material, browserMaterial]) {
    assert.ok(Object.isFrozen(core) && Object.isFrozen(core.PROFILE_TYPES));
    assert.equal(core.isSupportedProfileType('constructor'), false);
    assert.equal(core.isSupportedProfileType('toString'), false);
    const availability = {
        stockLength: 6000,
        newStock: Object.keys(core.PROFILE_TYPES).map(profileType => ({
            profileType, color: null, unlimited: false, quantity: 0
        })),
        remnants: [
            { profileType: 'verticalProfile', length: 1000.1, quantity: 1 },
            { profileType: 'verticalProfile', color: null, length: 1000.1, quantity: 2 },
            { profileType: 'verticalProfile', color: 'black', length: 1000.1, quantity: 1 }
        ]
    };
    const before = JSON.stringify(availability);
    const inventory = core.createMaterialInventory(availability);
    const sources = core.getMaterialSourcesForProfile(inventory, 'verticalProfile');
    assert.equal(sources.length, 1);
    assert.equal(sources[0].quantity, 3);
    assert.equal(core.getMaterialSourcesForProfile(inventory, 'verticalProfile', 'black')[0].quantity, 1);
    const consumed = core.consumeMaterialSource(sources, sources[0]);
    assert.equal(consumed[0].quantity, 2);
    assert.equal(sources[0].quantity, 3);
    assert.notEqual(consumed[0], sources[0]);
    assert.equal(core.consumeMaterialSource(sources, { ...sources[0], color: 'black' }), null);
    assert.equal(core.consumeMaterialSource([{ ...sources[0], quantity: 0 }], sources[0]), null);
    const unlimited = [{ ...sources[0], source: 'new', unlimited: true, quantity: null }];
    const nextUnlimited = core.consumeMaterialSource(unlimited, unlimited[0]);
    assert.equal(nextUnlimited[0].quantity, null);
    assert.notEqual(nextUnlimited[0], unlimited[0]);
    const usage = core.calculateMaterialUsage({ bars: [{ ...sources[0] }] }, inventory);
    assert.equal(usage.remnantUsage.find(row => row.color === null).remainingQuantity, 2);
    assert.equal(JSON.stringify(availability), before);
    assert.throws(() => core.createMaterialInventory({ ...availability, stockLength: 6000.01 }),
        { message: 'Raakatangon pituudessa saa olla enintään 0,1 mm tarkkuus.' });
}

// Sama tavallisten skriptien latausjärjestys kuin selaimessa; ei DOM:ia tai storagea.
const files = [...source('index.html').matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
const context = vm.createContext({ console: { log() {}, table() {} } });
for (const file of files) new vm.Script(source(file), { filename: file }).runInContext(context);
assert.equal(vm.runInContext(`Object.entries(MATERIAL).every(([name, value]) =>
    name === 'PROFILE_TYPES' ? PROFILE_TYPES === value : globalThis[name] === value)`, context), true);
const snapshot = vm.runInContext(`JSON.stringify(createDevelopmentTestCases().map(test => {
    const inventory = createMaterialInventory(test.materialAvailability);
    const optimization = optimizeOrderByProfileTypeWithInventory(test.cuts, inventory, test.kerf, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS);
    const plan = adaptMaterialOptimizationForUi(optimization, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
    let score;
    try { score = scoreCompleteMaterialTransitionPlan(optimization, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings); }
    catch (error) { score = { error: error.message }; }
    return { id: test.id, inventory, optimization, plan, score,
        usage: calculateMaterialUsage(plan, inventory),
        postInventory: calculatePostOrderMaterialInventory(plan, inventory, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings),
        execution: optimization.complete ? createProductionExecution(plan, createDevelopmentOrdersFromCuts(test.cuts), test.kerf) : null };
}))`, context, { timeout: 60000 });
// Commitin 54445d7 app.js ennen material-irrotusta: A, A jäännöksillä, D1 ja mahdoton profiilieristys.
assert.equal(crypto.createHash('sha256').update(snapshot).digest('hex'),
    '1d65f2fd78fb8b59501570d9bc1e6af1a33abe9c4965c336343ba74e60986820');
console.log('PASS material CommonJS/isolated browser module, global aliases and four complete pre-extraction fixture snapshots');
