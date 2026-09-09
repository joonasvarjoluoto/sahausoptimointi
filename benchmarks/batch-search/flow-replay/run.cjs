const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRuntime } = require('../runtime.cjs');
const m = require('./model.cjs');
const configs = {
    arrival200:{mode:'arrival',trigger:200,thresholds:m.baselineThresholds},
    all:{mode:'all',trigger:200,thresholds:m.baselineThresholds},
    arrival150:{mode:'arrival',trigger:150,thresholds:m.baselineThresholds},
    arrival250:{mode:'arrival',trigger:250,thresholds:m.baselineThresholds},
    permissive:{mode:'arrival',trigger:200,thresholds:m.permissiveThresholds}
};
function run(name) {
    const config=configs[name]; assert(config,'Unknown scenario');
    const started=performance.now(), arrivals=[...m.orders], descriptions=m.describe(m.orders);
    const pieces=queue=>queue.reduce((n,o)=>n+descriptions.find(d=>d.id===o.id).pieceCount,0);
    let queue=[],live=[],batch=0;
    const records=[],batches=[],completed=[];
    const report={name,config,policy:'thresholds',dataFile:m.data.sourceFile,excelHash:m.data.sha256,
        excludedOrders:m.data.excludedOrders,sourceHashes:m.sourceHashes,settings:m.settings,node:process.version,
        arrivalOrder:m.orders.map(o=>o.id),orders:descriptions,requiredCuts:m.cutsFor(m.orders),records,batches};
    if (config.mode==='all') queue.push(...arrivals.splice(0));
    while (arrivals.length||queue.length) {
        while (arrivals.length && pieces(queue)<config.trigger) queue.push(arrivals.shift());
        // All queues in this fixed historical replay have an eligible whole-order batch.
        const inventory=m.inventoryFor(live), beforeIds=live.map(r=>r.id), beforeSummary=m.amount(live);
        console.log(JSON.stringify({scenario:name,nextBatch:batch+1,queue:queue.map(o=>o.id),pieces:pieces(queue),before:beforeSummary}));
        const {result,selection}=m.select(queue,inventory);
        assert(result.pieceCount<200 ? pieces(queue)<200 : result.pieceCount<=300||result.ids.length===1);
        const transaction=m.applyBatch(result,inventory,live,records,++batch,config.thresholds,'thresholds');
        // Paired no-remnant counterfactual holds selected orders and row order fixed.
        const noOld=createRuntime({...m.data,orders:queue,inventory:m.inventoryFor([])}).evaluate(result.ids,'full',60000,true);
        assert.equal(noOld.status,'complete','No-remnant counterfactual timed out');
        const selectedOrders=queue.filter(o=>result.ids.includes(o.id));
        assert.equal(selectedOrders.length,result.ids.length);
        for (const id of result.ids) {assert(!completed.includes(id));completed.push(id);}
        const row={batch,queueIds:queue.map(o=>o.id),queuePieces:pieces(queue),selectedIds:result.ids,pieceCount:result.pieceCount,
            selection,result,inventoryBefore:inventory,inventoryBeforeIds:beforeIds,before:beforeSummary,
            usedOld:m.amount(transaction.consumed),usedOldIds:transaction.consumed.map(r=>r.id),
            generated:m.amount(transaction.generated),generatedIds:transaction.generated.map(r=>r.id),tails:transaction.tails,
            ignored:transaction.ignored,after:m.amount(transaction.after),inventoryAfterIds:transaction.after.map(r=>r.id),
            inventoryAfter:m.inventoryFor(transaction.after),newBars:result.newBars,newLengthMm:transaction.newLength,
            cutLengthMm:transaction.cutLength,kerfMm:transaction.kerf,scrapMm:transaction.scrap,
            noRemnantCounterfactual:{newBars:noOld.newBars,newLengthMm:noOld.newLengthMm,score:noOld.score,plan:noOld.plan,execution:noOld.execution},
            savedNewBars:noOld.newBars-result.newBars,savedNewMm:noOld.newLengthMm-transaction.newLength};
        batches.push(row);live=transaction.after;queue=queue.filter(o=>!result.ids.includes(o.id));
        console.log(JSON.stringify({scenario:name,batch,selected:result.ids,newBars:row.newBars,usedOld:row.usedOld,after:row.after,seconds:selection.elapsedMs/1000}));
    }
    assert.deepEqual([...completed].sort(),m.orders.map(o=>o.id).sort());
    assert.equal(batches.reduce((n,b)=>n+b.pieceCount,0),1231);
    for (const r of records) r.unusedAtEnd=r.usedBatch===null;
    report.complete=true;report.finalLiveIds=live.map(r=>r.id);report.elapsedMs=performance.now()-started;
    assert.deepEqual(m.hashes(),m.sourceHashes,'Production changed during replay');
    fs.writeFileSync(path.join(__dirname,name+'.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({scenario:name,complete:true,batches:batch,seconds:report.elapsedMs/1000,final:m.amount(live)}));
    return report;
}
if(require.main===module)run(process.argv[2]||'arrival200');
module.exports={run,configs};
