const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {enumerateCandidates,runSearch,compare}=require('./search.cjs');
const {createRuntime}=require('./runtime.cjs');
const root=path.resolve(__dirname,'../..');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
const order=(id,pieceCount)=>({id,pieceCount,requiredLengthMm:pieceCount*1000});
const limits={min:4,target:5,max:6};
check('Short queue is whole, never a sub-batch',()=>assert.deepEqual(enumerateCandidates([order('a',1),order('b',2)],limits).map(c=>c.ids),[['a','b']]));
check('Oversized order stays whole',()=>assert.deepEqual(enumerateCandidates([order('a',8)],limits).map(c=>c.ids),[['a']]));
check('No below-min fallback from larger queue',()=>assert.equal(enumerateCandidates([order('a',3),order('b',3)],{min:4,target:4,max:4}).length,0));
check('Invalid limits rejected',()=>assert.throws(()=>enumerateCandidates([],{min:6,target:4,max:5})));
check('Enumeration matches existing selector',()=>{
    const ctx=vm.createContext({});new vm.Script(fs.readFileSync(path.join(root,'src/production-planning.js'),'utf8')).runInContext(ctx);
    for(const counts of [[1,2,3,4],[3,3,3],[1,8],[1,2],[]]){
        const orders=counts.map((n,i)=>order(String(i),n));ctx.orders=orders;
        const expected=JSON.parse(vm.runInContext(`JSON.stringify((()=>{const out=[];PRODUCTION_PLANNING.selectBatch(orders,o=>{out.push(o.map(x=>x.id).join(','));return {complete:false}},
            {minBatchPieces:4,targetBatchPieces:5,maxBatchPieces:6});return out.sort()})())`,ctx));
        assert.deepEqual(enumerateCandidates(orders,limits).map(c=>c.ids.join(',')).sort(),expected);
    }
});
function simulated(results,maxEvaluations=7,maxSeconds=100){
    let milliseconds=0,index=0;
    const orders=[order('a',2),order('b',2),order('c',2),order('d',2)];
    const runtime={describe:()=>({orders,lightSettings:{},fullSettings:{}}),evaluate(ids,level){
        milliseconds+=1000;
        return {status:'complete',ids,level,pieceCount:ids.length*2,score:level==='full'?999:(results[index++]??10)};
    }};
    return runSearch({}, {runtime,now:()=>milliseconds,limits,maxEvaluations,maxSeconds,checkpoints:[0.5,1.5,4.5]});
}
check('Checkpoint cannot contain unfinished result',()=>{
    const result=simulated([10,9,8,7]);assert.equal(result.checkpoints[0].best,null);assert.equal(result.checkpoints[1].best.score,10);
});
check('Worse refinement never replaces incumbent',()=>{
    const result=simulated([10,9,8,7,6,5]);assert(result.evaluations.some(e=>e.level==='full'));assert.equal(result.best.score,5);
});
check('Work-budget rerun is deterministic',()=>assert.deepEqual(simulated([9,8,7,6,5,4]),simulated([9,8,7,6,5,4])));
check('Deadline excludes late complete result',()=>assert.equal(simulated([1],7,0.5).best,null));
check('Material score precedes target proximity',()=>assert(compare({ids:['a'],pieceCount:4,score:1},{ids:['b'],pieceCount:5,score:2},5)<0));

