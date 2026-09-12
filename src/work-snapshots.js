// Erillinen katseluarkisto. Mikään tämän moduulin polku ei palauta aktiivista työtä.
const WORK_SNAPSHOTS = (() => {
    const clone = value => JSON.parse(JSON.stringify(value));
    const nameOf = name => {
        if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) throw Error('Anna nimi (1–120 merkkiä).');
        return name.trim();
    };
    const presentation = state => {
        const plan = state.generatedPlan;
        if (!plan) return null;
        const execution = plan.batch === undefined ? null : createProductionExecution(plan, state.orders, Number(state.kerf));
        return {
            execution,
            physical: execution ? replayProductionExecution(state.executionState, plan, execution, Number(state.kerf)) : null,
            manifest: execution ? createWorkerSourceManifest(plan, execution) : plan.bars.map(bar =>
                ({ sourceId: bar.id, profileType: bar.profileType, workerNumber: bar.number })),
            score: scoreCompleteMaterialTransitionPlan(adaptStoredPlanForVerification(plan), PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings)
        };
    };
    function create(state, name, note = '') {
        name = nameOf(name);
        if (typeof note !== 'string' || note.length > 500) throw Error('Kommentti saa olla enintään 500 merkkiä.');
        const workState = clone(state);
        if (!isValidStoredWorkState(workState)) throw Error('Nykyinen työ ei ole kelvollinen tallennettavaksi snapshotiksi.');
        const now = new Date().toISOString();
        return clone({ snapshotVersion: 1, id: crypto.randomUUID(), name, note: note.trim(), createdAt: now, updatedAt: now,
            workState, presentation: presentation(workState) });
    }
    function valid(record) {
        try {
            if (!record || record.snapshotVersion !== 1 || typeof record.id !== 'string' || !record.id ||
                nameOf(record.name) !== record.name || typeof record.note !== 'string' || record.note.length > 500 ||
                ![record.createdAt, record.updatedAt].every(time => typeof time === 'string' && Number.isFinite(Date.parse(time))) ||
                !isValidStoredWorkState(record.workState)) return false;
            // Nykyinen validator johtaa schedulerin integrity-tarkistukseen, ei hakuun.
            // Eri scheduler/score ei saa muuttaa arkiston esitystä: se hylätään.
            return JSON.stringify(presentation(record.workState)) === JSON.stringify(record.presentation);
        } catch { return false; }
    }
    function rename(record, name) {
        if (!record || typeof record !== 'object') throw Error('Vaurioitunutta snapshotia ei voi nimetä uudelleen.');
        return { ...clone(record), name: nameOf(name), updatedAt: new Date().toISOString() };
    }
    const newest = entries => [...entries].sort((a, b) =>
        (Date.parse(b.record?.createdAt) || 0) - (Date.parse(a.record?.createdAt) || 0) || String(a.id).localeCompare(String(b.id)));

    // Ei localStorage-indeksiä: myös rikkinäinen yksittäinen record voidaan listata/poistaa omalla avaimellaan.
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('sahausoptimointi.snapshots', 1);
            let blocked = false;
            request.onupgradeneeded = () => request.result.createObjectStore('snapshots', { keyPath: 'id' });
            request.onerror = () => reject(request.error);
            request.onblocked = () => { blocked = true; reject(Error('Sulje muut sovelluksen välilehdet ja yritä uudelleen.')); };
            request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
        });
    }
    async function transaction(mode, action) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction('snapshots', mode);
            let result;
            tx.oncomplete = () => { db.close(); resolve(result); };
            tx.onabort = tx.onerror = () => { db.close(); reject(tx.error || Error('Snapshotin tallennus epäonnistui.')); };
            try { action(tx.objectStore('snapshots'), value => { result = value; }); }
            catch (error) { tx.abort(); db.close(); reject(error); }
        });
    }
    const store = {
        list: () => transaction('readonly', (objects, done) => {
            const entries = [], request = objects.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) return done(newest(entries));
                entries.push({ id: cursor.primaryKey, record: cursor.value }); cursor.continue();
            };
        }),
        add: record => transaction('readwrite', objects => objects.add(clone(record))),
        rename: (id, name) => {
            name = nameOf(name);
            return transaction('readwrite', objects => {
                const request = objects.get(id);
                request.onsuccess = () => {
                    try {
                        if (!request.result) throw Error('Snapshotia ei enää ole.');
                        objects.put(rename(request.result, name));
                    } catch { objects.transaction.abort(); }
                };
            });
        },
        remove: id => transaction('readwrite', objects => objects.delete(id))
    };

    // Vain merkkijonoesitys ja olemassa olevat formaatit/CSS-luokat; ei live-DOM:n tilapäistä vaihtoa.
    function render(record) {
        if (!valid(record)) throw Error('Snapshot on yhteensopimaton tai vaurioitunut. Sitä ei muutettu.');
        const s = record.workState, p = record.presentation, plan = s.generatedPlan;
        const e = escapeHtml, mm = formatMillimeters;
        const profile = value => e(PROFILE_TYPES[value].label);
        const color = value => e(getMaterialColorLabel(value));
        const count = orders => { try { return normalizeOrderCuts(orders).reduce((n, c) => n + c.quantity, 0); } catch { return '–'; } };
        const source = id => {
            const item = p.manifest.find(row => row.sourceId === id);
            return `${profile(item.profileType)} ${e(String(item.workerNumber))}`;
        };
        const operations = (execution, events, title) => !execution ? '' : `<section class="plan-summary"><h2>${title}</h2>
            <p>Kirjattu ${events.length} / ${execution.operations.length} työvaihetta. Sahausliikkeet ${execution.metrics.cutOperationCount};
            mittavasteen siirrot ${execution.metrics.stopPositionChanges}; nippukapasiteetin käyttö ${Math.round(execution.metrics.bundleUtilization * 100)} %.</p>
            <ol>${execution.operations.map((op, i) => `<li><strong>${i < events.length ? '✓ ' : ''}${op.kind === 'cut' ? 'Sahaus' : 'Poiminta'} ${op.number} · ${mm(op.length)}</strong>
                <p>${op.sources.map(row => `${source(row.id)}: ${mm(row.before)} → ${mm(row.after)}`).join('; ')}</p>
                <p>${op.pieces.map(piece => `${e(s.orders.find(order => order.id === piece.orderId)?.name || piece.orderId)} / ${e(piece.openingId || 'Tuntematon aukko')} · ${e(piece.pieceId)}`).join('; ')}</p>
                ${events[i] ? `<p>Toteutunut: ${events[i].actualSourceIds.map(source).join(', ')} · ${e(events[i].completedAt)}</p>` : ''}</li>`).join('')}</ol></section>`;
        let html = `<header><h2>SNAPSHOT — VAIN KATSELU</h2><h3>${e(record.name)}</h3><p>${e(new Date(record.createdAt).toLocaleString('fi-FI'))}</p><p>${e(record.note)}</p></header>
            <section class="plan-summary"><h2>Tilaukset · ${s.orders.length} · ${count(s.orders)} kpl</h2>
            ${s.orders.map(order => `<details><summary>${e(order.name || order.id)} · ${color(order.color)} · ${count([order])} kpl</summary>
                ${order.sections.filter(section => section.rows.length).map(section => `<p>${e(ORDER_PROFILE_SECTIONS.find(item => item.key === section.key).label)}</p><ul>${section.rows.map(row =>
                    `<li>${e(row.length)} mm × ${e(row.quantity)} · ${e(row.openingId || 'Tuntematon aukko')}</li>`).join('')}</ul>`).join('')}</details>`).join('')}
            <p>Raakasalko ${e(s.stockLength)} mm · kerf ${e(s.kerf)} mm</p></section>`;
        if (!plan) return html + '<p>Luonnos — ei laskettua sahaussuunnitelmaa.</p>';
        const score = p.score;
        html += `<section class="plan-summary"><h2>Alkuperäinen materiaaliplani</h2>
            <p>Batch: ${plan.batch ? plan.batch.orderIds.map(id => e(s.orders.find(o => o.id === id)?.name || id)).join(', ') : 'Koko suunnitelma'}</p>
            <p>Valitussa suunnitelmassa ${plan.bars.reduce((n, b) => n + b.groupedCuts.reduce((q, c) => q + c.quantity, 0), 0)} kappaletta.</p>
            <p>${plan.bars.length} salkoa · uudet ${plan.bars.filter(b => b.source === 'new').length} · vanhat jäännökset ${plan.bars.filter(b => b.source === 'remnant').length} · lähdepituudet yhteensä ${mm(plan.bars.reduce((n, b) => n + b.sourceLength, 0))}.</p>
            <p>Loppujäännökset: säästettävät ${plan.bars.filter(b => b.remnantStatus === 'reusable').length} kpl;
            romuksi päätyvät ${plan.bars.filter(b => b.remnantStatus === 'scrap').map(b => mm(b.remaining)).join(', ') || 'ei romupaloja'}.
            Sahahukka yhteensä ${mm(plan.bars.reduce((n, b) => n + b.waste, 0))}.</p>
            <p>Materiaalipiste ${score.totalCostEquivalent.toFixed(1)}: lähdearvo ${score.sourceValueEquivalent.toFixed(1)} − jäännöskrediitti ${score.recoveredRemnantValueEquivalent.toFixed(1)}
            − kerf-krediitti ${score.kerfRecoveredValueEquivalent.toFixed(1)} + jäännöskäsittely ${score.remnantHandlingPenaltyEquivalent.toFixed(1)}
            + uuden jäännöksen luonti ${score.newStockRemnantCreationPenaltyEquivalent.toFixed(1)} + suuri romu ${score.largeScrapPenaltyEquivalent.toFixed(1)}. Materiaalin ekvivalenttipituus, ei euroja.</p>
            <p>Salot merkitty valmiiksi ${s.completedBarIds.length} / ${plan.bars.length}.</p></section>
            <div class="bar-list">${plan.bars.map(bar => `<article class="bar-card"><h3>${source(bar.id)} · ${color(bar.color)}</h3>
                <div class="bar-cuts">${bar.groupedCuts.map(c => `<div class="bar-cut">${mm(c.length)} × ${c.quantity}</div>`).join('')}</div>
                <p>${bar.source === 'new' ? 'Uusi salko' : 'Vanha jäännös'} · ${mm(bar.sourceLength)}</p>
                <p>Jäännös ${mm(bar.remaining)} · ${e(getRemnantStatusLabel(bar.remnantStatus))} · sahahukka ${mm(bar.waste)}</p></article>`).join('')}</div>`;
        html += operations(p.execution, s.executionState?.events || [], 'Alkuperäinen sahausjärjestys');
        if (p.physical?.continuationExecution) html += operations(p.physical.continuationExecution, s.executionState.continuation.events, 'JATKOSUUNNITELMA');
        if (p.physical) html += `<details class="plan-summary"><summary>Toteutuneet fyysiset saldot</summary><ul>${p.physical.bars.map(bar =>
            `<li>${source(bar.id)} · nimellinen ${mm(bar.nominalRemaining)} · turvallinen ${mm(bar.remaining)} · sahahukka ${mm(bar.waste)}</li>`).join('')}</ul></details>`;
        return html;
    }
    return Object.freeze({ create, valid, rename, newest, store, render });
})();

