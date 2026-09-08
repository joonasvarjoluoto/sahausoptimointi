# Tuotantobatchit ja nippusahaus

## Päätös ja toteutus 8.9.2026

Lähde: käyttäjän tämän toteutustehtävän auktoritatiivinen tehtävänanto. Tämä päätös korvaa muistion 7.9.2026 avoimet continuous-, span-, age- ja sekventiaalisen putkituksen vaihtoehdot. Ne ovat mahdollisia myöhempiä kehityssuuntia, eivät aktiivinen arkkitehtuuri.

Ainoa aktiivinen optimointikriteeri on nykyinen materiaalitalous. Kerf, materiaalin lähdearvo, jäännöskrediitti, disposition, käsittely, uusien jäännösten luonti ja suuren romun lisäkustannus säilyvät nykyisessä `scoreCompleteMaterialTransitionPlan()`-mallissa. Nippusahaus ja mittavasteen siirrot eivät vaikuta materiaalipisteisiin.

## Putki ja vastuut

```text
avoimet tilauskortit
  → selectProductionBatch / PRODUCTION_PLANNING.selectBatch
  → valitut kokonaiset tilaukset
  → nykyinen inventory-aware material optimizer
  → materiaalin tankokohtainen suunnitelma
  → attachPieces: yksilölliset kappaleet ja tilaus-/aukkokohdistus
  → schedule: lähderiippuvuudet ja hetkellinen nippusahaus
  → cut operations ja materiaalinäkymä
```

`src/production-planning.js` sisältää puhtaan selectorin, kohdistuksen ja schedulerin. `src/production-integration.js` sovittaa ne nykyisiin lomakkeisiin, optimointiin, tallennukseen ja tulosnäkymään. Optimizerin hakua, score-parametreja, legacy-polkuja tai sahausmoduulia ei muutettu.

## Batch-valinta

- `minBatchPieces = 200`, `targetBatchPieces = 250`, `maxBatchPieces = 300` ovat asetuksia; niitä voi muuttaa selaimen batch-asetuksista.
- **Batch selectorissa tilaus on jakamaton yksikkö: yhden tilauksen kaikki kappaleet kuuluvat samaan batchiin. Batchin sisällä material optimizer saa käsitellä kappaleita yksittäin ja yhdistellä niitä muiden batchin tilausten kappaleisiin.**
- Kappalemäärä lasketaan normalisoidusta kysynnästä: ylä- ja alakisko ovat erillisiä fyysisiä kappaleita. Kiskosyötteen vanhaa määrätulkintaa ei muutettu tässä työssä.
- Selector luettelee kaikki max-rajaan mahtuvat kokonaisten tilausten yhdistelmät. Yksittäinen max-rajan ylittävä tilaus on sallittu yksin oversized-batchina.
- Jos kaikkien avoimien tilausten yhteiskappalemäärä jää alle minimin, arvioidaan ainoastaan koko jono yhtenä batchina. Muuten arvioidaan min–max-alue ja oversized-yksittäistilaukset. Alle minimin jääviä osajoukkoja ei tällöin valita; materiaalipuutteen tai kokorajoihin sopimattomien tilauskokojen vuoksi voidaan palauttaa epäonnistuminen. Tilausta ei pilkota. Käyttäjän tarkennus 8.9.2026: minimin tarkoitus on estää tarpeettoman pienet erät suuresta jonosta.
- Valintajärjestys on nykyinen `totalCostEquivalent`, sitten etäisyys tavoitekokoon ja lopuksi tilaus-ID:iden järjestys. Kokoeroa ei hinnoitella eikä materiaalipistettä normalisoida kappalekohtaiseksi. Kokonaiskustannus voi siksi suosia pienempää tai vähemmän materiaalia vaativaa sallittua batchia; tämä on näkyvä ensimmäisen version sääntö.
- FIFO, deadline ja anti-starvation eivät ole aktiivisia. `selectBatch(orders, evaluate, settings)` erottaa ehdokkaiden haun materiaaliratkaisun arvioinnista ja sallii selectorin myöhemmän vaihdon.
- Haku on deterministinen. Kaikkien batch-yhdistelmien tutkiminen ei todista materiaaliratkaisua globaaliksi optimiksi, koska materiaalikerros on beam-heuristiikka.
- Tyypillinen 5–10 tilauksen jono on lähtömittakaava. Yhdistelmien määrä kasvaa eksponentiaalisesti; pitkä laskenta on synkroninen. Suurten jonojen suorituskyky ja peruutettava taustalaskenta ovat myöhempää työtä, eivät piilotettu esikarsinta.

## Kappaleiden provenance

