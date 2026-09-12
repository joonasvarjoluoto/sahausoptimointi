# Aktiivinen tuotantomalli

Tämä on batchin, schedulerin ja tuotannon suoritusnäkymän kanoninen spesifikaatio. Toteutukset: [production-planning.js](../../src/production-planning.js), [production-integration.js](../../src/production-integration.js) ja ohjaus [app.js](../../app.js):ssä. Materiaalifysiikka ja score kuuluvat [materiaalimalliin](MATERIAL.md), tallenteen rakenne ja migraatiot [arkkitehtuuriin](../ARCHITECTURE.md), testien valinta [testausohjeeseen](../TESTING.md). Vanha tuotantosuunnitelma on [historiaa](../history/BATCH_AND_BUNDLE_SAWING_PLANNING.md).

## Tilaukset ja kysynnän muodostus

Sahattavat syötetään tilauskortteina. Tilauksella on pysyvä sisäinen `id`, vapaamuotoinen `name`, yksi yhteinen väri ja viisi osiota: Pysty, Vaaka, U, Vaste, Ala- ja yläkisko. Mittarivillä on mitta, määrä ja valinnainen `openingId`. Tilauksen identiteetti ei riipu muokattavasta nimestä. Eri aukot syötetään omille riveilleen; yhden rivin kaikki kappaleet kuuluvat annettuun aukkoon. Puuttuva aukko näkyy tuntemattomana, eikä sitä päätellä mitoista.

`getOrdersFromForm() → normalizeOrderCuts()` tuottaa `profileType + color + length + quantity` -kysynnän ja säilyttää `orderId`:n sekä aukon. `rails` on vain UI-osion avain: yhteismäärä 2 → yksi ylä- ja yksi alakisko, 4 → kaksi kumpaakin, 6 → kolme kumpaakin. Täytetyn kiskorivin määrä on positiivinen parillinen kokonaisluku. Fyysiset profiilit ja niiden varastot pysyvät erillisinä.

U-profiilin ja kiskorivin oletusmäärä on 2, muiden 1. U-määrää ei puoliteta eikä parittomia U-määriä estetä nykyisessä toteutuksessa. Tyhjä mitta tyhjällä tai osion oletusmäärällä ohitetaan; U:ssa ja kiskoissa myös vanha tyhjä oletusrivi määrällä 1 hyväksytään. Muokattu määrä ilman mittaa hylätään laskennassa.

Tilauskortti on avattava/suljettava `details`; otsikossa näkyvät nimi, väri ja fyysinen kokonaiskappalemäärä. Määrä päivittyy mittarivin muutoksesta ja poistosta. Uusi tai ilman sulkemistietoa palautettu tilaus on auki. Kortin `collapsed` ja profiiliaccordionien avaus tallentuvat muuttamatta suunnitelmaa tai toteumaa. Tilauksen ja mittarivin muokkaus mitätöi suunnitelman ja kuittaukset; tilauksen poisto vahvistetaan. Tallenteen kenttärajat ovat arkkitehtuuridokumentissa.

## Batch ja vastuuraja

```text
avoimet tilaukset → kokonaisten tilausten batch-valinta
  → inventory-aware materiaalihaku yhteiselle kysynnälle
  → validoitu salon materiaaliplani
  → attachPieces: kappaleiden provenance
  → schedule: operaatiot ja lähderiippuvuudet
  → valmistelu, suoritus ja lopuksi varaston finalisointi
```

Batch-selectorissa tilaus on jakamaton. Sen kaikki kappaleet kuuluvat samaan batchiin; materiaalihaku saa yhdistellä batchin eri tilausten kappaleita. Scheduler saa järjestää tuotannon, mutta ei muuttaa materiaalilähteiden kulutusta, kerfiä, kapasiteetin merkitystä, loppudispositionia tai materiaalipistettä.

`PRODUCTION_PLANNING.selectBatch(orders, evaluate, settings)` erottaa ehdokashaun materiaaliratkaisun arvioinnista. Integraatio suodattaa tyhjät luonnostilaukset pois laskettavasta jonosta. Nykyiset asetukset ovat `minBatchPieces = 200`, `targetBatchPieces = 250`, `maxBatchPieces = 300`; käyttäjä voi muuttaa niitä. Arvot ovat positiivisia kokonaislukuja järjestyksessä min ≤ tavoite ≤ max.

- Selector luettelee kaikki max-rajaan mahtuvat kokonaiset tilausyhdistelmät. Yksittäinen max-rajan ylittävä tilaus sallitaan yksin oversized-batchina.
- Jos koko laskettavan jonon kappalemäärä jää alle minimin, arvioidaan ainoastaan koko jono. Muuten arvioidaan min–max-alue ja oversized-yksittäistilaukset; alle minimin osajoukkoja ei valita edes materiaalipuutteen vuoksi.
- Vain täydellinen kelvollinen materiaaliratkaisu kelpaa. Ellei sopivaa löydy, palautetaan epäonnistuminen, ei osittaista valmisratkaisua.
- Pienin `totalCostEquivalent` voittaa; tavoitekoon etäisyys ratkaisee vain tasapisteet ja viimeisenä tilaus-ID:iden deterministinen järjestys. Pisteitä ei normalisoida kappalekohtaisiksi. Tämä voi suosia pienempää sallittua batchia.
- FIFO, deadline, ikä, anti-starvation ja työaikapisteet eivät ole aktiivisia valintakriteerejä. Kaikkien batch-yhdistelmien tutkiminen ei tee heuristisesta materiaalituloksesta todistettua optimia.

