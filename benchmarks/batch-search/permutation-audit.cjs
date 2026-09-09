const {read,save}=require('./inventory-study.cjs');
const groups=new Map();
for(const seed of [1,2,3,4,5]){
    const report=read('search-A-'+seed);
    for(const e of report.evaluations.filter(e=>e.status==='complete'&&e.endSeconds<=120)){
        const k=JSON.stringify([e.ids.slice().sort(),e.level]);
        if(!groups.has(k))groups.set(k,[]);
        groups.get(k).push({seed,score:e.score,ids:e.ids,level:e.level,pieces:e.pieceCount,newBars:e.newBars,
            oldRemnants:e.oldRemnantSources,scrapMm:e.scrapMm,reusableMm:e.reusableMm});
    }
}
const shared=[...groups.values()].filter(g=>g.length>=3).map(observations=>{
    const scores=observations.map(x=>x.score);return {observations,best:Math.min(...scores),worst:Math.max(...scores),spreadPercent:100*(Math.max(...scores)/Math.min(...scores)-1)};
}).sort((a,b)=>b.spreadPercent-a.spreadPercent);
save('permutation-audit',{sharedCandidatesAtLeastThreeSeeds:shared.length,largestScoreSpreads:shared.slice(0,10),
    interpretation:'Same batch and evaluation level in the same inventory; differing scores here reflect material optimizer input ordering, not candidate selection alone. mergeGroupedCuts preserves first occurrence order; pattern ties compare quantity vectors in that order.'});
console.log(JSON.stringify({shared:shared.length,worstSpreadPercent:shared[0]?.spreadPercent}));
