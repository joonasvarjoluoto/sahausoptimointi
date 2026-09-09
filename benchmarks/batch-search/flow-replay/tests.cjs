const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const m=require('./model.cjs');
const {cutPiece,millimetersToDpUnits:units}=require('../../../src/cutting-physics.js');
const {auditBars,auditAvailability,auditProvenance}=require('../inventory-audit.cjs');
let checks=0;
const check=(label,fn)=>{fn();checks++;console.log('PASS '+label);};
check('Historical IDs, exclusions and demand',()=>{
    assert.deepEqual(m.orders.map(o=>Number(o.id.slice(6))),Array.from({length:24},(_,i)=>24-i).filter(i=>i!==16));
    assert.equal(m.cutsFor(m.orders).reduce((n,c)=>n+c.quantity,0),1231);
    assert.deepEqual(m.data.excludedOrders,[16]);
});
check('Physical thresholds do not change score disposition',()=>{
    for(const [p,t] of Object.entries(m.baselineThresholds)){
        assert(!m.shouldStore(t-.1,p,'reusable',m.baselineThresholds,'thresholds'));
        assert(m.shouldStore(t,p,'scrap',m.baselineThresholds,'thresholds'));
        assert(!m.shouldStore(t,p,'scrap',m.baselineThresholds,'both'));
    }
    assert.equal(m.core('evaluateRemnantDisposition(500,PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings)').disposition,'scrap');
    assert(m.shouldStore(500,'horizontalProfile','scrap',m.baselineThresholds,'thresholds'));
});
check('Duplicate lengths aggregate without mixing variant identity',()=>{
    const rows=[{id:'a',profileType:'topRail',color:'black',length:1200},{id:'b',profileType:'topRail',color:'black',length:1200},
        {id:'c',profileType:'bottomRail',color:'black',length:1200},{id:'d',profileType:'topRail',color:'gray',length:1200}];
    const before=JSON.stringify(rows),inv=m.inventoryFor(rows);
    assert.equal(inv.remnants.length,3);assert.equal(inv.remnants.reduce((n,r)=>n+r.quantity,0),4);
    assert.equal(JSON.stringify(rows),before);
    assert(cutPiece(1200,1200,3).possible);
});
const outputNames=['arrival200','all','arrival150','arrival250','permissive'];
const existingOutputs=outputNames.filter(name=>fs.existsSync(path.join(__dirname,name+'.json')));
check('Replay outputs are either absent or form a complete set',()=>assert(existingOutputs.length===0||existingOutputs.length===outputNames.length));
for(const name of existingOutputs){
    const file=path.join(__dirname,name+'.json');
    const d=JSON.parse(fs.readFileSync(file,'utf8'));assert(d.complete,'Incomplete scenario '+name);
    check(name+': sources, full plans, physics, score, traceability and balances',()=>{
        assert.deepEqual(d.sourceHashes,m.hashes());assert.deepEqual(d.settings,m.settings);
        const ids=new Set(d.records.map(r=>r.id));assert.equal(ids.size,d.records.length);
        let previous=[],done=[];
        for(const b of d.batches){
            assert.deepEqual(b.inventoryBeforeIds,previous);
            auditBars(b.result.plan.bars,b.result.score);auditAvailability(b.result.plan.bars,b.inventoryBefore);auditProvenance(b.result);
            auditBars(b.noRemnantCounterfactual.plan.bars,b.noRemnantCounterfactual.score);
            auditAvailability(b.noRemnantCounterfactual.plan.bars,m.inventoryFor([]));
            auditProvenance({...b.result,...b.noRemnantCounterfactual});
            assert.deepEqual(b.result.ids,b.selectedIds);
            assert(b.pieceCount<200?b.queuePieces<200:b.pieceCount<=300||b.selectedIds.length===1);
            const live=b.inventoryBeforeIds.map(id=>d.records.find(r=>r.id===id));
            assert.deepEqual(m.inventoryFor(live),b.inventoryBefore);
            const used=b.usedOldIds.map(id=>d.records.find(r=>r.id===id));
            assert.equal(new Set(b.usedOldIds).size,b.usedOldIds.length);
            for(const r of used){assert(live.includes(r));assert.equal(r.usedBatch,b.batch);assert.equal(r.ageBatches,b.batch-r.bornBatch);assert(r.ageBatches>=1);}
            for(const id of b.generatedIds){const r=d.records.find(r=>r.id===id);assert.equal(r.bornBatch,b.batch);
                if(r.parentId){const p=d.records.find(v=>v.id===r.parentId);assert.equal(p.childId,id);assert.equal(p.usedBatch,b.batch);assert.equal(p.rootId,r.rootId);}}
            const after=b.inventoryAfterIds.map(id=>d.records.find(r=>r.id===id));
            assert.deepEqual(b.inventoryAfter,m.inventoryFor(after));
            assert.equal(units(b.before.mm+b.newLengthMm),units(b.cutLengthMm+b.kerfMm+b.scrapMm+b.after.mm));
            const coreAfter=m.core('calculatePostOrderMaterialInventory(payload.plan,payload.inventory,PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings)',{plan:b.result.plan,inventory:b.inventoryBefore});
            const unused=live.filter(r=>!b.usedOldIds.includes(r.id));
            assert.deepEqual(coreAfter.remnants,m.inventoryFor([...unused,...b.tails.filter(t=>t.scoreDisposition==='reusable')]).remnants);
            for(const t of b.tails)assert.equal(t.physicalDisposition==='stored',m.shouldStore(t.length,t.profileType,t.scoreDisposition,d.config.thresholds,d.policy));
            if(d.config.mode==='arrival'){
                const newest=Math.max(...b.queueIds.map(id=>d.arrivalOrder.indexOf(id)));
                assert(b.queueIds.every(id=>!done.includes(id)));
                assert(b.queueIds.every(id=>d.arrivalOrder.indexOf(id)<=newest));
                const arrived=d.arrivalOrder.slice(0,newest+1).filter(id=>!done.includes(id));assert.deepEqual(b.queueIds,arrived);
            }
            done.push(...b.selectedIds);previous=b.inventoryAfterIds;
        }
        assert.equal(new Set(done).size,23);assert.deepEqual([...done].sort(),[...d.arrivalOrder].sort());
        assert.equal(d.batches.reduce((n,b)=>n+b.pieceCount,0),1231);
        assert.deepEqual(d.finalLiveIds,previous);
        for(const r of d.records)assert.equal(r.unusedAtEnd,d.finalLiveIds.includes(r.id));
    });
}
if(existingOutputs.length)check('Permissive policy preserves all six executed plans, scores and operations',()=>{
    const a=JSON.parse(fs.readFileSync(path.join(__dirname,'arrival200.json'),'utf8'));
    const b=JSON.parse(fs.readFileSync(path.join(__dirname,'permissive.json'),'utf8'));
    assert.equal(a.batches.length,b.batches.length);
    for(let i=0;i<a.batches.length;i++)for(const field of ['ids','plan','execution','score'])assert.deepEqual(a.batches[i].result[field],b.batches[i].result[field]);
    const extra=b.records.filter(r=>r.length<m.baselineThresholds[r.profileType]);
    assert.equal(extra.length,66);
    const cuts=m.cutsFor(m.orders);
    for(const r of extra){assert.equal(r.usedBatch,null);assert(!cuts.some(c=>c.profileType===r.profileType&&c.color===r.color&&cutPiece(r.length,c.length,3).possible));}
});
check('Production files unchanged',()=>assert.deepEqual(m.hashes(),m.sourceHashes));
console.log(checks+' research checks passed');
