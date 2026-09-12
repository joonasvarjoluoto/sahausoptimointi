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
    const calculated = copy(state);
    calculated.executionState = createInitialProductionExecutionState(fixture.plan, fixture.execution);
    const draft = copy(calculated); draft.generatedPlan = null; draft.executionState = null;
    assert(!S.hasPhysicalProduction(draft) && !S.hasPhysicalProduction(calculated), 'Draft and calculated plan are restorable before physical work');
    const completed = copy(calculated); completed.completedBarIds = [completed.generatedPlan.bars[0].id];
    const v1Event = copy(calculated); v1Event.executionState.events.push(copy(fixture.base.events[0]));
    const v2Event = copy(state); v2Event.executionState = copy(fixture.base);
    assert(S.hasPhysicalProduction(completed) && S.hasPhysicalProduction(v1Event) &&
        S.hasPhysicalProduction(state), 'Completion marks and V1/V2/V3 events are physical work');
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
        get: async id => copy(memory.get(id)),
        add: async r => { if (fail) throw Error('quota'); if (memory.has(r.id)) throw Error('duplicate'); memory.set(r.id, copy(r)); },
        rename: async (id, name) => { if (fail) throw Error('quota'); memory.set(id, S.rename(memory.get(id), name)); },
        remove: async id => { if (fail) throw Error('quota'); memory.delete(id); } };
    Object.assign(S.store, store);
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

    const restoreTarget = S.create(calculated, 'Restore target'); await store.add(restoreTarget);
    const targetBefore = JSON.stringify(memory.get(restoreTarget.id));
    const activeDraft = copy(draft); activeDraft.orders[0].name = 'Unsaved active draft';
    let persisted = copy(activeDraft), live = copy(activeDraft), persistCalls = 0, activateCalls = 0;
    const dependencies = overrides => ({
        isRecoveryLocked: () => false,
        readActive: () => copy(live),
        persistActive: next => { persistCalls++; persisted = copy(next); return true; },
        readPersistedActive: () => copy(persisted),
        activatePersisted: () => { activateCalls++; live = copy(persisted); return true; },
        ...overrides
    });
    const restored = await S.restoreActive(restoreTarget.id, dependencies());
    assert(restored.safetySnapshot?.name.startsWith('Ennen palautusta – ') &&
        restored.safetySnapshot.note.includes('automaattisesti'), 'Restore creates named safety snapshot first');
    assert(JSON.stringify(memory.get(restoreTarget.id)) === targetBefore, 'Restore leaves target record unchanged');
    assert(JSON.stringify(live.generatedPlan) === JSON.stringify(calculated.generatedPlan) &&
        JSON.stringify(live.executionState) === JSON.stringify(calculated.executionState) &&
        persistCalls === 1 && activateCalls === 1, 'Canonical plan and scheduler state persist before activation');
    assert(live.savedAt !== calculated.savedAt && !JSON.stringify(live).includes('presentation'), 'Active state gets current persistence timestamp without presentation');

    const defaultState = {
        schemaVersion: WORK_STATE_SCHEMA_VERSION, engineVersion: WORK_STATE_ENGINE_VERSION, savedAt: new Date().toISOString(),
        batchSettings: Object.fromEntries(Object.entries(PRODUCTION_PLANNING.batchDefaults).map(([key, value]) => [key, String(value)])),
        stockLength: DEFAULT_STOCK_LENGTH, kerf: DEFAULT_KERF,
        stockProfileRows: Object.keys(PROFILE_TYPES).flatMap(profileType => [
            { profileType, color: 'gray', quantity: '1', unlimited: true, additional: false },
            { profileType, color: 'black', quantity: '1', unlimited: true, additional: true }
        ]), remnantRows: [], orders: [createOrderInput('order-1')], generatedPlan: null, executionState: null, completedBarIds: []
    };
    live = copy(defaultState); persisted = copy(defaultState);
    const blankRestore = await S.restoreActive(restoreTarget.id, dependencies());
    assert(blankRestore.safetySnapshot === null, 'Completely empty default work skips needless safety snapshot');
    const draftTarget = S.create(draft, 'Draft restore target'); await store.add(draftTarget);
    live = copy(calculated); persisted = copy(calculated);
    const restoredDraft = await S.restoreActive(draftTarget.id, dependencies());
    assert(restoredDraft.activeState.generatedPlan === null && restoredDraft.activeState.executionState === null &&
        live.generatedPlan === null && live.executionState === null, 'Named draft restores as canonical active draft');

    const safetyCount = memory.size;
    const beforeSafetyFailure = JSON.stringify(live);
    fail = true; persistCalls = 0;
    let safetyFailed = false;
    try { await S.restoreActive(restoreTarget.id, dependencies()); } catch (error) { safetyFailed = !error.activePersisted; }
    fail = false;
    assert(safetyFailed && persistCalls === 0 && JSON.stringify(live) === beforeSafetyFailure && memory.size === safetyCount,
        'Safety snapshot failure aborts before active persistence');

    live = copy(activeDraft); persisted = copy(activeDraft); persistCalls = 0;
    let activeWriteFailed = false;
    try { await S.restoreActive(restoreTarget.id, dependencies({ persistActive: () => { persistCalls++; return false; } })); }
    catch (error) { activeWriteFailed = !error.activePersisted; }
    assert(activeWriteFailed && persistCalls === 1 && JSON.stringify(persisted) === JSON.stringify(activeDraft) &&
        JSON.stringify(live) === JSON.stringify(activeDraft), 'Active write failure preserves persisted and live active state');

    live = copy(activeDraft); persisted = copy(activeDraft);
    let renderFailed = false;
    try { await S.restoreActive(restoreTarget.id, dependencies({ activatePersisted: () => { throw Error('render'); } })); }
    catch (error) { renderFailed = error.activePersisted === true; }
    assert(renderFailed && JSON.stringify(persisted.generatedPlan) === JSON.stringify(calculated.generatedPlan) &&
        JSON.stringify(live) === JSON.stringify(activeDraft), 'Render failure keeps newly persisted target authoritative');

    for (const [blockedState, name] of [[v2Event, 'V2 deviation'], [completed, 'completion mark'], [state, 'V3 event']]) {
        let wrote = false;
        let blocked = false;
        try { await S.restoreActive(restoreTarget.id, dependencies({ readActive: () => copy(blockedState), persistActive: () => { wrote = true; return true; } })); }
        catch { blocked = true; }
        assert(blocked && !wrote, 'Restore blocks ' + name);
    }
    let recoveryBlocked = false;
    try { await S.restoreActive(restoreTarget.id, dependencies({ isRecoveryLocked: () => true })); } catch { recoveryBlocked = true; }
    assert(recoveryBlocked, 'Recovery lock blocks restore');
    const physicalTarget = S.create(v2Event, 'Physical target'); await store.add(physicalTarget);
    let targetBlocked = false;
    try { await S.restoreActive(physicalTarget.id, dependencies({ readActive: () => copy(activeDraft) })); } catch { targetBlocked = true; }
    assert(targetBlocked, 'Snapshot with physical production remains read-only');
    const wrongPresentation = copy(restoreTarget); wrongPresentation.presentation = { injected: true }; await store.add({ ...wrongPresentation, id: 'wrong-presentation' });
    let corruptBlocked = false;
    try { await S.restoreActive('wrong-presentation', dependencies({ readActive: () => copy(activeDraft) })); } catch { corruptBlocked = true; }
    assert(corruptBlocked && JSON.stringify(live) === JSON.stringify(activeDraft), 'Invalid presentation cannot become active canonical state');
    for (const id of [...memory.keys()]) if (id !== record.id && id !== 'broken') memory.delete(id);
    const element = () => ({ value: '', textContent: '', innerHTML: '', hidden: false, disabled: false, open: false,
        children: [], replaceChildren() { this.children = []; }, append(...items) { this.children.push(...items); },
        addEventListener() {}, showModal() { this.open = true; }, close() { this.open = false; } });
    const elements = Object.fromEntries(['snapshotList', 'snapshotName', 'snapshotNote', 'snapshotNoteField', 'snapshotEditorTitle',
        'snapshotEditor', 'snapshotEditorStatus', 'snapshotSubmit', 'snapshotStatus', 'snapshotContent', 'snapshotViewer',
        'snapshotDelete', 'snapshotDeleteName', 'snapshotDeleteConfirm', 'snapshotDeleteStatus', 'snapshotRestoreButton',
        'snapshotRestoreReason', 'snapshotRestore', 'snapshotRestoreTarget', 'snapshotRestoreActive', 'snapshotRestoreStatus',
        'snapshotRestoreConfirm'].map(id => [id, element()]));
    globalThis.document = { getElementById: id => elements[id], createElement: element };
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
    assert(elements.snapshotViewer.open && elements.snapshotContent.innerHTML.includes('Controller snapshot') &&
        elements.snapshotRestoreButton.disabled && elements.snapshotRestoreReason.textContent.includes('fyysistä'), 'Open controller shows physical restore block');
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

    fail = false;
    const uiTarget = S.create(calculated, 'UI restore target'); await store.add(uiTarget);
    const uiTargetBefore = JSON.stringify(memory.get(uiTarget.id));
    let uiLive = copy(activeDraft), uiPersisted = copy(activeDraft);
    createWorkStateSnapshot = () => copy(uiLive);
    localStorage.getItem = () => JSON.stringify(uiPersisted);
    localStorage.setItem = (_key, value) => { uiPersisted = JSON.parse(value); };
    restoreSavedWorkState = () => { uiLive = copy(uiPersisted); currentGeneratedPlan = uiLive.generatedPlan;
        currentProductionExecutionState = uiLive.executionState; return true; };
    await openWorkSnapshot(uiTarget.id);
    assert(!elements.snapshotRestoreButton.disabled && elements.snapshotRestoreReason.textContent.includes('turvakopion'),
        'Restorable viewer enables restore action and explains safety copy');
    showSnapshotRestoreConfirmation();
    assert(elements.snapshotRestore.open && elements.snapshotRestoreTarget.textContent.includes('UI restore target') &&
        elements.snapshotRestoreActive.textContent.includes('luonnos'), 'Restore confirmation compares target and active summaries');
    elements.snapshotRestore.close();
    assert(JSON.stringify(uiLive) === JSON.stringify(activeDraft) && JSON.stringify(memory.get(uiTarget.id)) === uiTargetBefore,
        'Cancelled restore changes neither active work nor target');
    showSnapshotRestoreConfirmation(); await confirmSnapshotRestore();
    assert(!elements.snapshotRestore.open && !elements.snapshotViewer.open &&
        JSON.stringify(uiLive.generatedPlan) === JSON.stringify(calculated.generatedPlan) &&
        JSON.stringify(uiLive.executionState) === JSON.stringify(calculated.executionState), 'Confirmed UI restore activates exact canonical plan and scheduler state');
    assert(JSON.stringify(memory.get(uiTarget.id)) === uiTargetBefore && [...memory.values()].some(item =>
        item.name.startsWith('Ennen palautusta – ') && item.note.includes('automaattisesti')), 'UI restore preserves target and stores active-work safety snapshot');
    uiLive = copy(activeDraft); workRecoveryLocked = true; await openWorkSnapshot(uiTarget.id);
    assert(elements.snapshotRestoreButton.disabled && elements.snapshotRestoreReason.textContent.includes('palautuslukittu'),
        'Recovery lock disables restore action with reason');
    workRecoveryLocked = false;
    uiLive = copy(activeDraft); await openWorkSnapshot(record.id);
    assert(elements.snapshotRestoreButton.disabled && elements.snapshotRestoreReason.textContent.includes('snapshotissa'),
        'Physical target disables restore action with reason');
    uiLive = copy(activeDraft); uiPersisted = copy(activeDraft); await openWorkSnapshot(uiTarget.id); showSnapshotRestoreConfirmation();
    fail = true; await confirmSnapshotRestore(); fail = false;
    assert(elements.snapshotRestore.open && elements.snapshotRestoreStatus.textContent.includes('turvakopion') &&
        JSON.stringify(uiLive) === JSON.stringify(activeDraft) && JSON.stringify(uiPersisted) === JSON.stringify(activeDraft),
        'UI reports safety-copy failure and preserves active work');
    const realWriteWorkStateSnapshot = writeWorkStateSnapshot;
    document.getElementById('snapshotRestoreStatus').textContent = '';
    writeWorkStateSnapshot = () => false;
    await confirmSnapshotRestore();
    writeWorkStateSnapshot = realWriteWorkStateSnapshot;
    assert(elements.snapshotRestore.open && elements.snapshotRestoreStatus.textContent.includes('Aktiivisen työn tallennus epäonnistui') &&
        JSON.stringify(uiLive) === JSON.stringify(activeDraft) && JSON.stringify(uiPersisted) === JSON.stringify(activeDraft),
        'UI reports active-store failure and leaves live state unchanged');
    elements.snapshotRestore.close(); elements.snapshotViewer.close();
    const beforeQuotaSize = memory.size, beforeQuotaLive = JSON.stringify(uiLive), beforeQuotaPersisted = JSON.stringify(uiPersisted);
    fail = true; showSnapshotEditor(); elements.snapshotName.value = 'Quota';
    await submitWorkSnapshot({ preventDefault() {} });
    assert(elements.snapshotEditor.open && memory.size === beforeQuotaSize && !snapshotBusy, 'Failure leaves editor and snapshots intact');
    assert(JSON.stringify(uiLive) === beforeQuotaLive && JSON.stringify(uiPersisted) === beforeQuotaPersisted && !workRecoveryLocked,
        'Failed snapshot save preserves live and persisted active state');
    let activeWrite = false;
    localStorage.setItem = () => { activeWrite = true; };
    assert(writeWorkStateSnapshot(JSON.parse(original)) && activeWrite, 'Snapshot failure does not lock active persistence');
    console.log('Snapshot regressions:', checks, 'passed');
})()`, Object.assign(context, { TextEncoder }), { timeout: 60000 }).catch(error => { console.error(error); process.exitCode = 1; });