Jokainen tuotantokappale saa ajokohtaisen `pieceId`:n, `orderId`:n, `openingId`:n (tai `null`), profiilin, värin, mitan ja lähdeviitteen. Mittarivin valinnainen aukon tunnus kulkee tallennuksen ja normalisoinnin läpi. Saman rivin kaikki kappaleet kuuluvat annettuun aukkoon; eri aukot syötetään omille riveilleen. Tunnisteen oikeellisuus perustuu käyttäjän syötteeseen, eikä järjestelmä päättele aukkoja mitoista.

Optimizer saa yhdistää saman materiaalivariantin ja mitan kysynnän. `attachPieces()` kohdistaa tuloksen deterministisesti alkuperäisiin kysyntäriveihin ja tarkistaa jokaisen kappaleen täsmälleen kerran. Metadata ei vaikuta materiaalipisteeseen. Varastoryhmille ei lisätä pysyviä yksilö-ID:itä.

## Scheduler ja turvallisuus

Yksi `cut operation` sisältää yhden katkaisumitan, yhteensopivuusryhmän, mukana olevat lähde-ID:t ja niiden ennen/jälkeen-pituudet, syntyvät kappaleet sekä edeltävät operaatiot. Nippu ei ole pysyvä objekti. Scheduler ottaa valitun mitan samanaikaisesti kaikista valmiista yhteensopivista lähteistä kapasiteettiin saakka; tarvittaessa saman lähteen kappaleiden järjestys muuttuu. Materiaaliratkaisu ja sen loppujäännös säilyvät.

Profiilikohtaiset `profileDefaults`-asetukset:

| Profiili | maxStackSize | Peruste |
| --- | ---: | --- |
| U | 4 | Käyttäjän alustava oletus |
| Pysty | 4 | Käyttäjän alustava oletus |
| Vaaka | 4 | Käyttäjän alustava oletus |
| Yläkisko | 2 | Käyttäjän alustava oletus |
| Alakisko | 2 | Käyttäjän alustava oletus |
| Vaste | 1 | Varovainen toteutusoletus; käyttäjä ei antanut kapasiteettia |

`getCompatibility()` lukee profiilin `compatibilityGroup`- ja `maxStackSize`-säännöt. Oletuksena kukin profiili muodostaa oman ryhmänsä. Tulevia poikkeuksia voi määrittää datalla; sekaryhmässä noudatetaan mukana olevien profiilien pienintä kapasiteettia. Värit saavat sekoittua sahausliikkeessä, mutta kappaleen ja materiaalilähteen värin on edelleen täsmättävä.

`cutPiece()` tarkistaa alkuperäiset lähteet ja jokaisen operaation. Scheduler ei lisää kerfiä, toleranssia, päävaraa eikä muuta dispositionia. Nimellinen täsmäsovitus säilyy nykyisen fysiikan mukaisena. Täsmälleen oikean mittainen loppukappale on `kind: "release"` -poiminta, joka näkyy suoritusjärjestyksessä mutta ei kasvata sahausliikkeiden määrää. Muut leikkaukset ovat `kind: "cut"` -operaatioita.

## Saman batchin jäännökset ja DAG

Lähteen jokainen seuraava leikkaus käyttää sen edellisen operaation jäljelle jättämää materiaalia. Tällä jatko-operaatiolla on eksplisiittinen `dependencyIds`-viite edeltävään operaatioon, ja lähteen alkuperä näytetään `same-run-remnant`-tilana. Materiaalinäkymässä sama fyysinen salko säilyy yhtenä bar-objektina, joten sen varastovähennys ja loppujäännöksen krediitti lasketaan vain kerran.

Scheduler hyväksyy myös erikseen kuvatun `parentSourceId`-riippuvuuden: lapsilähteen pitää olla `same-run-remnant`, sen pituuden pitää vastata vanhemman loppujäännöstä ja materiaalivariantin olla sama. Sykli, puuttuva vanhempi ja saman jäännöksen kaksoiskäyttö hylätään ennen aikataulutusta. Tämä on schedulerin rajapinta; nykyinen materiaalihaku esittää saman salon jatkoleikkaukset edelleen yhtenä bar-kuviona eikä luo erillistä varastotapahtumaa jokaisesta välijäännöksestä.

Valmis saman ajon jäännöksen käyttö priorisoidaan ennen riippumatonta uutta lähdettä. Tasatilanteet ratkaistaan lähde-ID:llä ja alkuperäisellä kappalejärjestyksellä. Samanmittoiset muut valmiit lähteet voidaan silti ottaa mukaan samaan nippuun. Globaalisti optimaalista tuotantojärjestystä ei väitetä.

