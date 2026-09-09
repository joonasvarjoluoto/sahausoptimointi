const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { createRuntime } = require('./runtime.cjs');
const root = path.resolve(__dirname, '../..');
const profileDir = path.join(__dirname, 'reachable-profile');
const baselineCommit = '404b885';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const data = read(path.join(__dirname, 'orders-23.json'));
const manual = read(path.join(__dirname, 'inventory-study/manual.json'));
const noRemnantIds = ['excel-1', 'excel-4', 'excel-17', 'excel-18'];

function storedRuns(caseName, stage) {
    return [1, 2, 3].map(run => read(path.join(
        profileDir,
        `${caseName}-baseline-${stage === 'before' ? run : `after-${run}`}.json`
    )));
}

function summarizeStored(caseName) {
    const before = storedRuns(caseName, 'before');
    const after = storedRuns(caseName, 'after');
    for (const run of [...before, ...after]) {
        assert.equal(run.exactReferenceMatch, true);
        assert.equal(run.planHash, before[0].planHash);
        assert.equal(run.score.totalCostEquivalent, before[0].score.totalCostEquivalent);
        assert.deepEqual(run.settings, before[0].settings);
        run.measurements.forEach((variant, index) => {
            const baselineVariant = before[0].measurements[index];
            for (const key of ['profile', 'color', 'items', 'sources', 'stats']) {
                assert.deepEqual(variant[key], baselineVariant[key]);
            }
        });
    }
    return {
        planHash: before[0].planHash,
        score: before[0].score.totalCostEquivalent,
        before: before.map(run => run.materialMs),
        after: after.map(run => run.materialMs)
    };
}

function hardWorkCounters() {
    const variant = file => read(path.join(profileDir, file)).measurements.find(row =>
        row.profile === 'horizontalProfile' && row.color === 'gray'
    );
    const before = variant('hard-counts-1.json');
    const after = variant('hard-counts-after-1.json');
    const sum = (row, key) => row.calls.reduce((total, call) => total + (call[key] || 0), 0);
    assert.deepEqual(after.stats, before.stats);
    assert.equal(after.calls.length, before.calls.length);
    const unchanged = Object.fromEntries(
        ['chunks', 'transitions', 'copies', 'copiedElements', 'keepCalls', 'inputPatterns', 'retainedPatterns', 'reachable']
            .map(key => [key, sum(before, key)])
    );
    for (const [key, value] of Object.entries(unchanged)) {
        assert.equal(sum(after, key), value, key);
    }
    return {
        patternCalls: before.calls.length,
        ...unchanged,
        removedJoinKeys: unchanged.inputPatterns,
        removedMapAndGeneralSortCalls: unchanged.keepCalls
    };
}

function runNoRemnants(sourceOverrides) {
    const reference = manual.find(row =>
        row.scenario === 'none' &&
        JSON.stringify(row.ids) === JSON.stringify(noRemnantIds)
    );
    assert(reference);
    const runtime = createRuntime(data, { sourceOverrides });
    const result = runtime.evaluate(reference.ids, 'full', 60000, true);
    assert.equal(result.status, 'complete');
    assert.equal(result.score, reference.score);
    assert.deepEqual(result.plan, reference.plan);
    assert.deepEqual(result.execution, reference.execution);
    return {
        materialMs: result.materialMs,
        elapsedMs: result.elapsedMs,
        score: result.score,
        planHash: hash(JSON.stringify([result.plan, result.execution, result.score])),
        sourceHashes: runtime.sourceHashes
    };
}

const oldApp = execFileSync(
    'git',
    ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, 'show', `${baselineCommit}:app.js`],
    { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
);
const noRemnantBefore = [];
const noRemnantAfter = [];
for (let run = 0; run < 3; run++) {
    noRemnantBefore.push(runNoRemnants({ 'app.js': oldApp }));
}
for (let run = 0; run < 3; run++) {
    noRemnantAfter.push(runNoRemnants({}));
}
for (const run of [...noRemnantBefore, ...noRemnantAfter]) {
    assert.equal(run.score, noRemnantBefore[0].score);
    assert.equal(run.planHash, noRemnantBefore[0].planHash);
}

const report = {
    node: process.version,
    baselineCommit,
    generatedAt: new Date().toISOString(),
    hardA: { ...summarizeStored('hard'), work: hardWorkCounters() },
    fastA: summarizeStored('fast'),
    noRemnants: {
        ids: noRemnantIds,
        planHash: noRemnantBefore[0].planHash,
        score: noRemnantBefore[0].score,
        before: noRemnantBefore.map(run => run.materialMs),
        after: noRemnantAfter.map(run => run.materialMs),
        beforeSourceHashes: noRemnantBefore[0].sourceHashes,
        afterSourceHashes: noRemnantAfter[0].sourceHashes
    }
};
fs.writeFileSync(
    path.join(__dirname, 'pattern-merge-results.json'),
    JSON.stringify(report, null, 2)
);
console.log(JSON.stringify(report, null, 2));
