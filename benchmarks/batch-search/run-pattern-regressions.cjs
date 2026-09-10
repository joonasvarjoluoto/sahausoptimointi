const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRuntime } = require('./runtime.cjs');
const { data, read, random } = require('./inventory-study.cjs');

const runtime = createRuntime(data);
const rng = random(990823);
const digest = crypto.createHash('sha256');
let patternComparisons = 0;

function recordPattern(items, length, kerf, limit) {
    digest.update(JSON.stringify(runtime.patterns(items, length, kerf, limit)) + '\n');
    patternComparisons++;
}

for (let sample = 0; sample < 150; sample++) {
    const length = sample < 50 ? 6000 : Math.round((20 + rng() * 250) * 10) / 10;
    const items = Array.from({ length: 1 + Math.floor(rng() * 5) }, () => ({
        length: Math.round((0.1 + rng() * length) * 10) / 10,
        quantity: 1 + Math.floor(rng() * 8)
    }));
    for (const kerf of [0, 3, 3.4]) for (const limit of [1, 2, 10]) {
        recordPattern(items, length, kerf, limit);
    }
}

for (const [length, items, kerf] of [
    [6000, [{ length: 6000, quantity: 1 }], 3],
    [6000, [{ length: 2998.5, quantity: 2 }], 3],
    [10, [{ length: 0.1, quantity: 100 }], 0],
    [6000, [{ length: 2200, quantity: 2 }, { length: 2200, quantity: 2 }], 3]
]) {
    recordPattern(items, length, kerf, 10);
}

const patternDigest = digest.digest('hex');
const expectedPatternDigest = '5e44a7c13b7b8965ed7576910a8518363227411283f4929446582a72188855dc';
assert.equal(patternDigest, expectedPatternDigest, 'Järjestettyjen DP-kuvioiden regressiodigest muuttui');

const scenarios = read('scenarios').scenarios;
let completePlanComparisons = 0;
let completedTimeoutComparisons = 0;
const executionDigest = crypto.createHash('sha256');
const completePlanDigest = crypto.createHash('sha256');
const profileBlockRank = new Map([
    ['verticalProfile', 0], ['closingProfile', 1], ['horizontalProfile', 2],
    ['uProfile', 3], ['bottomRail', 4], ['topRail', 4]
]);

function validateAndRecordExecution(execution) {
    let previousRank = -1;
    execution.operations.forEach((operation, index) => {
        assert.equal(operation.id, `operation-${index + 1}`);
        assert.equal(operation.number, index + 1);
        const ranks = new Set(operation.sources.map(source => profileBlockRank.get(source.profileType)));
        assert.equal(ranks.size, 1, 'Operaatio ylittää profiiliblokin');
        const [rank] = ranks;
        assert.ok(Number.isSafeInteger(rank) && rank >= previousRank, 'Profiiliblokkien järjestys rikkoutui');
        previousRank = rank;
        operation.dependencyIds.forEach(dependencyId => {
            assert.ok(Number(dependencyId.split('-')[1]) < operation.number, 'Dependency ei edellä operaatiota');
        });
    });
    executionDigest.update(JSON.stringify(execution) + '\n');
}

for (const reference of read('manual')) {
    const scenarioRuntime = createRuntime({
        ...data,
        ...(reference.scenario === 'none' ? {} : { inventory: scenarios[reference.scenario].inventory })
    });
    const result = scenarioRuntime.evaluate(reference.ids, 'full', 60000, true);
    if (reference.status === 'complete') {
        assert.equal(result.status, 'complete');
        completePlanDigest.update(JSON.stringify({
            scenario: reference.scenario, ids: reference.ids,
            score: result.score, plan: result.plan
        }) + '\n');
        validateAndRecordExecution(result.execution);
        completePlanComparisons++;
        continue;
    }
    const cached = read('pattern-cache').find(row =>
        row.scenario === reference.scenario && JSON.stringify(row.ids) === JSON.stringify(reference.ids));
    if (cached?.status === 'complete') {
        assert.equal(result.status, 'complete');
        completePlanDigest.update(JSON.stringify({
            scenario: reference.scenario, ids: reference.ids,
            score: result.score, plan: result.plan
        }) + '\n');
        validateAndRecordExecution(result.execution);
        completedTimeoutComparisons++;
    }
}

const executionResultDigest = executionDigest.digest('hex');
const completePlanResultDigest = completePlanDigest.digest('hex');
const expectedCompletePlanDigest = '8c395646b3b99c576c670ea3f9324574ae44bc28166ceafd4ac7babb3257453f';
assert.equal(completePlanResultDigest, expectedCompletePlanDigest,
    'Kapasiteettimallin tallennettujen suunnitelmien checkpoint muuttui');
const expectedExecutionDigest = '11f10b561237a6eb46ad0eba9a18ef795c046a01160382e0a73ddf42b751b90c';
assert.equal(executionResultDigest, expectedExecutionDigest, 'Tallennettujen suunnitelmien scheduler-tulos muuttui');

console.log(`PASS ${patternComparisons} ordered DP pattern cases (${patternDigest})`);
console.log(`PASS ${completePlanComparisons} capacity-model complete material plan checkpoints (${completePlanResultDigest})`);
console.log(`PASS ${completedTimeoutComparisons} former timeout against a completed reference`);
