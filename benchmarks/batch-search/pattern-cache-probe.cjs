const assert=require('node:assert/strict');
const {createRuntime}=require('./runtime.cjs');
const {data,read,save}=require('./inventory-study.cjs');
const {auditBars}=require('./inventory-audit.cjs');
const scenarios=read('scenarios').scenarios,manual=read('manual'),results=[];
for(const reference of manual.filter(r=>['A','B','C'].includes(r.scenario))){
    const runtime=createRuntime({...data,inventory:scenarios[reference.scenario].inventory},{patternCache:true});
    const result=runtime.evaluate(reference.ids,'full',60000,true);
    if(reference.status==='complete'){
        assert.equal(result.status,'complete');assert.equal(result.score,reference.score);
        assert.deepEqual(result.plan,reference.plan);assert.deepEqual(result.execution,reference.execution);
    }
    if(result.status==='complete')auditBars(result.plan.bars,result.score);
    results.push({scenario:reference.scenario,referenceStatus:reference.status,referenceMs:reference.elapsedMs,
        exactPlanMatch:reference.status==='complete',...result,patternStats:runtime.patternStats()});
    save('pattern-cache',results);
    console.log(JSON.stringify({scenario:reference.scenario,ids:reference.ids,status:result.status,seconds:result.elapsedMs/1000,baselineSeconds:reference.elapsedMs/1000,stats:runtime.patternStats()}));
}
const runtime=createRuntime({...data,inventory:scenarios.A.inventory},{profile:true});
const result=runtime.evaluate(['excel-1','excel-2'],'full',60000);
save('pattern-profile',{...result,patternStats:runtime.patternStats()});
console.log(JSON.stringify({profileSeconds:result.elapsedMs/1000,stats:runtime.patternStats()}));
