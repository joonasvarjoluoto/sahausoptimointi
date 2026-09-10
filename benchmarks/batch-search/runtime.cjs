const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const files = ['src/cutting-physics.js', 'src/material.js', 'src/production-planning.js', 'src/production-integration.js', 'app.js'];
const sources = files.map(file => ({ file, code: fs.readFileSync(path.join(root, file), 'utf8') }));
const sourceHashes = Object.fromEntries(sources.map(s => [s.file, crypto.createHash('sha256').update(s.code).digest('hex')]));

function createRuntime(data, { cache = false, patternCache = false, profile = false, sparsePatterns = false, sourceOverrides = {} } = {}) {
    const runtimeSources = sources.map(source => ({
        ...source,
        code: sourceOverrides[source.file] ?? source.code
    }));
    const runtimeSourceHashes = Object.fromEntries(runtimeSources.map(source => [
        source.file,
        crypto.createHash('sha256').update(source.code).digest('hex')
    ]));
    const ctx = vm.createContext({ data, useCache: cache, usePatternCache:patternCache, profilePatterns:profile,
        console: { log() {}, table() {}, warn() {}, error() {} } });
    runtimeSources.forEach(s => new vm.Script(s.code, { filename: s.file }).runInContext(ctx, { timeout: 10000 }));
    if(sparsePatterns){
        const {transformPatternFunction}=require('./sparse-patterns.cjs');
        const original=vm.runInContext('findCandidatePatternsDP.toString()',ctx);
        vm.runInContext('findCandidatePatternsDP = ('+transformPatternFunction(original)+')',ctx);
    }
    vm.runInContext(`
        const orders = data.orders.map(o => createOrderInput(o.id, o.name, o.color, o.sections));
        const inventory = data.inventory || createMaterialInventory({stockLength:data.stockLength,
            newStock:Object.keys(PROFILE_TYPES).flatMap(profileType=>['gray','black','white'].map(color=>
                ({profileType,color,unlimited:true,quantity:null}))),remnants:[]});
        const fullSettings = PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS;
        const lightSettings = {...fullSettings,beamWidth:2,patternsPerState:2,candidatePoolSize:10};
        let lastValidatedResearchResult=null, bestValidatedResultSoFar=null;
        const cacheStore = new Map();
        const cacheStats = {hits:0,misses:0,evictions:0,eligibleRepeats:0};
        const seenGroups = new Set();
        const patternStore = new Map();
        const patternStats = {calls:0,hits:0,misses:0,evictions:0,computeMs:0};
        const originalPatterns = findCandidatePatternsDP;
        if(usePatternCache || profilePatterns)findCandidatePatternsDP = function(...args) {
            patternStats.calls++;
            // The pattern API is geometric only; availability is still checked separately.
            // Preserve exact item order and every argument, and return independent copies.
            const key=usePatternCache?JSON.stringify(args):null;
            if(usePatternCache && patternStore.has(key)) {patternStats.hits++;return JSON.parse(patternStore.get(key));}
            patternStats.misses++;
            const started=Date.now();
            const result=originalPatterns(...args);
            patternStats.computeMs+=Date.now()-started;
            if(usePatternCache){
                if(patternStore.size>=20000){patternStore.delete(patternStore.keys().next().value);patternStats.evictions++;}
                patternStore.set(key,JSON.stringify(result));
            }
            return result;
        };
        const originalGroupOptimizer = optimizeOrderInventoryBeamDP;
        optimizeOrderInventoryBeamDP = function(items,sources,kerf,options) {
            // Conservative exact-input key: includes source identities/quantities and all settings.
            // The pure group API has no order/opening provenance; final attachment remains unchanged.
            const key=JSON.stringify([items,sources,kerf,options]);
            if(seenGroups.has(key))cacheStats.eligibleRepeats++;
            if(seenGroups.size<10000)seenGroups.add(key);
            if(useCache && cacheStore.has(key)) {
                cacheStats.hits++;
                return JSON.parse(cacheStore.get(key));
            }
            cacheStats.misses++;
            const result=originalGroupOptimizer(items,sources,kerf,options);
            if(useCache && result.complete) {
                if(cacheStore.size>=1000){cacheStore.delete(cacheStore.keys().next().value);cacheStats.evictions++;}
                cacheStore.set(key,JSON.stringify(result));
            }
            return result;
        };
        function evaluateResearchBatch(ids,level,includePlan=false) {
            const selected=orders.filter(o=>ids.includes(o.id));
            if(selected.length!==ids.length)throw new Error('Unknown or duplicate order');
            const cuts=normalizeOrderCuts(selected);
            if(cuts.some(cut=>getMaterialSourcesForProfile(inventory,cut.profileType,cut.color).length===0))
                return {status:'not-found',reason:'missing-material-variant',cache:{...cacheStats}};
            const before=JSON.stringify([cuts,inventory]);
            const settings=level==='light'?lightSettings:fullSettings;
            const started=Date.now();
            const optimization=optimizeOrderByProfileTypeWithInventory(cuts,inventory,data.kerf,settings);
            const materialMs=Date.now()-started;
            verifyOptimizationResult(cuts,inventory,optimization);
            if(JSON.stringify([cuts,inventory])!==before)throw new Error('Mutated input');
            if(!optimization.complete)return {status:'not-found',materialMs,cache:{...cacheStats}};
            const score=scoreCompleteMaterialTransitionPlan(optimization,settings.scoreSettings);
            const plan=adaptMaterialOptimizationForUi(optimization,settings.scoreSettings);
            const schedulerStart=Date.now();
            const execution=createProductionExecution(plan,selected,data.kerf);
            const schedulerMs=Date.now()-schedulerStart;
            const sum=(bars,key)=>bars.reduce((n,b)=>n+b[key],0);
            const reusable=optimization.bars.filter(b=>b.remaining>0 && evaluateRemnantDisposition(b.remaining,settings.scoreSettings).disposition==='reusable');
            const scrap=optimization.bars.filter(b=>b.remaining>0 && evaluateRemnantDisposition(b.remaining,settings.scoreSettings).disposition==='scrap');
            const result = {status:'complete',materialMs,schedulerMs,score:score.totalCostEquivalent,scoreComponents:score,
                ids,pieceCount:cuts.reduce((n,c)=>n+c.quantity,0),requiredLengthMm:cuts.reduce((n,c)=>n+c.quantity*c.length,0),
                newBars:optimization.bars.filter(b=>b.source==='new').length,
                newLengthMm:sum(optimization.bars.filter(b=>b.source==='new'),'sourceLength'),
                oldRemnantSources:optimization.bars.filter(b=>b.source!=='new').length,
                kerfMm:sum(optimization.bars,'waste'),scrapMm:sum(scrap,'remaining'),
                reusableCount:reusable.length,reusableMm:sum(reusable,'remaining'),
                cutOperations:execution.metrics.cutOperationCount,cache:{...cacheStats},
                ...(includePlan?{plan,execution}: {})};
            lastValidatedResearchResult={...result,plan,execution};
            return result;
        }
    `, ctx, { timeout: 10000 });
    return {
        sourceHashes: runtimeSourceHashes,
        patterns(items,length,kerf,limit) {
            ctx.patternRequest={items,length,kerf,limit};
            return JSON.parse(vm.runInContext('JSON.stringify(findCandidatePatternsDP(patternRequest.items,patternRequest.length,patternRequest.kerf,patternRequest.limit))',ctx,{timeout:60000}));
        },
        normalizeInventory(availability) {
            ctx.inventoryRequest=availability;
            return JSON.parse(vm.runInContext('JSON.stringify(createMaterialInventory(inventoryRequest))',ctx));
        },
        patternStats() { return JSON.parse(vm.runInContext('JSON.stringify(patternStats)',ctx)); },
        retainBest() { vm.runInContext('bestValidatedResultSoFar=lastValidatedResearchResult',ctx); },
        getBest() { return JSON.parse(vm.runInContext('JSON.stringify(bestValidatedResultSoFar)',ctx)); },
        describe() { return JSON.parse(vm.runInContext(`JSON.stringify({fullSettings,lightSettings,
            orders:orders.map(o=>({id:o.id,color:o.color,pieceCount:normalizeOrderCuts([o]).reduce((n,p)=>n+p.quantity,0),
                requiredLengthMm:normalizeOrderCuts([o]).reduce((n,p)=>n+p.quantity*p.length,0)}))})`, ctx)); },
        evaluate(ids, level = 'full', timeoutMs = 60000, includePlan = false) {
            ctx.request = { ids, level, includePlan };
            const start = performance.now();
            try {
                const result = JSON.parse(vm.runInContext('JSON.stringify(evaluateResearchBatch(request.ids,request.level,request.includePlan))', ctx,
                    { timeout: Math.max(1, Math.ceil(timeoutMs)) }));
                return { ...result, level, elapsedMs: performance.now() - start };
            } catch (error) {
                if (error.code !== 'ERR_SCRIPT_EXECUTION_TIMEOUT') throw error;
                return { status: 'timeout', ids, level, elapsedMs: performance.now() - start };
            }
        }
    };
}
module.exports = { createRuntime, sourceHashes };