Haku on deterministinen ja synkroninen. Yhdistelmien määrä kasvaa eksponentiaalisesti; käyttöliittymän tilausraja ei ole suorituskykytakuu. Node-tutkimuksen anytime-haku ja välimuistit eivät ole selainselectorissa. Tunnettu rajoite: [BACKLOG.md, B-006](../../BACKLOG.md).

## Kappaleiden provenance

`attachPieces()` kohdistaa materiaaliplanin kappaleet deterministisesti alkuperäisiin kysyntäriveihin. Kappaleella on ajokohtainen `pieceId`, `orderId`, `openingId` tai `null`, profiili, väri, pituus ja lähdeviite. Kaikki pyydetyt kappaleet kohdistetaan täsmälleen kerran. Nimen muuttaminen ei saa vaihtaa tilausidentiteettiä. Sama mitta tai väri ei oikeuta yhdistämään eri aukkojen pareja.

Metadata ei muuta materiaalipistettä eikä lisää varastoryhmille pysyviä ID:itä. Materiaaliplanin `bar`/`source` on fyysinen lähde; `cut operation` kuvaa juuri yhtä tuotantovaihetta ja siinä mukana olevia lähteitä. Nippu ei ole pysyvä materiaalivaraston objekti.

## Scheduler, profiiliblokit ja yhteensopivuus

Scheduler käsittelee batchin yhtenäisinä blokkeina:

**Pysty → Vaste → Vaaka → U → yhteinen ala-/yläkiskoblokki.**

Puuttuva profiili ohitetaan. Aikaisimman keskeneräisen blokin ready-lähteet käsitellään ennen seuraavaa blokkia. Parent-riippuvuus on sallittu vain saman profiilin sisällä, joten kelvollinen dependency ei ylitä blokkirajaa.

| Profiili | `maxStackSize` | Varmuus |
| --- | ---: | --- |
| Pysty, Vaaka, U | 4 | Käyttäjän alustava kapasiteettipäätös |
| Yläkisko, Alakisko | 2 | Käyttäjän alustava kapasiteettipäätös |
| Vaste | 1 | Varovainen toteutusoletus; fyysinen nippukapasiteetti vahvistamatta |

`getCompatibility()` käyttää `profileDefaults`-datan `compatibilityGroup`- ja `maxStackSize`-arvoja. Oletuksena profiilit ovat eri ryhmissä. Yhteensopivassa sekaryhmässä noudatetaan pienintä mukana olevan profiilin kapasiteettia. Värit voivat sekoittua nipussa, mutta jokainen kappale tehdään oman profiilinsa ja värinsä lähteestä. Yleinen ryhmäasetus ei ohita kiskoparin erikoisrajaa.

Yksi operaatio sisältää lajin, sahaus-/poimintamitan, yhteensopivuusryhmän, lähde-ID:t, lähteiden ennen/jälkeen-pituudet, kappaleet ja edeltävät operaatiot. Samalla mitalla olevat ready-lähteet voidaan ottaa nippuun kapasiteettiin asti. Lähteen kappaleiden järjestys voi schedulerissa muuttua; materiaalin loppuratkaisun on säilyttävä validoituna.

### Aukkokohtainen kiskopari

Eksplisiittinen `railPairCompatibility` sallii ala+ylä-sekanipun vain, kun saman `orderId + openingId` -aukon **schedulerin aloituskysyntä** on täsmälleen yksi kumpaakin, mitat ja värit täsmäävät, molemmat lähteet ovat valmiina leikkausta varten ja kapasiteetti sallii parin. Puuttuvaa aukkoa ei arvata. Riippuvuudet ja release-poiminta voivat estää yhteisen sahausliikkeen.

Tavallisessa alkuperäisessä työssä aloituskysyntä on koko työn alkuperäinen kiskokysyntä. Continuationissa se on jatkon alkaessa todellisuudessa jäljellä oleva `remainingPieces`-kysyntä: alkuperäisestä 2+2:sta tai 3+3:sta jäljelle jäävä täsmällinen 1+1 saa sekaparin erityiskelpoisuuden. Konteksti pysyy samana jatkon loppuun asti; sitä ei pienennetä jokaisen kuittauksen jälkeen. Jäljellä oleva 2+2 tai 2+1 ei ole 1+1-erikoistapaus. Muut yhteensopivuus-, ready-, dependency- ja kapasiteettiehdot säilyvät.

