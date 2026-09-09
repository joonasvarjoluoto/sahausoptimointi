const fs=require('node:fs');
const path=require('node:path');
const read=file=>JSON.parse(fs.readFileSync(path.join(__dirname,file),'utf8'));
const search=read('search-results.json'),pilot=read('pilot-results.json'),small=read('small-results.json'),cache=read('cache-results.json');
const anytime=read('anytime-result-test.json');
if(anytime.bestValidatedResultSoFar?.score!==search.best.score || JSON.stringify(anytime.best.ids)!==JSON.stringify(search.best.ids))
    throw new Error('Whole-result repeat must match the measured incumbent');
const n=(x,d=1)=>x==null?'—':Number(x).toFixed(d);
const ids=r=>r.ids.map(id=>id.replace('excel-','')).join(', ');
const points=search.checkpoints;
const initial=search.improvements[0],best=search.best;
const rows=points.map(p=>`| ${p.budgetSeconds} | ${p.uniqueCandidates} | ${p.lightCompleted} | ${p.fullCompleted} | ${n(p.best?.score)} | ${p.best?.newBars??'—'} | ${n((p.best?.newLengthMm??0)/1000)} | ${n((p.best?.kerfMm??0)/1000,3)} | ${n((p.best?.scrapMm??0)/1000,3)} | ${p.best?.reusableCount??'—'} / ${n((p.best?.reusableMm??0)/1000,3)} | ${n(p.finalBestFoundSeconds)} | ${n(p.noImprovementSeconds)} |`);
const manual=pilot.samples.filter(r=>r.level==='full').map(r=>`| ${ids(r)} | ${r.ids.length} | ${r.pieceCount} | ${n(r.elapsedMs/1000,2)} | ${n(r.materialMs/1000,2)} | ${r.schedulerMs} |`);
const comparison=small.scenarios.map(r=>`| ${r.scenario.ids.join(', ')} | ${r.scenario.min}/${r.scenario.target}/${r.scenario.max} | ${r.evaluatedCandidates} | ${r.uniqueCandidates} / ${r.fullCompleted} | ${n(r.exhaustiveMs/1000,2)} | ${n(r.researchMs/1000,2)} | ${n(r.exhaustive.score)} | ${n(r.research.score)} | ${n(r.scoreDifferencePercent,3)} % | ${r.sameOrders?'kyllä':'ei'} |`);
const valid=search.evaluations.filter(e=>e.status==='complete');
const lastCache=[...valid].reverse().find(e=>e.cache)?.cache;
const components=Object.entries(best.scoreComponents).map(([key,value])=>`| ${key} | ${n(value,3)} |`);
const text=`# Batch-haun tutkimustulokset, 8.9.2026

## Rajaus ja aineisto

Erillinen Node-koeversio; tuotannon selainpolkua, materiaali- tai scheduler-lähteitä ei muutettu tässä tutkimuksessa. Aiemmat paikalliset kiskomuutokset olivat mukana lähteissä. Sovelluslähteiden SHA-256-tunnisteet ovat JSON-tuloksissa. Node ${search.node}. Mittaukset tehtiin peräkkäisinä CPU-ajoina tällä koneella, ilman rinnakkaisia benchmarkeja.

Excelistä 23 tilausta / 79 aukkoa / 1 231 kappaletta. Tilaus 16 jätettiin pois käyttäjän pyynnöstä. 6000 mm, kerf 3 mm, kaikki tuetut värit rajattomina, ei vanhoja jäännöksiä. Tämä on materiaalioletus, ei oikea varastosaldo. Kokorajoilla 200/250/300 on ${search.candidateCount} kelvollista batch-ehdokasta.

## Strategia ja hakuasetukset

Rajattu deterministinen monialoitushaku, kuuden parhaan batchin add/remove/swap-naapurit ja säännölliset uudet lähtökohdat. Kokoalueita vuorotellaan. Kokonaiskysynnän pituus auttaa valitsemaan tutkittavia ehdokkaita mutta ei korvaa materiaalipisteytystä. Neljän kevyen arvioinnin jälkeen tarkennetaan yksi lupaava ehdokas. Parempi kevyt tulos säilyy myös huonomman tarkennuksen jälkeen.

Kevyt haku: beamWidth 2 / patternsPerState 2 / candidatePoolSize 10. Normaali haku: 20 / 10 / 50. Muut parametrit ja kaikki pistekomponentit samat. Jokainen valmis materiaalisuunnitelma validoidaan, ja normaali scheduler muodostetaan provenancen tarkistamiseksi. Schedulerin mittareita ei käytetä valintaan. Tuntematon tai katkaistu haku ei ole todiste mahdottomuudesta.

Koeversion ehdokasluettelointi käyttää enintään 23 tilauksen bittimaskeja. Tuotannon 100 tilauksen raja tarvitsee myöhemmin rajatun generaattorin ilman kaikkien osajoukkojen luettelointia.

## Laatu ajan funktiona

Yksi jatkuva haku. Taulukko kertoo, mikä valmis validoitu tulos oli saatavilla juuri annetun budjetin kohdalla. Arvioinnin aikana ylitettyyn aikapisteeseen ei kirjata sen myöhemmin valmistunutta tulosta. Täyden budjetin ajo kesti ${n(search.usedSearchSeconds,2)} s, lopetussyy ${search.stopReason}.

| Budjetti s | Eri ehdokkaita | Kevyitä valmiiksi käsitelty | Perusteellisia käsitelty | Paras piste | Uusia tankoja | Uutta m | Kerf m | Romujäännös m | Säästettävät kpl / m | Paras löytyi s | Ilman parannusta s |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${rows.join('\n')}

Kevyt/perusteellinen laskuri tarkoittaa loppuun käsiteltyjä arviointiyrityksiä (myös mahdollinen not-found); JSON erittelee tilan. Rajalla kesken oleva yritys ei kuulu aikapisteen laskureihin. Koko ajossa ${valid.length} valmisratkaisua validoitiin; ${search.evaluations.filter(e=>e.status!=='complete').length} arviointia päättyi muuhun tilaan.

## Improvement history ja materiaalierot

${search.improvements.map(r=>`- ${n(r.foundSeconds,2)} s: piste ${n(r.score,3)}, ${r.level}, tilaukset ${ids(r)}, ${r.pieceCount} kpl, ${r.newBars} uutta tankoa, kerf ${n(r.kerfMm/1000,3)} m, romujäännöstä ${n(r.scrapMm/1000,3)} m, säästettäviä ${r.reusableCount} kpl / ${n(r.reusableMm/1000,3)} m.`).join('\n')}

Ensimmäisestä parhaaseen piste pieneni ${n(initial.score-best.score,3)} eli ${n(100*(initial.score-best.score)/initial.score,3)} %. Uusia tankoja ${initial.newBars} → ${best.newBars}; uutta materiaalia ${n(initial.newLengthMm/1000)} → ${n(best.newLengthMm/1000)} m. Valitut tilaukset ${JSON.stringify(initial.ids)===JSON.stringify(best.ids)?'säilyivät samoina, joten tämä on saman kysynnän materiaalivertailu':'muuttuivat, joten eroa ei voi tulkita saman tuotannon materiaalinsäästöksi'}.

Pisteparannus perustui suurempaan jäännöskrediittiin ja pienempään suuren romun rangaistukseen. Uutta materiaalia kului yksi tanko enemmän. Tätä ei siten pidä raportoida raakamateriaalin kulutuksen vähentymisenä; materiaalimallin prioriteetteja ei muutettu tutkimuksessa.

Paras löytyi ${n(best.foundSeconds,2)} s; viimeiset ${n(search.usedSearchSeconds-best.foundSeconds,1)} s kuluivat ilman parannusta. Tämä osoittaa havaitun tasaantumisen tämän jonon, varastooletuksen ja hakustrategian yhdistelmässä. Se ei todista globaalia optimia, tyypillistä 99 % hyötysuhdetta eikä ettei myöhempi uusi lähtökohta voisi parantaa tulosta. 30 ja 60 minuutin ajoa ei tehty ensimmäisellä kierroksella, koska 10 minuutin käyrä oli jo tasainen; eri jonot ja varastot ovat hyödyllisempi seuraava koe kuin yhden tasaisen ajon jatkaminen tuntiin. Viimeinen kesken ollut arviointi katkaistiin 600 sekunnin aikabudjettiin; plateau-ehto täyttyi samalla. Aiempi valmis paras tulos säilyi.

Paras materiaalipiste on ekvivalenttipituutta, ei euroja:

| Komponentti | Arvo mm-ekvivalenttia |
| --- | ---: |
${components.join('\n')}

## Jo valitun batchin normaali laskenta

Automaattinen selector ohitettiin. Samat nykyiset normaalihaun asetukset; mukana materiaalihaku, validointi, UI-suunnitelman tietorakenne ja scheduler. Ei selain-DOM:n renderöintimittausta. Lähteiden lataus ei sisälly lukuihin. Välimuisti pois.

| Tilaukset | Tilausten määrä | Kappaleita | Yhteensä s | Materiaalihaku s | Scheduler ms |
| --- | ---: | ---: | ---: | ---: | ---: |
${manual.join('\n')}

Kevyt haku samoille neljälle batchille kesti ${n(Math.min(...pilot.samples.filter(r=>r.level==='light').map(r=>r.elapsedMs))/1000,2)}–${n(Math.max(...pilot.samples.filter(r=>r.level==='light').map(r=>r.elapsedMs))/1000,2)} s. Yksittäiset nopeudet eivät ole kaikkien 2–5 tilauksen tai äärellisen varaston takuu. Normaali pieni batch säilyi tässä sekuntien suuruusluokassa.

## Exhaustive-vertailu pienillä aineistoilla

Nykyinen PRODUCTION_PLANNING.selectBatch arvioi jokaisen kelvollisen batchin normaalilla heuristisella materiaalihakulla. Uusi haku saa kahdeksan arvioinnin työbudjetin ja enintään 120 s, välimuisti pois molemmilta. Ei väitettä globaalista materiaalioptimista. Positiivinen piste-ero tarkoittaa uuden haun huonompaa tulosta.

| Tilaukset | Min/tavoite/max | Exhaustive-ehdokkaita | Uuden eri ehdokkaat / tarkennukset | Exhaustive s | Uusi s | Exhaustive piste | Uusi piste | Piste-ero | Samat tilaukset |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
${comparison.join('\n')}

Konkreettiset materiaalimäärät, valitut tilaukset ja score-komponentit molemmille poluille ovat small-results.jsonissa. Kolme pientä joukkoa on ensimmäinen vertailu, ei riittävä yleinen laatutakuu.

## Välimuisti

Ajokohtainen profiili-/väriryhmän puhtaan optimizer-kutsun välimuisti toteutettiin vain VM-kääreeseen. Koko kysyntä, lähteet, kerf ja asetukset ovat avaimessa. Palautetaan kopio; provenance muodostetaan uudelleen. Ei tuotanto-optimizerin refaktoria. Koko haun viimeiset tilastot: ${JSON.stringify(lastCache)}.

Sama kolmen haun jono ilman välimuistia ${n(cache.sequences[0].totalMs/1000,2)} s, välimuistilla ${n(cache.sequences[1].totalMs/1000,2)} s. Mukana on tarkoituksellinen saman batchin toisto ja osittain muuttunut batch. Tulosten, score-komponenttien ja provenancen identtisyys tarkistettiin. Säästö ei ole lupaus samasta nopeutuskertoimesta missä tahansa jonossa.

## Suositus ja rajaukset

Säilytä käsin valitun batchin normaali materiaalihaku erillisenä automaattisesta selectorista. Jatka kaksivaiheisen haun ja turvallisen ryhmävälimuistin tutkimusta useammalla jonolla, äärellisellä materiaalilla ja vanhoilla jäännöksillä ennen production-kytkentää. Mittaa myös toinen aloitussiemen ja pidempi vertailu ainakin aineistolla, jossa käyrä jatkaa paranemista. Tämän yhden jonon perusteella automaattihaulle ei vielä lukita oletusaikaa.

Node-koeversio osoittaa huomattavan hakukertojen vähennyksen ja varhaisen tasaisen parhaan tuloksen tällä aineistolla. Mahdollisen UI:n, Web Workerin, peruutuspainikkeen, laskennanaikaisen syöterevision sekä osajoukkoluettelosta luopuvan suuren jonon generaattorin toteutus jää myöhemmäksi. Mitään ei commitoitu tai pushattu tässä tutkimuksessa.

## Tarkistukset

Tutkimusajurin 16 tarkistusta läpäisty: kandidaattien vastaavuus nykyiseen selectoriin pienissä tapauksissa, min/oversized/lyhyt jono, checkpointin valmistumisraja, myöhäisen tuloksen hylkäys, huonomman tarkennuksen käsittely, työbudjetin determinismi, välimuistin suunnitelma-/score-/provenance-yhtäläisyys sekä kerfin, hakubudjetin ja äärellisen määrän eristys. Mukana on myös koko validoidun suunnitelman ja operaatioiden säilyttäminen incumbentissa seuraavien hakujen yli. Nykyinen regressiopaketti 35/35 ja ohjaus-/persistenssiajuri 18 tarkistusta läpäisty. Syntaksit ja diff tarkistettu. Tässä Node-tutkimuksessa ei tehty uutta selain-UI:ta tai selaintestiä.

Varsinainen 600 s mittaus tallensi suunnitelmien validoidut yhteenvedot. Sen jälkeen koeversioon lisättiin koko voittajasuunnitelman ja operaatioiden vienti kenttään bestValidatedResultSoFar. Erillinen ${n(anytime.usedSearchSeconds,2)} s toisto varmisti tämän: sama paras piste ja samat tilaukset löytyivät ${n(anytime.best.foundSeconds,2)} s kohdalla, ja aikakatkaisun jälkeen koko valmis suunnitelma oli saatavilla. Tämän toiston tulos on anytime-result-test.jsonissa. Taulukon 600 s ajat ovat alkuperäisestä mittauksesta; pienet raportointi-/validointitäydennykset eivät muuta haun pisteytys- tai ehdokassääntöä.
`;
fs.writeFileSync(path.join(__dirname,'RESULTS.md'),text);
const columns=['budgetSeconds','uniqueCandidates','lightCompleted','fullCompleted','score','newBars','newLengthMm','kerfMm','scrapMm','reusableCount','reusableMm','finalBestFoundSeconds','noImprovementSeconds','orders'];
const csv=[columns.join(',')];
for(const point of points){const row={...point,...point.best,orders:point.best?ids(point.best):''};csv.push(columns.map(k=>JSON.stringify(row[k]??'')).join(','));}
fs.writeFileSync(path.join(__dirname,'quality-checkpoints.csv'),csv.join('\n')+'\n');
console.log('Wrote RESULTS.md and quality-checkpoints.csv');
