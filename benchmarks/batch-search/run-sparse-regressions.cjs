const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {transformApp}=require('./sparse-patterns.cjs');
const root=path.resolve(__dirname,'../..'),app=path.join(root,'app.js');
// Reuse the real runner's explicit suite list and pass/fail rules. Only its
// read of a pre-promotion app.js is transformed; current production is already sparse.
const experimentFs={...fs,readFileSync(file,...options){
    const result=fs.readFileSync(file,...options);
    return path.resolve(String(file))===app && !String(result).includes('const states = new Map()')
        ? transformApp(result) : result;
}};
vm.runInNewContext(fs.readFileSync(path.join(root,'run-regressions.cjs'),'utf8'),{
    __dirname:root,console,process,
    require(name){return name==='node:fs'?experimentFs:require(name);}
},{filename:'run-regressions.cjs (sparse Node experiment)'});
