# Nykyinen arkkitehtuuri

Tämä on ohjelman rakenteen ja tilan omistajuuden kanoninen kuvaus. Materiaalin säännöt ovat [MATERIAL.md](domain/MATERIAL.md):ssä, tuotannon säännöt [PRODUCTION.md](domain/PRODUCTION.md):ssä ja tarkistukset [TESTING.md](TESTING.md):ssä. Tuleva tiedostojako kuuluu [roadmapiin](../ROADMAP.md), ei tähän nykytilaan.

## Tiedostot ja riippuvuudet

Sovellus toimii suoraan selaimessa ilman rakennusvaihetta, paketinhallintaa tai uusia riippuvuuksia. Tiedostot ladataan tavallisina classic-skripteinä, eivät ES-moduuleina.

| Tiedosto | Nykyinen vastuu |
| --- | --- |
| [index.html](../index.html) ja [style.css](../style.css) | Lomakkeen runko, työtoiminnot, tulosalue ja mobiili ensin -asettelu |
| [src/cutting-physics.js](../src/cutting-physics.js) | Puhdas `CUTTING_PHYSICS`: `cutPiece()` ja 0,1 mm:n mitta-apurit |
| [src/material.js](../src/material.js) | Puhdas `MATERIAL`: `PROFILE_TYPES`, kapasiteettiasetukset ja -tase, varaston validointi/muodostus, variantin lähteet, lähteen kulutus ja materiaalikulutuksen laskenta |
| [src/production-planning.js](../src/production-planning.js) | Puhdas `PRODUCTION_PLANNING`: kokonaiset tilaukset valitseva selector, yksilöllisten kappaleiden kohdistus ja scheduler |
| [src/production-integration.js](../src/production-integration.js) | Sovittimet lomakkeen, optimizerin, tuotantotuloksen, renderöinnin ja persistenssin välillä; worker-manifesti, digest, toteumaloki ja johdettu suoritusnäkymä |
| [app.js](../app.js) | Käynnistys, lomakkeet, optimizerit, score/disposition, jälkivarasto, UI-ohjaus, localStorage ja suuri osa dev-testeistä |
| [production-regressions.js](../production-regressions.js) | Node-ajurin erikseen lataamat tuotantoregressiot; ei selaimen tuotantoriippuvuus |
| [src/work-snapshots.js](../src/work-snapshots.js) | Nimetty katseluarkisto: canonical-työtilan kopio, validointi, erillinen IndexedDB-store, read-only-dialogit sekä ennen fyysistä tuotantoa sallittu persistoi-ensin-palautus |

Selain lataa tässä järjestyksessä:

```text
cutting-physics → material → production-planning → production-integration → app → work-snapshots
```

Node-ajurit lataavat samat lähteet samassa järjestyksessä tuoreeseen VM-ympäristöön. Puhdas sahaus-, materiaali- ja tuotantosuunnittelurajapinta tukee myös CommonJS-`require()`-latausta. `CUTTING_PHYSICS` ja `MATERIAL` ovat suljettuja, jäädytettyjä rajapintoja. `app.js`:n ohuet `var`-aliaset säilyttävät siirrettyjen funktioiden konsoli-/`window`-kutsut ilman toteutuksen kopiointia; `PROFILE_TYPES`-alias viittaa samaan olioon.

Riippuvuussuunta: materiaalimoduuli käyttää sahausmoduulin **mitta-apureita ja `cutPiece()`-funktiota**. Tuotantosuunnittelu käyttää molempia fysiikan ja kapasiteetin tarkistamiseen. Puhdas core ei riipu DOM:sta, `window`:sta, localStoragesta, sovelluksesta tai testidatasta. Integraatio käyttää myös `app.js`:n funktioita kutsuhetkellä; sen lataaminen ennen sovellusta ei tarkoita riippumatonta core-moduulia.

