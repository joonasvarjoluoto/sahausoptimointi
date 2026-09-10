// Read-only production profiling. Instrumentation exists only in an isolated VM.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const inspector = require('node:inspector');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const root = path.resolve(__dirname, '../..');
const output = path.join(__dirname, 'reachable-profile');
const files = ['src/cutting-physics.js', 'src/material.js', 'src/production-planning.js', 'src/production-integration.js', 'app.js'];
const sources = files.map(file => ({ file, code: fs.readFileSync(path.join(root, file), 'utf8') }));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const data = read('orders-23.json');
const inventory = read('inventory-study/scenarios.json').scenarios.A.inventory;
const cases = { hard: [3, 9, 21], fast: [1, 4, 17, 18] };

function instrument(code, mode) {
    code = code.replace(/\r\n/g, '\n');
    if (code.includes('function mergeDistinctSortedPatterns(')) {
        return instrumentMergedPatternSearch(code);
    }
    const start = code.indexOf('function findCandidatePatternsDP(');
    const end = code.indexOf('function optimizeOrderDP(', start);
    assert(start >= 0 && end > start);
    let part = code.slice(start, end);
    const replace = (from, to) => {
        assert.equal(part.split(from).length, 2, 'Instrumentation anchor changed: ' + from);
        part = part.replace(from, to);
    };
    replace('const chunks = [];', 'const chunks = []; const meter = activeCall;');
    replace('const states = new Map();', 'meter.chunks = chunks.length; const states = new Map();');
    replace('for (const chunk of chunks) {', 'for (const chunk of chunks) { meter.capacityKeysSorted += states.size;');
    replace('const newPatterns = [];', `const newPatterns = [];
        meter.transitions++;
        const copied = states.get(sourceCapacity).length;
        meter.copies += copied; meter.copiedElements += copied * items.length;
        const sampleCopy = sampleMode && (Math.imul(meter.transitions + meter.ordinal * 104729, 2654435761) >>> 22) === 0;
        const copyStart = sampleCopy ? performance.now() : 0;`);
    replace('states.set(targetCapacity, keepDistinctPatterns([', `if (sampleCopy) { meter.copySamples++; meter.copySampleMs += performance.now() - copyStart; }
        states.set(targetCapacity, keepDistinctPatterns([`);
    replace('const distinctPatterns = new Map();', `meter.keepCalls++; meter.inputPatterns += patterns.length;
        const sampleKeep = sampleMode && (Math.imul(meter.keepCalls + meter.ordinal * 104729, 2654435761) >>> 22) === 0;
        const keepStart = sampleKeep ? performance.now() : 0;
        const distinctPatterns = new Map();`);
    replace('return [...distinctPatterns.values()]\n            .sort(compareQuantities)\n            .slice(0, maxPatterns);', `meter.uniquePatterns += distinctPatterns.size;
        meter.retainedPatterns += Math.min(distinctPatterns.size, maxPatterns);
        meter.maxKeepInput = Math.max(meter.maxKeepInput, patterns.length);
        meter.maxKeepDistinct = Math.max(meter.maxKeepDistinct, distinctPatterns.size);
        const middle = sampleKeep ? performance.now() : 0;
        const kept = [...distinctPatterns.values()].sort(compareQuantities).slice(0, maxPatterns);
        if (sampleKeep) {
            meter.keepSamples++; meter.dedupSampleMs += middle - keepStart;
            meter.sortSampleMs += performance.now() - middle;
        }
        return kept;`);
    replace('return candidates;', `meter.reachable = states.size;
        meter.returned = candidates.length;
        return candidates;`);
    return code.slice(0, start) + part + code.slice(end);
}

