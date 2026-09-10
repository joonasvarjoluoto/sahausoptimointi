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

`executionState = { version: 1, planDigest, events }` on tallennettava toteumatieto. Operaatiolista muodostetaan aina uudelleen validoidusta materiaaliplanista ja kysynnästä. Digest sitoo tapahtumat planin materiaaliin, kapasiteettitietoihin, batchiin ja johdettuihin operaatioihin; se ei ole erillinen scheduler-totuus.

Tapahtumat muodostavat järjestetyn etuliitteen alkuperäisestä operaatiolistasta. Vain seuraava operaatio voidaan kuitata, vain viimeisin kuittaus perua. `SAHAUS TEHTY` / `POIMINTA TEHTY` lisää yhden `operation-completed`-tapahtuman, johon kuuluvat operationId, completedAt ja actualSourceIds. Kuittaus tai undo tallennetaan ennen live-toteuman vaihtamista. Reload validoi digestin ja tapahtumien järjestyksen ja johtaa seuraavan vaiheen samasta etuliitteestä.

Nykyinen `actualSourceIds` hyväksyy vain operaation suunnitellut lähteet. Se ei vielä tue väärän salon kirjaamista, jäljellä olevan suunnitelman korjausta tai osittaista uudelleenoptimointia. Pelkkä ID:n vaihtaminen ei riitä fyysisten seurausten käsittelyksi. Avoin työ: [B-009](../../BACKLOG.md).

### Suoritusnäkymä ja toistoryhmät

Näkymä korostaa aktiivista profiiliblokkia, nykyistä sahaus-/poimintamittaa, worker-numeroita, nipun kokoa, kappaleita sekä blokin ja batchin edistymistä. Tilaus- ja aukkotiedot säilyvät mukana.

`areProductionOperationsRepeatable()` ja `createProductionOperationView()` yhdistävät vain **peräkkäiset** identtiset operaatiot esityksen toistoryhmäksi. Identiteettiin kuuluvat laji, mitta, yhteensopivuusryhmä, nippukapasiteetti, järjestetyt lähde-ID/profiili/väri-tiedot ja kappaleiden lähde-, profiili-, väri-, mitta-, määrä-, tilaus- ja aukkotiedot. Pelkkä sama mitta tai worker-numero ei riitä.

Operaation/piece-ID:n vaihtuminen, saman salon lyheneminen ja jatkosahauksen muuttunut origin eivät katkaise ryhmää. Riippuvuudet toteutuvat edelleen alkuperäisen listan järjestyksessä. Ryhmä ei muuta scheduleria, operation-ID:itä, planDigestiä tai persistenssiä.

- Yksi painallus kuittaa aina yhden alkuperäisen operaation, vaikka kortissa on usean toiston ryhmä.
- `x / n tehty` ja jäljellä olevat toistot johdetaan tapahtumien määrästä suhteessa ryhmän alkuun. Ryhmää tai omaa laskuria ei tallenneta.
- Näytetään enintään kolme viimeksi kuitattua operaatiota, nykyinen kortti/toistoryhmä ja kolme alkuperäistä operaatiota **nykyisen ryhmän jälkeen**. Esikatselu ei näytä ryhmän omia seuraavia toistoja erillisinä kortteina.
- Reload ja undo palauttavat saman ryhmän tilanteen lokista. Kaiken valmistuttua nykyistä tai seuraavaa operaatiota ei ole, ja viimeiset kolme jäävät historiaan. Täydet valmistuneet vaiheet ovat edelleen tarkasteltavissa.

## Salon valmistuminen ja finalisointi

`SALKO VALMIS` on erillinen palautettava fyysisen salon koko käsittelyn UI-tila. Se ei ole sama asia kuin operaation kuittaus eikä kumpikaan yksin muuta varastoa. Nykyinen `canFinalizePlan()` edellyttää täydellistä, epätyhjää suunnitelmaa ja kaikkien sen salon ID:iden valmistumismerkintää. **Toteumalokin valmistumista ei tarkisteta erillisenä finalisointiehtona.** Tätä ei saa kuvata tiukemmaksi kuin koodi toteuttaa.

`finalizeCurrentWork()` muodostaa materiaalimallin mukaisen jälkivaraston ja poistaa avoimesta jonosta vain valitun batchin tilaukset. Se rakentaa lopullisen snapshotin (jäljelle jäävät tilaukset ja varasto, tyhjä suunnitelma/toteuma/valmistumistilat), persistoi sen ja vaihtaa live-DOM:n vasta onnistumisen jälkeen. Tallennusvirhe säilyttää työn, varaston ja toteumalokin. Finalisointi ei käytä tutkimusten fyysistä säilytyspolitiikkaa.

Batch-historia, toteutuneen lähteen poikkeamankäsittely, peruutettava taustahaku, anti-starvation ja työaikakustannukset ovat tulevaa työtä. Vaiheistus on [roadmapissa](../../ROADMAP.md), fyysiset perusteet ja epävarmuudet [tuotantomuistiinpanoissa](../../DOMAIN_NOTES.md).