Ensimmäinen material-core-raja on tarkoituksella pieni. `findMaterialSourceCandidates()` jää optimizerin viereen, koska se kutsuu DP-hakua. `calculatePostOrderMaterialInventory()` jää sovellukseen, koska se käyttää `evaluateRemnantDisposition()`-arvotusta. `scoreCompleteMaterialTransitionPlan()` ei ole materiaalimoduulin riippuvuus. Älä siirrä näitä automaattisesti tiedostokoon perusteella.

## Aktiivinen laskentaputki

```text
calculate()
  → getOrdersFromForm() / normalizeOrderCuts(), materiaalisaatavuus
  → createMaterialInventory()
  → selectProductionBatch() / PRODUCTION_PLANNING.selectBatch()
      → optimizeOrderByProfileTypeWithInventory() jokaiselle batch-ehdokkaalle
          → getMaterialSourcesForProfile()
          → optimizeOrderInventoryBeamDP() materiaalivarianteittain
          → scoreCompleteMaterialTransitionPlan()
  → adaptMaterialOptimizationForUi()
  → createProductionExecution(): attachPieces() → schedule()
  → renderCuttingPlan()
```

Batchin yhteinen kysyntä optimoidaan profiilin ja värin mukaan erikseen ja tulokset yhdistetään. Materiaalikerros saa yhdistää eri tilausten kappaleita; alkuperäinen kysyntä säilytetään tuotantokohdistusta varten. Valmiit tulokset tarkistetaan riippumattomalla validoinnilla. Osittaista ratkaisua ei esitetä valmiina sahaussuunnitelmana.

Laskenta on synkroninen. Selaimessa ei ole tutkimuksen kaksivaiheista batch-hakua, tutkimusvälimuistia, Web Workeria tai peruutettavaa taustalaskentaa. Reachable-state-DP ja vakaa pattern-merge ovat aktiivisessa optimizerissa; niiden järjestysinvariantit ovat materiaalidokumentissa.

Legacy-/vertailupolkuja ovat `optimizeOrderMaterialBeamDP()`, `optimizeOrderBeamDP()`, `optimizeOrderDP()`, `optimizeCuts()` ja `generateCombinations() → evaluateCombination() → findBestCombination() → optimizeOrder()`. Ne eivät ole aktiivisen käyttöliittymän varapolkuja. Niitä ei poisteta, oteta käyttöön tai oleteta oikeiksi ilman rajattua tehtävää ja testejä. Yhdistelmäpolun suurta syötettä ei ajeta ilman suorituskyvyn arviointia.

## Tilan omistajuus

| Tieto | Auktoritatiivinen lähde ja johdettu käyttö |
| --- | --- |
| Muokattava avoin työ | Lomakkeen tilaukset, materiaalirivit, `stockLength`, kerf ja batch-asetukset; tallennukseen snapshot |
| Laskettu materiaali | Validoitu alkuperäinen `currentGeneratedPlan` ja sen `bars`; ei kirjoiteta uusiksi toteuman perusteella |
| Yksilölliset kappaleet ja operaatiot | Johdetaan materiaaliplanista ja valittujen tilausten alkuperäisestä kysynnästä; operaatiolistaa ei tallenneta rinnakkaiseksi totuudeksi |
| Toteutuneet kuittaukset | `currentProductionExecutionState` / tallennettu `executionState`, sidottuna plan-digestiin |
| Aktivoitu jatkosuunnitelma | `executionState.version === 3`: alkuperäinen jäädytetty prefix sekä `continuation`-kohdistus, digest, base-raja ja oma tapahtumaprefix. Integraatio omistaa puhtaat tilasiirtymät; `app.js` omistaa persist-first-controllerit |
| Jatkon suunnitelma ja operaatiot | `evaluateProductionContinuationPlan()` johtaa tallennetusta sourceId → alkuperäiset piece-ID:t -kohdistuksesta schedulerin, materiaaliennusteen ja scoren ilman optimizer-hakua. Replay-ledgeriä ei tallenneta |
| Toteuman fyysinen tase | `src/production-integration.js`: `replayProductionExecution()` johtaa taseen alkuperäisistä lähteistä ja tapahtumista materiaalicoren fysiikalla; `createExecutedMaterialPlan()` muodostaa finalisoinnin syötteen |
| Salon käsittelyn valmistuminen | Erillinen `completedBarIds`; ei sama kuin operaatiokuittaus |
| Worker-numerot, toistoryhmät, 3+3-jono, valmisteluyhteenveto | Uudelleen johdettava esitys; eivät pysyviä identiteettejä tai uutta execution-statea |
| Finalisoitu varasto | `calculatePostOrderMaterialInventory()`; onnistunut lopullinen snapshot ennen live-tilan vaihtamista |