Kun aloituskysynnän yhteismäärä on 4 tai enemmän, alakiskot niputetaan keskenään ja yläkiskot keskenään. Saman aukon samanmittaisia valmiita operaatioita suositaan peräkkäin myös suuremmissa määrissä. Tämä helpottaa mittavasteen pitämistä paikallaan, mutta ei lisää sen siirtoja optimizerin pisteytykseen. Pakkaamisen tuotantoperuste on [tuotantomuistiinpanoissa](../../DOMAIN_NOTES.md).

### Saman ajon jäännökset ja riippuvuudet

Lähteen jatkoleikkaus riippuu sen edellisestä operaatiosta (`dependencyIds`). Sama fyysinen `sourceId` säilyy, ja jatkokäytön origin näkyy `same-run-remnant`-arvona. Materiaaliplanissa salko pysyy yhtenä bar-kuviona: varastokulutus ja loppukrediitti lasketaan kerran.

Schedulerin rajapinta hyväksyy myös erillisen `parentSourceId`-lapsilähteen. Sen on oltava saman profiilin/värin `same-run-remnant`, ja nimellispituuden on vastattava vanhemman turvallista loppujäännöstä. Puuttuva vanhempi, sykli, kaksoiskäyttö ja väärä materiaalitase hylätään. Nykyinen materiaalihaku ei muodosta jokaisesta välijäännöksestä erillistä varastotapahtumaa.

Valmis saman ajon jäännös priorisoidaan ennen riippumatonta uutta lähdettä. Tasatilanteissa käytetään lähde-ID:tä ja alkuperäistä kappalejärjestystä kiskopriorisoinnin rajoissa. Syötetty vanha jäännösvarasto on lähtötieto, vaikka todellisen hyllyn tarkkuus voi vaihdella; sitä ei sekoiteta laskennallisesti tunnettuun saman ajon jatkoon.

### Cut, release ja mittarit

`kind: "cut"` tarkoittaa sahan käynnistämistä ja terän laskemista leikkuuseen. `kind: "release"` on nimellisesti täsmälleen oikean mittaisen loppukappaleen poiminta ilman uutta sahausliikettä. Fysiikka ja erillinen kapasiteetti tarkistetaan materiaalimallin mukaan. Oletusvaroilla turvallisen `remaining`-arvon loppuminen nollaan on edelleen `cut`, koska nimellistä varattua päätä on jäljellä.

`metrics` raportoi `cutOperationCount`, `stopPositionChanges`, `bundleUtilization`, `stackChanges` ja `handledSourceCount`. Sahausliikkeet ja nippukäyttö koskevat vain cut-operaatioita. Nippukäyttö on sahausliikkeissä tuotettujen kappaleiden määrä / sahausliikkeiden kapasiteettien summa. Mittavasteen siirtoihin lasketaan ensimmäinen sahausmitan asetus ja jokainen myöhempi mitan muutos; sama mitta tai poiminta ei lisää siirtoa. Nipun muutokset vertaavat lähde-ID-listoja. Ilman sahausta mittavasteen siirtoja on nolla.

Mittarit ovat raportointia. Työaika, käsittely, värinvaihdot, WIP tai nippuhyöty eivät ole materiaalipisteen komponentteja.

## Worker-numerointi ja materiaalivalmistelu

`createWorkerSourceManifest()` johtaa materiaaliplanin vakaasta `bars`-järjestyksestä kullekin fyysiselle profiilityypille numerot 1..N. Eri profiileilla voi olla sama numero. Sisäinen `bar.id`/`sourceId` on silti globaalisti yksilöllinen työssä. Saman lähteen kaikki jatkoleikkaukset säilyttävät worker-numeronsa. Numeroa ei tallenneta uutena identiteettinä.

Valmisteluyhteenveto näyttää **koko aktiivisen profiiliblokin** lähteet profiilin, värin ja alkuperän mukaan ryhmiteltyinä. Uusien salot näkyvät worker-numeroineen ja lähtöpituuksineen, vanhat jäännökset myös yksilöllisine nimellispituuksineen. Valmistelu ei ole vain seuraavan nipun tai jäljellä olevien lähteiden lista. Se vaihtuu seuraavaan käytössä olevaan blokkiin edellisen valmistuttua.

Ohjelma näyttää materiaalitarpeen; **operaattori päättää fyysisen kantomäärän ja varastoreissut**. Näkymä ei anna kantosuositusta eikä muuta batchia tämän perusteella. Kiskoblokissa esimerkiksi Ala 1 ja Ylä 1 erotetaan profiilinimellä.

## Toteumaloki, digest ja kuittaus

