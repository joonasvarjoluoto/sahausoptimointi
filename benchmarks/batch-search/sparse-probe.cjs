const assert=require('node:assert/strict');
const {createRuntime}=require('./runtime.cjs');
const {data,read,save,random}=require('./inventory-study.cjs');
const {auditBars}=require('./inventory-audit.cjs');
const dense=createRuntime(data),sparse=createRuntime(data,{sparsePatterns:true}),rng=random(990823);
let comparisons=0;
for(let sample=0;sample<150;sample++){
    const length=sample<50?6000:Math.round((20+rng()*250)*10)/10;
    const items=Array.from({length:1+Math.floor(rng()*5)},()=>({length:Math.round((.1+rng()*length)*10)/10,quantity:1+Math.floor(rng()*8)}));
    for(const kerf of [0,3,3.4])for(const limit of [1,2,10]){
        assert.deepEqual(sparse.patterns(items,length,kerf,limit),dense.patterns(items,length,kerf,limit));comparisons++;
    }
}
for(const [length,items,kerf] of [[6000,[{length:6000,quantity:1}],3],[6000,[{length:2998.5,quantity:2}],3],[10,[{length:.1,quantity:100}],0],[6000,[{length:2200,quantity:2},{length:2200,quantity:2}],3]]){
    assert.deepEqual(sparse.patterns(items,length,kerf,10),dense.patterns(items,length,kerf,10));comparisons++;
}
console.log(`PASS ${comparisons} exact ordered pattern comparisons`);
const scenarios=read('scenarios').scenarios,results=[];
for(const reference of read('manual')){
    const runtime=createRuntime({...data,...(reference.scenario==='none'?{}:{inventory:scenarios[reference.scenario].inventory})},{sparsePatterns:true});
    const result=runtime.evaluate(reference.ids,'full',60000,true);
    if(reference.status==='complete'){
        assert.equal(result.status,'complete');assert.equal(result.score,reference.score);
        assert.deepEqual(result.plan,reference.plan);assert.deepEqual(result.execution,reference.execution);
    }
    else {
        const cached=read('pattern-cache').find(r=>r.scenario===reference.scenario&&JSON.stringify(r.ids)===JSON.stringify(reference.ids));
        if(cached?.status==='complete'){assert.deepEqual(result.plan,cached.plan);assert.deepEqual(result.execution,cached.execution);assert.equal(result.score,cached.score);}
    }
    if(result.status==='complete')auditBars(result.plan.bars,result.score);
    results.push({scenario:reference.scenario,referenceStatus:reference.status,referenceMs:reference.elapsedMs,
        exactPlanMatch:reference.status==='complete',...result});
    save('sparse-plans',results);
    console.log(JSON.stringify({scenario:reference.scenario,ids:reference.ids,status:result.status,seconds:result.elapsedMs/1000,baselineSeconds:reference.elapsedMs/1000}));
}
save('sparse-validation',{orderedPatternComparisons:comparisons,manualComparisons:results.filter(r=>r.exactPlanMatch).length,newlyCompleted:results.filter(r=>r.referenceStatus==='timeout'&&r.status==='complete').length,status:'PASS'});