Vanha fyysinen jäännösvarasto voi tuotannossa olla epätarkka (käyttäjän havainto 7.9.2026). Nykyisen sovelluksen syötetty varasto säilyy optimizerin auktoritatiivisena lähtötietona. Saman ajon välijäännökset tunnetaan laskennallisesti tarkasti; niitä ei sekoiteta vanhaan varastoon.

## UI, tallennus ja finalisointi

Batchin tilaukset, kappalemäärät, kokorajat ja materiaalipisteen komponentit näkyvät tuloksessa. Nykyinen materiaalinäkymä säilyy. Avattava sahausjärjestys näyttää operaatiot, lähteet, värit, alkuperän sekä tilaus-, aukko- ja kappaletunnisteet.

Skeema 4 saa yhteensopivat valinnaiset lisäkentät: luonnoksen `batchSettings` (lomakemerkkijonot), mittarivin `openingId` ja `generatedPlan.batch = { version: 1, orderIds, settings }`. Vanha kelvollinen skeeman 4 työ säilyy; sen suunnitelma tarkoittaa entiseen tapaan koko kysyntää. Materiaalimoottoriversio `material-v0.3` säilyy, koska materiaalifysiikka ja score-yhteensopivuus eivät muutu. Uuden batch-metadatan oma versio validoidaan.

Operaatiolistaa ei tallenneta toisena totuutena: se muodostetaan uudelleen validoidusta materiaalista ja kysynnästä. Palautus tarkistaa valitut kokonaiset tilaukset, materiaalitaseen, varastorajat, sahausfysiikan ja tuotantokohdistuksen. Korruptti/puutteellinen batch tai osittainen suunnitelma ei palaudu valmiina.

TEHTY pysyy salon UI-tilana. Finalisointi persistoi lopullisen varaston ja jäljelle jäävän tilausjonon ennen live-tilan vaihtamista. Vain valitun batchin tilaukset poistuvat jonosta; tallennusvirhe säilyttää koko työn. Vanhan batchittoman suunnitelman finalisointi säilyttää aiemman tilauslomakekäyttäytymisen. Batch-historiaa, operaatiokohtaista kuittausta tai osittain sahatun batchin uudelleenoptimointia ei vielä ole.

## Mittarit ja myöhempi työ

`metrics` sisältää `cutOperationCount`, `stopPositionChanges`, `bundleUtilization`, `stackChanges` ja `handledSourceCount`. Mittavasteen ensimmäinen asetus lasketaan yhdeksi siirroksi batchin alussa. Seuraava siirto lasketaan aina sahausmitan muuttuessa. Saman mitan toistaminen ei lisää siirtoa. Ilman sahausliikkeitä siirtoja on nolla; poiminnat eivät muuta mittavasteen asentoa. Sahausliike tarkoittaa käynnistetyn sahan terän laskemista käsin alas leikkuuseen. Nippukäyttö on sahausliikkeissä tuotettujen kappaleiden määrä jaettuna sahausliikkeiden kapasiteettien summalla; release-poimintoja ei lasketa mukaan. Nipun muutos vertailee peräkkäisten operaatioiden lähde-ID-listoja.

Mittarit ovat raportointia. Työaika, mittavasteen siirto, nippuhyöty, käsittelyaika, WIP, värinvaihdot ja kiireellisyys eivät ole optimizerin objective. Niiden kustannuskalibrointi, anti-starvation, batch-historia ja mahdollinen continuous-planner ovat myöhempiä erillisiä päätöksiä.

## Testaus

Tulokset 8.9.2026: koko Node-paketti 35/35 ryhmää, tuotantoryhmä 65 tarkistusta ja ohjaus-/persistenssiajuri 17 tarkistusta. Viiden 50 kappaleen Pysty-tilauksen mittaus (1000/1010/1020/1030/1040 mm, rajaton musta 6000 mm materiaali, kerf 3): kuusi alueen batch-ehdokasta, noin 27,4 s, valittu 200 kappaletta ja 41 salkoa. Tämä on yksi synteettinen Node-mittaus, ei todistus hakulaadusta tai 10 tilauksen laskenta-ajasta.

- `node run-regressions.cjs`: vanhat materiaaliregressiot ja uusi `production-regressions.js`-ryhmä.
- `node run-production-ui-regressions.cjs`: oikean calculate-/restore-/finalize-ohjauksen testit DOM-/storage-testikaksoisella; ei selaimen layout-testi.
- Uudet tapaukset kattavat batch-koot, kokonaiset tilaukset, oversizedin, deterministisyyden, todellisen ei-FIFO-materiaalivalinnan, nippukapasiteetit, värit, profiilieristyksen, laajennettavan yhteensopivuuden, kappale-/aukkokohdistuksen, riippuvuudet, materiaalitaseen, pisteiden säilymisen ja palautuksen virheet.
- Ohjaustestit kattavat batchin tallennuksen/palautuksen, TEHTY-tilan, finalisoinnin tallennusvirheen ja onnistumisen, jälkivaraston sekä seuraavan batchin muodostamisen ilman jo valmistuneita tilauksia.
- Todellinen selaintesti suoritettiin 8.9.2026 käyttäjän antamassa osoitteessa `http://127.0.0.1:5500/index.html`. Aiempi tiedostosivun avaus estyi; nykyinen HTTP-testi valmistui onnistuneesti.

