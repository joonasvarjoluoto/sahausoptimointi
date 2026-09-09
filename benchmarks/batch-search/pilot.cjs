const fs = require('node:fs');
const path = require('node:path');
const { createRuntime, sourceHashes } = require('./runtime.cjs');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'orders-23.json'), 'utf8'));
const sets = [[1,2],[1,2,3],[1,4,17,18],[8,12,15,17,20]];
const report={sourceHashes,node:process.version,dataHash:data.sha256,assumptions:data.inventoryAssumption,samples:[]};
for(const numbers of sets) for(const level of ['light','full']) {
    const rt=createRuntime(data);
    const result=rt.evaluate(numbers.map(n=>'excel-'+n),level,60000);
    report.samples.push(result);
    console.log(JSON.stringify({ids:result.ids,level,status:result.status,ms:result.elapsedMs,score:result.score,pieces:result.pieceCount}));
    fs.writeFileSync(path.join(__dirname,'pilot-results.json'),JSON.stringify(report,null,2));
}
