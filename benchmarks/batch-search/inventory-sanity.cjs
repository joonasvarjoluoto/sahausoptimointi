const assert=require('node:assert/strict');
const {createRuntime}=require('./runtime.cjs');
const {data,read,save}=require('./inventory-study.cjs');
const {auditBars}=require('./inventory-audit.cjs');
const comparisons=[];
const manual=read('manual');
for(const numbers of [[3,9,21],[1,2],[1,2,3],[8,12,15,17,20]]){
    const ids=numbers.map(n=>'excel-'+n),runtime=createRuntime(data,{sparsePatterns:true});
    const light=runtime.evaluate(ids,'light',60000,true);
    const full=manual.find(r=>r.scenario==='none'&&JSON.stringify(r.ids)===JSON.stringify(ids))||runtime.evaluate(ids,'full',60000,true);
    assert.equal(light.status,'complete');assert.equal(full.status,'complete');
    auditBars(light.plan.bars,light.score);auditBars(full.plan.bars,full.score);
    comparisons.push({scenario:'none',ids,light,full,scoreImprovesWithMoreNewBars:full.score<light.score&&full.newBars>light.newBars,
        scoreChange:full.score-light.score,newBarsChange:full.newBars-light.newBars});
    console.log(JSON.stringify({ids,scoreChange:full.score-light.score,newBarsChange:full.newBars-light.newBars}));
}
for(const scenario of ['A','B','C']){
    const report=read(`search-${scenario}-1`);
    for(let i=0;i<report.improvementPlans.length;i++)for(let j=i+1;j<report.improvementPlans.length;j++){
        const light=report.improvementPlans[i].result,full=report.improvementPlans[j].result;
        if(report.improvements[i].level!=='light'||report.improvements[j].level!=='full'||JSON.stringify(light.ids)!==JSON.stringify(full.ids))continue;
        if(full.score>=light.score||full.newBars<=light.newBars)continue;
        auditBars(light.plan.bars,light.score);auditBars(full.plan.bars,full.score);
        comparisons.push({scenario,ids:light.ids,light,full,scoreImprovesWithMoreNewBars:true,scoreChange:full.score-light.score,newBarsChange:full.newBars-light.newBars});
    }
}
save('sanity',comparisons);