`executionState = { version, planDigest, events }` on V1/V2:n tallennettava toteumatieto. Operaatiolista muodostetaan aina uudelleen validoidusta materiaaliplanista ja kysynnästä. Digest sitoo tapahtumat alkuperäisen planin materiaaliin, kapasiteettitietoihin, batchiin ja johdettuihin operaatioihin; se ei ole erillinen scheduler-totuus. Tavallinen uusi työ ja vanhat tallenteet käyttävät versiota 1 (vain suunnitellut lähteet). Ensimmäinen lähdepoikkeama vaihtaa toteuman versioon 2. Sen jälkeen myös suunnitelman mukaiset kuittaukset validoidaan fyysisen toteuman kautta. Undo ei alenna versiota. V3 lisää alla kuvatun jatkosuunnitelman. Työtilan skeema 6 ja materiaalimoottori `material-v0.4` säilyvät.

Tapahtumat muodostavat järjestetyn etuliitteen alkuperäisestä operaatiolistasta. Vain seuraava operaatio voidaan kuitata, vain viimeisin kuittaus perua. `SAHAUS TEHTY` / `POIMINTA TEHTY` lisää yhden `operation-completed`-tapahtuman, johon kuuluvat operationId, completedAt ja actualSourceIds. Kuittaus tai undo tallennetaan ennen live-toteuman vaihtamista. Reload validoi digestin ja tapahtumien järjestyksen ja johtaa seuraavan vaiheen samasta etuliitteestä.

### Toteutuneen salon poikkeama (B-009)

Nykyisen operaation **Käytin eri salkoa** avaa yhden korvatun salon valinnan. Vaihtoehtoja ovat saman profiilin ja värin, jo alkuperäiseen manifestiin kuuluvat fyysiset salot. Kiskoblokissakaan ala- ja yläkisko eivät vaihdu materiaalina keskenään. Toisen nippupaikan jo käyttämää salkoa ei tarjota. Valitun salon tämänhetkisen kapasiteetin on riitettävä, eikä valinta saa muuttaa cut-operaatiota release-poiminnaksi tai päinvastoin. UI kirjaa yhden korvauksen ja kuittaa samalla koko nykyisen työvaiheen. Muiden slotien lähteet säilyvät suunniteltuina.

Alkuperäinen plan, sen kappalekohdistus ja schedulerin operaatiot säilyvät muuttumattomina. Tapahtuman `actualSourceIds` kohdistuu järjestyksessä alkuperäisiin lähde-/kappaleslotteihin: suunniteltu ja toteutunut lähde ovat erikseen jäljitettävissä. Uusia fyysisiä identiteettejä ei luoda worker-numeroista, eikä tulevia operaatioita automaattisesti siirretä korvaavalle salolle.

`replayProductionExecution()` johtaa fyysisen taseen lähtöpituuksista ja koko tapahtumaetuliitteestä. Kunkin käytetyn salon toteutuneet mitat ajetaan järjestyksessä materiaalicoren `calculateMaterialBarCapacity()`-funktion kautta käyttäen työn kerfiä ja salon alkuperäisiä kapasiteettivaroja. Näin `cutPiece()` määrää nimellisen jäljellä olevan pituuden ja sahahukan, ja samat lähde-/kappalevarat määräävät turvallisen pituuden. Koko nipun lähteet validoidaan ennen johdetun taseen päivittämistä. Sama fyysinen ID ei voi esiintyä kahdesti yhdessä nipussa; jatkoleikkaukset käyttävät saman salon lyhentynyttä tasetta. Erillisiä parent/child-jäännösidentiteettejä tai manifestin ulkopuolista varastomateriaalia ei tueta tässä ensiversiossa.

Jäljellä oleva alkuperäinen operaatiolista simuloidaan johdetun taseen kopiolla alkuperäisessä järjestyksessä ja alkuperäisillä lähde-ID:illä. Jos poikkeama itsessään on fyysisesti mahdollinen mutta tuleva työ ei enää ole, tapahtuma tallentuu ja **työ pysähtyy**. UI näyttää ristiriitaisen salon ja työvaiheen sekä uudelleenoptimoinnin tarpeen. Kuittaus, uusi poikkeama ja finalisointi estetään. Kelvollinen pysähtynyt tapahtumaetuliite hyväksytään reloadissa; sen jälkeiset jatkotapahtumat hylätään.

Toteutuneen poikkeaman aikana syötteet, uusi laskenta ja uuden työn aloitus lukitaan, jotta alkuperäistä suunnitelmaa tai toteumaa ei vahingossa hävitetä. Kuittaus ja undo nollaavat muuttuneen tapahtuman oikeasti käyttämien salojen valmistumismerkinnät. Undo poistaa vain viimeisimmän tapahtuman ja johtaa taseen sekä estot uudelleen; kaikkien poikkeamien peruuntuminen vapauttaa syötteet. **Undo on virheellisen kirjauksen korjaus, ei fyysisen sahaamisen peruutus.** Tallennusvirhe säilyttää edellisen live-tilan; epäonnistunut poikkeama pitää kirjata uudelleen ennen työn jatkamista.

Suunniteltu ja toteutunut salko näkyvät valmistuneen vaiheen historiassa ja lähiesikatselussa. Erillinen toteumatase näyttää jokaisen fyysisen salon käytön sekä nimellisen ja turvallisen jäljellä olevan pituuden. Alkuperäinen materiaalipiste ja materiaalikortit pysyvät vertailuna. Toteumataseita tai vaihtoehtoista plania ei tallenneta rinnakkaiseksi totuudeksi.

