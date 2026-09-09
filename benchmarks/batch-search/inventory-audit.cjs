const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {cutPiece,millimetersToDpUnits}=require('../../src/cutting-physics.js');
const {read,save,directory,data}=require('./inventory-study.cjs');
// Independent arithmetic cross-check of the frozen checkpoint, not an optimizer.
function value(length){const t=Math.max(0,Math.min(1,(length-500)/4000));return .1+.77*t*t/(t*t+(1-t)*(1-t));}
function reusable(length){return length*(value(length)-.1)>20;}
function auditAvailability(bars,inventory){
    const usedNew=new Map(),usedOld=new Map();
    for(const b of bars){
        const k=JSON.stringify([b.profileType,b.color]);
        if(b.source==='new'){
            const source=inventory.newStock.find(s=>s.profileType===b.profileType&&s.color===b.color);
            assert(source);assert.equal(b.sourceLength,inventory.stockLength);
            const n=(usedNew.get(k)||0)+1;usedNew.set(k,n);assert(source.unlimited||n<=source.quantity);
        }else{
            assert.equal(b.source,'remnant');
            const rk=JSON.stringify([b.profileType,b.color,b.sourceLength]);
            const n=(usedOld.get(rk)||0)+1;usedOld.set(rk,n);
            const available=inventory.remnants.filter(r=>r.profileType===b.profileType&&r.color===b.color&&r.length===b.sourceLength).reduce((n,r)=>n+r.quantity,0);
            assert(n<=available);
        }
    }
}
function auditProvenance(result){
    const expected=new Map(),actual=new Map(),pieceIds=new Set();
    const key=p=>JSON.stringify([p.orderId,p.openingId||null,p.profileType,p.color,p.length]);
    for(const order of data.orders.filter(o=>result.ids.includes(o.id)))for(const [section,rows] of Object.entries(order.sections))for(const row of rows){
        if(!Number(row.length))continue;
        for(const profileType of section==='rails'?['topRail','bottomRail']:[section]){
            const k=key({orderId:order.id,openingId:row.openingId,profileType,color:order.color,length:Number(row.length)});
            expected.set(k,(expected.get(k)||0)+Number(row.quantity)/(section==='rails'?2:1));
        }
    }
    for(const operation of result.execution.operations)for(const p of operation.pieces){
        assert.equal(p.quantity,1);assert(!pieceIds.has(p.pieceId));pieceIds.add(p.pieceId);
        const k=key(p);actual.set(k,(actual.get(k)||0)+1);
    }
    assert.deepEqual([...actual].sort(),[...expected].sort());assert.equal(pieceIds.size,result.pieceCount);
}
function capacityDeficits(ids,inventory){
    const demand=new Map();
    for(const order of data.orders.filter(o=>ids.includes(o.id)))for(const [section,rows] of Object.entries(order.sections))for(const row of rows){
        if(!Number(row.length))continue;
        for(const profileType of section==='rails'?['topRail','bottomRail']:[section]){
            const k=JSON.stringify([profileType,order.color]),quantity=Number(row.quantity)/(section==='rails'?2:1);
            demand.set(k,(demand.get(k)||0)+millimetersToDpUnits(Number(row.length))*quantity);
        }
    }
    const deficits=[];
    for(const [k,required] of demand){
        const [profileType,color]=JSON.parse(k),stock=inventory.newStock.find(s=>s.profileType===profileType&&s.color===color);
        if(stock?.unlimited)continue;
        const available=(stock?.quantity||0)*millimetersToDpUnits(inventory.stockLength)+inventory.remnants.filter(r=>r.profileType===profileType&&r.color===color).reduce((n,r)=>n+millimetersToDpUnits(r.length)*r.quantity,0);
        if(required>available)deficits.push({profileType,color,requiredMm:required/10,availableMm:available/10,deficitMm:(required-available)/10});
    }
    // A necessary capacity bound ignoring kerf: a deficit proves shortage;
    // absence of a deficit proves nothing about packing feasibility.
    return deficits;
}
function auditBars(bars,score){
    let source=0,credit=0,handling=0,creation=0,scrapPenalty=0;
    for(const b of bars){
        let remaining=b.sourceLength,waste=0;
        for(const c of b.groupedCuts)for(let i=0;i<c.quantity;i++){
            const cut=cutPiece(remaining,c.length,3);assert(cut.possible);remaining=cut.remaining;waste+=cut.waste;
        }
        assert(Math.abs(remaining-b.remaining)<.00001);assert(Math.abs(waste-b.waste)<.00001);
        assert.equal(b.remnantStatus,reusable(b.remaining)?'reusable':b.remaining===0?'none':'scrap');
        source+=b.source==='new'?b.sourceLength:b.sourceLength*value(b.sourceLength);
        if(reusable(b.remaining)){credit+=b.remaining*value(b.remaining);handling+=20;if(b.source==='new')creation+=50;}
        else{credit+=b.remaining*.1;scrapPenalty+=Math.max(0,b.remaining-200)*1.7;}
    }
    const total=source-credit+handling+creation+scrapPenalty;
    if(score!==undefined)assert(Math.abs(total-score)<.00001,`${total} != ${score}`);
    return {source,credit,handling,creation,scrapPenalty,total};
}
function main(){
    const scenarios=read('scenarios');
    for(const h of scenarios.history)auditBars(h.bars,h.score);
    for(const s of Object.values(scenarios.scenarios)){
        assert.equal(s.provenance.length,100);
        assert.equal(s.inventory.remnants.reduce((n,r)=>n+r.quantity,0),100);
        assert.equal(new Set(s.inventory.remnants.map(r=>JSON.stringify([r.profileType,r.color,r.length]))).size,s.inventory.remnants.length);
        for(const r of s.provenance){
            const b=scenarios.history[r.historyIndex].bars.find(b=>b.id===r.barId);
            assert.equal(r.length,b.remaining);assert.equal(r.profileType,b.profileType);assert.equal(r.color,b.color);assert(reusable(r.length));
        }
    }
    let plans=0;
    for(const file of fs.readdirSync(directory).filter(f=>f.endsWith('.json')&&f!=='scenarios.json')){
        const doc=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));
        const results=Array.isArray(doc)?doc:doc.improvementPlans?.map(x=>x.result)||[];
        for(const r of results)if(r.plan){
            auditBars(r.plan.bars,r.score);
            auditProvenance(r);
            const scenario=r.scenario||file.match(/^search-(A|B|C|F1|F2)-/)?.[1];
            if(scenarios.scenarios[scenario])auditAvailability(r.plan.bars,scenarios.scenarios[scenario].inventory);
            plans++;
        }
    }
    for(const name of ['F1','F2'])if(scenarios.scenarios[name]){
        const s=scenarios.scenarios[name];
        for(const [variant,quantity] of Object.entries(s.feasibleWitness.newStockCounts))assert(s.stockCounts[variant]>=quantity);
    }
    const tightFile=path.join(directory,'finite-tight-probe.json');
    if(fs.existsSync(tightFile)){
        const tight=JSON.parse(fs.readFileSync(tightFile,'utf8'));
        auditAvailability(tight.knownFeasibleWitness.plan.bars,tight.inventory);
        for(const r of tight.results)if(r.plan){auditBars(r.plan.bars,r.score);auditAvailability(r.plan.bars,tight.inventory);auditProvenance(r);plans++;}
    }
    if(fs.existsSync(path.join(directory,'finite-retries.json'))){
        save('finite-capacity-certificates',read('finite-retries').map(r=>({scenario:r.scenario,ids:r.ids,
            deficits:capacityDeficits(r.ids,scenarios.scenarios[r.scenario].inventory)})));
    }
    save('audit',{historicalOrders:scenarios.history.length,historicalBars:scenarios.history.reduce((n,h)=>n+h.bars.length,0),scenarioRemnants:Object.keys(scenarios.scenarios).length*100,benchmarkedPlans:plans,status:'PASS'});
    console.log(`PASS history, provenance, cutting physics and independent score; ${plans} benchmark plans`);
}
if(require.main===module)main();
module.exports={auditBars,auditAvailability,auditProvenance,capacityDeficits,value,reusable};
