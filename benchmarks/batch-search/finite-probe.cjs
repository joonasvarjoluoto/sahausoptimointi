const {createRuntime}=require('./runtime.cjs');
const {data,read,save,inventory}=require('./inventory-study.cjs');
const {auditBars}=require('./inventory-audit.cjs');
const a=read('search-A-1').bestValidatedResultSoFar,base=read('scenarios').scenarios;
// A tighter, still provably sufficient production reserve for this fixed batch.
// Keep other colors available and all 100 old remnants; cap demanded variants
// exactly at a known validated executable plan's new-stock consumption.
const counts={...base.F2.stockCounts};
const used={};
for(const b of a.plan.bars){const k=b.profileType+'|'+b.color;used[k]??=0;if(b.source==='new')used[k]++;}
Object.assign(counts,used);
const stock=inventory(base.A.inventory.remnants,counts),input={...data,inventory:stock};
auditBars(a.plan.bars,a.score);
const runtime=createRuntime(input,{sparsePatterns:true}),results=[];
for(const level of ['light','full']){
    const result=runtime.evaluate(a.ids,level,60000,true);if(result.status==='complete')auditBars(result.plan.bars,result.score);
    results.push(result);console.log(JSON.stringify({level,status:result.status,score:result.score,seconds:result.elapsedMs/1000}));
}
save('finite-tight-probe',{inventory:stock,knownFeasibleWitness:a,results});
// Check failed light candidates from the finite search directly with the full
// material optimizer. Never infer impossibility from this sampling either.
const retries=[];
for(const name of ['F1','F2']){
    const failed=read(`search-${name}-1`).evaluations.filter(e=>e.level==='light'&&e.status==='not-found').slice(0,3);
    const rt=createRuntime({...data,inventory:base[name].inventory},{sparsePatterns:true});
    for(const e of failed){const result=rt.evaluate(e.ids,'full',60000,true);if(result.status==='complete')auditBars(result.plan.bars,result.score);
        retries.push({scenario:name,ids:e.ids,lightStatus:e.status,...result});save('finite-retries',retries);
        console.log(JSON.stringify({scenario:name,ids:e.ids,fullStatus:result.status,score:result.score}));}
}
save('finite-retries',retries);