const smallData={stockLength:6000,kerf:3,orders:[{id:'a',name:'',color:'black',sections:{verticalProfile:[{length:'2200',quantity:'2',openingId:'A'}]}}]};
check('Cached and uncached plans, scores and provenance match',()=>{
    const cached=createRuntime(smallData,{cache:true}),uncached=createRuntime(smallData);
    const reference=uncached.evaluate(['a'],'full',60000,true),first=cached.evaluate(['a'],'full',60000,true),second=cached.evaluate(['a'],'full',60000,true);
    for(const result of [first,second]){assert.deepEqual(result.plan,reference.plan);assert.deepEqual(result.execution,reference.execution);assert.equal(result.score,reference.score);}
    assert(second.cache.hits>0);
    first.plan.bars[0].remaining=-1;
    assert.deepEqual(cached.evaluate(['a'],'full',60000,true).plan,reference.plan);
});
check('Cache separates budgets and finite inventory; incomplete is not impossible',()=>{
    const finite={...smallData,inventory:{stockLength:6000,newStock:['uProfile','verticalProfile','closingProfile','horizontalProfile','topRail','bottomRail'].map(profileType=>
        ({profileType,color:'black',unlimited:false,quantity:profileType==='verticalProfile'?1:0})),remnants:[]}};
    const cached=createRuntime(finite,{cache:true});const light=cached.evaluate(['a'],'light'),full=cached.evaluate(['a'],'full');
    assert.equal(light.status,'complete');assert.equal(full.status,'complete');assert.equal(full.cache.hits,0);
    const none=createRuntime({...finite,inventory:{...finite.inventory,newStock:finite.inventory.newStock.map(s=>({...s,quantity:s.profileType==='uProfile'?1:0}))}});
    assert.equal(none.evaluate(['a'],'light').status,'not-found');
});
check('Cached material gets fresh order/opening provenance',()=>{
    const data=JSON.parse(JSON.stringify(smallData));
    data.orders.push({...data.orders[0],id:'b',sections:{verticalProfile:[{length:'2200',quantity:'2',openingId:'B'}]}});
    const runtime=createRuntime(data,{cache:true});runtime.evaluate(['a']);
    const result=runtime.evaluate(['b'],'full',60000,true);
    assert(result.cache.hits>0);
    assert(result.execution.operations.flatMap(o=>o.pieces).every(p=>p.orderId==='b'&&p.openingId==='B'));
});
check('Changed kerf cannot reuse the wrong material result',()=>{
    const data=JSON.parse(JSON.stringify(smallData));
    const runtime=createRuntime(data,{cache:true});runtime.evaluate(['a']);data.kerf=4;
    const cached=runtime.evaluate(['a'],'full',60000,true),fresh=createRuntime(data).evaluate(['a'],'full',60000,true);
    assert.equal(cached.cache.hits,0);assert.deepEqual(cached.plan,fresh.plan);assert.equal(cached.score,fresh.score);
});
check('Changed finite quantity causes a new group evaluation',()=>{
    const data=JSON.parse(JSON.stringify(smallData));
    data.inventory={stockLength:6000,newStock:['uProfile','verticalProfile','closingProfile','horizontalProfile','topRail','bottomRail'].map(profileType=>
        ({profileType,color:'black',unlimited:false,quantity:profileType==='verticalProfile'?1:0})),remnants:[]};
    const runtime=createRuntime(data,{cache:true}),first=runtime.evaluate(['a']);
    data.inventory.newStock.find(s=>s.profileType==='verticalProfile').quantity=2;
    const changed=runtime.evaluate(['a'],'full',60000,true),fresh=createRuntime(data).evaluate(['a'],'full',60000,true);
    assert(changed.cache.misses>first.cache.misses);assert.deepEqual(changed.plan,fresh.plan);
});
check('Anytime incumbent retains the whole validated executable plan',()=>{
    const runtime=createRuntime(smallData);
    assert.equal(runtime.getBest(),null);
    const result=runtime.evaluate(['a'],'light',60000,true);runtime.retainBest();
    assert.deepEqual(runtime.getBest().plan,result.plan);
    assert.deepEqual(runtime.getBest().execution,result.execution);
    runtime.evaluate(['a'],'full');
    assert.equal(runtime.getBest().score,result.score);
    const copy=runtime.getBest();copy.plan.bars[0].remaining=-1;
    assert.deepEqual(runtime.getBest().plan,result.plan);
});
check('Pattern cache preserves exact plan and execution',()=>{
    const runtime=createRuntime(smallData,{patternCache:true});
    const first=runtime.evaluate(['a'],'full',60000,true),second=runtime.evaluate(['a'],'full',60000,true);
    const uncached=createRuntime(smallData).evaluate(['a'],'full',60000,true);
    assert.deepEqual(first.plan,uncached.plan);assert.deepEqual(second.execution,uncached.execution);
    assert.equal(first.score,uncached.score);assert(runtime.patternStats().hits>0);
    second.plan.bars[0].remaining=-1;
    assert.deepEqual(runtime.evaluate(['a'],'full',60000,true).plan,uncached.plan);
});
check('Pattern cache keeps kerf in its geometric key',()=>{
    const data=structuredClone(smallData),runtime=createRuntime(data,{patternCache:true});
    runtime.evaluate(['a']);data.kerf=4;
    const result=runtime.evaluate(['a'],'full',60000,true),fresh=createRuntime(data).evaluate(['a'],'full',60000,true);
    assert.deepEqual(result.plan,fresh.plan);assert.equal(result.score,fresh.score);
});
check('Pattern cache never bypasses finite source consumption',()=>{
    const data=structuredClone(smallData);
    data.inventory={stockLength:6000,newStock:['uProfile','verticalProfile','closingProfile','horizontalProfile','topRail','bottomRail'].map(profileType=>
        ({profileType,color:'black',unlimited:false,quantity:profileType==='verticalProfile'?2:0})),remnants:[]};
    const runtime=createRuntime(data,{patternCache:true});runtime.evaluate(['a']);
    data.inventory.newStock.find(s=>s.profileType==='verticalProfile').quantity=1;
    const result=runtime.evaluate(['a'],'full',60000,true),fresh=createRuntime(data).evaluate(['a'],'full',60000,true);
    assert.deepEqual(result.plan,fresh.plan);assert.equal(result.score,fresh.score);
});
check('Synthetic inventory merges duplicate remnants through the production adapter',()=>{
    const data=structuredClone(smallData),normalizer=createRuntime(data);
    const raw={stockLength:6000,newStock:['uProfile','verticalProfile','closingProfile','horizontalProfile','topRail','bottomRail'].map(profileType=>
        ({profileType,color:'black',unlimited:false,quantity:0})),remnants:[1,2].map(()=>({profileType:'verticalProfile',color:'black',length:2203,quantity:1}))};
    data.inventory=normalizer.normalizeInventory(raw);
    assert.equal(data.inventory.remnants.length,1);assert.equal(data.inventory.remnants[0].quantity,2);
    assert.equal(raw.remnants.length,2);assert.equal(raw.remnants[0].quantity,1);
    const result=createRuntime(data,{patternCache:true}).evaluate(['a'],'full',60000,true);
    assert.equal(result.status,'complete');assert.equal(result.oldRemnantSources,2);assert.equal(result.newBars,0);
});
console.log('Research checks: '+checks+' passed');
