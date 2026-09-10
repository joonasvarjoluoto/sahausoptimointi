const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {data,directory,read,save,random}=require('./inventory-study.cjs');
const {sourceHashes}=require('./runtime.cjs');
const root=path.resolve(__dirname,'../..'),scenarios=read('scenarios');
assert.deepEqual(sourceHashes,scenarios.sourceHashes,'Production sources changed during the study');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const file of fs.readdirSync(directory)){
    const match=file.match(/^search-(A|B|C|F1|F2)-(\d+)(-dense)?\.json$/);if(!match)continue;
    const report=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8')),seed=Number(match[2]);
    const orders=data.orders.map(o=>o.id);
    if(seed!==1){const rng=random(seed);for(let i=orders.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[orders[i],orders[j]]=[orders[j],orders[i]];}}
    Object.assign(report,{inputOrderIds:orders,permutationSeed:seed,searchSeed:230916,
        normalizedFixtureSHA256:hash(fs.readFileSync(path.join(__dirname,'orders-23.json'))),
        inventorySHA256:hash(JSON.stringify(scenarios.scenarios[match[1]].inventory))});
    fs.writeFileSync(path.join(directory,file),JSON.stringify(report,null,2));
}
const syntaxFiles=['app.js','src/cutting-physics.js', 'src/material.js','src/production-planning.js','src/production-integration.js','production-regressions.js','run-regressions.cjs','run-production-ui-regressions.cjs',
    ...fs.readdirSync(__dirname).filter(f=>f.endsWith('.cjs')).map(f=>'benchmarks/batch-search/'+f)];
for(const file of syntaxFiles){const r=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,file+'\n'+r.stderr);}
const diff=spawnSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),'diff','--check'],{cwd:root,encoding:'utf8'});
fs.writeFileSync(path.join(directory,'diff-check.log'),(diff.stdout||'')+(diff.stderr||''));assert.equal(diff.status,0);
const log=name=>fs.readFileSync(path.join(directory,name),'utf8');
function groupCount(name){const m=log(name).match(/Regressioryhmät: (\d+)\/(\d+) läpäisty/);assert(m);assert.equal(m[1],m[2]);return Number(m[1]);}
const core=groupCount('core-regressions.log'),sparse=groupCount('sparse-regressions.log');assert.equal(core,sparse);
const ui=log('production-ui-regressions.log').match(/Tuotannon ohjaus-\/persistenssitestit: (\d+) läpäisty/);
const research=log('research-regressions.log').match(/Research checks: (\d+) passed/);assert(ui);assert(research);
save('validation',{status:'PASS',coreGroups:core,sparseCoreGroups:sparse,productionUiChecks:Number(ui[1]),researchChecks:Number(research[1]),
    orderedPatternComparisons:read('sparse-validation').orderedPatternComparisons,planAudit:read('audit'),syntaxFiles:syntaxFiles.length,
    productionSourceHashesUnchanged:true,diffCheck:true,browserTestPerformed:false});
console.log(JSON.stringify(read('validation'),null,2));