function instrumentMergedPatternSearch(code) {
    const replaceOnce = (source, from, to) => {
        assert.equal(source.split(from).length, 2, 'Instrumentation anchor changed: ' + from);
        return source.replace(from, to);
    };
    const mergeStart = code.indexOf('function mergeDistinctSortedPatterns(');
    const searchStart = code.indexOf('function findCandidatePatternsDP(', mergeStart);
    const searchEnd = code.indexOf('function optimizeOrderDP(', searchStart);
    assert(mergeStart >= 0 && searchStart > mergeStart && searchEnd > searchStart);
    let mergePart = code.slice(mergeStart, searchStart);
    mergePart = replaceOnce(mergePart, '    const mergedPatterns = [];', `    const meter = activeCall;
    meter.keepCalls++; meter.inputPatterns += existingPatterns.length + newPatterns.length;
    meter.maxKeepInput = Math.max(meter.maxKeepInput, existingPatterns.length + newPatterns.length);
    const sampleKeep = sampleMode && (Math.imul(meter.keepCalls + meter.ordinal * 104729, 2654435761) >>> 22) === 0;
    const keepStart = sampleKeep ? performance.now() : 0;
    const mergedPatterns = [];`);
    mergePart = replaceOnce(mergePart, '    return mergedPatterns;', `    meter.retainedPatterns += mergedPatterns.length;
    meter.maxKeepDistinct = Math.max(meter.maxKeepDistinct, mergedPatterns.length);
    meter.mergeOutputs = (meter.mergeOutputs || 0) + mergedPatterns.length;
    if (sampleKeep) { meter.keepSamples++; meter.dedupSampleMs += performance.now() - keepStart; }
    return mergedPatterns;`);
    let searchPart = code.slice(searchStart, searchEnd);
    searchPart = replaceOnce(searchPart, 'const chunks = [];', 'const chunks = []; const meter = activeCall;');
    searchPart = replaceOnce(searchPart, 'const states = new Map();', 'meter.chunks = chunks.length; const states = new Map();');
    searchPart = replaceOnce(searchPart, 'for (const chunk of chunks) {', 'for (const chunk of chunks) { meter.capacityKeysSorted += states.size;');
    searchPart = replaceOnce(searchPart, 'const newPatterns = [];', `const newPatterns = [];
            meter.transitions++;
            const copied = states.get(sourceCapacity).length;
            meter.copies += copied; meter.copiedElements += copied * items.length;
            const sampleCopy = sampleMode && (Math.imul(meter.transitions + meter.ordinal * 104729, 2654435761) >>> 22) === 0;
            const copyStart = sampleCopy ? performance.now() : 0;`);
    searchPart = replaceOnce(searchPart, '            states.set(\n                targetCapacity,\n                mergeDistinctSortedPatterns(', `            if (sampleCopy) { meter.copySamples++; meter.copySampleMs += performance.now() - copyStart; }
            states.set(
                targetCapacity,
                mergeDistinctSortedPatterns(`);
    searchPart = replaceOnce(searchPart, 'return candidates;', `meter.reachable = states.size;
    meter.returned = candidates.length;
    return candidates;`);
    return code.slice(0, mergeStart) + mergePart + searchPart + code.slice(searchEnd);
}

