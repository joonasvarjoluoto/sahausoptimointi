const assert=require('node:assert/strict');
const {createRuntime}=require('./runtime.cjs');
const {data,read,save}=require('./inventory-study.cjs');
const {auditBars}=require('./inventory-audit.cjs');
const reference=read('search-A-1').bestValidatedResultSoFar;
const runtime=createRuntime({...data,inventory:read('scenarios').scenarios.A.inventory},{sparsePatterns:true});
const result=runtime.evaluate(reference.ids,'full',60000,true);
if(result.status==='complete'){
    assert.deepEqual(result.plan,reference.plan);assert.deepEqual(result.execution,reference.execution);
    assert.equal(result.score,reference.score);auditBars(result.plan.bars,result.score);
}
save('manual-complex',[{scenario:'A',ids:reference.ids,...result}]);
console.log(JSON.stringify({ids:reference.ids,status:result.status,seconds:result.elapsedMs/1000,materialMs:result.materialMs,schedulerMs:result.schedulerMs}));
