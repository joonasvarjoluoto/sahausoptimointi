// Node-only, fail-closed experiment on the existing function. No second copy of
// pattern selection/physics: only storage and traversal of empty DP cells change.
function transformPatternFunction(source){
    function replaceOnce(pattern,replacement){
        const matches=source.match(new RegExp(pattern.source,'g'));
        if(matches?.length!==1)throw new Error('Sparse experiment anchor changed: '+pattern.source);
        source=source.replace(pattern,replacement);
    }
    replaceOnce(/const states = Array\.from\(\s*\{ length: capacity \+ 1 \},\s*\(\) => \[\]\s*\);/,
        'const states = new Map();');
    replaceOnce(/states\[0\]\.push\(new Array\(items\.length\)\.fill\(0\)\);/,
        'states.set(0, [new Array(items.length).fill(0)]);');
    // Snapshot existing capacities for each binary chunk, descending as before.
    // Newly reached capacities cannot reuse that same chunk.
    replaceOnce(/for \(\s*let sourceCapacity = capacity - chunk\.size;\s*sourceCapacity >= 0;\s*sourceCapacity--\s*\)/,
        'for (const sourceCapacity of [...states.keys()].filter(c => c <= capacity - chunk.size).sort((a,b) => b-a))');
    replaceOnce(/if \(states\[sourceCapacity\]\.length === 0\)/,'if (states.get(sourceCapacity).length === 0)');
    replaceOnce(/for \(const quantities of states\[sourceCapacity\]\)/,'for (const quantities of states.get(sourceCapacity))');
    replaceOnce(/states\[targetCapacity\] = keepDistinctPatterns\(\[\s*\.\.\.states\[targetCapacity\],\s*\.\.\.newPatterns\s*\]\);/,
        'states.set(targetCapacity, keepDistinctPatterns([...(states.get(targetCapacity) || []), ...newPatterns]));');
    replaceOnce(/for \(\s*let usedCapacity = capacity;\s*usedCapacity > 0 && candidates\.length < maxPatterns;\s*usedCapacity--\s*\) \{/,
        'for (const usedCapacity of [...states.keys()].filter(c => c > 0).sort((a,b) => b-a)) { if (candidates.length >= maxPatterns) break;');
    replaceOnce(/for \(const quantities of states\[usedCapacity\]\)/,'for (const quantities of states.get(usedCapacity))');
    return source;
}
function transformApp(source){
    const start=source.indexOf('function findCandidatePatternsDP(');
    const end=source.indexOf('function optimizeOrderDP(',start);
    if(start<0||end<=start)throw new Error('Pattern function boundaries changed');
    return source.slice(0,start)+transformPatternFunction(source.slice(start,end))+source.slice(end);
}
module.exports={transformPatternFunction,transformApp};
