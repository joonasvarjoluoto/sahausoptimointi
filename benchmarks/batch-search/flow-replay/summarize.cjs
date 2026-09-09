const fs=require('node:fs'),path=require('node:path');
const m=require('./model.cjs');
const {cutPiece}=require('../../../src/cutting-physics.js');
const sum=(rows,fn)=>rows.reduce((n,r)=>n+fn(r),0);
const median=values=>{const a=[...values].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length?(a.length%2?a[i]:(a[i-1]+a[i])/2):null;};
const bins=[0,500,1000,2000,3000,4500,Infinity];
const bin=r=>{const i=bins.findIndex((v,i)=>i<bins.length-1&&r.length>=v&&r.length<bins[i+1]);return bins[i]+'–'+(bins[i+1]===Infinity?'∞':'<'+bins[i+1]);};
function distribution(rows,group){
    return Object.fromEntries([...new Set(rows.map(group))].sort().map(k=>{const r=rows.filter(r=>group(r)===k);return [k,{count:r.length,mm:sum(r,r=>r.length),medianMm:median(r.map(r=>r.length))}];}));
}
function reuse(rows,totalBatches){
    const used=rows.filter(r=>r.usedBatch!==null);
    return {born:rows.length,used:used.length,unused:rows.length-used.length,medianObservedAgeBatches:median(used.map(r=>r.ageBatches)),
        within:Object.fromEntries([1,2,3,5].map(k=>{const eligible=rows.filter(r=>r.bornBatch<=totalBatches-k);
            const count=used.filter(r=>r.ageBatches<=k).length,cohortUsed=eligible.filter(r=>r.usedBatch!==null&&r.ageBatches<=k).length;
            return [k,{count,allBirthsDenominator:rows.length,percent:rows.length?100*count/rows.length:null,
                fullyObservedBirths:eligible.length,fullyObservedUsed:cohortUsed,fullyObservedPercent:eligible.length?100*cohortUsed/eligible.length:null}];}))};
}
const names=['arrival200','all','arrival150','arrival250','permissive'];
const reports=names.map(n=>JSON.parse(fs.readFileSync(path.join(__dirname,n+'.json'),'utf8')));
const cuts=m.cutsFor(m.orders),fits=(r,c)=>r.profileType===c.profileType&&r.color===c.color&&cutPiece(r.length,c.length,m.data.kerf).possible;
const demandByProfile=Object.fromEntries(Object.keys(m.baselineThresholds).map(p=>{const rows=cuts.filter(c=>c.profileType===p);return[p,{pieces:sum(rows,r=>r.quantity),minMm:Math.min(...rows.map(r=>r.length)),distinctLengths:new Set(rows.map(r=>r.length)).size}];}));
const summary={demandByProfile,scenarios:{},priorInventoryA:JSON.parse(fs.readFileSync(path.join(__dirname,'../inventory-study/scenarios.json'),'utf8')).scenarios.A.summary};
for(const d of reports){
    const records=d.records,final=records.filter(r=>r.unusedAtEnd),used=records.filter(r=>!r.unusedAtEnd);
    const extra=records.filter(r=>r.length<m.baselineThresholds[r.profileType]);
    const byGroup=group=>Object.fromEntries([...new Set(records.map(group))].sort().map(k=>{const rows=records.filter(r=>group(r)===k);return[k,{...reuse(rows,d.batches.length),finalMm:sum(rows.filter(r=>r.unusedAtEnd),r=>r.length)}];}));
    const finalAudit=final.map(r=>({...r,observedAgeBatches:d.batches.length-r.bornBatch,ageCensored:true,fitsAnyHistoricalDemand:cuts.some(c=>fits(r,c)),
        fitsLaterExecutedDemand:d.batches.filter(b=>b.batch>r.bornBatch).some(b=>m.cutsFor(m.orders.filter(o=>b.selectedIds.includes(o.id))).some(c=>fits(r,c)))}));
    const tails=d.batches.flatMap(b=>b.tails);
    const finalLong=final.filter(r=>r.length>=3000);
    const s={batches:d.batches.length,pieces:sum(d.batches,b=>b.pieceCount),elapsedSeconds:d.elapsedMs/1000,
        newBars:sum(d.batches,b=>b.newBars),newMm:sum(d.batches,b=>b.newLengthMm),
        pairedNoRemnantBars:sum(d.batches,b=>b.noRemnantCounterfactual.newBars),savedNewBars:sum(d.batches,b=>b.savedNewBars),savedNewMm:sum(d.batches,b=>b.savedNewMm),
        cutMm:sum(d.batches,b=>b.cutLengthMm),kerfMm:sum(d.batches,b=>b.kerfMm),scrapMm:sum(d.batches,b=>b.scrapMm),
        usedOld:{count:used.length,sourceMm:sum(used,r=>r.length),cutMm:sum(used,r=>r.cutLengthMm),kerfMm:sum(used,r=>r.kerfMm)},
        inventory:{maxCount:Math.max(...d.batches.map(b=>b.after.count)),medianCount:median(d.batches.map(b=>b.after.count)),
            maxMm:Math.max(...d.batches.map(b=>b.after.mm)),medianMm:median(d.batches.map(b=>b.after.mm)),final:m.amount(final),
            medianFinalLengthMm:median(final.map(r=>r.length)),medianAllBornLengthMm:median(records.map(r=>r.length)),
            medianSnapshotLengthMm:median(d.batches.flatMap(b=>b.inventoryAfterIds.map(id=>records.find(r=>r.id===id).length)))},
        reuse:reuse(records,d.batches.length),longAtLeast3000:reuse(records.filter(r=>r.length>=3000),d.batches.length),
        roots:new Set(records.map(r=>r.rootId)).size,finalLong:m.amount(finalLong),
        byVariant:byGroup(r=>r.profileType+'|'+r.color),byProfile:byGroup(r=>r.profileType),byLength:byGroup(bin),
        finalByVariant:distribution(final,r=>r.profileType+'|'+r.color),finalByLength:distribution(final,bin),
        finalFitsAnyHistoricalDemand:m.amount(finalAudit.filter(r=>r.fitsAnyHistoricalDemand)),
        finalFitsLaterExecutedDemand:m.amount(finalAudit.filter(r=>r.fitsLaterExecutedDemand)),finalAudit,
        ignoredFitEvents:sum(d.batches,b=>b.ignored.filter(r=>r.fitsDemand).length),
        ignoredFitUnique:new Set(d.batches.flatMap(b=>b.ignored.filter(r=>r.fitsDemand).map(r=>r.id))).size,
        physicalKeptScoreScrap:m.amount(tails.filter(t=>t.physicalDisposition==='stored'&&t.scoreDisposition==='scrap')),
        physicalScrappedScoreReusable:m.amount(tails.filter(t=>t.physicalDisposition==='scrap'&&t.scoreDisposition==='reusable')),
        scoreScrapKeptThenUsed:records.filter(r=>r.scoreDisposition==='scrap'&&r.usedBatch!==null).length,
        belowBaseline:{...reuse(extra,d.batches.length),bornMm:sum(extra,r=>r.length),finalMm:sum(extra.filter(r=>r.unusedAtEnd),r=>r.length)},
        batchRows:d.batches.map(b=>({batch:b.batch,orders:b.selectedIds.map(id=>Number(id.slice(6))),pieces:b.pieceCount,
            newBars:b.newBars,newMm:b.newLengthMm,before:b.before,used:b.usedOld,generated:b.generated,after:b.after,
            savedNewBars:b.savedNewBars,selection:b.selection,materialMs:b.result.materialMs,
            afterByVariant:distribution(b.inventoryAfterIds.map(id=>records.find(r=>r.id===id)),r=>r.profileType+'|'+r.color),
            afterByLength:distribution(b.inventoryAfterIds.map(id=>records.find(r=>r.id===id)),bin)}))};
    summary.scenarios[d.name]=s;
}
summary.permissiveSameBatchIds=reports[0].batches.every((b,i)=>JSON.stringify(b.selectedIds)===JSON.stringify(reports[4].batches[i].selectedIds));
summary.permissiveSameExecutedPlans=reports[0].batches.every((b,i)=>JSON.stringify(b.result.plan)===JSON.stringify(reports[4].batches[i].result.plan));
fs.writeFileSync(path.join(__dirname,'summary.json'),JSON.stringify(summary,null,2));
const num=n=>n===null?'–':Number(n.toFixed(3)).toString();
const qty=x=>x.count+' / '+num(x.mm/1000);
const table=(heads,rows)=>['| '+heads.join(' | ')+' |','| '+heads.map(()=> '---').join(' | ')+' |',...rows.map(row=>'| '+row.join(' | ')+' |')].join('\n');
let detail='# Replay-taulukot\n\nAutomaattisesti johdettu tallennetuista ajoista. Pituudet metreinä, ellei mm mainita. Varastomediaanit ovat toteutuneiden batchien jälkeisistä hetkistä ilman alkutilanteen nollavarastoa.\n\n';
detail+=table(['Profiili','Kpl','Lyhin mm','Eri mittoja'],Object.entries(demandByProfile).map(([p,v])=>[p,v.pieces,v.minMm,v.distinctLengths]));
detail+='\n\n'+table(['Skenaario','Batchit','Uudet kpl / m','Säästö kpl / m¹','Loppu kpl / m','Huippu kpl / m','Mediaani kpl / m','Loppupalan mediaani mm'],Object.entries(summary.scenarios).map(([n,s])=>[n,s.batches,s.newBars+' / '+num(s.newMm/1000),s.savedNewBars+' / '+num(s.savedNewMm/1000),qty(s.inventory.final),s.inventory.maxCount+' / '+num(s.inventory.maxMm/1000),s.inventory.medianCount+' / '+num(s.inventory.medianMm/1000),s.inventory.medianFinalLengthMm]));
detail+='\n\n¹ Samat valitut batchit ja rivijärjestys laskettuna ilman vanhoja jäännöksiä. Ei uuden batch-valinnan eikä globaalin optimin vertailu. Kappale- ja metrihuippu voivat osua eri batcheihin.\n';
for(const [name,s] of Object.entries(summary.scenarios)){
    detail+='\n## '+name+'\n\n'+table(['Batch','Tilaukset','Kpl','Uudet kpl / m','Ennen kpl / m','Käytetyt kpl / m','Syntyneet kpl / m','Jälkeen kpl / m','Säästö uusia kpl','Haku s'],s.batchRows.map(b=>[b.batch,b.orders.join('/'),b.pieces,b.newBars+' / '+num(b.newMm/1000),qty(b.before),qty(b.used),qty(b.generated),qty(b.after),b.savedNewBars,num(b.selection.elapsedMs/1000)]));
    detail+='\n\nKäytettyjen jäännösten metrit tarkoittavat kulutettujen lähteiden koko pituutta. Uuden materiaalin säästö on erillinen mittari. Syntynyt pala sisältää myös käytetystä vanhasta palasta jäävän uuden lapsipalan.\n\n';
    detail+=table(['Aika batchia','Käytetty / kaikki syntyneet','Osuus %','Täysin seurattu kohortti käytetty / syntynyt','Osuus %'],Object.entries(s.reuse.within).map(([k,v])=>[k,v.count+' / '+v.allBirthsDenominator,num(v.percent),v.fullyObservedUsed+' / '+v.fullyObservedBirths,num(v.fullyObservedPercent)]));
    detail+='\n\n'+table(['Profiili','Syntyi','Käytettiin','Loppuun jäi','Loppu m','Käytön mediaani batchia'],Object.entries(s.byProfile).map(([p,v])=>[p,v.born,v.used,v.unused,num(v.finalMm/1000),v.medianObservedAgeBatches??'–']));
    detail+='\n\n'+table(['Syntymäpituus mm','Syntyi','Käytettiin','Loppuun jäi','Loppu m'],Object.entries(s.byLength).map(([p,v])=>[p,v.born,v.used,v.unused,num(v.finalMm/1000)]));
    detail+='\n\n'+table(['Profiili ja väri','Syntyi','Käytettiin','Loppuun jäi','Loppu m'],Object.entries(s.byVariant).map(([p,v])=>[p.replace('|',' / '),v.born,v.used,v.unused,num(v.finalMm/1000)]));
    for(const b of s.batchRows){
        detail+='\n\n### Batch '+b.batch+': varaston jakauma sahauksen jälkeen\n\n';
        detail+=table(['Profiili / väri','Kpl','m'],Object.entries(b.afterByVariant).map(([p,v])=>[p.replace('|',' / '),v.count,num(v.mm/1000)]));
        detail+='\n\n'+table(['Pituus mm','Kpl','m'],Object.entries(b.afterByLength).map(([p,v])=>[p,v.count,num(v.mm/1000)]));
    }
}
fs.writeFileSync(path.join(__dirname,'TABLES.md'),detail+'\n');
for(const [n,s] of Object.entries(summary.scenarios))console.log(JSON.stringify({name:n,newBars:s.newBars,savedNewBars:s.savedNewBars,inventory:s.inventory}));