### Käyttäjän selaintarkistus

1. Avaa sovellus omalla nykyisellä käyttötavallasi. Syötä kolme mustaa tilausta: Pysty 2200 × 1 (aukko A), 3800 × 1 (B), 3797 × 1 (C). Käytä 6000 mm salkoa, kerfiä 3, rajatonta mustaa Pystyä ja tyhjää jäännöslistaa.
2. Aseta batchin min/tavoite/max = 2/2/2 ja laske. Batchiin tulee 2200 + 3797; 3800 jää jonoon. Suunnitelmassa on yksi uusi salko ja nollajäännös.
3. Avaa sahausjärjestys ja varmista tilaus-/aukkotiedot. Lataa sivu uudelleen: batch, asetukset ja kohdistukset säilyvät.
4. Merkitse salko tehdyksi ja päätä työ. Vain 3800-tilaus jää jonoon. Laske se seuraavana batchina; alle minimin jäävä yhden kappaleen batch sallitaan.
5. Nippudemo: kaksi mustaa Pysty-tilausta ja kaksi valkoista, jokaisessa 4000 × 1, vastaavat rajattomat materiaalit, min/tavoite/max = 4/4/4. Neljä lähdettä sahataan samalla 4000 mm:n mitalla yhdessä nipussa, vaikka värit eroavat.

Käyttäjän selaintarkistus 8.9.2026: kolmen tilauksen testin materiaalivalinta vahvistettu oikeaksi rajoilla 2/2/2. Myös rajattoman harmaan ja mustan oletusrivit vahvistettu. Muita aiemman testilistan kohtia ei ole tällä vahvistuksella kuitattu. Mittavasteen ensiasetuksen laskenta ja lyhyen jonon koko batch ovat tämän palautteen jälkeisiä muutoksia.

Käyttäjän jatkotestit: palautus, TEHTY, finalisointi, seuraava batch, syötteen muokkauksen mitätöinti, materiaalin loppuminen sekä eri värien 4 ja 4+2 lähteen nippusahaus vahvistettu toimiviksi. Tämän jälkeen lisättiin käyttäjän pyynnöstä koko tilauskortin pienentäminen nimellä ja värillä otsikoidun accordionin taakse. Kortin sulkemistila tallentuu valinnaisena `collapsed`-booleanina, eikä se vaikuta kysyntään, suunnitelmaan tai TEHTY-tilaan. Uusi kortti avautuu oletuksena.

Agentin täydentävät selaintestit 8.9.2026 läpäisty: harmaan ja mustan oletusrivit; tilausotsikon fyysinen kappalemäärä ja sen päivittyminen määrää muutettaessa sekä riviä poistettaessa; suljetun kortin ja TEHTY-tilan säilyminen uudelleenlatauksessa; Pysty/Vaaka-profiilieristys samalla 4000 mm mitalla; kiskojen 4000 × 3 -rivin kuusi fyysistä kappaletta ja erilliset 2+1 niput kummallekin kiskolle; alle minimin jäävän koko jonon valinta; rajojen 2/3/4 sallimat 2 ja 4 kappaleen batchit sekä jakamaton 5 kappaleen oversized-tilaus. Suljetun kortin työpöytäasettelu tarkistettu kuvasta; erillistä mobiililaitetestiä ei tehty. Selaimen virhe- ja varoitusloki oli tyhjä.

Jatkosahauksen fixture: musta Pysty 4000 × 1 + 1000 × 1, saatavilla täsmälleen yksi uusi 6000 mm tanko, kerf 3, ei jäännösvarastoa. Tulos: yksi tanko, kaksi peräkkäistä saman lähteen sahausta 6000 → 1997 → 994 mm, sahahukka 6 mm, kaksi mittavasteen siirtoa ja oikeat aukot J1/J2. Aiempi testiohje oletti yhden tangon myös rajattomalla saatavuudella. Se oletus oli väärä: sekä HEAD että työversio valitsevat silloin kaksi tankoa pisteellä 7187,8; yhden tangon palautetun ratkaisun piste on 7250,4. Tämä ei ole uuden schedulerin regressio eikä peruste muuttaa materiaalipisteytystä tässä työssä.
