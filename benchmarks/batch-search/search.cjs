const fs = require('node:fs');
const path = require('node:path');
const { createRuntime, sourceHashes } = require('./runtime.cjs');

function enumerateCandidates(orders, limits = { min: 200, target: 250, max: 300 }) {
    if(![limits.min,limits.target,limits.max].every(n=>Number.isSafeInteger(n)&&n>0)||limits.min>limits.target||limits.target>limits.max)
        throw new Error('Invalid batch limits');
    if(orders.length>23)throw new Error('Research mask enumeration is limited to 23 orders');
    const total=orders.reduce((n,o)=>n+o.pieceCount,0), candidates=[];
    const add=(mask,pieceCount,requiredLengthMm)=>candidates.push({mask,pieceCount,requiredLengthMm,
        ids:orders.filter((o,i)=>mask&(1<<i)).map(o=>o.id),band:pieceCount<limits.min+(limits.max-limits.min)/3?0:
            pieceCount<limits.min+2*(limits.max-limits.min)/3?1:2});
    if(total<limits.min){if(total)add((1<<orders.length)-1,total,orders.reduce((n,o)=>n+o.requiredLengthMm,0));return candidates;}
    function visit(i,mask,count,length){
        if(i===orders.length){if(count>=limits.min)add(mask,count,length);return;}
        visit(i+1,mask,count,length);
        if(count+orders[i].pieceCount<=limits.max)visit(i+1,mask|(1<<i),count+orders[i].pieceCount,length+orders[i].requiredLengthMm);
    }
    visit(0,0,0,0);
    orders.forEach((o,i)=>{if(o.pieceCount>limits.max)add(1<<i,o.pieceCount,o.requiredLengthMm);});
    return candidates;
}

function compare(a,b,target=250){
    const keyA=JSON.stringify(a.ids.slice().sort()),keyB=JSON.stringify(b.ids.slice().sort());
    return a.score-b.score || Math.abs(a.pieceCount-target)-Math.abs(b.pieceCount-target) || (keyA<keyB?-1:keyA>keyB?1:0);
}