### Johdettu jatkolähtötila (B-013:n pohja)

`createProductionContinuationInput(state, plan, execution, kerf)` on DOM-riippumaton apuri alkuperäisestä validoidusta planista ja sen `createProductionExecution()`-tuloksesta. Se tarkistaa tapahtumaetuliitteen ja fyysisen toteuman nykyisellä replaylla sekä kappale-ID:iden yksilöllisyyden, kappaleslotit ja materiaaliplanin kappaleiden kattavuuden. Kelvollinen pysähtynyt etuliite on sallittu; apuri ei avaa työn jatkamista.

`allPieces` säilyttää alkuperäisen executionin operaatio- ja slottijärjestyksen sekä kappaleiden provenancen. `completedPieces` sisältää kuitattujen alkuperäisten operaatioiden kappaleet ja `remainingPieces` niiden piece-ID-erotuksen samassa järjestyksessä. Toteutunut lähde ei muuta kappaleen identiteettiä: B-009-fixturen 7 → 3 -poikkeama valmistaa `piece-7-1`:n, ei salon 3 tulevaa `piece-3-1`:tä. Tapahtumat viittaavat operaatioihin; erillistä kappalelistaa ei lueta tapahtumista eikä kappaleita numeroida uudelleen.

`physicalSources` sisältää replaysta kaikki alkuperäiset fyysiset salot manifestin järjestyksessä, myös käyttämättömät ja loppuun käytetyt. `sourceId`, profiili, väri, `source` ja `sourceLength` säilyttävät alkuperäisen fyysisen lähteen tiedot. `nominalRemaining` ja `remaining` ovat toteuman nimellinen ja turvallinen jatkolähtöpituus; `groupedCuts`, `waste` ja kapasiteettivarojen summat kuvaavat vain jo kirjattua käyttöä. `sourceCapacityAllowance` ja `pieceCapacityAllowance` säilyvät alkuperäisinä. Erikseen johdettu `carriedSourceCapacityAllowance = nominalRemaining − remaining` kantaa jo kertyneet varaukset eikä tarkoita uutta lähdevaraa tai varastojäännöstä. Erotus lasketaan 0,1 mm:n kokonaislukuyksiköissä.

Apuri palauttaa uudet kappale- ja lähdeobjektit; completed/remaining-listat viittaavat tuloksen yhteisiin `allPieces`-objekteihin. Mitään tästä ei tallenneta eikä apuri sovita tietoa optimizerin inventoryksi. Myös tyhjän tai valmiin kelvollisen lokin lähtötila voidaan johtaa.

### Puhdas jatkohaku ja scheduler (B-013:n toinen vaihe)

`createProductionContinuationPlan(state, plan, execution, kerf, options)` käyttää vain edellisen apurin alkuperäisiä fyysisiä lähteitä. Jokainen haulle tarjottu salko on äärellinen, määrä 1; myös käyttämätön alkuperäinen salko on sallittu. Loppuun käytettyä kapasiteettia ei tarjota haulle. Ulkopuolisia jäännöksiä tai uusia raakasalkoja ei lisätä eikä batch-selectoria ajeta. Valinnaiset `beamWidth` ja `patternsPerState` rajaavat hakua; materiaalipisteen asetukset pysyvät nykyisinä.

Sovitin käyttää yhteistä inventory-beamia lähdekohtaisella `sourceId`:llä. ID säilyy ehdokkaissa, kulutuksessa, beam-tiloissa ja lopputuloksessa. Tavallisessa inventory-polussa kenttä puuttuu ja ryhmäkohtainen käyttäytyminen säilyy. Virtuaalisen hakulähteen nimellispituus on `nominalRemaining`, kapasiteetti `remaining` ja varaus `carriedSourceCapacityAllowance`; alkuperäistä fyysistä lähdettä ei kirjoiteta uudelleen. Exact finite -fallback ohitetaan fyysisille lähteille, koska sen yhteiset kapasiteettiasetukset eivät kata eri carried-varoja. Ratkaisematon haku palauttaa `complete: false`, `feasibilityStatus: "unknown"`, `reason: "no-validated-continuation"` ilman osittaista suunnitelmaa. Tyhjän kysynnän syy on `no-remaining-pieces`.

Täydelliset ehdokkaat pisteytetään `createPredictedProductionMaterialPlan()`-funktion yhdistetystä fyysisestä ennusteesta nykyisellä materiaalipisteellä. Alkuperäisen prefixin leikkaukset ja ehdotetut jatkoleikkaukset lasketaan kullekin käytetylle salolle kerran alkuperäisestä `sourceLength`-pituudesta, alkuperäisellä lähdelajilla ja kapasiteettivaroilla. Kokonaan käyttämättömät salot eivät kulu eivätkä saa lähdeveloitusta. Score on lähdekohtaisesti additiivinen, joten profiili-/värivariantit ratkaistaan erikseen niiden yhdistetyllä ennusteella; lopullinen score kattaa kaikki käytetyt fyysiset salot, myös pelkässä prefixissä käytetyt.

