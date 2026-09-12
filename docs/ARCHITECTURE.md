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

Selain lataa tässä järjestyksessä:

```text
cutting-physics → material → production-planning → production-integration → app
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