let snapshotBusy = false;
let snapshotEntries = [];
let snapshotEditingId = null;
function snapshotStatus(message) { document.getElementById('snapshotStatus').textContent = message; }
async function refreshSnapshotList() {
    const list = document.getElementById('snapshotList');
    try {
        snapshotEntries = await WORK_SNAPSHOTS.store.list();
        list.replaceChildren();
        if (!snapshotEntries.length) list.textContent = 'Ei tallennettuja snapshotteja.';
        for (const entry of snapshotEntries) {
            const row = document.createElement('article');
            const text = document.createElement('p');
            const record = entry.record, readable = record?.id === entry.id && WORK_SNAPSHOTS.valid(record);
            text.textContent = `${typeof record?.name === 'string' ? record.name : 'Vaurioitunut snapshot'} · ${record?.createdAt ? new Date(record.createdAt).toLocaleString('fi-FI') : 'Tuntematon aika'} · ${readable ? record.workState.orders.length + ' tilausta' + (record.workState.generatedPlan ? ' · laskettu suunnitelma' : ' · luonnos') : 'Ei voida avata: yhteensopimaton tai vaurioitunut'}`;
            row.append(text);
            for (const [label, action, disabled] of [
                ['AVAA', () => openWorkSnapshot(entry.id), !readable],
                ['NIMEÄ UUDELLEEN', () => showSnapshotEditor(entry.id), false],
                ['POISTA', () => deleteWorkSnapshot(entry.id), false]
            ]) {
                const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
                button.disabled = disabled; button.addEventListener('click', action); row.append(button);
            }
            list.append(row);
        }
    } catch { snapshotStatus('Snapshot-listaa ei voitu lukea. Aktiivinen työ säilyy ennallaan.'); }
}
function showSnapshotEditor(id = null) {
    if (snapshotBusy) return;
    snapshotEditingId = id;
    document.getElementById('snapshotEditorStatus').textContent = '';
    document.getElementById('snapshotName').value = id === null ? '' : snapshotEntries.find(entry => entry.id === id)?.record?.name || '';
    document.getElementById('snapshotNote').value = '';
    document.getElementById('snapshotNoteField').hidden = id !== null;
    document.getElementById('snapshotEditorTitle').textContent = id === null ? 'Tallenna snapshot' : 'Nimeä snapshot uudelleen';
    document.getElementById('snapshotEditor').showModal();
}
async function submitWorkSnapshot(event) {
    event.preventDefault();
    if (snapshotBusy) return;
    snapshotBusy = true;
    const button = document.getElementById('snapshotSubmit'); button.disabled = true;
    try {
        const name = document.getElementById('snapshotName').value;
        if (snapshotEditingId === null) {
            if (workRecoveryLocked) throw Error('Palautuslukittua työtä ei voi tallentaa snapshotiksi.');
            const record = WORK_SNAPSHOTS.create(createWorkStateSnapshot(), name, document.getElementById('snapshotNote').value);
            await WORK_SNAPSHOTS.store.add(record);
        } else await WORK_SNAPSHOTS.store.rename(snapshotEditingId, name);
        document.getElementById('snapshotEditor').close();
        snapshotStatus('Snapshot tallennettu.');
        await refreshSnapshotList();
    } catch (error) {
        document.getElementById('snapshotEditorStatus').textContent = `Snapshotia ei tallennettu: ${error.message || 'Tallennustila ei ole käytettävissä.'} Aktiivinen työ ja aiemmat snapshotit säilyvät.`;
    } finally { snapshotBusy = false; button.disabled = false; }
}
async function openWorkSnapshot(id) {
    try {
        const entry = (await WORK_SNAPSHOTS.store.list()).find(entry => entry.id === id);
        if (!entry || entry.record?.id !== id) throw Error('Snapshotia ei voi avata.');
        const html = WORK_SNAPSHOTS.render(entry.record);
        document.getElementById('snapshotContent').innerHTML = html;
        document.getElementById('snapshotViewer').showModal();
    } catch { snapshotStatus('Snapshotia ei voi avata: se on yhteensopimaton tai vaurioitunut. Tallenne säilytettiin.'); }
}
let snapshotDeletingId = null;
function deleteWorkSnapshot(id) {
    const record = snapshotEntries.find(entry => entry.id === id)?.record;
    snapshotDeletingId = id;
    document.getElementById('snapshotDeleteStatus').textContent = '';
    document.getElementById('snapshotDeleteName').textContent = record?.name || 'Vaurioitunut snapshot';
    document.getElementById('snapshotDelete').showModal();
}
async function confirmDeleteWorkSnapshot() {
    const button = document.getElementById('snapshotDeleteConfirm');
    if (button.disabled) return;
    button.disabled = true;
    try {
        await WORK_SNAPSHOTS.store.remove(snapshotDeletingId);
        document.getElementById('snapshotDelete').close();
        snapshotStatus('Snapshot poistettu.'); await refreshSnapshotList();
    }
    catch { document.getElementById('snapshotDeleteStatus').textContent = 'Snapshotia ei voitu poistaa. Aktiivinen työ säilyy ennallaan.'; }
    finally { button.disabled = false; }
}
if (typeof document !== 'undefined' && document.getElementById('snapshotList')?.replaceChildren) {
    document.getElementById('snapshotForm').addEventListener('submit', submitWorkSnapshot);
    refreshSnapshotList();
}
