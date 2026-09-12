// Lataa vain erillisellä testi-originilla. Luo ja poistaa vain tämän ajon omat snapshot-ID:t.
async function runSnapshotBrowserRegressions() {
    const S = WORK_SNAPSHOTS, store = S.store;
    const ids = [];
    let checks = 0;
    const assert = (ok, name) => { if (!ok) throw Error(name); checks++; };
    const activeRaw = localStorage.getItem(WORK_STORAGE_KEY);
    const canonical = () => { const state = createWorkStateSnapshot(); delete state.savedAt; return JSON.stringify(state); };
    const activeLive = canonical();
    const initial = JSON.stringify(await store.list());
    const first = S.create(createWorkStateSnapshot(), 'IndexedDB regression'); ids.push(first.id);
    const second = S.create(createWorkStateSnapshot(), 'IndexedDB regression'); ids.push(second.id);
    const get = async id => await store.get(id) ?? undefined;
    const abortWrite = async (method, action) => {
        const original = IDBObjectStore.prototype[method];
        IDBObjectStore.prototype[method] = function (...args) {
            const request = original.apply(this, args);
            this.transaction.abort();
            return request;
        };
        let rejected = false;
        try { await action(); } catch { rejected = true; }
        finally { IDBObjectStore.prototype[method] = original; }
        assert(rejected, 'Aborted ' + method + ' rejects');
    };
    try {
        await store.add(first); await store.add(second);
        assert(first.id !== second.id && (await get(first.id)).name === second.name, 'Multiple duplicate names with independent IDs');
        const originalFirst = JSON.stringify(await get(first.id));
        first.workState.orders[0].name = 'mutated'; first.presentation.execution.operations[0].length++;
        assert(JSON.stringify(await get(first.id)) === originalFirst, 'IndexedDB deep clone');
        let rejected = false; try { await store.add(second); } catch { rejected = true; }
        assert(rejected && JSON.stringify(await get(first.id)) === originalFirst, 'Duplicate ID cannot overwrite');
        await store.rename(first.id, ' Renamed ');
        const renamed = await get(first.id);
        assert(renamed.name === 'Renamed' && renamed.createdAt === first.createdAt &&
            JSON.stringify(renamed.workState) === JSON.stringify(JSON.parse(originalFirst).workState), 'Transactional metadata-only rename');
        const beforeFailed = JSON.stringify(await store.list());
        const failed = S.create(createWorkStateSnapshot(), 'Aborted'); ids.push(failed.id);
        await abortWrite('add', () => store.add(failed));
        assert(JSON.stringify(await store.list()) === beforeFailed, 'Aborted save preserves all records');
        await abortWrite('put', () => store.rename(first.id, 'Must not persist'));
        assert(JSON.stringify(await store.list()) === beforeFailed, 'Aborted rename preserves all records');
        await abortWrite('delete', () => store.remove(first.id));
        assert(JSON.stringify(await store.list()) === beforeFailed, 'Aborted delete preserves all records');
        const damaged = S.create(createWorkStateSnapshot(), 'Damaged'); ids.push(damaged.id);
        damaged.workState.executionState.planDigest += 'broken';
        await store.add(damaged);
        assert(!S.valid(await get(damaged.id)) && S.valid(await get(second.id)), 'One corrupt entry does not damage another');
        await store.remove(damaged.id);
        assert(!(await get(damaged.id)) && !!(await get(second.id)), 'Corrupt entry manually deletable');
        await store.remove(first.id);
        assert(!(await get(first.id)) && !!(await get(second.id)), 'Delete exact ID');

        const restoreState = createStoredPlanSemanticRegressionState();
        const restoreTarget = S.create(restoreState, 'IndexedDB restore target'); ids.push(restoreTarget.id);
        await store.add(restoreTarget);
        const targetBefore = JSON.stringify(await get(restoreTarget.id));
        const currentDraft = JSON.parse(JSON.stringify(restoreState));
        currentDraft.generatedPlan = null; currentDraft.executionState = null; currentDraft.completedBarIds = [];
        currentDraft.orders[0].name = 'Active draft before restore';
        let persisted = JSON.parse(JSON.stringify(currentDraft));
        let live = JSON.parse(JSON.stringify(currentDraft));
        const restored = await S.restoreActive(restoreTarget.id, {
            isRecoveryLocked: () => false,
            readActive: () => JSON.parse(JSON.stringify(live)),
            persistActive: state => { persisted = JSON.parse(JSON.stringify(state)); return true; },
            readPersistedActive: () => JSON.parse(JSON.stringify(persisted)),
            activatePersisted: () => { live = JSON.parse(JSON.stringify(persisted)); return true; }
        });
        ids.push(restored.safetySnapshot.id);
        assert(!!(await get(restored.safetySnapshot.id)) && restored.safetySnapshot.name.startsWith('Ennen palautusta – '),
            'Real IndexedDB stores automatic safety snapshot before restore');
        assert(JSON.stringify(await get(restoreTarget.id)) === targetBefore, 'Restore keeps original target record immutable');
        assert(JSON.stringify(live.generatedPlan) === JSON.stringify(restoreState.generatedPlan) &&
            JSON.stringify(live.executionState) === JSON.stringify(restoreState.executionState), 'Restore activates canonical workState exactly');

        live = JSON.parse(JSON.stringify(currentDraft)); persisted = JSON.parse(JSON.stringify(currentDraft));
        let failedSafetyId = null, writeRejected = false;
        try {
            await S.restoreActive(restoreTarget.id, {
                isRecoveryLocked: () => false,
                readActive: () => JSON.parse(JSON.stringify(live)),
                persistActive: () => false,
                readPersistedActive: () => JSON.parse(JSON.stringify(persisted)),
                activatePersisted: () => true
            });
        } catch (error) {
            writeRejected = !error.activePersisted;
            failedSafetyId = error.safetySnapshot?.id;
            if (failedSafetyId) ids.push(failedSafetyId);
        }
        assert(writeRejected && !!failedSafetyId && !!(await get(failedSafetyId)), 'Safety snapshot remains after active-store rejection');
        assert(JSON.stringify(live) === JSON.stringify(currentDraft) && JSON.stringify(persisted) === JSON.stringify(currentDraft),
            'Active-store rejection preserves persisted and live work');
        assert(localStorage.getItem(WORK_STORAGE_KEY) === activeRaw && canonical() === activeLive && !workRecoveryLocked,
            'All real IndexedDB paths preserve active bytes/live state/recovery');
    } finally {
        for (const id of ids) await store.remove(id);
    }
    assert(JSON.stringify(await store.list()) === initial, 'Test cleanup preserves preexisting snapshots');
    return `PASS ${checks} real IndexedDB checks`;
}
