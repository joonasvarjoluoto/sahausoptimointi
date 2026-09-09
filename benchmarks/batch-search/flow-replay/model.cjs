const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../..');
const { cutPiece, millimetersToDpUnits: units } = require('../../../src/cutting-physics.js');
const { createRuntime } = require('../runtime.cjs');
const { enumerateCandidates, runSearch } = require('../search.cjs');
const { auditBars, auditAvailability, auditProvenance } = require('../inventory-audit.cjs');
const sourceFiles = ['app.js','src/cutting-physics.js','src/production-planning.js','src/production-integration.js','index.html','style.css'];
const hashes = () => Object.fromEntries(sourceFiles.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')]));
const sourceHashes = hashes();
const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../orders-23.json'), 'utf8'));
// Reverse only the order arrival list; preserve all measurement rows inside orders.
const orders = [...data.orders].sort((a,b) => Number(b.id.slice(6))-Number(a.id.slice(6)));
const ctx = vm.createContext({ console: {log(){},table(){},warn(){},error(){}} });
for (const f of ['src/cutting-physics.js','src/production-planning.js','src/production-integration.js','app.js']) {
    new vm.Script(fs.readFileSync(path.join(root,f),'utf8'),{filename:f}).runInContext(ctx);
}
function core(expression, payload) {
    ctx.payload = payload;
    return JSON.parse(vm.runInContext('JSON.stringify('+expression+')', ctx, {timeout:60000}));
}
const settings = core('PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS');
const baselineThresholds = {uProfile:1000,verticalProfile:1000,closingProfile:1000,horizontalProfile:500,topRail:800,bottomRail:800};
const permissiveThresholds = {uProfile:500,verticalProfile:500,closingProfile:500,horizontalProfile:300,topRail:400,bottomRail:400};
const cutsFor = list => core('normalizeOrderCuts(payload.map(o=>createOrderInput(o.id,o.name,o.color,o.sections)))',list);
const describe = list => createRuntime({...data,orders:list}).describe().orders;
const amount = list => ({count:list.length,mm:list.reduce((n,r)=>n+r.length,0)});
const key = r => JSON.stringify([r.profileType,r.color,units(r.length)]);
const shouldStore = (length, profileType, scoreDisposition, thresholds, policy) =>
    length > 0 && length >= thresholds[profileType] && (policy==='thresholds' || scoreDisposition==='reusable');
function aggregate(list) {
    const groups = new Map();
    for (const r of list) {
        const k = key(r), old = groups.get(k);
        if (old) old.quantity++; else groups.set(k,{profileType:r.profileType,color:r.color,length:r.length,quantity:1});
    }
    return [...groups.values()].sort((a,b)=>a.profileType.localeCompare(b.profileType)||JSON.stringify(a.color).localeCompare(JSON.stringify(b.color))||b.length-a.length);
}
function inventoryFor(live) {
    return core('createMaterialInventory(payload)', {stockLength:data.stockLength,
        newStock:Object.keys(baselineThresholds).flatMap(profileType=>['gray','black','white'].map(color=>({profileType,color,unlimited:true,quantity:null}))),
        remnants:aggregate(live)});
}
function select(queue, inventory) {
    const input = {...data, orders:queue, inventory};
    const runtime = createRuntime(input,{cache:true});
    const candidates = enumerateCandidates(runtime.describe().orders);
    const start = performance.now();
    let result, selection;
    if (candidates.length <= 12) {
        // Use the actual production selector for small queues, with normal material settings.
        ctx.selectionOrders = runtime.describe().orders;
        ctx.evaluateBatch = selected => {
            const remaining = 60000-(performance.now()-start);
            assert(remaining>0,'Small-queue selection exceeded 60 s');
            const evaluated = runtime.evaluate(selected.map(o=>o.id),'full',remaining,true);
            assert.equal(evaluated.status,'complete','Normal material solve failed or timed out');
            return {complete:true,materialScore:evaluated.score,result:evaluated};
        };
        const selected = JSON.parse(vm.runInContext('JSON.stringify(PRODUCTION_PLANNING.selectBatch(selectionOrders,evaluateBatch))',ctx,{timeout:65000}));
        assert(selected.complete);
        result = selected.result;
        selection = {method:'production-exhaustive',candidateCount:candidates.length,evaluations:selected.evaluatedCount,capSeconds:60};
    } else {
        const search = runSearch(input,{runtime,cache:true,maxSeconds:10,maxEvaluations:40,seed:230916,checkpoints:[]});
        assert(search.best, 'Anytime budget produced no complete candidate');
        // Only batch IDs come from the two-stage search. The executed solution is always full production.
        result = createRuntime(input).evaluate(search.best.ids,'full',60000,true);
        assert.equal(result.status,'complete','Selected batch normal solve failed or timed out');
        selection = {method:'existing-two-stage-then-full',candidateCount:candidates.length,capSeconds:10,maxEvaluations:40,
            normalSolveCapSeconds:60,seed:230916,stopReason:search.stopReason,searchSeconds:search.usedSearchSeconds,
            winnerSearchLevel:search.best.level,winnerSearchScore:search.best.score,evaluations:search.evaluations.map(e=>({ids:e.ids,level:e.level,status:e.status,score:e.score}))};
    }
    selection.elapsedMs = performance.now()-start;
    return {result,selection};
}
function applyBatch(result, inventory, live, records, batch, thresholds, policy) {
    auditBars(result.plan.bars,result.score);
    auditAvailability(result.plan.bars,inventory);
    auditProvenance(result);
    const authoritative = core('calculatePostOrderMaterialInventory(payload.plan,payload.inventory,PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings)',{plan:result.plan,inventory});
    const unused = [...live], consumed = [], generated = [], tails = [];
    for (const bar of result.plan.bars) {
        let parent = null;
        if (bar.source==='remnant') {
            const i = unused.findIndex(r=>key(r)===key({...bar,length:bar.sourceLength}));
            assert(i>=0,'Remnant double use or missing source');
            parent = unused.splice(i,1)[0];
            parent.usedBatch=batch; parent.ageBatches=batch-parent.bornBatch;
            parent.cutLengthMm=bar.groupedCuts.reduce((n,c)=>n+c.length*c.quantity,0);
            parent.kerfMm=bar.waste; parent.tailMm=bar.remaining; parent.usedSourceMm=bar.sourceLength;
            consumed.push(parent);
        }
        if (!bar.remaining) continue;
        const accepted = shouldStore(bar.remaining,bar.profileType,bar.remnantStatus,thresholds,policy);
        const tail={barId:bar.id,parentId:parent?.id||null,profileType:bar.profileType,color:bar.color,length:bar.remaining,
            scoreDisposition:bar.remnantStatus,physicalDisposition:accepted?'stored':'scrap',threshold:thresholds[bar.profileType]};
        tails.push(tail);
        if (accepted) {
            const record={id:'r'+(records.length+1),parentId:parent?.id||null,rootId:parent?.rootId||('r'+(records.length+1)),
                bornBatch:batch,originBar:bar.id,originSource:bar.source,profileType:bar.profileType,color:bar.color,
                length:bar.remaining,usedBatch:null,ageBatches:null,childId:null,scoreDisposition:bar.remnantStatus};
            records.push(record); generated.push(record); tail.id=record.id;
            if (parent) parent.childId=record.id;
        }
    }
    // Reconcile the authoritative update with explicitly recorded physical-policy differences.
    const authoritativeRows = inventoryFor([...unused,...tails.filter(t=>t.scoreDisposition==='reusable')]).remnants;
    assert.deepEqual(authoritative.remnants,authoritativeRows);
    const after=[...unused,...generated];
    const newLength=result.plan.bars.filter(b=>b.source==='new').reduce((n,b)=>n+b.sourceLength,0);
    const cutLength=result.plan.bars.reduce((n,b)=>n+b.groupedCuts.reduce((s,c)=>s+c.length*c.quantity,0),0);
    const kerf=result.plan.bars.reduce((n,b)=>n+b.waste,0);
    const scrap=tails.filter(t=>t.physicalDisposition==='scrap').reduce((n,t)=>n+t.length,0);
    assert.equal(units(amount(live).mm+newLength),units(cutLength+kerf+scrap+amount(after).mm),'Full material mass balance');
    const batchCuts=cutsFor(orders.filter(o=>result.ids.includes(o.id)));
    const ignored=unused.map(r=>({id:r.id,ageBatches:batch-r.bornBatch,profileType:r.profileType,color:r.color,length:r.length,
        compatibleDemand:batchCuts.some(c=>c.profileType===r.profileType&&c.color===r.color),
        fitsDemand:batchCuts.some(c=>c.profileType===r.profileType&&c.color===r.color&&cutPiece(r.length,c.length,data.kerf).possible)}));
    return {after,consumed,generated,tails,ignored,newLength,cutLength,kerf,scrap};
}
module.exports={root,data,orders,ctx,core,settings,sourceHashes,hashes,baselineThresholds,permissiveThresholds,cutsFor,describe,amount,key,aggregate,inventoryFor,select,applyBatch,shouldStore};