Materiaalijaon mitat kohdistetaan deterministisesti takaisin alkuperäisiin tekemättömiin piece-ID:ihin. `evaluateProductionContinuationPlan(input, assignments, kerf)` validoi `assignments = [{ sourceId, pieceIds }]` -jaon, muodostaa uuden schedulerin ja simuloi sen alkuperäisen fyysisen taseen päälle. Vieraat, tehdyt, kahdennetut tai puuttuvat kappaleet sekä vieraat tai kahdennetut lähteet hylätään. Scheduler saa neljäntenä argumenttina jatkon alun `remainingPieces`-joukon: kiskoparin täsmällinen 1+1-kelpoisuus arvioidaan jäljellä olevasta kysynnästä. Alkuperäinen `allPieces` säilyy kappaleiden jäljitettävyyden ja digestin osana. Muutos vaikuttaa vain tuotanto-operaatioihin ja niiden mittareihin; samalla kohdistuksella materiaalitase ja materiaalipiste säilyvät. Jatkodigest muuttuu tarkoituksellisesti, jos scheduler-operaatiot muuttuvat; reload regeneroi saman schedulerin tallennetusta kohdistuksesta eikä hyväksy vanhaa eri schedulerin digestiä. Johdettu `previouslyUsed`-tieto säilyttää käytetyn salon jatkoleikkausprioriteetin ja `same-run-remnant`-esityksen ilman parent/child-identiteettiä. Before/after-pituudet alkavat replayn todellisista pituuksista.

Täydellinen tulos sisältää `assignments`, `predictedPlan`, `materialScore` ja `execution`. Ennuste ei ole toteuma eikä varastotransaktio. Haku-API on DOM- ja persistenssiriippumaton; erillinen V3-siirtymä vastaa aktivoinnista.

### Jatkon toteumatila V3 (B-013:n kolmas vaihe)

Tallennettava rakenne on `{ version: 3, planDigest, events, continuation: { digest, baseEventCount, assignments, events } }`. Alkuperäinen materiaaliplani ja siitä johdettu execution säilyvät vertailutotuuksina. Ulompi `events` on jäädytetty alkuperäinen V2-etuliite: sen on oltava fyysisesti kelvollinen mutta alkuperäisen tulevan työn kannalta pysähtynyt. `baseEventCount === events.length`. Tavalliseen ei-pysähtyneeseen työhön tai jo aktivoituun jatkoon ei voi aktivoida jatkoa.

`createProductionContinuationState()` tarkistaa pysähdyksen, johtaa lähtötilan, kutsuu olemassa olevaa jatkohakua ja vaatii täydellisen validoidun tuloksen. `activateCurrentProductionContinuation()` muodostaa uuden snapshotin ja vaihtaa live-tilan vain `persistProductionExecutionState()`-tallennuksen onnistuttua. Ratkaisematon haku tai tallennusvirhe säilyttää V2:n ja valmistumismerkinnät täsmälleen. Aktivoinnissa poistetaan valmistumismerkintä kaikilta `assignments`-lähteiltä; muiden salojen merkinnät säilyvät.

Jatkosta tallennetaan vain järjestetty `{ sourceId, pieceIds }` -kohdistus, sen digest, base-raja ja jatkon omat tapahtumat. Kappale-ID:t ovat alkuperäisiä. Scheduler, ennustettu materiaaliplani, score ja fyysinen tase johdetaan uudelleen; niitä ei tallenneta rinnakkaiseksi totuudeksi.

`createProductionContinuationDigest()` kanonisoi olioavaimet säilyttäen taulukoiden järjestyksen. Identiteetti sitoo alkuperäisen planDigestin, baseEventCountin, base-tapahtumien tyypit, operationId:t, aikaleimat ja järjestetyt actualSourceId:t, koko fyysisen lähtötaseen kapasiteettivaroineen, alkuperäisen koko kappalerekisterin ja remaining-joukon provenanceineen, järjestetyn kohdistuksen, uudelleen muodostetun scheduler-tuloksen, kerfin ja schedulerin profiiliasetukset. Digestin versio on `production-continuation-v1`. Digest ei korvaa kysynnän ja fysiikan validointia.

`continuation.events` on jatkoschedulerin järjestetty etuliite: `operation-completed`, `operationId`, `completedAt`, `actualSourceIds`. Tässä V3:ssa **vain jatkosuunnitelman mukaiset fyysiset lähteet hyväksytään**, samassa slottijärjestyksessä. Uutta lähdepoikkeamaa jatkon aikana ei tueta; se vaatisi uuden pysähdys- ja jatkorajan. Alkuperäisiä tapahtumia ei kasvateta. V1/V2:n kuittaus- ja poikkeamasopimus säilyy.

