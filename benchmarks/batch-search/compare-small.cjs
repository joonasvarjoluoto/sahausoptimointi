const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRuntime,sourceHashes}=require('./runtime.cjs');
const {runSearch}=require('./search.cjs');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'orders-23.json'),'utf8'));
const scenarios=[{ids:[1,2,3,4],min:100,target:130,max:160},
    {ids:[10,11,15,19,21],min:70,target:85,max:100},
    {ids:[3,5,18,20,24],min:90,target:110,max:130}];
const report={sourceHashes,node:process.version,dataHash:data.sha256,scenarios:[]};
for(const scenario of scenarios){
    const subset={...data,orders:data.orders.filter(o=>scenario.ids.includes(Number(o.id.slice(6))))};
    const limits={min:scenario.min,target:scenario.target,max:scenario.max};
    const runtime=createRuntime(subset),description=runtime.describe(),evaluations=[];
    const ctx=vm.createContext({orders:description.orders,evaluate:orders=>{
        const result=runtime.evaluate(orders.map(o=>o.id),'full',60000);evaluations.push(result);
        if(result.status!=='complete')throw new Error('Exhaustive reference failed: '+result.status);
        return {complete:true,materialScore:result.score,detail:result};
    }});
    new vm.Script(fs.readFileSync(path.resolve(__dirname,'../../src/production-planning.js'),'utf8')).runInContext(ctx);
    const start=performance.now();
    const exhaustive=vm.runInContext(`PRODUCTION_PLANNING.selectBatch(orders,evaluate,{minBatchPieces:${limits.min},targetBatchPieces:${limits.target},maxBatchPieces:${limits.max}})`,ctx);
    const exhaustiveMs=performance.now()-start;
    // Small comparison uses an explicit work budget, so pruning cost is reproducible without timing luck.
    const research=runSearch(subset,{limits,maxSeconds:120,maxEvaluations:8,cache:false,checkpoints:[10,30,60,120]});
    const entry={scenario,exhaustiveMs,evaluatedCandidates:exhaustive.evaluatedCount,exhaustive:exhaustive.detail,
        researchMs:research.usedSearchSeconds*1000,research:research.best,uniqueCandidates:research.finalSnapshot.uniqueCandidates,
        lightCompleted:research.finalSnapshot.lightCompleted,fullCompleted:research.finalSnapshot.fullCompleted,
        scoreDifference:research.best.score-exhaustive.materialScore,scoreDifferencePercent:100*(research.best.score/exhaustive.materialScore-1),
        sameOrders:JSON.stringify([...research.best.ids].sort())===JSON.stringify(exhaustive.orders.map(o=>o.id).sort())};
    report.scenarios.push(entry);fs.writeFileSync(path.join(__dirname,'small-results.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify({ids:scenario.ids,exhaustiveSeconds:exhaustiveMs/1000,researchSeconds:research.usedSearchSeconds,
        candidates:entry.evaluatedCandidates,scoreDifferencePercent:entry.scoreDifferencePercent,sameOrders:entry.sameOrders}));
}