async function run(caseName, mode, runId) {
    assert(cases[caseName]);
    assert(['baseline', 'counts', 'sample', 'cpu'].includes(mode));
    const counted = mode === 'counts' || mode === 'sample';
    const ctx = vm.createContext({ data, inventory, ids: cases[caseName].map(n => 'excel-' + n), performance,
        counted, sampleMode: mode === 'sample', console: { log() {}, table() {}, warn() {}, error() {} } });
    sources.forEach(({ file, code }) => new vm.Script(file === 'app.js' && counted ? instrument(code, mode) : code,
        { filename: file }).runInContext(ctx));
    vm.runInContext(`
        const measurements = []; let activeVariant = null, activeCall = null;
        const originalGroup = optimizeOrderInventoryBeamDP;
        const originalPatterns = findCandidatePatternsDP;
        if (counted) findCandidatePatternsDP = function(items, length, kerf, limit) {
            const key = JSON.stringify([items, length, kerf, limit]);
            const demandKey = JSON.stringify([items, kerf, limit]);
            const repeated = activeVariant.keys.has(key);
            activeVariant.keys.add(key); activeVariant.demands.add(demandKey);
            activeCall = { ordinal: activeVariant.calls.length, length, itemCount: items.length, repeated, chunks: 0, transitions: 0, copies: 0,
                copiedElements: 0, keepCalls: 0, inputPatterns: 0, uniquePatterns: 0, retainedPatterns: 0,
                maxKeepInput: 0, maxKeepDistinct: 0, capacityKeysSorted: 0, keepSamples: 0,
                copySamples: 0, copySampleMs: 0, dedupSampleMs: 0, sortSampleMs: 0 };
            const start = performance.now();
            const result = originalPatterns(items, length, kerf, limit);
            activeCall.ms = performance.now() - start;
            activeVariant.calls.push(activeCall);
            return result;
        };
        optimizeOrderInventoryBeamDP = function(items, sources, kerf, options) {
            const item = { profile: sources[0].profileType, color: sources[0].color,
                items: JSON.parse(JSON.stringify(items)), sources: JSON.parse(JSON.stringify(sources)),
                calls: [], keys: new Set(), demands: new Set() };
            activeVariant = item;
            const start = performance.now();
            const result = originalGroup(items, sources, kerf, options);
            item.ms = performance.now() - start;
            item.stats = result.stats;
            item.uniquePatternInputs = item.keys.size; item.uniqueDemandInputs = item.demands.size;
            delete item.keys; delete item.demands;
            measurements.push(item);
            return result;
        };
        const orders = data.orders.filter(o => ids.includes(o.id)).map(o => createOrderInput(o.id,o.name,o.color,o.sections));
        const cuts = normalizeOrderCuts(orders);
        const before = JSON.stringify([cuts, inventory]);
    `, ctx);
    let session;
    const post = (method, params = {}) => new Promise((resolve, reject) => session.post(method, params,
        (err, result) => err ? reject(err) : resolve(result)));
    if (mode === 'cpu') {
        session = new inspector.Session(); session.connect();
        await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 1000 });
        await post('Profiler.start');
    }
    const start = performance.now();
    const result = JSON.parse(vm.runInContext(`
        const materialStart = performance.now();
        const optimization = optimizeOrderByProfileTypeWithInventory(cuts,inventory,data.kerf,PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS);
        const materialMs = performance.now() - materialStart;
        verifyOptimizationResult(cuts,inventory,optimization);
        if (!optimization.complete || JSON.stringify([cuts,inventory]) !== before) throw new Error('Incomplete or mutated input');
        const plan = adaptMaterialOptimizationForUi(optimization, PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings);
        const schedulerStart = performance.now();
        const execution = createProductionExecution(plan,orders,data.kerf);
        const schedulerMs = performance.now() - schedulerStart;
        JSON.stringify({ materialMs, schedulerMs, plan, execution, measurements,
            settings: PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS,
            score: scoreCompleteMaterialTransitionPlan(optimization,PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings) });
    `, ctx, { timeout: 180000 }));
    const elapsedMs = performance.now() - start;
    fs.mkdirSync(output, { recursive: true });
    if (session) {
        const { profile } = await post('Profiler.stop'); session.disconnect();
        fs.writeFileSync(path.join(output, caseName + '-' + mode + '-' + runId + '.cpuprofile'), JSON.stringify(profile));
    }
    const reference = caseName === 'hard' ? read('inventory-study/manual-complex.json')[0]
        : read('inventory-study/manual.json').find(r => r.scenario === 'A' && JSON.stringify(r.ids) === JSON.stringify(cases.fast.map(n => 'excel-' + n)));
    assert.deepEqual(result.plan, reference.plan);
    assert.deepEqual(result.execution, reference.execution);
    assert.equal(result.score.totalCostEquivalent, reference.score);
    const planHash = hash(JSON.stringify([result.plan, result.execution, result.score]));
    delete result.plan; delete result.execution;
    const document = { caseName, mode, runId, instrumentationVersion: 2, ids: cases[caseName], node: process.version,
        fixtureHash: hash(JSON.stringify(data)), inventoryHash: hash(JSON.stringify(inventory)),
        sourceHashes: Object.fromEntries(sources.map(s => [s.file, hash(s.code)])),
        planHash, exactReferenceMatch: true, elapsedMs, ...result };
    fs.writeFileSync(path.join(output, caseName + '-' + mode + '-' + runId + '.json'), JSON.stringify(document, null, 2));
    console.log(JSON.stringify({ caseName, mode, runId, elapsedMs, materialMs: result.materialMs,
        variants: result.measurements.map(v => [v.profile, v.color, v.ms, v.calls.length]), planHash }));
}
run(process.argv[2] || 'hard', process.argv[3] || 'baseline', process.argv[4] || '1').catch(err => { console.error(err); process.exitCode = 1; });