`replayProductionExecution()` ohjaa V3:n `replayProductionContinuationExecution()`-polulle: alkuperäiset fyysiset lähteet → alkuperäisen etuliitteen replay → jatko-operaatioiden replay samalle ledgerille. Jokainen leikkaus käyttää alkuperäistä lähdepituutta, lähdelajia ja kapasiteettivaroja sekä kaikkia jo toteutuneita leikkauksia yhteisen materiaalifysiikan kautta. Paluuarvo sisältää fyysiset saldot, `completedPieceIds`, `continuationComplete`, `complete` ja `conflict: null`; virheellinen toteuma hylätään poikkeuksella. Valmiina valmistuneet ID:t kattavat koko alkuperäisen kysynnän täsmälleen kerran.

V3:n undo poistaa vain viimeisen jatkotapahtuman. Tyhjän jatkolokin yli ei voi perua alkuperäistä kirjausta. `discardProductionContinuationState()` ja sen controller `discardCurrentProductionContinuation()` hylkäävät vain tyhjän jatkon ja palauttavat saman V2-pysähdyksen samalla fyysisellä taseella. Tallennus tapahtuu ensin; virhe säilyttää V3:n. Alkuperäisen kirjauksen undo on mahdollinen vasta V2:een palattua. Kuittaus ja undo poistavat muuttuneen tapahtuman todellisten lähteiden valmistumismerkinnät; hylkäys ei palauta poistettuja merkintöjä. V3:ssa myös erillinen salon valmistumismerkintä tallennetaan ennen live-muutosta. Undo korjaa kirjausta, ei palauta sahattua materiaalia.

