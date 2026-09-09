const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {createRuntime,sourceHashes}=require('./runtime.cjs');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'orders-23.json'),'utf8'));
const subsets=[[1,2,3],[1,2,3,4],[1,2,3]].map(ids=>ids.map(n=>'excel-'+n));
const report={sourceHashes,sequences:[]};
let reference;
for(const cache of [false,true]){
    const runtime=createRuntime(data,{cache}),results=[];
    for(const ids of subsets)results.push(runtime.evaluate(ids,'full',60000,true));
    if(!cache)reference=results;
    else results.forEach((result,i)=>{
        assert.equal(result.status,'complete');assert.deepEqual(result.plan,reference[i].plan);
        assert.deepEqual(result.execution,reference[i].execution);assert.deepEqual(result.scoreComponents,reference[i].scoreComponents);
    });
    const entries=results.map(({plan,execution,...summary})=>summary);
    report.sequences.push({cache,totalMs:entries.reduce((n,r)=>n+r.elapsedMs,0),results:entries});
    fs.writeFileSync(path.join(__dirname,'cache-results.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({cache,totalMs:report.sequences.at(-1).totalMs,cacheStats:entries.at(-1).cache}));
}