`workInputRevision` auttaa suunnitelman sitomisessa nykyiseen syötteeseen. Tilausten ja laskentaan vaikuttavien syötteiden muokkaus mitätöi suunnitelman, salon valmistumistilat ja toteumalokin, ellei toteutunut lähdepoikkeama lukitse muokkausta. Poikkeaman aikana myös uusi laskenta ja uuden työn aloitus estetään. Accordionin avaus/sulkeminen tallentuu muuttamatta laskentaa tai kuittauksia. Tuotannon tarkat kuittaus-, poikkeama- ja finalisointiehdot ovat [tuotantomallissa](domain/PRODUCTION.md).

## Tallennus, versiot ja palautus

Paikallinen työtila käyttää localStorage-avainta `sahausoptimointi.currentWork`. Nyt:

- `WORK_STATE_SCHEMA_VERSION = 6`: tallenteen rakenne, tilaukset, batch-tiedot ja toteumaloki.
- `WORK_STATE_ENGINE_VERSION = "material-v0.4"`: kapasiteettivaramallin kanssa yhteensopiva laskentatulos.
- `executionState.version`: 1 hyväksyy vain suunnitellut lähteet, 2 tukee fyysisesti validoitua lähdepoikkeamaa. Ensimmäinen poikkeama siirtää lokin versioon 2 säilyttäen aiemmat tapahtumat ja alkuperäisen digestin. Vanhoja V1-tapahtumia ei tulkita uudella väljemmällä lähdesäännöllä; muu työtilaskeema ja materiaalimoottori eivät muutu.
- Versio 3 lisää pysähtyneeseen V2:een yhden versionoidun jatkon. Outer-skeema pysyy 6:ssa: sen kentät, alkuperäinen generatedPlan ja tilaus-/varastomalli eivät muutu, ja execution-versio erottaa uuden semantiikan ilman migraatiota. Materiaalifysiikka ja score säilyvät, joten `material-v0.4` ei muutu. V3:n tarkka tietorakenne, digest, kuittaus- ja undo-raja ovat [tuotantomallissa](domain/PRODUCTION.md#jatkon-toteumatila-v3-b-013n-kolmas-vaihe).

Skeema ja materiaalimoottori tarkoittavat eri asioita. Arvioi molempien yhteensopivuus niiden merkitystä muuttavassa työssä. Yhteiset kapasiteettivarat eivät ole työkohtaisia lomakesyötteitä. Versiotarkistus koskee **koko työtilaa, myös luonnosta**: `isValidStoredWorkState()` hylkää väärän moottoriversion ennen `generatedPlan === null` -haaraa. Pelkkä skeemamigraatio ei hyväksy vanhaa moottoria.

Skeeman 4 työ muunnetaan skeemaan 5 kaksinkertaistamalla vanhan kiskosyötteen määrät fyysisen kysynnän säilyttämiseksi. Skeema 5 muunnetaan skeemaan 6 lisäämällä batchille tyhjä toteumaloki; batchiton työ saa `null`-arvon. Migraatio ei mutatoi lähtöoliota ja säilyttää kysynnän, materiaaliplanin sekä salon valmistumistilat. Tulos läpäisee tämän jälkeen normaalin rakenne-, moottori-, semantiikka- ja fysiikkavalidoinnin. Käyttäjän päätöksellä skeeman 3 kuvitteellisia testitöitä ei migroida. Hylätty vanha tallenne poistetaan, työ palautuu oletuksiin ja käyttäjälle näytetään ilmoitus. V3-toteumaa sisältävä tallenne on tästä poikkeus: sitä ei migroida tyhjäksi lokiksi eikä poisteta.

Skeema 6 tallentaa `orders`-rakenteen, ei rinnakkaista `inputRows`-kysyntää. Tallennettu materiaalisuunnitelma validoidaan ennen DOM:n palautusta: sama tilausadapteri muodostaa kysynnän, tarkistus kattaa kappalemäärät, värit/profiilit, lähdesaldot, sahausfysiikan ja kapasiteetin. Batch-tiedot ja uudelleen johdetun executionin digest/tapahtumat tarkistetaan myös.

Tallenteen rajat ja lomakesopimus:

- Enintään 100 tilausta, 120 merkkiä nimessä, 80 aukon tunnuksessa ja yhteensä 1000 laajennettua mittariviä; kiskorivi lasketaan kahdeksi myös luonnoksessa. Varaston persistoiduilla lomakeriveillä on 1000 rivin raja.
- Tilaus-ID:t ovat yksilöllisiä. Tilauskortilla on täsmälleen viisi tunnettua osiota määrätyssä järjestyksessä. Numeroiden lomakearvot ovat merkkijonoja; avausarvot ja valinnainen `collapsed` booleaneja.
- Luonnos voi sisältää korjattavia numeroarvoja ja tyhjän värin; laskettu suunnitelma vaatii kelvollisen kysynnän. Tuetut värit ja kysynnän muodostus on kuvattu materiaalin ja tuotannon dokumenteissa.
- Raakalistan, jäännösten ja suunnitelman profiilin pitää olla `PROFILE_TYPES`-olion oma avain. Peritty `constructor` tai `toString` ei ole profiili eikä tilausosio.
- Stock-varianttien duplikaatit tarkistetaan UI:n kanonisoidulla värillä. Jokaisella profiiliryhmällä on täsmälleen yksi oletusrivi. Jos `additional` puuttuu legacy-riviltä, ensimmäinen on oletusrivi ja myöhemmät lisärivejä; validointi ja palautus käyttävät samaa sääntöä.
- Palautus säilyttää tallennetut materiaalirivit ja saatavuudet; uuden työn oletusrivejä ei lisätä palautettuun työhön.

Tallennus ja palautus ovat sovelluksen I/O-raja. Erityisesti finalisointi ja operaation kuittaus/peruminen muodostavat ensin validoitavan tallenteen ja vaihtavat live-tilan vasta tallennuksen onnistuttua. Epäonnistunut tallennus ei saa jättää osittain päivitettyä varastoa tai toteumaa.

V3:n reload tarkistaa ulomman rakenteen ja alkuperäisen planin ensin, muodostaa alkuperäisen executionin sekä pysähtyneen base-replayn, validoi tallennetun jatkokohdistuksen, regeneroi schedulerin ja tarkistaa jatkodigestin, jatkotapahtumat, yhdistetyn fyysisen toteuman sekä valmistumismerkinnät alkuperäistä manifestia vasten. Optimizeria ei kutsuta. Alkuperäinen plan pysyy finalisoinnin ja worker-identiteetin vertailuna.

Kelvoton V3, jatkodataa sisältävä väärä execution-/outer-versio tai tunnistettavasti katkennut V3-JSON asettaa vain muistissa olevan `workRecoveryLocked`-lukon. Raakatallenne säilyy nykyisessä localStorage-avaimessa; `writeWorkStateSnapshot()`, automaattitallennus, tallenteen poisto ja työn resetointi eivät ohita lukkoa. Epäkelpoa työtä ei palauteta live-sahausohjeeksi. Ilmoitus ja syötteiden lukitus riittävät tässä vaiheessa; erillistä recovery-UI:ta tai rinnakkaista varmuuskopiototuutta ei lisätä. Vain onnistunut, kokonaan validoitu palautus vapauttaa lukon.

## Nimetyt paikalliset snapshotit

Snapshot on käyttäjän nimeämä immutable katselukopio; aktiivinen työ säilyy yllä kuvatussa localStorage-avaimessa. **TALLENNA SNAPSHOT** kopioi `createWorkStateSnapshot()`-tuloksen JSON-syväkopioksi ja hyväksyy sen nykyisellä `isValidStoredWorkState()`-validaattorilla. Palautuslukittua aktiivista työtä ei arkistoida. Export/import ja automaattinen batch-historia eivät kuulu tähän versioon.

Record: `{ snapshotVersion: 1, id, name, note, createdAt, updatedAt, workState, presentation }`. ID on `crypto.randomUUID()`, nimi trimmattu 1–120 merkkiä (samat nimet sallitaan), kommentti valinnainen enintään 500 merkkiä. Ajat ovat ISO-UTC-aikoja; UI näyttää paikallisen ajan. Rename muuttaa vain nimeä ja `updatedAt`-aikaa; luontiaika ja sisältö säilyvät. Lista järjestyy luontiajan mukaan uusin ensin, tasatilanne ID:llä. Poisto vaatii nimellä yksilöidyn vahvistusdialogin ja poistaa vain valitun ID:n.

`workState` säilyttää koko nykyisen skeeman 6 / `material-v0.4`-tallenteen: tilaukset, varastorivit, asetukset, alkuperäisen generatedPlanin, batchin, V1/V2/V3-toteuman ja completedBarIds:n. Se on arkiston auktoritatiivinen laskentatieto, ei uusi optimizer-datamalli. Koska työtila ei tallenna scheduleria eikä piste-erittelyä, luonti jäädyttää lisäksi versionoidun **esitystarkisteen** `presentation = { execution, physical, manifest, score }` (luonnoksessa null). Se sisältää olemassa olevien apurien tulokset, myös fyysisen replayn V3-jatko-executionin. Sitä ei käytetä tuotannon ohjaukseen tai aktiivisen työn totuutena.

B-014:n aktiiviseksi palautus perustuu aina uudelleen ID:llä luettuun ja validoituun canonical `workState`:en. `presentation` palvelee vain historiallista read-only-esittämistä eikä ole aktiivisen työn toinen auktoritatiivinen tila eikä sitä kirjoiteta active-work-storeen.

Avauksessa work-state-validaattori tarkistaa rakenteen, version, materiaalitaseen, alkuperäisen digestin, jatkodigestin ja toteuman. Nykyinen kanoninen validointi johtaa schedulerin integrity-tarkistukseen, mutta ei aja batch-selectoria tai optimizeria. Esitystarkisteen pitää vastata täsmälleen validoidusta tilasta johdettua tulosta; jos esimerkiksi scheduler tai score on muuttunut versionumeron säilymisestä huolimatta, arkisto merkitään yhteensopimattomaksi. **Viewer näyttää tallennetun esitystarkisteen**, ei vaihda siihen uudelleen laskettua järjestystä. Avaus ja reload eivät migroi, kirjoita tai optimoi snapshotia. Vaurioitunut/yhteensopimaton record säilyy listassa manuaalisesti poistettavana eikä aktivoi työtilan recovery-lukkoa.

Tallennus: selaimen/originin erillinen IndexedDB `sahausoptimointi.snapshots`, tietokantaversio 1, object store `snapshots`, keyPath `id`. Ei localStorage-indeksiä eikä automaattista poistokiintiötä. Yksi lisäys, rename tai poisto tehdään yhdessä readwrite-transaktiossa; onnistuminen ilmoitetaan vasta commitin jälkeen. Rinnakkaiset välilehdet eivät kirjoita koko snapshot-listaa toistensa päälle. Virhe tai quota/abort säilyttää aiemmat recordit; se ei muuta active-work-storea. IndexedDB ei kuluta aktiivisen localStoragen omaa tilakiintiötä. Paikallinen arkisto ei ole ulkoinen varmuuskopio ja selaintietojen poistaminen poistaa sen.

**PALAUTA AKTIIVISEKSI TYÖKSI** on käytettävissä vain, kun sekä aktiivinen canonical työ että kohteen canonical `workState` ovat validoituja, recovery-lukko ei ole päällä eikä kummassakaan ole fyysistä toteumaa. Fyysiseksi toteumaksi lasketaan yksikin V1/V2:n `events`-tapahtuma, V3:n base- tai continuation-tapahtuma sekä konservatiivisesti yksikin `completedBarIds`-merkintä. Näin myös lähdepoikkeama ja salon fyysinen valmistumismerkintä estävät JSON-pohjaisen aikahypyn. Estetty snapshot säilyy normaalisti katseltavana. Fyysisen työn sovitus kuuluu erilliseen B-015:een.

Palautusdialogi näyttää snapshotin nimen, ajan ja yhteenvedon sekä nykyisen aktiivisen työn yhteenvedon. Hyväksyntä lukee kohteen uudelleen ID:llä, validoi recordin, skeeman, moottoriversion, digestit ja fyysisen rajan ja luo nykyisestä canonical työstä snapshotin nimellä `Ennen palautusta – <timestamp>`. Täysin tyhjä oletustila on ainoa poikkeus turvakopiointiin. Turvakopio committoidaan IndexedDB:hen ennen kuin kohteen syväkopio, uudella `savedAt`-ajalla, kirjoitetaan nykyiseen active-work-avaimeen. Kirjoitus luetaan takaisin ja vasta sitten tavallinen `restoreSavedWorkState()` rakentaa live-DOM:n canonical tilasta. Tämä polku ei kutsu batch-selectoria, inventory-optimizeria eikä continuation-hakua; schedulerin muodostus kuuluu olemassa olevaan planin integrity-validointiin.

Jos turvakopion transaktio epäonnistuu, active storea tai live-tilaa ei muuteta. Jos active-store-kirjoitus epäonnistuu, live-tila ja aiempi persisted tila säilyvät ja onnistunut turvasnapshot saa jäädä arkistoon. Jos kirjoitus ja takaisinluku onnistuvat mutta live-renderöinti epäonnistuu, uutta persisted canonical tilaa ei yritetä arvata takaisin DOM:sta: käyttäjää pyydetään lataamaan sivu uudelleen. Kohdesnapshotin ID, metadata, canonical sisältö ja presentation säilyvät kaikissa palautuspoluissa muuttumattomina.

12.9.2026 koon mittaus UTF-8-JSONina: seitsemän salon V3-fixturen canonical work-state 4 851 tavua, koko record noin 13 172 tavua; saman kysynnän 50 tilauksen luonnos noin 33 105 tavua. Synteettinen 50 tilauksen / 350 kappaleen / 350 salon validoitu suunnitelma noin 450 447 tavua. Nämä ovat testiaineiston kokoja, eivät ylärajoja: monet suuret arkistot perustelevat IndexedDB:n ja erilliset transaktiot localStorage-listan sijaan.

`SNAPSHOT — VAIN KATSELU` on erillinen modaalinen HTML-dialogi. Tausta on selaimen toimesta inertti; aktiivista lomake-DOM:ia, plania, lokia tai autosavea ei vaihdeta edes väliaikaisesti. Viewer käyttää nykyisiä mitta-/väri-/disposition-formaatteja ja materiaalikorttien CSS-luokkia. Se näyttää tilaukset, alkuperäisen materiaaliplanin/pisteen, valitun batchin, lähteet/leikkaukset/loppudispositionin, alkuperäisen ja mahdollisen jatkon järjestyksen sekä toteutuneet tapahtumat ja saldot. Sillä ei ole sahaus-, undo-, finalisointi- tai muokkauscontrollereita. **PALAA AKTIIVISEEN TYÖHÖN** sulkee vain dialogin. Erillinen palautuspainike avaa vahvistusdialogin eikä muuta työtä suoraan.