Reload validoi ensin ulomman työtilan ja alkuperäisen planin, muodostaa alkuperäisen executionin, tarkistaa base-prefixin pysähdyksineen ja johtaa jatkon lähtötilan. `evaluateProductionContinuationPlan()` validoi tallennetut kohdistukset ja muodostaa schedulerin ilman optimizer-hakua. Vasta digestin, jatkotapahtumien, yhdistetyn replayn ja alkuperäisen manifestin valmistumis-ID:iden tarkistuksen jälkeen palautetaan live-tila. Korruptoitunutta V3:a ei pudoteta V2:ksi eikä tyhjennetä: [arkkitehtuurin palautuslukko](../ARCHITECTURE.md#tallennus-versiot-ja-palautus) säilyttää raakatallenteen automaattitallennukselta.

V3:n finalisointi käyttää samaa `createExecutedMaterialPlan()`-rajaa: kaikki jatko-operaatiot ja alkuperäiset kappaleet on valmistettava kerran ja koko alkuperäisen manifestin salot merkittävä valmiiksi. Yhdistettyyn materiaalitransaktioon tulee yksi bar per oikeasti käytetty alkuperäinen fyysinen sourceId, alkuperäinen source/sourceLength, kumulatiiviset leikkaukset ja waste sekä lopullinen turvallinen saldo ja nykyinen disposition. Käyttämättömät lähteet jäävät varastoon. Nykyistä jälkivarastopolkua kutsutaan kerran; batchin tilaukset poistetaan vasta onnistuneessa lopullisessa snapshotissa.

**Aktiivinen käyttöpolku:** pysähtyneen V2:n **MUODOSTA JATKOSUUNNITELMA** kutsuu olemassa olevaa aktivointicontrolleria. Ohut asynkroninen UI-sovitin lukitsee tuotantopainikkeet ja antaa selaimelle piirtohetken ennen synkronista hakua; tuplapainallus ei käynnistä toista aktivointia. Ratkaisematon haku tai tallennusvirhe näyttää virheen ja säilyttää V2-pysähdyksen. UI ei laske materiaalia.

V3:n **JATKOSUUNNITELMA** näyttää jatkon alkaessa tehdyt ja tekemättömät kappalemäärät sekä koko työn nykyisen kappale-etenemisen. `renderProductionDetails()` valitsee V3:ssa yhdistetyn replayn johtaman jatko-executionin ja `continuation.events`-prefixin; V1/V2 käyttää alkuperäistä executionia ja lokia. Sama kortti, profiiliblokki, toistoryhmät ja 3+3-esikatselu palvelevat molempia. Alkuperäisen prefixin historia ja poikkeamat säilyvät erillisessä pienessä avattavassa listassa; alkuperäiset materiaalikortit on nimetty vertailuksi.

Worker-numerot tulevat aina alkuperäisestä manifestista. Jatkon valmistelu rajaa siitä koko aktiivisen jatkoblokin käyttämät lähteet ja näyttää niiden jatkon lähtöpituudet, myös jo käytetyt jatkoleikattavat salot. Niitä ei numeroida uudelleen. **SAHAUS TEHTY** / **POIMINTA TEHTY** käyttää nykyistä V3-kuittauscontrolleria; **Käytin eri salkoa** ei näy jatkossa. Undo on käytettävissä vain jatkotapahtumien ollessa epätyhjä; tyhjän jatkon kohdalla näkyy erillinen **HYLKÄÄ JATKOSUUNNITELMA**. Selite erottaa kirjauksen korjauksen fyysisen sahaamisen peruuttamisesta. Reload palauttaa saman aktiivisen tilanteen ilman hakua. Salon valmistumismerkinnät ja finalisointi käyttävät nykyisiä persist-first-controllereita.

### Suoritusnäkymä ja toistoryhmät

Näkymä korostaa aktiivista profiiliblokkia, nykyistä sahaus-/poimintamittaa, worker-numeroita, nipun kokoa, kappaleita sekä blokin ja batchin edistymistä. Tilaus- ja aukkotiedot säilyvät mukana.

`areProductionOperationsRepeatable()` ja `createProductionOperationView()` yhdistävät vain **peräkkäiset** identtiset operaatiot esityksen toistoryhmäksi. Identiteettiin kuuluvat laji, mitta, yhteensopivuusryhmä, nippukapasiteetti, järjestetyt lähde-ID/profiili/väri-tiedot ja kappaleiden lähde-, profiili-, väri-, mitta-, määrä-, tilaus- ja aukkotiedot. Pelkkä sama mitta tai worker-numero ei riitä.

Operaation/piece-ID:n vaihtuminen, saman salon lyheneminen ja jatkosahauksen muuttunut origin eivät katkaise ryhmää. Riippuvuudet toteutuvat edelleen alkuperäisen listan järjestyksessä. Ryhmä ei muuta scheduleria, operation-ID:itä, planDigestiä tai persistenssiä.

- Yksi painallus kuittaa aina yhden alkuperäisen operaation, vaikka kortissa on usean toiston ryhmä.
- `x / n tehty` ja jäljellä olevat toistot johdetaan tapahtumien määrästä suhteessa ryhmän alkuun. Ryhmää tai omaa laskuria ei tallenneta.
- Näytetään enintään kolme viimeksi kuitattua operaatiota, nykyinen kortti/toistoryhmä ja kolme alkuperäistä operaatiota **nykyisen ryhmän jälkeen**. Esikatselu ei näytä ryhmän omia seuraavia toistoja erillisinä kortteina.
- Reload ja undo palauttavat saman ryhmän tilanteen lokista. Kaiken valmistuttua nykyistä tai seuraavaa operaatiota ei ole, ja viimeiset kolme jäävät historiaan. Täydet valmistuneet vaiheet ovat edelleen tarkasteltavissa.

## Salon valmistuminen ja finalisointi

`SALKO VALMIS` on erillinen palautettava fyysisen salon koko käsittelyn UI-tila. Se ei ole sama asia kuin operaation kuittaus eikä kumpikaan yksin muuta varastoa. `canFinalizePlan()` edellyttää täydellistä, epätyhjää suunnitelmaa ja kaikkien sen salon ID:iden valmistumismerkintää. Batch-työssä finalisointi vaatii lisäksi kaikki operaatiot fyysisesti kelvollisena tapahtumaetuliitteenä ja kelvollisen jatkotaseen. Pelkät salon valmistumismerkinnät eivät siis riitä, myöskään vanhassa batchissa, joka migroitui tyhjään lokiin. Batchiton legacy-suunnitelma käyttää aiempaa valmistumisehtoa.

`finalizeCurrentWork()` muodostaa batchin jälkivaraston `createExecutedMaterialPlan()`-funktion johtamasta toteumasta käyttäen muuttumatonta materiaalimallia. Vain oikeasti käytetyt fyysiset salot kuluvat, kukin kerran; käyttämätön suunniteltu salko jää varastoon ja syntyvät jäännökset tulevat toteuman turvallisista loppupituuksista samalla disposition-säännöllä kuin ennen. Kaikki manifestin salot, myös käyttämättömäksi jäänyt, tarkistetaan edelleen salon valmistumismerkinnällä. Näin vanhojen materiaalikorttien valmistumislogiikka pysyy yksiselitteisenä.

Finalisointi poistaa avoimesta jonosta vain valitun batchin tilaukset. Se rakentaa lopullisen snapshotin (jäljelle jäävät tilaukset ja varasto, tyhjä suunnitelma/toteuma/valmistumistilat), persistoi sen ja vaihtaa live-DOM:n vasta onnistumisen jälkeen. Tallennusvirhe säilyttää työn, varaston ja toteumalokin. Finalisointi ei käytä tutkimusten fyysistä säilytyspolitiikkaa. Pysyvä batch-historia ei sisälly tähän versioon.

Batch-historia, jatkon aikaiset lähdepoikkeamat, usean salon vaihtaminen samalla UI-kirjauksella, manifestin ulkopuoliset lähteet, peruutettava taustahaku, anti-starvation ja työaikakustannukset ovat tulevaa työtä. Vaiheistus on [roadmapissa](../../ROADMAP.md), fyysiset perusteet ja epävarmuudet [tuotantomuistiinpanoissa](../../DOMAIN_NOTES.md).
