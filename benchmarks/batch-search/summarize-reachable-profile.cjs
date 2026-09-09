const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const dir = path.join(__dirname, 'reachable-profile');
const read = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
const root = path.resolve(__dirname, '../..');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const validation = { runs: 0, variants: 0, comparedCalls: 0, passed: false };
// Reject mixed source versions, changed inputs or instrumentation that changes the search.
for (const name of ['hard', 'fast']) {
    const runs = ['baseline-1','baseline-2','baseline-3','counts-1','sample-1','cpu-1']
        .map(suffix => read(name + '-' + suffix + '.json'));
    const baseline = runs[0];
    for (const run of runs) {
        assert.equal(run.exactReferenceMatch, true);
        for (const key of ['ids','node','sourceHashes','fixtureHash','inventoryHash','settings','planHash','score']) {
            assert.deepEqual(run[key], baseline[key], name + ': ' + key);
        }
        assert.equal(run.measurements.length, baseline.measurements.length);
        run.measurements.forEach((variant, index) => {
            for (const key of ['profile','color','items','sources','stats']) {
                assert.deepEqual(variant[key], baseline.measurements[index][key], name + ': variant ' + index + ' ' + key);
            }
            validation.variants++;
        });
        validation.runs++;
    }
    for (const [file, expected] of Object.entries(baseline.sourceHashes)) {
        assert.equal(hash(fs.readFileSync(path.join(root, file), 'utf8')), expected, 'Source changed: ' + file);
    }
    assert.equal(hash(JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, 'orders-23.json'), 'utf8')))), baseline.fixtureHash);
    const inventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'inventory-study/scenarios.json'), 'utf8')).scenarios.A.inventory;
    assert.equal(hash(JSON.stringify(inventory)), baseline.inventoryHash);
    const counts = runs[3], sampled = runs[4];
    assert.equal(sampled.instrumentationVersion, 2);
    counts.measurements.forEach((variant, index) => {
        const other = sampled.measurements[index];
        assert.equal(other.uniquePatternInputs, variant.uniquePatternInputs);
        assert.equal(other.uniqueDemandInputs, variant.uniqueDemandInputs);
        assert.equal(other.calls.length, variant.calls.length);
        variant.calls.forEach((call, callIndex) => {
            for (const key of Object.keys(call).filter(k => !['ms','ordinal'].includes(k) && !/Sample/.test(k))) {
                assert.deepEqual(other.calls[callIndex][key], call[key], name + ': call ' + callIndex + ' ' + key);
            }
            validation.comparedCalls++;
        });
    });
}
validation.passed = true;
fs.writeFileSync(path.join(dir, 'validation.json'), JSON.stringify(validation, null, 2));
const sum = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);
const distribution = values => {
    values = [...values].sort((a,b) => a-b);
    return { min: values[0], median: values[Math.floor(values.length / 2)],
        p95: values[Math.min(values.length-1, Math.floor(values.length * .95))], max: values.at(-1),
        sum: values.reduce((a,b) => a+b, 0), mean: values.reduce((a,b) => a+b, 0) / values.length };
};
function chunks(items, length, kerf = 3) {
    let count = 0;
    for (const item of items) {
        let left = Math.min(item.quantity, Math.floor((Math.round(length*10)+Math.round(kerf*10))/(Math.round(item.length*10)+Math.round(kerf*10))));
        for (let chunk=1; left>0; chunk*=2) { left-=Math.min(chunk,left); count++; }
    }
    return count;
}
function cpu(file) {
    const p = read(file), nodes = new Map(p.nodes.map(n => [n.id,n])), parents = new Map();
    for (const n of p.nodes) for (const child of n.children || []) parents.set(child,n.id);
    const self = {}, inclusive = {};
    let totalUs = 0;
    for (let i=0;i<p.samples.length;i++) {
        const us = p.timeDeltas[i]; totalUs += us;
        let id = p.samples[i];
        const label = n => (n.callFrame.functionName || '(anonymous)') + '@' + n.callFrame.url + ':' + (n.callFrame.lineNumber+1);
        const leaf = label(nodes.get(id)); self[leaf] = (self[leaf] || 0) + us;
        const seen = new Set();
        while (id) {
            const name = nodes.get(id).callFrame.functionName || '(anonymous)';
            if (!seen.has(name)) inclusive[name] = (inclusive[name] || 0) + us;
            seen.add(name); id = parents.get(id);
        }
    }
    const ranked = obj => Object.entries(obj).sort((a,b) => b[1]-a[1]).map(([name,us]) => ({name,ms:us/1000,percent:us/totalUs*100}));
    return { sampleCount:p.samples.length, totalMs:totalUs/1000, self:ranked(self).slice(0,35),
        inclusive:ranked(inclusive).slice(0,25),
        positionTicks:p.nodes.filter(n => ['keepDistinctPatterns','findCandidatePatternsDP','compareQuantities'].includes(n.callFrame.functionName))
            .map(n => ({frame:n.callFrame,hitCount:n.hitCount,positionTicks:n.positionTicks})) };
}
const summary = {};
for (const name of ['hard','fast']) {
    const baseline = [1,2,3].map(n => read(name+'-baseline-'+n+'.json'));
    const counts = read(name+'-counts-1.json');
    const sampleFile = path.join(dir,name+'-sample-1.json');
    const sample = fs.existsSync(sampleFile) ? read(name+'-sample-1.json') : null;
    const variants = counts.measurements.map(v => {
        const calls = v.calls, timing = sample?.measurements.find(s => s.profile===v.profile && s.color===v.color);
        const lengths = [...v.items].sort((a,b) => a.length-b.length);
        const totals = Object.fromEntries(['chunks','transitions','copies','copiedElements','keepCalls','inputPatterns','uniquePatterns','retainedPatterns','capacityKeysSorted','returned'].map(k => [k,sum(calls,k)]));
        const timings = timing && Object.fromEntries(['keepSamples','copySamples','copySampleMs','dedupSampleMs','sortSampleMs'].map(k => [k,sum(timing.calls,k)]));
        const sourceRows = v.sources.map(s => ({...s,initialChunks:chunks(v.items,s.sourceLength)}));
        return { profile:v.profile,color:v.color,pieces:sum(v.items,'quantity'),lengthCount:v.items.length,
            // Sorted for reporting only. The VM always receives the original order.
            lengths,nearLengths:lengths.slice(1).filter((v,i) => v.length-lengths[i].length<=10)
                .map(v => [lengths[lengths.indexOf(v)-1].length,v.length]),
            sources:sourceRows,remnantPhysicalCount:sum(v.sources.filter(s=>s.source==='remnant'),'quantity'),
            baselineMs:distribution(baseline.map(b=>b.measurements.find(m=>m.profile===v.profile&&m.color===v.color).ms)),
            beam:v.stats,calls:calls.length,uniqueInputs:v.uniquePatternInputs,uniqueDemands:v.uniqueDemandInputs,
            reachable:distribution(calls.map(c=>c.reachable)),chunksPerCall:distribution(calls.map(c=>c.chunks)),totals,
            maxKeepInput:Math.max(...calls.map(c=>c.maxKeepInput)),maxKeepDistinct:Math.max(...calls.map(c=>c.maxKeepDistinct)),
            patternMs:sum(calls,'ms'),repeatedCalls:calls.filter(c=>c.repeated).length,
            repeatedPatternMs:sum(calls.filter(c=>c.repeated),'ms'),timings,
            sourceWork:sourceRows.map(s=>{const c=calls.filter(c=>c.length===s.sourceLength);return {length:s.sourceLength,
                calls:c.length,ms:sum(c,'ms'),keepCalls:sum(c,'keepCalls'),patterns:sum(c,'inputPatterns')};}) };
    });
    summary[name] = { ids:counts.ids,score:counts.score.totalCostEquivalent,planHash:counts.planHash,
        baselineMs:baseline.map(b=>b.elapsedMs),materialMedianMs:distribution(baseline.map(b=>b.materialMs)).median,
        countRunMs:counts.elapsedMs,sampleRunMs:sample?.elapsedMs,
        schedulerMedianMs:distribution(baseline.map(b=>b.schedulerMs)).median,
        variants,cpu:cpu(name+'-cpu-1.cpuprofile') };
}
fs.writeFileSync(path.join(dir,'summary.json'),JSON.stringify(summary,null,2));
const fmt = (n, decimals=0) => Number(n).toLocaleString('fi-FI',{minimumFractionDigits:decimals,maximumFractionDigits:decimals});
const table = (headers, rows) => ['| '+headers.join(' | ')+' |','| '+headers.map(()=>'---').join(' | ')+' |',
    ...rows.map(r=>'| '+r.join(' | ')+' |')].join('\n');
