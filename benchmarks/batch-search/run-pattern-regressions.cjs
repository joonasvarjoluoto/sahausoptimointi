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
        assert.deepEqual(result.execution, reference.execution);
        completePlanComparisons++;
        continue;
    }
    const cached = read('pattern-cache').find(row =>
        row.scenario === reference.scenario && JSON.stringify(row.ids) === JSON.stringify(reference.ids));
    if (cached?.status === 'complete') {
        assert.equal(result.status, 'complete');
        assert.equal(result.score, cached.score);
        assert.deepEqual(result.plan, cached.plan);
        assert.deepEqual(result.execution, cached.execution);
        completedTimeoutComparisons++;
    }
}

console.log(`PASS ${patternComparisons} ordered DP pattern cases (${patternDigest})`);
console.log(`PASS ${completePlanComparisons} stored complete plans with identical score and operations`);
console.log(`PASS ${completedTimeoutComparisons} former timeout against a completed reference`);
