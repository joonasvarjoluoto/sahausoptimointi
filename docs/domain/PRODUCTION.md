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

Eksplisiittinen `railPairCompatibility` sallii ala+ylä-sekanipun vain, kun saman `orderId + openingId` -aukon **koko batchin kiskokysyntä** on täsmälleen yksi kumpaakin, mitat ja värit täsmäävät, molemmat lähteet ovat valmiina leikkausta varten ja kapasiteetti sallii parin. Puuttuvaa aukkoa ei arvata. Riippuvuudet ja release-poiminta voivat estää yhteisen sahausliikkeen.

Kun yhteismäärä on 4 tai enemmän, alakiskot niputetaan keskenään ja yläkiskot keskenään. Saman aukon samanmittaisia valmiita operaatioita suositaan peräkkäin myös suuremmissa määrissä. Tämä helpottaa mittavasteen pitämistä paikallaan, mutta ei lisää sen siirtoja optimizerin pisteytykseen. Pakkaamisen tuotantoperuste on [tuotantomuistiinpanoissa](../../DOMAIN_NOTES.md).

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

`executionState = { version, planDigest, events }` on tallennettava toteumatieto. Operaatiolista muodostetaan aina uudelleen validoidusta materiaaliplanista ja kysynnästä. Digest sitoo tapahtumat alkuperäisen planin materiaaliin, kapasiteettitietoihin, batchiin ja johdettuihin operaatioihin; se ei ole erillinen scheduler-totuus. Tavallinen uusi työ ja vanhat tallenteet käyttävät versiota 1 (vain suunnitellut lähteet). Ensimmäinen lähdepoikkeama vaihtaa toteuman versioon 2. Sen jälkeen myös suunnitelman mukaiset kuittaukset validoidaan fyysisen toteuman kautta. Undo ei alenna versiota. Työtilan skeema 6 ja materiaalimoottori `material-v0.4` säilyvät.

Tapahtumat muodostavat järjestetyn etuliitteen alkuperäisestä operaatiolistasta. Vain seuraava operaatio voidaan kuitata, vain viimeisin kuittaus perua. `SAHAUS TEHTY` / `POIMINTA TEHTY` lisää yhden `operation-completed`-tapahtuman, johon kuuluvat operationId, completedAt ja actualSourceIds. Kuittaus tai undo tallennetaan ennen live-toteuman vaihtamista. Reload validoi digestin ja tapahtumien järjestyksen ja johtaa seuraavan vaiheen samasta etuliitteestä.

### Toteutuneen salon poikkeama (B-009)

Nykyisen operaation **Käytin eri salkoa** avaa yhden korvatun salon valinnan. Vaihtoehtoja ovat saman profiilin ja värin, jo alkuperäiseen manifestiin kuuluvat fyysiset salot. Kiskoblokissakaan ala- ja yläkisko eivät vaihdu materiaalina keskenään. Toisen nippupaikan jo käyttämää salkoa ei tarjota. Valitun salon tämänhetkisen kapasiteetin on riitettävä, eikä valinta saa muuttaa cut-operaatiota release-poiminnaksi tai päinvastoin. UI kirjaa yhden korvauksen ja kuittaa samalla koko nykyisen työvaiheen. Muiden slotien lähteet säilyvät suunniteltuina.

Alkuperäinen plan, sen kappalekohdistus ja schedulerin operaatiot säilyvät muuttumattomina. Tapahtuman `actualSourceIds` kohdistuu järjestyksessä alkuperäisiin lähde-/kappaleslotteihin: suunniteltu ja toteutunut lähde ovat erikseen jäljitettävissä. Uusia fyysisiä identiteettejä ei luoda worker-numeroista, eikä tulevia operaatioita automaattisesti siirretä korvaavalle salolle.

`replayProductionExecution()` johtaa fyysisen taseen lähtöpituuksista ja koko tapahtumaetuliitteestä. Kunkin käytetyn salon toteutuneet mitat ajetaan järjestyksessä materiaalicoren `calculateMaterialBarCapacity()`-funktion kautta käyttäen työn kerfiä ja salon alkuperäisiä kapasiteettivaroja. Näin `cutPiece()` määrää nimellisen jäljellä olevan pituuden ja sahahukan, ja samat lähde-/kappalevarat määräävät turvallisen pituuden. Koko nipun lähteet validoidaan ennen johdetun taseen päivittämistä. Sama fyysinen ID ei voi esiintyä kahdesti yhdessä nipussa; jatkoleikkaukset käyttävät saman salon lyhentynyttä tasetta. Erillisiä parent/child-jäännösidentiteettejä tai manifestin ulkopuolista varastomateriaalia ei tueta tässä ensiversiossa.

Jäljellä oleva alkuperäinen operaatiolista simuloidaan johdetun taseen kopiolla alkuperäisessä järjestyksessä ja alkuperäisillä lähde-ID:illä. Jos poikkeama itsessään on fyysisesti mahdollinen mutta tuleva työ ei enää ole, tapahtuma tallentuu ja **työ pysähtyy**. UI näyttää ristiriitaisen salon ja työvaiheen sekä uudelleenoptimoinnin tarpeen. Kuittaus, uusi poikkeama ja finalisointi estetään. Kelvollinen pysähtynyt tapahtumaetuliite hyväksytään reloadissa; sen jälkeiset jatkotapahtumat hylätään.

Toteutuneen poikkeaman aikana syötteet, uusi laskenta ja uuden työn aloitus lukitaan, jotta alkuperäistä suunnitelmaa tai toteumaa ei vahingossa hävitetä. Kuittaus ja undo nollaavat muuttuneen tapahtuman oikeasti käyttämien salojen valmistumismerkinnät. Undo poistaa vain viimeisimmän tapahtuman ja johtaa taseen sekä estot uudelleen; kaikkien poikkeamien peruuntuminen vapauttaa syötteet. **Undo on virheellisen kirjauksen korjaus, ei fyysisen sahaamisen peruutus.** Tallennusvirhe säilyttää edellisen live-tilan; epäonnistunut poikkeama pitää kirjata uudelleen ennen työn jatkamista.

Suunniteltu ja toteutunut salko näkyvät valmistuneen vaiheen historiassa ja lähiesikatselussa. Erillinen toteumatase näyttää jokaisen fyysisen salon käytön sekä nimellisen ja turvallisen jäljellä olevan pituuden. Alkuperäinen materiaalipiste ja materiaalikortit pysyvät vertailuna. Toteumataseita tai vaihtoehtoista plania ei tallenneta rinnakkaiseksi totuudeksi.

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

Batch-historia, poikkeaman rikkoman jatkosuunnitelman osittainen uudelleenoptimointi, usean salon vaihtaminen samalla UI-kirjauksella, manifestin ulkopuoliset lähteet, peruutettava taustahaku, anti-starvation ja työaikakustannukset ovat tulevaa työtä. Vaiheistus on [roadmapissa](../../ROADMAP.md), fyysiset perusteet ja epävarmuudet [tuotantomuistiinpanoissa](../../DOMAIN_NOTES.md).