class Explorer {
    constructor(orders,candidates,limits,seed=230916){
        this.orders=orders;this.candidates=candidates;this.limits=limits;
        this.byMask=new Map(candidates.map(c=>[c.mask,c]));this.seeds=[];this.cursor=0;this.lightCount=0;
        const seen=new Set();
        const add=c=>{if(c&&!seen.has(c.mask)){seen.add(c.mask);this.seeds.push(c);}};
        const proxy=(a,b)=>a.requiredLengthMm-b.requiredLengthMm || a.mask-b.mask;
        // Required length is only an exploration proxy, never a final material score or proof bound.
        for(let rank=0;rank<3;rank++)for(let band=0;band<3;band++)add(candidates.filter(c=>c.band===band).sort(proxy)[rank]);
        for(const reverse of [false,true])for(let start=0;start<orders.length;start++)for(const goal of [limits.min,limits.target,limits.max]){
            let mask=0,count=0;
            for(let j=0;j<orders.length;j++){
                const i=reverse?(start-j+orders.length)%orders.length:(start+j)%orders.length;
                if(count+orders[i].pieceCount<=limits.max){mask|=1<<i;count+=orders[i].pieceCount;}
                if(count>=goal)break;
            }
            add(this.byMask.get(mask));
        }
        const shuffled=[...candidates];
        for(let i=shuffled.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=Math.floor(seed/4294967296*(i+1));[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
        this.restarts=shuffled;this.restartCursor=0;this.proxy=proxy;
    }
    next(evaluated,ranked){
        const fresh=c=>c&&!evaluated.has(c.mask);
        // One in four light evaluations explores a restart, the rest explore elite add/remove/swap moves.
        if(this.lightCount%4!==0 && ranked.length){
            const neighbors=new Map();
            for(const parent of ranked.slice(0,6)){
                const mask=parent.mask;
                for(let i=0;i<this.orders.length;i++){
                    const changed=mask^(1<<i),c=this.byMask.get(changed);
                    if(fresh(c))neighbors.set(c.mask,c);
                    if(mask&(1<<i))for(let j=0;j<this.orders.length;j++)if(!(mask&(1<<j))){
                        const swap=this.byMask.get(changed|(1<<j));if(fresh(swap))neighbors.set(swap.mask,swap);
                    }
                }
            }
            const values=[...neighbors.values()].sort(this.proxy);
            const wanted=this.lightCount%3;
            const chosen=values.find(c=>c.band===wanted)||values[0];
            if(chosen){this.lightCount++;return chosen;}
        }
        while(this.cursor<this.seeds.length){const c=this.seeds[this.cursor++];if(fresh(c)){this.lightCount++;return c;}}
        while(this.restartCursor<this.restarts.length){const c=this.restarts[this.restartCursor++];if(fresh(c)){this.lightCount++;return c;}}
        return null;
    }
}

function runSearch(data,options={}){
    const limits=options.limits||{min:200,target:250,max:300};
    const runtime=options.runtime||createRuntime(data,{cache:options.cache!==false,patternCache:options.patternCache===true,sparsePatterns:options.sparsePatterns===true});
    const now=options.now||(()=>performance.now());
    const description=runtime.describe();
    const started=now();
    const candidates=enumerateCandidates(description.orders,limits);
    const explorer=new Explorer(description.orders,candidates,limits,options.seed);
    const checkpoints=options.checkpoints||[10,30,60,120,300,600,1800,3600];
    const maxSeconds=options.maxSeconds??600;
    const light=new Set(),full=new Set(),bestByMask=new Map(),improvements=[],evaluations=[];
    let best=null,stopReason='time-budget',lastCheckpoint=0,lastWriteMs=-Infinity;
    const report={strategyVersion:1,sourceHashes,node:process.version,dataHash:data.sha256,
        assumptions:data.inventoryAssumption,limits,settings:{light:description.lightSettings,full:description.fullSettings},
        cacheEnabled:options.cache!==false,patternCacheEnabled:options.patternCache===true,sparsePatternsEnabled:options.sparsePatterns===true,orders:description.orders.length,candidateCount:candidates.length,
        enumerationAndSeedsMs:now()-started,checkpoints:[],improvements,evaluations,best:null};
    const elapsed=()=> (now()-started)/1000;
    const snapshot=time=>({budgetSeconds:time,usedSearchSeconds:time,uniqueCandidates:light.size,
        lightCompleted:evaluations.filter(e=>e.level==='light').length,fullCompleted:evaluations.filter(e=>e.level==='full').length,
        validatedEvaluations:evaluations.filter(e=>e.status==='complete').length,
        best,finalBestFoundSeconds:best?.foundSeconds??null,noImprovementSeconds:best?time-best.foundSeconds:null});
    const write=(force=false)=>{
        report.best=best;report.usedSearchSeconds=elapsed();
        if(options.output&&(force||now()-lastWriteMs>=(options.persistenceIntervalMs||0))){
            fs.writeFileSync(options.output,JSON.stringify(report,null,2));lastWriteMs=now();
        }
    };
    function checkpointsBefore(time){
        while(lastCheckpoint<checkpoints.length&&checkpoints[lastCheckpoint]<=time){
            const point=checkpoints[lastCheckpoint++];report.checkpoints.push(snapshot(point));
            options.onProgress?.({checkpoint:point,bestScore:best?.score,light:light.size,full:full.size});
        }
    }
    while(elapsed()<maxSeconds){
        const ranked=[...bestByMask.values()].sort((a,b)=>compare(a,b,limits.target));
        // Only one refinement per four light calls; use actual scored leaders, never assume refinement wins.
        const shouldRefine=light.size>0&&light.size%4===0&&full.size<Math.floor(light.size/4);
        let candidate=shouldRefine?ranked.find(c=>!full.has(c.mask)):null;
        const level=candidate?'full':'light';
        if(!candidate)candidate=explorer.next(light,ranked);
        if(!candidate){stopReason='candidates-exhausted';break;}
        const remainingMs=(maxSeconds-elapsed())*1000;
        if(remainingMs<=0)break;
        const beginSeconds=elapsed();
        let result=runtime.evaluate(candidate.ids,level,Math.min(60000,remainingMs));
        const endSeconds=elapsed();
        if(endSeconds>maxSeconds && result.status==='complete')result={status:'finished-after-deadline',ids:candidate.ids,level,elapsedMs:result.elapsedMs};
        // A result is unavailable at checkpoints crossed while its synchronous evaluation was running.
        const previousCheckpointCount=report.checkpoints.length;
        checkpointsBefore(Math.min(endSeconds,maxSeconds));
        const entry={...result,mask:candidate.mask,ids:candidate.ids,beginSeconds,endSeconds};
        evaluations.push(entry);(level==='light'?light:full).add(candidate.mask);
        let improved=false;
        if(result.status==='complete'){
            const previous=bestByMask.get(candidate.mask);
            if(!previous||compare(entry,previous,limits.target)<0)bestByMask.set(candidate.mask,entry);
            if(!best||compare(entry,best,limits.target)<0){
                best={...entry,foundSeconds:endSeconds};improvements.push(best);
                improved=true;
                runtime.retainBest?.();
                report.bestValidatedResultSoFar=runtime.getBest?.()??null;
                if(options.keepImprovementPlans){
                    report.improvementPlans??=[];
                    report.improvementPlans.push({foundSeconds:endSeconds,result:report.bestValidatedResultSoFar});
                }
                options.onProgress?.({improvement:endSeconds,score:best.score,level,ids:best.ids,pieces:best.pieceCount});
            }
        }
        write(improved||previousCheckpointCount!==report.checkpoints.length);
        if(options.maxEvaluations&&evaluations.length>=options.maxEvaluations){stopReason='work-budget';break;}
        if(options.plateauSeconds&&endSeconds>=600&&best&&endSeconds-best.foundSeconds>=options.plateauSeconds){stopReason='observed-plateau';break;}
    }
    report.stopReason=stopReason;report.finalSnapshot=snapshot(elapsed());write(true);
    return report;
}

if(require.main===module){
    const data=JSON.parse(fs.readFileSync(path.join(__dirname,'orders-23.json'),'utf8'));
    const seconds=Number(process.argv[2]||600),output=path.join(__dirname,process.argv[3]||'search-results.json');
    runSearch(data,{maxSeconds:seconds,output,plateauSeconds:300,onProgress:x=>console.log(JSON.stringify(x))});
}
module.exports={enumerateCandidates,Explorer,compare,runSearch};
