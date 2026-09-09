const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createRuntime, sourceHashes} = require('./runtime.cjs');
const {runSearch} = require('./search.cjs');
const directory = path.join(__dirname, 'inventory-study');
fs.mkdirSync(directory, {recursive:true});
const data = JSON.parse(fs.readFileSync(path.join(__dirname,'orders-23.json'),'utf8'));
const profiles = ['uProfile','verticalProfile','closingProfile','horizontalProfile','topRail','bottomRail'];
const key = x => x.profileType+'|'+x.color;
const save = (name,value) => fs.writeFileSync(path.join(directory,name+'.json'),JSON.stringify(value,null,2));
const read = name => JSON.parse(fs.readFileSync(path.join(directory,name+'.json'),'utf8'));
function random(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
function inventory(remnants,counts){return createRuntime(data).normalizeInventory({stockLength:6000,newStock:profiles.flatMap(profileType=>['gray','black','white'].map(color=>({profileType,color,unlimited:!counts,quantity:counts?(counts[profileType+'|'+color]||0):null}))),remnants});}
function summarize(rows){const lengths=rows.map(x=>x.length).sort((a,b)=>a-b);return {count:rows.length,totalMm:lengths.reduce((a,b)=>a+b,0),min:lengths[0],q25:lengths[Math.floor(lengths.length*.25)],median:lengths[Math.floor(lengths.length*.5)],q75:lengths[Math.floor(lengths.length*.75)],max:lengths.at(-1),variants:Object.fromEntries([...new Set(rows.map(key))].sort().map(k=>[k,rows.filter(x=>key(x)===k).length]))};}
function generate(){
    const rng=random(230908),pool=[],history=[];
    const demand={};
    for(const order of data.orders)for(const [section,rows] of Object.entries(order.sections))for(const row of rows){
        if(!Number(row.length))continue;
        for(const profile of section==='rails'?['topRail','bottomRail']:[section]){
            const k=profile+'|'+order.color,quantity=Number(row.quantity)/(section==='rails'?2:1);
            demand[k]??={pieces:0,lengthMm:0};demand[k].pieces+=quantity;demand[k].lengthMm+=quantity*Number(row.length);
        }
    }
    save('demand',demand);
    // Historical orders retain quantities, profile/color mix and paired rail lengths.
    // Small independent measurement perturbations prevent exact replay of future orders.
    for(let cycle=0;cycle<4;cycle++){
        const synthetic=structuredClone(data);
        for(const order of synthetic.orders)for(const rows of Object.values(order.sections))for(const row of rows)
            if(Number(row.length)>0)row.length=String(Math.round((Number(row.length)+(rng()-.5)*60)*10)/10);
        const runtime=createRuntime(synthetic);
        for(const order of synthetic.orders){
            const result=runtime.evaluate([order.id],'light',60000,true);
            assert.equal(result.status,'complete');
            history.push({cycle,orderId:order.id,score:result.score,bars:result.plan.bars});
            for(const bar of result.plan.bars)if(bar.remnantStatus==='reusable')pool.push({profileType:bar.profileType,color:bar.color,length:bar.remaining,quantity:1,historyIndex:history.length-1,barId:bar.id});
        }
        console.log(JSON.stringify({generationCycle:cycle,pool:pool.length}));
    }
    assert.ok(pool.length>=100);
    const groups=[...new Set(pool.map(key))].sort().map(k=>({key:k,rows:pool.filter(x=>key(x)===k)}));
    let allocated=0;
    for(const g of groups){g.exact=100*g.rows.length/pool.length;g.quota=Math.floor(g.exact);allocated+=g.quota;}
    for(const g of [...groups].sort((a,b)=>(b.exact-b.quota)-(a.exact-a.quota)||a.key.localeCompare(b.key)).slice(0,100-allocated))g.quota++;
    const scenarios={};
    for(const name of ['A','B','C']){
        const draw=random(90823),selected=[];
        for(const g of groups){
            const ranked=g.rows.map(row=>({row,tie:draw()}));
            ranked.sort(name==='A'?((a,b)=>a.tie-b.tie):((a,b)=>(name==='B'?1:-1)*(a.row.length-b.row.length)||a.tie-b.tie));
            selected.push(...ranked.slice(0,g.quota).map(x=>x.row));
        }
        assert.equal(selected.length,100);
        scenarios[name]={inventory:inventory(selected.map(({historyIndex,barId,...r})=>r)),summary:summarize(selected),provenance:selected};
    }
    save('scenarios',{seed:230908,sourceHashes,excludedOrders:[16],poolSummary:summarize(pool),history,scenarios});
}
function pilot(){
    const scenarios=read('scenarios').scenarios,results=[];
    for(const name of ['none','A','B','C'])for(const ids of [[1,2],[1,2,3],[1,4,17,18],[8,12,15,17,20]]){
        const input={...data,...(name==='none'?{}:{inventory:scenarios[name].inventory})};
        const result=createRuntime(input).evaluate(ids.map(i=>'excel-'+i),'full',60000,true);
        results.push({scenario:name,...result});save('manual',results);
        console.log(JSON.stringify({scenario:name,ids,status:result.status,seconds:result.elapsedMs/1000,score:result.score}));
    }
}
function search(name,seconds,seed=1,sparsePatterns=true){
    const s=read('scenarios').scenarios[name];
    const input={...data,inventory:s.inventory,inventoryAssumption:`Synthetic ${name}; 100 simulated retained remnants; order 16 excluded`};
    if(seed!==1){const rng=random(seed);input.orders=[...input.orders];for(let i=input.orders.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[input.orders[i],input.orders[j]]=[input.orders[j],input.orders[i]];}}
    runSearch(input,{seed:230916,maxSeconds:seconds,sparsePatterns,persistenceIntervalMs:10000,keepImprovementPlans:true,output:path.join(directory,`search-${name}-${seed}${sparsePatterns?'':'-dense'}.json`),onProgress:x=>console.log(JSON.stringify({scenario:name,seed,sparsePatterns,...x}))});
}
function finite(){
    const document=read('scenarios'),historicalCounts={},witnessCounts={};
    for(const h of document.history.filter(h=>h.cycle===0))for(const b of h.bars)historicalCounts[key(b)]=(historicalCounts[key(b)]||0)+1;
    const witness=JSON.parse(fs.readFileSync(path.join(__dirname,'anytime-result-test.json'),'utf8')).bestValidatedResultSoFar;
    for(const b of witness.plan.bars)if(b.source==='new')witnessCounts[key(b)]=(witnessCounts[key(b)]||0)+1;
    for(const name of ['F1','F2']){
        const counts=Object.fromEntries(Object.entries(historicalCounts).map(([k,v])=>[k,name==='F1'?Math.max(Math.ceil(v/4)+1,witnessCounts[k]||0):(witnessCounts[k]||Math.ceil(v/4))]));
        document.scenarios[name]={inventory:inventory(document.scenarios.A.inventory.remnants,counts),summary:document.scenarios.A.summary,provenance:document.scenarios.A.provenance,stockCounts:counts,
            feasibleWitness:{ids:witness.ids,newStockCounts:witnessCounts,score:witness.score,note:'Saved independently validated all-new plan fits these finite counts; old remnants need not be consumed'}};
    }
    save('scenarios',document);
}
function suite(){
    finite();
    search('A',120,1,false);
    for(const name of ['A','B','C'])search(name,600);
    for(const name of ['F1','F2'])search(name,120);
    // Same search RNG; only input order is permuted, so effects are not confounded.
    for(const seed of [2,3,4,5])search('A',120,seed);
}
if(require.main===module){const [mode,a,b,c,d]=process.argv.slice(2);if(mode==='generate')generate();else if(mode==='pilot')pilot();else if(mode==='search')search(a,Number(b),Number(c||1),d!=='off');else if(mode==='suite')suite();else if(mode==='finite')finite();else throw new Error('Unknown mode');}
module.exports={data,directory,save,read,inventory,summarize,search,random};
