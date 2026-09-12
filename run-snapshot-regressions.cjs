const fs = require('node:fs');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const context = vm.createContext({ console, crypto: webcrypto });
for (const file of ['src/cutting-physics.js', 'src/material.js', 'src/production-planning.js', 'src/production-integration.js', 'app.js', 'production-regressions.js']) {
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
}
vm.runInContext(`globalThis.document = { getElementById: () => ({ value: '7' }) };`, context);
if (fs.existsSync('src/work-snapshots.js')) vm.runInContext(fs.readFileSync('src/work-snapshots.js', 'utf8'), context);
vm.runInContext(`(async () => {
    let checks = 0;
    const assert = (ok, name) => { if (!ok) throw new Error(name); checks++; };
    const copy = value => JSON.parse(JSON.stringify(value));
    const fixture = createProductionContinuationStateFixture();
    const state = Object.assign(createStoredPlanSemanticRegressionState(), {
        orders: fixture.orders, generatedPlan: fixture.plan, executionState: fixture.state,
        completedBarIds: [], remnantRows: [], stockProfileRows: Object.keys(PROFILE_TYPES).map(profileType =>
            ({ profileType, color: 'black', quantity: '7', unlimited: false, additional: false }))
    });
    const original = JSON.stringify(state);
    console.log('V3 canonical workState bytes:', new TextEncoder().encode(original).length);
    assert(typeof WORK_SNAPSHOTS !== 'undefined', 'Snapshot API exists');
    const S = WORK_SNAPSHOTS;
    const record = S.create(state, '  Demo  ', 'note');
    assert(record.name === 'Demo' && record.id && record.createdAt === record.updatedAt, 'Trimmed name and identity');
    assert(JSON.stringify(state) === original, 'Creation preserves input');
    assert(S.valid(record), 'V3 validates');
    console.log('V3 named snapshot bytes:', new TextEncoder().encode(JSON.stringify(record)).length);
    const many = copy(state); many.generatedPlan = null; many.executionState = null;
    many.orders = Array.from({ length: 50 }, (_, i) => ({ ...copy(state.orders[0]), id: 'order-' + i }));
    console.log('50-order draft snapshot bytes:', new TextEncoder().encode(JSON.stringify(S.create(many, '50 orders'))).length);
    const large = copy(many);
    large.stockProfileRows.forEach(row => row.quantity = '350');
    large.generatedPlan = copy(fixture.plan);
    large.generatedPlan.bars = large.orders.flatMap((order, i) => fixture.plan.bars.map((bar, j) =>
        ({ ...copy(bar), id: 'bar-' + (i * 7 + j + 1), number: i * 7 + j + 1 })));
    large.generatedPlan.batch = { version: 1, orderIds: large.orders.map(o => o.id), settings: { minBatchPieces: 1, targetBatchPieces: 350, maxBatchPieces: 350 } };
    large.executionState = createInitialProductionExecutionState(large.generatedPlan, createProductionExecution(large.generatedPlan, large.orders, 3));
    const largeSnapshot = S.create(large, '50 orders, 350 pieces');
    assert(S.valid(largeSnapshot), '50-order calculated-state archive validates without search');
    console.log('50-order / 350-bar synthetic calculated snapshot bytes:', new TextEncoder().encode(JSON.stringify(largeSnapshot)).length);
    for (const version of [1, 2]) {
        const other = copy(state); other.executionState = version === 1
            ? createInitialProductionExecutionState(fixture.plan, fixture.execution) : fixture.base;
        assert(S.valid(S.create(other, 'V' + version)), 'V1/V2 validation');
    }
    for (const mutate of [r => r.snapshotVersion++, r => r.workState.schemaVersion++, r => r.workState.engineVersion += 'x',
        r => r.workState.executionState.planDigest += 'x', r => r.workState.executionState.continuation.digest += 'x',
        r => r.presentation.execution.operations[0].length++, r => r.presentation.score.totalCostEquivalent++]) {
        const bad = copy(record); mutate(bad); assert(!S.valid(bad), 'Reject damaged/incompatible record');
    }
    const saved = JSON.stringify(record);
    state.orders[0].name = 'changed'; state.generatedPlan.bars[0].groupedCuts[0].length = 1;
    state.executionState.continuation.events.push({});
    assert(JSON.stringify(record) === saved, 'Deep copy of orders/plan/V3');
    let rejected = false; try { S.create(JSON.parse(original), '  '); } catch { rejected = true; }
    assert(rejected, 'Empty name rejected');
    const memory = new Map(); let fail = false;
    const store = { list: async () => copy([...memory.entries()].map(([id, record]) => ({ id, record }))),
        add: async r => { if (fail) throw Error('quota'); if (memory.has(r.id)) throw Error('duplicate'); memory.set(r.id, copy(r)); },
        rename: async (id, name) => { if (fail) throw Error('quota'); memory.set(id, S.rename(memory.get(id), name)); },
        remove: async id => { if (fail) throw Error('quota'); memory.delete(id); } };
    assert((await store.list()).length === 0, 'Empty store');
    await store.add(record); const second = S.create(JSON.parse(original), 'Demo'); await store.add(second);
    assert(second.id !== record.id && memory.size === 2, 'Unique IDs and duplicate names');
    const renamed = S.rename(record, ' New name ');
    assert(renamed.id === record.id && renamed.createdAt === record.createdAt && renamed.name === 'New name' &&
        JSON.stringify(renamed.workState) === JSON.stringify(record.workState), 'Rename changes only metadata');
    assert(JSON.stringify(record) === saved, 'Rename does not mutate input');
    const markup = S.create(JSON.parse(original), '<img src=x onerror=alert(1)>', '<script>bad</script>');
    assert(S.render(markup).includes('&lt;img') && !S.render(markup).includes('<script>bad'), 'Metadata is escaped, never executable markup');
    const later = { ...second, createdAt: '2099-01-01T00:00:00.000Z' };
    assert(S.newest([{ id: record.id, record }, { id: second.id, record: later }])[0].id === second.id, 'Newest first');
    // Opening and rendering cannot enter search, storage, or active controllers.
    optimizeOrderInventoryBeamDP = selectProductionBatch = createProductionContinuationPlan = () => { throw Error('SEARCH'); };
    globalThis.localStorage = { setItem: () => { throw Error('ACTIVE WRITE'); }, getItem: () => original };
    const html = S.render(record);
    assert(html.includes('JATKOSUUNNITELMA') && html.includes('Demo') && html.includes('SNAPSHOT — VAIN KATSELU'), 'Read-only V3 presentation');
    assert(!/<(button|input|select|form)\\b|onclick=/i.test(html), 'No production controls');
    assert(JSON.stringify(record) === saved && localStorage.getItem() === original, 'Render preserves both stores');
    fail = true; const beforeFailure = JSON.stringify([...memory]);
    try { await store.add(S.create(JSON.parse(original), 'Fail')); } catch {}
    assert(JSON.stringify([...memory]) === beforeFailure, 'Quota failure preserves records');
    fail = false; await store.remove(second.id);
    assert(memory.size === 1 && memory.has(record.id), 'Delete selected ID only');
    memory.set('broken', { name: 'Broken' });
    assert((await store.list()).length === 2 && !S.valid(memory.get('broken')), 'Corrupt record preserved');
    assert(localStorage.getItem() === original && !workRecoveryLocked, 'Snapshot corruption independent from active recovery');
    const element = () => ({ value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, open: false,
        children: [], replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); },
        addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } });
    const elements = Object.fromEntries(['snapshotList', 'snapshotName', 'snapshotNote', 'snapshotNoteField', 'snapshotEditorTitle',
        'snapshotEditor', 'snapshotEditorStatus', 'snapshotSubmit', 'snapshotStatus', 'snapshotContent', 'snapshotViewer',
        'snapshotDelete', 'snapshotDeleteName', 'snapshotDeleteConfirm', 'snapshotDeleteStatus'].map(id => [id, element()]));
    globalThis.document = { getElementById: id => elements[id], createElement: element };
    Object.assign(S.store, store);
    createWorkStateSnapshot = () => JSON.parse(original);
    currentGeneratedPlan = JSON.parse(original).generatedPlan;
    currentProductionExecutionState = JSON.parse(original).executionState;
    const active = { plan: currentGeneratedPlan, execution: currentProductionExecutionState, marks: [...completedBarIds] };
    await refreshSnapshotList();
    assert(elements.snapshotList.children.length === 2, 'Controller lists valid and corrupt entries');
    showSnapshotEditor(); elements.snapshotName.value = '  ';
    await submitWorkSnapshot({ preventDefault() {} });
    assert(elements.snapshotEditor.open && memory.size === 2 && elements.snapshotEditorStatus.textContent.includes('ei tallennettu'), 'Controller rejects blank name');
    elements.snapshotName.value = 'Controller snapshot';
    await submitWorkSnapshot({ preventDefault() {} });
    assert(!elements.snapshotEditor.open && memory.size === 3, 'Save controller persists before success');
    const created = [...memory.values()].find(r => r.name === 'Controller snapshot');
    await openWorkSnapshot(created.id);
    assert(elements.snapshotViewer.open && elements.snapshotContent.innerHTML.includes('Controller snapshot'), 'Open controller');
    elements.snapshotViewer.close();
    assert(!elements.snapshotViewer.open, 'Close returns without restore');
    showSnapshotEditor(created.id); elements.snapshotName.value = 'Renamed';
    await submitWorkSnapshot({ preventDefault() {} });
    assert(memory.get(created.id).name === 'Renamed' && memory.get(created.id).createdAt === created.createdAt, 'Rename controller');
    deleteWorkSnapshot(created.id); elements.snapshotDelete.close();
    assert(memory.has(created.id), 'Cancelled deletion preserves record');
    deleteWorkSnapshot(created.id); await confirmDeleteWorkSnapshot();
    assert(!memory.has(created.id) && memory.has(record.id), 'Confirmed deletion only selected snapshot');
    await openWorkSnapshot('broken');
    assert(!elements.snapshotViewer.open && elements.snapshotStatus.textContent.includes('ei voi avata'), 'Corruption does not open viewer');
    fail = true; showSnapshotEditor(); elements.snapshotName.value = 'Quota';
    await submitWorkSnapshot({ preventDefault() {} });
    assert(elements.snapshotEditor.open && memory.size === 2 && !snapshotBusy, 'Failure leaves editor and snapshots intact');
    assert(JSON.stringify(active) === JSON.stringify({ plan: currentGeneratedPlan, execution: currentProductionExecutionState, marks: [...completedBarIds] }) &&
        localStorage.getItem() === original && !workRecoveryLocked, 'All controllers preserve live and persisted active state');
    let activeWrite = false;
    localStorage.setItem = () => { activeWrite = true; };
    assert(writeWorkStateSnapshot(JSON.parse(original)) && activeWrite, 'Snapshot failure does not lock active persistence');
    console.log('Snapshot regressions:', checks, 'passed');
})()`, Object.assign(context, { TextEncoder }), { timeout: 60000 }).catch(error => { console.error(error); process.exitCode = 1; });
