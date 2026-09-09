const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const jobs={
    core:['run-regressions.cjs','core-regressions.log'],
    sparse:['benchmarks/batch-search/run-sparse-regressions.cjs','sparse-regressions.log'],
    ui:['run-production-ui-regressions.cjs','production-ui-regressions.log'],
    research:['benchmarks/batch-search/tests.cjs','research-regressions.log'],
    audit:['benchmarks/batch-search/inventory-audit.cjs','audit.log']
};
const targets=process.argv.length>2?process.argv.slice(2):Object.keys(jobs);
let failed=false;
for(const target of targets){
    if(!jobs[target])throw new Error('Unknown validation target: '+target);
    const [script,log]=jobs[target],result=spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024});
    const output=(result.stdout||'')+(result.stderr||'')+(result.error?String(result.error):'');
    fs.writeFileSync(path.join(__dirname,'inventory-study',log),output);
    console.log(target+': exit '+result.status+'\n'+output.trim().split('\n').slice(-4).join('\n'));
    if(result.status!==0)failed=true;
}
process.exitCode=failed?1:0;