const h = summary.hard, f = summary.fast;
const horizontal = s => s.variants.find(v=>v.profile==='horizontalProfile'&&v.color==='gray');
const hv = horizontal(h), fv = horizontal(f);
const rows = Object.entries(summary).flatMap(([name,s])=>s.variants.map(v=>[name,v.profile+'/'+v.color,v.pieces,v.lengthCount,
    fmt(v.baselineMs.median),v.sources.length,v.remnantPhysicalCount,v.beam.statesExpanded,fmt(v.beam.statesGenerated),v.beam.maxBeamSize]));
const metrics = Object.entries(summary).flatMap(([name,s])=>s.variants.map(v=>[name,v.profile+'/'+v.color,
    fmt(v.calls),fmt(v.totals.chunks),fmt(v.chunksPerCall.max),fmt(v.reachable.sum),fmt(v.reachable.median),fmt(v.reachable.p95),fmt(v.reachable.max),fmt(v.totals.keepCalls)]));
const patterns = Object.entries(summary).flatMap(([name,s])=>s.variants.map(v=>[name,v.profile+'/'+v.color,
    fmt(v.totals.copies),fmt(v.totals.inputPatterns),fmt(v.totals.uniquePatterns),fmt(v.totals.retainedPatterns),fmt(v.totals.returned)]));
