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
const expectedPatternDigest = 'd8aa8e2884e6ac7f8b2f37f782aad04e48aced4eabd28e3e3c6bc6f7d555d36c';
assert.equal(patternDigest, expectedPatternDigest, 'Järjestettyjen DP-kuvioiden regressiodigest muuttui');

const scenarios = read('scenarios').scenarios;
let completePlanComparisons = 0;
let completedTimeoutComparisons = 0;
const executionDigest = crypto.createHash('sha256');
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
        assert.equal(result.score, reference.score);
        assert.deepEqual(result.plan, reference.plan);
        validateAndRecordExecution(result.execution);
        completePlanComparisons++;
        continue;
    }
    const cached = read('pattern-cache').find(row =>
        row.scenario === reference.scenario && JSON.stringify(row.ids) === JSON.stringify(reference.ids));
    if (cached?.status === 'complete') {
        assert.equal(result.status, 'complete');
        assert.equal(result.score, cached.score);
        assert.deepEqual(result.plan, cached.plan);
        validateAndRecordExecution(result.execution);
        completedTimeoutComparisons++;
    }
}

const executionResultDigest = executionDigest.digest('hex');
const expectedExecutionDigest = '44d68957a1504764ba50e8f52fe2058bad0f363a1d961d75c5ff8aeb55fcc74d';
assert.equal(executionResultDigest, expectedExecutionDigest, 'Tallennettujen suunnitelmien scheduler-tulos muuttui');

console.log(`PASS ${patternComparisons} ordered DP pattern cases (${patternDigest})`);
console.log(`PASS ${completePlanComparisons} stored complete material plans with identical score and validated profile-block operations`);
console.log(`PASS ${completedTimeoutComparisons} former timeout against a completed reference`);