const report = `# A-varaston vaikean batchin kuviolaskennan profilointi — 9.9.2026

Batchin 3/9/21 noin 35 sekunnin laskenta kuluttaa 98,2 % materiaalilaskenta-ajasta harmaaseen Vaakaprofiiliin. Sen 74 kappaletta ja 13 eri lyhyttä mittaa synnyttävät paljon vaihtoehtoisia määrävektoreita samoihin kapasiteetteihin. Kumulatiivinen pattern-käsittely kasvaa paljon enemmän kuin saavutettujen kapasiteettien tai beam-tilojen määrä. CPU-otannassa keepDistinctPatterns kattaa noin 76 % koko ajosta, ja määrävektorin join-avaimen muodostus on sen selvästi raskain rivi.

Productioniin ei tehty muutoksia. Pohja on commit 4d967b66b4a5268249e22455155b2e36dc0fc6c5. Tarkat lähde-, fixture- ja inventaariohashit ovat jokaisessa ajotiedostossa. Kaikki 12 ajoa vertasivat koko tankosuunnitelmaa, scorea ja scheduler-operaatioita aiemmin tallennettuun referenssiin ja läpäisivät vertailun. Instrumentoinnilla mitataan samaa hakua; mitään välimuistia tai uusia hakujärjestyksiä ei käytetä.

## Asetelma ja mittauksen rajat

- Vaikea: tilaukset 3/9/21, 200 kappaletta. Vertailu: 1/4/17/18, myös 200 kappaletta. Tilaus 16 ei kuulu aineistoon.
- Molemmat käyttävät täsmälleen samaa kanonisoitua A-varastoa (100 fyysistä jäännöstä / 98 riviä), rajattomia 6000 mm uusia lähteitä ja 3 mm kerfiä. Koko jonosta ei haeta batchia; valitut tilaukset lasketaan sellaisinaan alkuperäisessä fixturejärjestyksessä.
- Normaalit asetukset: beamWidth 20 ja patternsPerState 10, muuttamattomat scoreSettings. Kaikki kuusi profiilia lasketaan väreittäin erikseen.
- Jokainen ajo on uusi Node-prosessi ja uusi VM. Ajot suoritettiin peräkkäin. Käynnistys, VM:n lataus, tiedostoluku ja tuloksen vertailu/tallennus jäävät raportoidun kokonaisajan ulkopuolelle; validointi, UI-adapteri, scheduler ja mittaustuloksen serialisointi sisältyvät.
- Baseline sisältää vain yhden ajastuksen per variantti. Kolme toistoa erottavat vaihtelun ilmiöstä. Ne eivät ole p95-palvelulupaus.
- Counts lisää kokonaislukulaskurit, kuviokutsukohtaisen ajastuksen ja täsmällisen syöteavaimen uusintojen tunnistukseen. Se ei kutsu kelloa jokaisessa kapasiteetti- tai pattern-iteraatiossa. Counts-ajon aikaa ei käytetä production-nopeutena: vaikea ajo kestää ${fmt(h.countRunMs/1000,2)} s, noin ${fmt((h.countRunMs/h.materialMedianMs-1)*100,0)} % baseline-mediaania enemmän. Mittarien keruu ja JIT-vaikutus ovat siis näkyviä.
- CPU on erillinen, sisäisiltä laskureiltaan muuttamaton ajo Node inspectorin 1000 µs otannalla. Vaikean profiloidun ajon kesto on noin 39,15 s. Taulukon funktioajat ovat pinonäytteiden aikapainotettuja arvioita, eivät eksakteja funktioajastuksia. GC ja V8:n inlining voivat sijoittaa aikaa kutsujalle tai erilliseen kehykseen.
- Sample-ajossa kellot lisätään vain noin joka 1024. keep-kutsuun ja vastaavaan kopiointiryhmään. Valinta käyttää kutsukohtaisesti suolattua kokonaislukuhajautuksen yläosaa, joten myös lyhyiden kuviokutsujen alku voi tulla mukaan. Samplattuun dedup-vaiheeseen kuuluu join sekä Map-operaatiot; sort-vaiheeseen values-kopio, lajittelu ja slice. Otos on suuntaa antava vaihe-erittely, jota ei summata CPU-aikojen päälle. Ensimmäinen systemaattinen otos korvattiin tällä tasaisemmin hajautetulla otoksella.

## Tavalliset toistoajat

${table(['Ajo','Vaikea kokonais-s','Vertailu kokonais-s'],[0,1,2].map(i=>[i+1,fmt(h.baselineMs[i]/1000,3),fmt(f.baselineMs[i]/1000,3)]))}

Vaikean materiaalilaskennan mediaani on ${fmt(h.materialMedianMs/1000,3)} s ja vertailun ${fmt(f.materialMedianMs/1000,3)} s. Harmaan Vaakaprofiilin mediaanit ovat ${fmt(hv.baselineMs.median/1000,3)} s ja ${fmt(fv.baselineMs.median/1000,3)} s: ero ${fmt(hv.baselineMs.median/fv.baselineMs.median,1)}-kertainen. Schedulerin mediaanit ovat ${fmt(h.schedulerMedianMs,2)} ms ja ${fmt(f.schedulerMedianMs,2)} ms. Materiaalipisteet ovat ${fmt(h.score,6)} ja ${fmt(f.score,6)}; eri kysyntöjen pisteitä ei käytetä nopeuden selityksenä.

## Variantit, kysyntä ja beam

${table(['Tapaus','Profiili/väri','Kpl','Eri mittoja','Mediaani ms','Lähderivit','Jäännöksiä kpl','Beam laajennettu','Lapsitiloja','Beam max'],rows)}

Lähderivit tarkoittavat variantin saatavilla olevia pituus-/alkuperärivejä, eivät uusien tankojen fyysistä määrää (uusi materiaali on rajaton). Beam-tilat ovat productionin omat stats-laskurit. Täydet deduplikointi-, valmistumis- ja fallback-tilastot säilyvät JSONissa. Fallback ei käynnistynyt kummassakaan tapauksessa.

## Kysynnän pituusjakaumat

Raportin pituudet on lajiteltu vain lukemista varten. Laskennan sisäistä rivijärjestystä ei muuteta.

${Object.entries(summary).flatMap(([name,s])=>s.variants.map(v=>'- '+name+' '+v.profile+'/'+v.color+': '+v.lengths.map(i=>i.length+' mm × '+i.quantity).join('; ')+'. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): '+(v.nearLengths.map(p=>p.join('/')).join(', ')||'ei')+'.')).join('\n')}

Vaikean Vaakaprofiilin kaikki 13 mittaa ovat 488–1046 mm. Niitä mahtuu yksittäiseen lähteeseen useita, mikä mahdollistaa paljon määrävektoriyhdistelmiä. 634/638/640/643 mm ja 581/585 mm ovat läheisiä; myös muut yhdistelmät voivat osua samaan käytettyyn pituuteen. Tämä on havaittua rakennetta ja selittävä mekanismi, ei erillinen koe läheisten mittojen kausaalivaikutuksesta. Esimerkiksi vaikean batchin kiskoilla on myös 13 mittaa mutta vain 13 kappaletta ja pidemmät pituudet: pelkkä erilaisten mittojen lukumäärä ei selitä hitautta.

## Kuviokutsut, määrälohkot ja saavutetut kapasiteetit

${table(['Tapaus','Profiili/väri','DP-kutsut','Chunkit yht.','Chunk max/kutsu','Kapasiteetit yht.','Mediaani/kutsu','P95/kutsu','Huippu/kutsu','keep-kutsut'],metrics)}

Chunkit lasketaan varsinaisessa funktiossa lähdepituudella rajatun binäärisen hajotelman jälkeen. Kapasiteettisumma on jokaisen kutsun lopullisten saavutettujen kapasiteettien summa, sisältäen nollatilan. Sama kapasiteetti eri kutsussa lasketaan uudelleen; luku ei ole yhtä aikaa muistissa oleva koko. Kapasiteettien määrä kasvaa monotonisesti kutsun sisällä, joten lopullinen koko on myös kyseisen kutsun huippu. Kaikkien kutsujen arvot ovat counts-JSONin calls-taulukossa.

Vaikean harmaan Vaakaprofiilin ensimmäisessä 6000 mm kutsussa on 39 chunkia, vertailussa 28 (jäännöslähteillä 39 ja 27). Huippukapasiteetit ${fmt(hv.reachable.max)} vs ${fmt(fv.reachable.max)} kasvavat vain ${fmt(hv.reachable.max/fv.reachable.max,2)}-kertaisiksi. Lopullisten kapasiteettien kumulatiivinen määrä kasvaa ${fmt(hv.reachable.sum/fv.reachable.sum,2)}-kertaiseksi, mutta keep-kutsut ${fmt(hv.totals.keepCalls/fv.totals.keepCalls,2)}-kertaisiksi ja käsiteltävät pattern-viittaukset ${fmt(hv.totals.inputPatterns/fv.totals.inputPatterns,2)}-kertaisiksi. Vaikean huippu on vain noin 6,6 % 60 031 mahdollisesta kapasiteetista: pääongelma ei ole täyden kapasiteettitaulukon paluu.

## Pattern-työ ennen ja jälkeen deduplikoinnin

${table(['Tapaus','Profiili/väri','Uusia vektorikopioita','keep syöte','Distinct ennen kiintiötä','Säilytetty kiintiön jälkeen','Palautetut kuviot'],patterns)}

Kaikki keep-luvut ovat kumulatiivisia välivaihelukuja: jo säilytetty vektori voidaan lukea taas seuraavassa päivityksessä. Distinct ei tarkoita kaikkien ajon kuvioiden globaalia uniikkimäärää. Vaikealla Vaakaprofiililla syntyy ${fmt(hv.totals.copies)} uusia määrävektoreita; kopioitavia vektorielementtejä kertyy ${fmt(hv.totals.copiedElements)} (vertailussa ${fmt(fv.totals.copiedElements)}). keep syötteessä jokainen viittaus aiheuttaa yhden join-avaimen.

Vaikeassa tapauksessa ${fmt(hv.totals.inputPatterns)} syöteviittauksesta jää deduplikoinnin jälkeen ${fmt(hv.totals.uniquePatterns)}, ja kymmenen kuvion kiintiön jälkeen ${fmt(hv.totals.retainedPatterns)}. Duplikaatteja poistuu ${fmt((1-hv.totals.uniquePatterns/hv.totals.inputPatterns)*100,1)} %, ja kiintiö leikkaa ${fmt(hv.totals.uniquePatterns-hv.totals.retainedPatterns)} välivaiheviittausta. Yhdessä keep-kutsussa on korkeintaan 20 syötekuviota / 20 uniikkia; säilytettyjä korkeintaan 10. Siis yksittäinen distinct-joukko on rajattu, mutta toistuvien pienten joukkojen käsittely on valtava.

## Mihin aika kuluu

${table(['Funktio/kehys','Vaikea CPU-arvio ms','Osuus %','Vertailu CPU-arvio ms'],h.cpu.inclusive.filter(r=>['findCandidatePatternsDP','keepDistinctPatterns','compareQuantities','(garbage collector)'].includes(r.name)).map(r=>[r.name,fmt(r.ms),fmt(r.percent,2),fmt(f.cpu.inclusive.find(v=>v.name===r.name)?.ms||0)]))}

Inclusive-rivit ovat sisäkkäisiä: keep sisältyy DP:hen, ja compareQuantities sisältyy keepiin. Niitä ei saa laskea yhteen. CPU-ajon keep-osuus 76,1 % vastaa sen omassa noin 39 s ajossa 29,84 sekuntia. Jos osuus siirretään baseline-mediaaniin, karkea arvio on noin 26,4 sekuntia keepin alla; tämä on arvio eikä erikseen mitattu eksakti aika.

Keepin omista positionTicks-näytteistä 13 070 / 18 400 (71,0 %) osuu app.js:n riville 2953, quantities.join(','). Tämä tukee noin puolen koko ajoajan käyttämistä avainten muodostukseen, mutta JIT/inlining estää tarkkojen yksittäisoperaatiosekuntien väittämisen. Mapin luonti, has/set, values-taulukko ja sort näkyvät myös. findCandidatePatternsDP:n omissa näytteissä (15,75 % koko ajosta) näkyvät määrävektorin kopiointi rivillä 2992, syötteen array-levitykset rivillä 3002 ja kapasiteettien sort rivillä 2979. findMaterialSourceCandidates-kehykselle kohdistuu 3,36 % ja GC:lle noin 2,8 %; muistin varaukset ovat merkittävä sivukulu mutta eivät yksin selitä 35 sekuntia. Scoring, sahausfysiikka ja scheduler eivät ole pääpullonkaula.

${table(['Tapaus / Vaakaprofiili harmaa','Otoksia','Kopiointiryhmät ms otoksessa','join+Map ms otoksessa','values+sort+slice ms otoksessa'],[hv,fv].map((v,i)=>[i?'fast':'hard',v.timings?.keepSamples,fmt(v.timings?.copySampleMs,3),fmt(v.timings?.dedupSampleMs,3),fmt(v.timings?.sortSampleMs,3)]))}

Otosajat eivät ole koko ajon aikoja, eikä jokaisen join-kutsun ympärille lisätty kelloa. Ne näyttävät vaiheiden keskinäistä suuruusluokkaa. Sample-ajojen kokonaisajat ovat ${fmt(h.sampleRunMs/1000,2)} s ja ${fmt(f.sampleRunMs/1000,2)} s; niitä ei käytetä production-nopeuksina. Count- ja sample-ajojen jokaisen ${fmt(validation.comparedCalls)} DP-kutsun kuviotyömäärät täsmäävät. Kaikkien ${validation.runs} ajon ${validation.variants} varianttituloksen kysyntä, lähteet ja beam-tilastot täsmäävät saman tapauksen baselineen. Myös lähde- ja aineistohashit tarkistetaan nykyisiin tiedostoihin; validation.json tallentaa tarkistuksen yhteenvedon.

## Toistuvat kuviokutsut ja lähteet

Vaikealla Vaakaprofiililla on ${hv.calls} kutsua, ${hv.uniqueInputs} täsmälleen erilaista [items järjestyksineen ja määrineen, sourceLength, kerf, limit] -syötettä sekä ${hv.uniqueDemands} erilaista kysyntäsyötettä ilman lähdepituutta. ${hv.repeatedCalls} täsmällistä uusintaa kuluttaa counts-ajossa yhteensä vain ${fmt(hv.repeatedPatternMs,2)} ms / ${fmt(hv.patternMs,0)} ms kuviolaskenta-ajasta. Lähdepituuksien väliset kutsut ovat samankaltaisia, mutta eivät samoja; kapasiteettiraja muuttaa chunkien rajauksia ja välitiloja, joten tuloksia ei voi yhdistää pelkällä epätarkalla avaimella.

${table(['Vaakaprofiili harmaa, lähde mm','Vaikea kutsut','Vaikea keep-kutsut','Vertailu kutsut','Vertailu keep-kutsut'],hv.sourceWork.map((r,i)=>[r.length,r.calls,fmt(r.keepCalls),fv.sourceWork[i].calls,fmt(fv.sourceWork[i].keepCalls)]))}

Kummallakin on samat neljä jäännöstä 5447,8 / 5172,5 / 5005,4 / 4901,7 mm ja rajaton uusi 6000 mm. Materiaalilähteiden määrä ei siis selitä eroa. Beam laajentaa 201 vs 161 tilaa, ja max on molemmissa 20. Vertailun koko batchilla on jopa enemmän variantteja ja DP-kutsuja: kutsumäärä tai beam-leveys ei ole ensisijainen syy.

## Kolme rajattua optimointivaihtoehtoa

1. **Yhdistä kaksi jo järjestettyä pattern-listaa suoraan.** Kohdekapasiteetin vanha lista on lexicografisesti järjestetty, uniikki ja enintään 10 pitkä. Lähdekapasiteetin lista on samoin järjestetty; saman itemIndex-komponentin vakiosiirto säilyttää sen järjestyksen ja uniikkiuden myös uusissa vektoreissa. Kahden listan merge voi vertailla compareQuantities-säännöllä, poistaa identtiset vierekkäiset vektorit ja pysähtyä kymmenenteen. Tasatilanteessa valitaan vanhan listan ensimmäinen vektori kuten nykyisen Mapin first-wins-logiikassa. Tämä poistaa join-avaimet, Mapin ja yleisen sortin. Muistia tarvitaan vain enintään 10 tulosviittaukseen nykyisen usean välirakenteen sijaan. Monimutkaisuus on pieni/keskisuuri; riski on väärä järjestys-, dedup- tai katkaisuehto. Potentiaali on suurin: kohde on noin 76 % CPU-ajasta. Teoreettinen nollakustannuksen yläraja on noin 4,2× koko ajolle; käytännön 1,5–3× on tutkimushypoteesi, ei mitattu lupaus. Kuviojoukkoa, järjestystä, tasatilanteita tai beam-semanttiikkaa ei tarvitse muuttaa.

2. **Laske muuttumattoman määrävektorin avain vain kerran.** WeakMap vektorioliosta sen join-avaimeen voisi säilyttää nykyisen Map-deduplikoinnin ja sortin. Vaakaprofiililla 48,6 miljoonaa keep-viittausta mutta 17,1 miljoonaa uutta vektorikopiota viittaa enintään noin 65 % join-uusintojen poistopotentiaaliin; todellinen hyöty riippuu avainvälimuistin hinnasta ja vektorien elinkaaresta. Jos join on noin puolet ajasta, karkea laskennallinen yläraja tällä osuudella on noin 1,5× ennen välimuistin kustannusta. Muistia kuluu lisää elävien vektorien avaimiin ja WeakMapiin; pysyvä tavallinen Map voisi pitää kuolleet vektorit turhaan muistissa. Monimutkaisuus pieni, semanttinen riski pieni vain jos vektorien muuttumattomuus varmistetaan. Ei muutosta kuviojoukkoon, järjestykseen, tasatilanteisiin tai beam-hakuun. Tämä on vaihtoehto mergelle, ei automaattisesti sen päälle lisättävä ratkaisu.

3. **Ohita yleinen dedup/sort tyhjälle kohdekapasiteetille.** Kun kohdetta ei vielä ole, uusi lista on yksinään jo järjestetty ja uniikki. Siinä on enintään 10 vektoria. Tällöin keep-rakenteita ei tarvita. Vaakaprofiilin uusien kohteiden määrä on saavutettujen kapasiteettien summa miinus nollatilat eli ${fmt(hv.reachable.sum-hv.calls)} / ${fmt(hv.totals.keepCalls)} päivitystä (noin ${fmt((hv.reachable.sum-hv.calls)/hv.totals.keepCalls*100,1)} %). Nämä ovat keskimäärin pienempiä listoja, joten prosentti ei ole sama kuin säästettävä aika; potentiaali on todennäköisesti selvästi mergeä pienempi ja mitattava erikseen. Lisämuistia ei tarvita, välivaraukset vähenevät. Monimutkaisuus hyvin pieni. Semantiikka voi säilyä täysin, mutta uusien listojen järjestys/uniikkius ja myöhempi mutatoimattomuus on todistettava. Hyöty limittyy merge-vaihtoehdon kanssa.

Täsmällisen kokonaisen kuviotuloksen välimuistia ei suositella ensimmäiseksi: mitattu uudelleenlaskennan ajansäästö on tässä vaikeassa variantissa vain millisekuntien luokkaa. Mittojen yhdistäminen, pyöristäminen, rivien uudelleenjärjestäminen, kiintiön pienentäminen tai beam-haun karsiminen muuttaisivat hakua eivätkä kuulu näihin ehdotuksiin.

## Hyväksymistestit mahdolliselle seuraavalle toteutukselle

- Vertaile vanhaa ja ehdotettua keep/merge-tulosta samoilla järjestetyillä listoilla: identtiset vektorit listojen välillä, tyhjä kohde, yksi kuvio, täydet 10+10 listat, kiintiö 1/2/10, erot vasta viimeisessä vektorikomponentissa ja old-first-tasatilanne. Uusien vektorien muodostuksen pitää käyttää alkuperäistä item-järjestystä.
- Aja nykyiset 1 354 järjestettyä kuvioregressiota sekä koko plan/score/operation-vertailu; lisää kerf 0/3/3,4, 0,1 mm rajat, binäärisen hajotelman loppulohkot ja äärelliset lähteet. Pelkkä sama score ei riitä.
- Vaikean ja nopean tapauksen koko suunnitelman sekä beam stats -lukujen tulee säilyä. Syötteet ja rinnakkaiset tilat eivät saa mutatoitua. Avainvälimuistin tapauksessa varmista erikseen vektorien elinkaari ja että avain ei jää vanhaksi mutaation jälkeen.
- Core 35/35, production/persistence 18/18 ja productioniin siirrettäessä vähintään oikea selainpolku. Mittaa nopeus instrumentointia käyttämättä vähintään kolmella peräkkäisellä toistolla sekä muistivaikutus erikseen.

## Toistaminen ja tiedostot

Tämän tutkimuksen lopputarkistukset: core-ajurin 35/35 ryhmää, tuotannon ohjaus-/persistenssit 18/18, 1 354 järjestettyä kuviotapausta, 14 tallennettua kokonaista suunnitelmaa samoine scoreineen ja operaatioineen sekä yksi aiemmin aikakatkaistu tapaus valmistunutta referenssiä vasten läpäistiin. Molempien uusien apurien syntaksitarkistus ja git diff --check läpäistiin. Gitin seuraamiin tiedostoihin ei jäänyt eroja HEADiin; lisäykset ovat vain tämän tutkimuksen benchmark-apurit, raportti ja mittausaineisto. Selaintestiä ei ajettu tässä Node-profilointitehtävässä.

Projektijuuresta: node benchmarks/batch-search/profile-reachable.cjs hard baseline 1. Vaihda hard → fast, baseline → counts/cpu/sample ja toiston numero tarpeen mukaan. Baseline ajettiin numeroilla 1–3, muut tilat numerolla 1. Aja peräkkäin. Sen jälkeen node benchmarks/batch-search/summarize-reachable-profile.cjs kokoaa summary.jsonin ja tämän raportin. Node käyttää vain sisäänrakennettuja moduuleja. Koodi ei kirjoita production-tiedostoihin, inventory-study-fixtureihin tai selainvarastoon.

reachable-profile/*.json sisältävät varianteittaiset tiedot ja counts/sample-ajoissa jokaisen DP-kutsun laskurit. *.cpuprofile ovat Node inspectorin raakanäytteitä. Baseline-ajoissa calls on tarkoituksella tyhjä (ei lisälaskureita), ei nolla todellista kutsua. Raportin laskurit tulevat counts-ajosta; baseline-ajat erillisistä kolmesta toistosta. Laskuriajojen millisekunteja ei pidä käyttää vertailukelpoisina production-aikoina. Prosessien tai JIT:n vaihtelun vuoksi prosenttiosuudet ovat arvioita.

Raakadatan capacityKeysSorted-laskurin nimi on epätarkka: se laskee chunk-kierrosten alussa otettujen kapasiteettiavainkuvien koon ennen kapasiteettirajan suodatusta, ei varsinaiseen sortiin päätyvien avainten määrää. Sitä ei käytetä lajittelutyön täsmällisenä mittana. Raportin kapasiteettitaulukko käyttää erillistä reachable-laskuria.

Pienin suositeltu seuraava toteutus on kahden järjestetyn pattern-listan täsmällinen merge, ensin erillisenä regressiovertailuna. Tässä tehtävässä sitä ei toteutettu. Ei commitia.
`;
fs.writeFileSync(path.join(dir,'RESULTS.md'),report);
for (const [name,s] of Object.entries(summary)) {
    console.log(name, 'baseline ms',s.baselineMs, 'CPU self',JSON.stringify(s.cpu.self.slice(0,8)));
    console.log('CPU inclusive keep',JSON.stringify(s.cpu.inclusive.filter(r=>['keepDistinctPatterns','findCandidatePatternsDP','compareQuantities','(garbage collector)'].includes(r.name))));
    console.log('horizontal',JSON.stringify(s.variants.find(v=>v.profile==='horizontalProfile'&&v.color==='gray')));
}
