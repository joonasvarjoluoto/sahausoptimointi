# AGENTS.md

## Ohjeiden tarkoitus ja projektidokumentit

Lue tämä tiedosto ennen projektia koskevaa työtä. Tämä sisältää pysyvät toimintatavat ja säännöt, joiden rikkoutuminen voisi muuttaa sahaus- tai materiaalilogiikan merkitystä.

Käytä lisäksi tehtävän mukaan:

- `ROADMAP.md`: etenemisjärjestys, nykyinen vaihe ja myöhemmät tavoitteet. Lue se, kun käyttäjä kysyy seuraavaa vaihetta tai pyytää suunnittelemaan laajempaa kehitystä.
- `BACKLOG.md`: todelliset mutta ei-kiireelliset virheet, rajoitteet ja parannuskohteet. Backlog-merkintä ei itsessään anna lupaa toteuttaa muutosta.
- `DOMAIN_NOTES.md`: tuotanto- ja liiketoimintafaktat, arviot sekä avoimet kysymykset. Arviota ei saa muuttaa koodin taloussäännöksi ilman erillistä päätöstä ja testejä.

Jos dokumentti ja nykyinen lähdekoodi ovat ristiriidassa, tarkista ensin lähdekoodi ja Git-tila. Raportoi ristiriita; korjaa dokumentaatio vain tehtävän rajojen tai käyttäjän luvan puitteissa.

## Projektin tavoite

Tämä on oppimisprojekti, jossa rakennetaan selaimessa toimivaa sahausoptimointia alumiiniprofiileille. Tavallinen uuden tangon pituus ja käyttöliittymän oletus on 6000 mm, mutta laskennan pitää käyttää nykyistä `stockLength`-syötettä, ellei tehtävässä erikseen päätetä lukita pituutta.

Tavoite ei ole vain vähentää sahahukkaa. Ratkaisun pitää huomioida erillisinä ja selitettävinä ainakin uuden materiaalin käyttö, olemassa olevat jäännökset, syntyvien jäännösten arvo, sahahukka ja varaston pirstaloituminen. Erillinen tuotantoscheduler muodostaa nyt sahausjärjestyksen; työaikakustannukset tulevat myöhemmin. Kustannuskomponentteja ei saa piilottaa yhteen perustelemattomaan kokonaispisteeseen.

Oppiminen on yhtä tärkeää kuin toimiva tulos. Perustele olennaiset oletukset, algoritmimuutokset ja testit käyttäjälle ymmärrettävästi.

## Nykyinen rakenne

Projekti toimii suoraan selaimessa ilman rakennusvaihetta tai paketinhallintaa:

- `index.html`: mobiiliystävälliset syötteet, työtoiminnot ja tulosalue.
- `app.js`: käyttöliittymä, optimizerit, pisteytys ja dispositioniin perustuva jälkivarasto, renderöinti, dev-testit ja localStorage-työtila.
- `src/material.js`: profiilimäärittely, materiaalivaraston validointi ja muodostus, variantin lähteet, lähteen kulutus sekä materiaalikulutuksen laskenta.
- `src/cutting-physics.js`: puhdas `cutPiece()`-sahausfysiikka sekä 0,1 mm:n mittamuunnokset ja tarkkuustarkistus.
- `src/production-planning.js`: puhdas kokonaisia tilauksia valitseva batch-selector, kappalekohdistus ja dependency-aware nippusahausscheduler.
- `src/production-integration.js`: tuotantokerroksen lomake-, materiaali-, renderöinti- ja persistenssisovittimet.
- `production-regressions.js`: puhtaat tuotantoregressiot; Node-ajurin eksplisiittinen testiryhmä.
- `run-production-ui-regressions.cjs`: calculate-/restore-/finalize-ohjauksen testikaksoisajo, ei todellinen selaintesti.
- `style.css`: mobiili ensin -asettelu ja tuloskorttien tilat.
- `run-regressions.cjs`: kehityksenaikainen Node-testiajuri; ei ladattaessa selaimessa tarvittava tiedosto.

Selain lataa tavallisina skripteinä `src/cutting-physics.js`, `src/material.js`, `src/production-planning.js`, `src/production-integration.js` ja `app.js` tässä järjestyksessä. Node-ajuri käyttää samoja lähteitä samassa järjestyksessä. Sahausmoduulin suljettu `CUTTING_PHYSICS`-rajapinta ei riipu sovelluksesta, DOM:sta, tallennuksesta tai testidatasta; se on myös suoraan `require()`-ladattava. Materiaalimoduulin suljettu `MATERIAL`-rajapinta riippuu vain sahausmoduulin mitta-apureista ja tukee myös suoraa `require()`-latausta. `PROFILE_TYPES` määritellään materiaalimoduulissa; `app.js`:n alias viittaa samaan jäädytettyyn olioon. Ohuet `var`-aliasnimet säilyttävät siirrettyjen funktioiden konsoli- ja `window`-kutsut ilman toteutuksen kopiointia. Koko sovellusta ei ole muutettu ES-moduuleiksi.

Ensimmäinen materiaaliraja (10.9.2026): `isSupportedProfileType()`, `validateMaterialAvailability()`, `createMaterialInventory()`, `getMaterialSourcesForProfile()`, `consumeMaterialSource()` ja `calculateMaterialUsage()` ovat materiaalimoduulissa. `findMaterialSourceCandidates()` pysyy optimizerin puolella, koska se kutsuu DP-hakua. `calculatePostOrderMaterialInventory()` pysyy `app.js`:ssä, koska se käyttää `evaluateRemnantDisposition()`-arvotusta; pisteytystä ei siirretty coren riippuvuudeksi.

Tallennetun työtilan nykyinen versiointi:

- `WORK_STATE_SCHEMA_VERSION = 6`
- `WORK_STATE_ENGINE_VERSION = "material-v0.3"`

Kun skeema tai moottorin yhteensopivuus muuttuu, arvioi versionnosto ja päivitä dokumentaatio samassa rajatussa työssä.

## Kriittiset tuotanto- ja materiaalisäännöt

Nykyiset kuusi fyysisesti erillistä profiilityyppiä ovat:

- `uProfile` = U-profiili, mittarooli `doorHeight`
- `verticalProfile` = Pystyprofiili, mittarooli `doorHeight`
- `closingProfile` = Vasteprofiili, mittarooli `doorHeight`
- `horizontalProfile` = Vaakaprofiili, mittarooli `doorWidth`
- `topRail` = Yläkisko, mittarooli `openingWidth`
- `bottomRail` = Alakisko, mittarooli `openingWidth`

Eri profiilityypit eivät ole materiaalina vaihtokelpoisia. Materiaalin nykyinen vähimmäisidentiteetti on `profileType + color`; tietomallin pitää sallia myöhemmät lisäattribuutit ilman täydellistä uudelleenkirjoitusta. Väri on materiaalin yhteensopivuudessa kova rajoite, mutta tulevassa sahausjärjestyksessä yleensä pehmeä tuotantopreferenssi.

Uuden tangon pituus tulee `stockLength`-syötteestä. Noin 8 mm ripustusreikää tai huonompaa tangon päätä ei saa kovakoodata nykyiseen hukkaan; tuleva malli voi käyttää esimerkiksi `usableLength`- ja `endAllowance`-kenttiä.

Jäännös kuuluu aina materiaalivarianttiin. Nykyinen ryhmittelyavain on `profileType + color + length`, ja ryhmä sisältää `quantity`-määrän. Pysyviä jäännös-ID:itä ei tarvita, mutta optimointihaku saa luoda anonyymejä väliaikaisia lähdeinstansseja.

Sahausvaran oletus on 3 mm. `cutPiece()` on sahausfysiikan authoritative sääntö. Älä muuta huomaamatta sitä, milloin terän leveys vähennetään, tai täydellisen loppusovituksen semantiikkaa.

Pidä todellinen kerf, kappalekohtainen mittatoleranssi ja lähteen kapasiteettivarat erillisinä. `DOMAIN_NOTES.md`:n noin 3,4 mm:n terähavainto ja ehdotettu 1 mm/kappale eivät ole nykyisiä oletusasetuksia. Turvallisuusvaraa ei saa piilottaa kerfin kasvattamiseen; 0,1 mm:n laskentatarkkuus ei takaa tuotannon mittatarkkuutta.

Pidä materiaalinäkymä ja tuleva tuotantonäkymä erillään:

- materiaali: `bar`/`source` ja varaston tilasiirtymät;
- tuotanto: yksi `cut operation` kuvaa sahausliikkeen ja juuri siinä liikkeessä mukana olevat lähteet.

Tarkemmat tuotantohavainnot ja keskeneräiset talousoletukset ovat `DOMAIN_NOTES.md`:ssä.

## Aktiivinen optimointipolku

Käyttöliittymän aktiivinen polku on inventory-aware:

`calculate()`
→ `getCutsFromForm()` / `getOrdersFromForm()`
→ `getMaterialAvailabilityFromForm()`
→ `createMaterialInventory()`
→ `selectProductionBatch()` / `PRODUCTION_PLANNING.selectBatch()`
→ `optimizeOrderByProfileTypeWithInventory()` (jokaiselle batch-ehdokkaalle)
→ `getMaterialSourcesForProfile()`
→ `optimizeOrderInventoryBeamDP()`
→ `scoreCompleteMaterialTransitionPlan()`
→ `adaptMaterialOptimizationForUi()`
→ `createProductionExecution()` / `attachPieces()` / `schedule()`
→ `renderCuttingPlan()`

`optimizeOrderByProfileTypeWithInventory()` optimoi profiilityypit erikseen ja yhdistää tulokset lopuksi. Se käsittelee valitun batchin yhteisen kysynnän. Batch selectorissa tilaus on jakamaton, mutta materiaalihaku saa yhdistää eri tilausten yksittäisiä kappaleita. Tilauskohdistus muodostetaan ryhmiteltyyn materiaalitulokseen deterministisesti alkuperäisestä kysynnästä.

`optimizeOrderInventoryBeamDP()` kantaa tilassa jäljellä olevat tilauskappaleet ja materiaalilähteet. Tila-avain huomioi äärellisten lähteiden jäljellä olevat määrät. `consumeMaterialSource()` ei saa mutatoida muiden beam-haarojen lähteitä.

`findCandidatePatternsDP()` säilyttää jokaisen saavutetun kapasiteetin määrävektorit `comparePatternQuantities()`-järjestyksessä, distinct-muodossa ja `maxPatterns`-kiintiössä. Chunk-päivitys yhdistää vanhan kapasiteettilistan ja samassa järjestyksessä säilyvän uuden listan vakaalla suoralla mergellä. Täsmällisessä duplikaatissa vanhan listan alkio voittaa. Tätä järjestystä, etusijaa tai kiintiön paikkaa ei saa muuttaa ilman täsmällisiä kuvioregressioita.

Valmiit ratkaisut pisteytetään `scoreCompleteMaterialTransitionPlan()`-funktiolla. Osittaisten beam-tilojen järjestys on edelleen heuristinen eikä käytä täysin samaa materiaalitalousmallia.

Legacy- ja vertailupolkuja ovat muun muassa `optimizeOrderMaterialBeamDP()`, `optimizeOrderBeamDP()`, `optimizeOrderDP()`, `optimizeCuts()` sekä `generateCombinations() → evaluateCombination() → findBestCombination() → optimizeOrder()`. Niitä ei ole kytketty aktiiviseen käyttöliittymään eikä niitä saa ottaa varapoluksi, poistaa tai olettaa oikeiksi ilman erillistä tehtävää ja testejä. Yhdistelmäpolkua ei saa käyttää suurille syötteille ilman suorituskyvyn arviointia.

## Tuotantobatchien ja nippusahauksen säännöt (8.9.2026)

Tarkka toteutus ja testausohjeet: `BATCH_AND_BUNDLE_SAWING_PLANNING.md`. Käyttäjän uusi päätös ohittaa vanhat continuous-/span-/age-planneriluonnokset.

- Batchin min/tavoite/max ovat asetuksia, oletuksena 200/250/300. Tilaus kuuluu kokonaisena yhteen batchiin. Yksittäinen oversized-tilaus sallitaan.
- Kaikki kokorajoihin sopivat tilausyhdistelmät arvioidaan nykyisellä materiaalipisteellä. Jos koko avoimen jonon kappalemäärä jää alle minimin, batchiin valitaan koko jono. Muussa tapauksessa alle minimin jääviä eriä ei valita edes materiaalipuutteen vuoksi. Tavoite-etäisyys ratkaisee vain materiaalipisteen tasatilanteen; työaikapisteitä ei lisätä.
- Nippusahaus on aktiivinen scheduler-ominaisuus. U/Pysty/Vaaka max 4, kiskot max 2; Vaste max 1 on varovainen oletus ennen tuotantovahvistusta. Yhteensopivuus tulee `compatibilityGroup`-datasta; väri ei estä nippua mutta materiaalikohdistuksen väriraja säilyy kovana.
- Scheduler suorittaa batchin yhtenäisinä profiiliblokkeina järjestyksessä Pysty → Vaste → Vaaka → U → kiskot. Ala- ja yläkisko kuuluvat samaan viimeiseen blokkiin, jotta aukkokohtainen 1+1-sekanippu säilyy. Parent-/same-run-remnant-riippuvuus hyväksytään vain saman profiilin sisällä, joten se ei ylitä blokkirajaa.
- Lähteen jatkoleikkaus riippuu edellisestä operaatiosta. Erillinen saman ajon jäännöslähde voi käyttää `parentSourceId`:tä; sykli, kaksoiskäyttö ja väärä materiaalitase hylätään. Ready saman ajon jäännös priorisoidaan ennen riippumatonta uutta lähdettä.
- Mittavasteen siirtoihin lasketaan batchin ensimmäinen sahausmitan asetus ja jokainen seuraava sahausmitan muutos. Saman mitan toistaminen tai pelkkä loppukappaleen poiminta ei lisää siirtoa. Sahausliike tarkoittaa käynnistetyn sahan terän laskemista leikkuuseen.
- Täsmälleen oikean mittainen loppukappale on `release`-poiminta, ei keksitty sahausliike. `cutOperationCount` ja nippumittarit koskevat vain `kind: "cut"` -operaatioita.
- Tuotanto-operaatiot johdetaan validoidusta materiaalista; ne eivät muuta scorea, kerfiä, lähteiden varastokulutusta tai loppujäännösten dispositionia.
- Skeemassa 6 säilyvät skeeman 5 batch- ja tilaustiedot ja lisäksi `executionState = { version, planDigest, events }`. Skeeman 4 työ migroidaan ensin kysynnän säilyttävällä kiskomäärämuunnoksella skeemaan 5 ja sitten skeemaan 6. Vanha batch aloittaa toteuman nollasta. Materiaalimoottori on edelleen `material-v0.3`; operaatiolistaa ei tallenneta rinnakkaiseksi totuudeksi.
- Operaatiot kuitataan schedulerin määräämässä järjestyksessä, ja vain viimeisin kuittaus voidaan perua. Nykyinen tapahtumaversio tallentaa myös `actualSourceIds`-kentän, mutta hyväksyy niihin vain suunnitellut lähteet; suunnitellun ja toteutuneen lähteen poikkeaman käsittely on seuraava erillinen vaihe.
- Batch-historia, työaikakustannukset, anti-starvation ja peruutettava taustalaskenta ovat myöhempää työtä.

## Materiaalivarasto ja pisteytys

Uusi materiaali ja jäännös sisältävät aina värin:

```js
{
    profileType: "verticalProfile",
    color: "black",
    unlimited: false,
    quantity: 4
}
```

```js
{
    profileType: "verticalProfile",
    color: "black",
    length: 2600,
    quantity: 3
}
```

Rajattomalla uudella lähteellä `quantity` on `null`. Äärellisellä lähteellä se on kokonaisluku vähintään 0; nollamääräistä lähdettä ei saa tarjota optimizerille. `createMaterialInventory()` yhdistää jäännökset nykyisin saman `profileType + color + length` -avaimen alle.

Uuden työn raakalistassa on käyttäjän päätöksellä (8.9.2026) jokaiselle kuudelle profiilille rajaton harmaa oletusrivi ja rajaton musta lisärivi. Profiililla säilyy täsmälleen yksi `additional: false` -rivi; musta rivi toimii tavallisena poistettavana lisärivinä. Tallennetun työn palautus ei lisää rivejä eikä muuta saatavuuksia näiden oletusten mukaisiksi.

Tulevat varastohälytykset käyttävät todellista saldoa mutta eivät muuta optimizerin saatavuutta tai pisteytystä. Rajaton lähde ei tarkoita tunnettua fyysistä varastosaldoa. Alustavat hälytysrajat ja vastaanottotarve on kuvattu `DOMAIN_NOTES.md`:ssä; ne eivät vielä ole toteutettuja ominaisuuksia.

`PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings` on kalibroitu checkpoint:

```js
minimumLength: 500
fullValueLength: 4500
curvePower: 2
minimumValueFactor: 0.1
maximumValueFactor: 0.87
scrapValueFactor: 0.1
kerfRecoveryFactor: 0
reusableRemnantHandlingPenalty: 20
newStockRemnantCreationPenalty: 50
freeScrapLength: 200
largeScrapPenaltyFactor: 1.7
```

Arvot eivät ole todistettuja optimeja. Muuta niitä vain regressioiden ja selkeän perustelun kautta.

Jäännöksen arvo on jatkuva pituuden funktio, ei kiinteä 1000 mm:n raja. `reusableRemnantHandlingPenalty` kuvaa säästettävän jäännöksen käsittelyä. `newStockRemnantCreationPenalty` lisätään vain, kun uudesta raakatangosta syntyy uusi säästettävä jäännös; sitä ei lisätä olemassa olevan jäännöksen lyhentämisestä. Älä yhdistä näitä penaltyja ilman nimenomaista syytä ja regressiotestejä.

`scoreCompleteMaterialTransitionPlan()` käyttää uuden tangon lähdearvona täyttä `sourceLength`-arvoa, vanhan jäännöksen lähdearvona sen nykyistä jäännösarvoa ja syntyvästä jäännöksestä dispositionin mukaista krediittiä. Romualumiinin noin 10 %:n jälleenmyyntiarvio ja sen suhde nykyiseen `scrapValueFactor`-asetukseen on kuvattu `DOMAIN_NOTES.md`:ssä; arviota ei saa tulkita automaattiseksi parametrimuutokseksi.

## Optimointiprioriteetit

Noudata tätä järjestystä, ellei käyttäjä muuta sitä:

1. **Oikeellisuus:** kaikki tilatut kappaleet tehdään täsmälleen oikeina määrinä yhteensopivasta materiaalista.
2. **Materiaalitalous:** minimoi todellinen uuden materiaalin kustannus huomioiden jäännökset, hukka ja varaston pirstaloituminen.
3. **Jäännösten järkevä käyttö:** olemassa oleva jäännös ei ole ehdoton greedy-valinta, jos kokonaisratkaisu huononee.
4. **Varaston muoto:** koskematon pitkä tanko on joustavampi kuin sama pituus useana lyhyenä jäännöksenä.
5. **Tuotantotehokkuus:** nippusahaus ja tilausten putkitus on nostettu kehitysjärjestyksessä ylemmäs käyttäjän päätöksellä 2026-09-07. Materiaalikustannus säilyy ensisijaisena. Mittavasteen siirrot huomioidaan myöhemmin eriteltynä työaikakustannuksena; käytä termiä mittavaste aiemman stopparin/stopperin sijaan. Kustannusarviot ja avoimet rajaukset ovat `DOMAIN_NOTES.md`:ssä.
6. **Deterministisyys ja selitettävyys:** sama syöte tuottaa saman tuloksen, ja kustannusvaikutukset voidaan eritellä.

Beam-haun tulosta ei saa väittää globaaliksi optimiksi ilman käsin tehtyä todistusta tai täsmäratkaisijaa. Käytä tarvittaessa ilmaisuja `heuristinen`, `paras tutkituista vaihtoehdoista` tai `optimum todistettu täsmäratkaisijalla`.

## Käyttöliittymän ja persistenssin invariantit

Raakalista, Jäännökset ja Sahattavat pidetään käyttöliittymässä erillisinä. Tankokortissa näkyvät profiilityyppi, materiaalilähde, lähdepituus, sahattavat kappaleet, syntyvä jäännös ja sahahukka. Osittaista ratkaisua ei saa näyttää valmiina sahaussuunnitelmana.

Sahattavat syötetään tilauskortteina: pysyvä sisäinen `id`, käyttäjän vapaamuotoinen `name`, yksi yhteinen väri ja viisi profiiliaccordionia. Mittariveillä on mitta, määrä ja valinnainen aukon tunnus (enintään 80 merkkiä). `getOrdersFromForm() → normalizeOrderCuts()` tuottaa nykyisen `profileType + color + length + quantity` -syötteen sekä `orderId`:n. Tunniste ei riipu muokattavasta nimestä. Se säilyy tilausdatassa, normalisoiduissa syöteriveissä ja tuotanto-operaatioiden yksilöllisissä kappaleissa. Mittarivin valinnainen `openingId` säilyy samoin; puuttuva aukko näkyy tuntemattomana, eikä sitä saa päätellä mitoista. Tämä ei ole vielä operaatiokohtainen valmistumishistoria.

`rails` on vain UI-osion avain: jokainen mittarivi laajenee täsmälleen yhdeksi `topRail`- ja yhdeksi `bottomRail`-riviksi samalla värillä ja mitalla, kummankin määrä on puolet rivin positiivisesta parillisesta yhteismäärästä. Materiaaliprofiilit pysyvät erillisinä. Tyhjä mitta ja tyhjä/oletusmäärä 1 eivät tuota kysyntää; muokattu määrä ilman mittaa hylätään laskennassa. Tilauskortti on avattava/suljettava `details`-elementti, jonka otsikossa näkyvät nimi, väri ja kokonaiskappalemäärä. Otsikon määrä päivittyy mittarivejä muokatessa ja poistettaessa; kiskot lasketaan erillisinä fyysisinä kappaleina. Uudet ja vanhat tilaukset ilman sulkemistilaa avautuvat oletuksena. Valinnainen boolean `collapsed` tallentaa kortin sulkemistilan skeemassa 5 ja säilyy skeemassa 6. Sekä kortin että profiiliaccordionin avaus/sulkeminen tallentuu muuttamatta suunnitelmaa tai valmistumistiloja. Tilausten ja mittarivien muokkaus mitätöi suunnitelman ja toteumalokin; tilauksen poisto vahvistetaan.

**Kiskosyöte ja aukkoparit toteutettu (2026-09-08):** oletus 2 tarkoittaa yhtä ylä- ja yhtä alakiskoa. Täytetty määrä on positiivinen parillinen kokonaisluku. Tyhjä mitta oletuksella 2 tai vanhalla oletuksella 1 ohitetaan. Schedulerin eksplisiittinen `railPairCompatibility` sallii ala+ylä-sekanipun vain, kun saman `orderId + openingId` -aukon koko kiskokysyntä on täsmälleen yksi kumpaakin, mitat ja värit täsmäävät, molemmat lähteet ovat valmiina sahausta varten ja kapasiteetit sallivat parin. Puuttuvaa aukkoa ei arvata. Suuremmat määrät niputetaan profiileittain; saman aukon samanmittaiset valmiit operaatiot priorisoidaan peräkkäin. Materiaalipisteet ja fysiikka eivät muutu.

Skeeman 4 työ muunnetaan palautuksessa skeemaan 5 kaksinkertaistamalla vanhat kiskorivien määrät ja edelleen skeemaan 6 lisäämällä toteumatila. Skeeman 5 batch aloittaa operaatiot nollasta; batchiton työ saa `executionState: null`-arvon. Sen jälkeen suoritetaan tavallinen rakenteellinen ja semanttinen validointi. Kysyntä, materiaaliratkaisu ja salon valmistumistila säilyvät; itse vanhaa oliota ei mutatoida. Moottoriversio pysyy `material-v0.3`:na.

Työntekijälle näytettävä salonumero johdetaan materiaaliplanin vakaasta `bars`-järjestyksestä erikseen jokaiselle profiilityypille: profiilin ensimmäinen fyysinen lähde on 1, seuraava 2 ja niin edelleen. Eri profiileilla saa olla sama worker-numero. Sisäinen `bar.id`/`sourceId` säilyy globaalisti yksilöllisenä ja samana fyysisen salon kaikissa jatkoleikkauksissa, joten myös saman ajon jäännös säilyttää worker-numeronsa. Worker-labelia ei tallenneta uutena identiteettinä.

`SAHAUS TEHTY` kuittaa seuraavan scheduler-operaation toteumalokiin. `SALKO VALMIS` on erillinen palautettava salon UI-tila ja kertoo, että koko fyysisen salon käsittely on valmis. Kumpikaan kuittaus ei yksin muuta materiaalivarastoa. Varasto muuttuu vain työn finalisoinnissa `calculatePostOrderMaterialInventory()`-tuloksen perusteella. Batch-suunnitelman finalisointi poistaa vain batchin tilaukset ja säilyttää muun avoimen jonon samassa persistoi-ensin-transaktiossa.

Finalisointi noudattaa persistoi-ensin/commitoi-sitten-järjestystä: lopullinen snapshot kirjoitetaan onnistuneesti ennen varasto-DOM:n vaihtamista ja suunnitelman tyhjentämistä. Epäonnistunut tallennus ei saa muuttaa live-työtä.

Tallennettu suunnitelma validoidaan rakenteellisesti, semanttisesti ja sahausfysiikan kannalta ennen DOM-palautusta. Persistoiduilla lomakeriveillä on 1000 rivin raja, ja tallennettujen stock-varianttien duplikaatit tarkistetaan UI:n kanonisoidulla värillä. Jokaisella profiiliryhmällä pitää olla täsmälleen yksi oletusrivi. Validointi ja palautus käyttävät samaa legacy-sääntöä: jos `additional` puuttuu, profiilin ensimmäinen rivi on oletusrivi ja myöhemmät lisärivejä.

Tallennettujen raakalista- ja jäännösrivien sekä suunnitelman tankojen profiilinimen pitää olla `PROFILE_TYPES`-olion oma avain. Tilauskorteilla on täsmälleen viisi tunnettua osiota määrätyssä järjestyksessä. Prototyypistä peritty ominaisuus, kuten `constructor` tai `toString`, ei ole kelvollinen profiili tai osio.

Skeema 6 tallentaa `orders`-rakenteen, ei rinnakkaista `inputRows`-kopiota. Tallenteen semanttinen validointi muodostaa kysynnän samalla adapterilla kuin UI. Batchin toteumatila sidotaan suunnitelman ja johdettujen operaatioiden digestiin; tapahtumien pitää muodostaa operaatiolistan järjestyksessä etenevä etuliite. Enintään 100 tilausta, 120 merkkiä nimessä ja yhteensä 1000 laajennettua mittariviä sallitaan; kiskorivi lasketaan kahdeksi myös luonnoksessa. Tunnisteet ovat yksilöllisiä, värit tuettuja tai luonnoksessa tyhjiä, osioiden avausarvot booleaneja ja numeroiden lomakearvot merkkijonoja. Luonnos saa sisältää vielä korjattavia numeroarvoja; laskettu suunnitelma vaatii kelvollisen kysynnän. Käyttäjän luvalla skeeman 3 kuvitteellisia testitöitä ei migroida: vanha tallenne poistuu palautuksessa, työ nollataan ja käyttäjälle näytetään ilmoitus. Moottoriversio säilyy ennallaan.

U-profiilin uusien mittarivien oletusmäärä on 2 (2026-09-07). Tyhjä U-mitta määrällä 2 ohitetaan adapterissa samoin kuin vanha tyhjä oletusrivi määrällä 1. Täytetyn rivin määrää ei muuteta eikä parittomia määriä estetä tässä UI-muutoksessa. Kiskojen oletus on myös 2 yhteiskappaletta; muiden osioiden oletus on 1.

## Testaus

`node run-material-regressions.cjs` tarkistaa materiaalimoduulin suoran CommonJS-latauksen, eristetyn tavallisen selainmoduulin ilman `app.js`:ää, globaalialiaset sekä neljän ennen irrotusta tallennetun fixturen täydet tulokset. Vertailu kattaa varaston, optimoinnin, UI-suunnitelman, piste-erittelyn, materiaalikulutuksen, jälkivaraston, operaatiot ja mahdottoman tapauksen virheilmoituksen. Lähtödigest on commitista `54445d7`; odotusta ei saa päivittää pelkän refaktoroinnin vuoksi.

Projektissa ei vielä ole varsinaista testikehystä. Turvallinen perustestiajo on `runCoreRegressionTests()`: se ajaa A:n, A:n jäännöksillä, D1:n ja profiilieristyksen ilman DOM- tai localStorage-käsittelyä. Se tarkistaa checkpoint-odotukset, riippumattoman tulosvalidoinnin, sahausfysiikan, syötteiden mutatoimattomuuden ja deterministisen toiston. `createDevelopmentTestCases()` tuottaa sekä tämän ajon että selainloaderien tuoreet lähtötiedot.

Kun Node on saatavilla, aja projektikansiossa `node run-regressions.cjs`. Ajuri käyttää vain Noden sisäänrakennettuja moduuleja ja ajaa perustestit sekä erikseen listatut puhtaat regressiot. Jokainen testiryhmä saa tuoreen ympäristön ilman DOM:ia tai localStoragea. Onnistuminen palauttaa paluukoodin 0; epäonnistunut tulos, poikkeus, aikakatkaisu tai lähdetiedoston latausvirhe palauttaa 1. Ajuri jatkaa muihin ryhmiin yksittäisen ryhmän epäonnistuessa ja tulostaa virheen erittelyn. Ryhmäkohtainen aikaraja on 60 sekuntia.

Pidä ajurin testilista eksplisiittisenä: lisää sinne vain ilman selainta toimivia testejä, joiden paluuarvo on `true` tai tunnetun mittainen PASS/FAIL-taulukko. Päivitä `expectedRows`, jos taulukkomuotoisen testiryhmän tapausmäärä muuttuu. Pelkkä truthy-paluuarvo tai konsoliin tulostettu PASS ei riitä onnistumiseksi. Node-ajo ei korvaa tehtävän vaatimia DOM-, palautus- tai käyttäjän selaintestejä.

`runCuttingPhysicsRegressionTests()` lukitsee 23 mittamuunnos-, desimaaliraja-, nollakerf- ja virheellisen tarkkuuden tapausta muuttamatta avointa työtä. Se täydentää aiempia `runCutPieceBoundaryTests()`- ja `runDecimalExactFitRegressionTest()`-testejä. Pidä dev-testit sahausmoduulin ulkopuolella.

`runOrderInputRegressionTests()` tarkistaa tilausadapterin, kiskoparit, tunnisteet ja neljän perustapauksen täsmälleen samat optimointitulokset. `runCandidatePatternMergeRegressionTests()` vertaa suoraa pattern-mergeä aiempaan Map/dedup/sort-semanttiikkaan ja lukitsee duplikaatit, tasatilanteet, kiintiön sekä kerf-täsmäsovitukset. `runStoredOrderValidationRegressionTests()` tarkistaa skeeman 6 rakenteen ja kysynnän sekä skeeman 3 hylkäyksen. Nämä ja `runProductionRegressionTests()` kuuluvat Node-ajurin 36 ryhmään. Tuotantoregressiot kattavat profiilityyppikohtaiset worker-numerot, profiiliblokkien järjestyksen, kiskoblokin, saman salon jatkoleikkauksen, toteumalokin järjestyksen, perumisen, plan-digestin ja skeeman 5 migraation. Pysyvä pattern-regressio vertaa edelleen 1 354 kuviota ja tallennettujen tapausten scoret sekä materiaaliplanit; scheduler-tulokset lukitaan profiiliblokkiversion omalla digestillä. `runCoreProfileTypeValidationRegressionTests()` on eksplisiittisesti kahdeksan rivin taulukko (B-005 korjattu). Selaimen `runOrderInputUiRegressionTests()` testaa irrotetun tilauskortin turvallisen DOM-roundtripin muuttamatta avointa työtä. Fixture-loaderit käyttävät `createDevelopmentOrdersFromCuts()`-adapteria; eriävät ylä-/alakiskolistat hylätään ennen lomakkeen muuttamista. Tämä ei rajoita suoria core-testejä eikä ole tallennemigraatio.

Aja tuotantoputken ohjaus- ja persistenssimuutoksissa myös `node run-production-ui-regressions.cjs`. Sen 32 tarkistusta käyttävät testikaksoisia; ne eivät korvaa todellista selaimen DOM-, palautus- tai asettelutestiä.

Käytä lisäksi tehtävään sopivia nimettyjä `run...RegressionTest(s)()`-funktioita. Selaimen `loadTestA()`, `loadTestAWithRemnants()`, `loadTestD1()` ja `loadTestProfileIsolation()` vaihtavat avoimen työn syötteet ja tallentavat ne; niiden palauttama `undefined` on normaali. Myös vanha `runAllRegressionTests()` käyttää näitä lomakelatauksia ja muuttaa avointa työtä. `runCurrentOrderSummaryTest()` laskee yhteenvedon nykyisestä lomakkeesta.

Kun korjaat virheen, tee ensin tapaus, joka osoittaa sen. Tarkista muutoksen jälkeen vähintään:

- kaikki pyydetyt kappaleet ja määrät;
- koko materiaalivariantin yhteensopivuus;
- äärellisten lähteiden määrärajojen pitävyys;
- lähdepituuden, sahaushukan ja jäännöksen materiaalitase;
- mahdottoman syötteen ja osittaisen ratkaisun oikea raportointi;
- syötteiden ja rinnakkaisten hakutilojen mutatoimattomuus;
- deterministinen toisto;
- aiemmat relevantit regressiot.

Perustestit:

- **Testi A ilman jäännöksiä:** 17 uutta tankoa (U 4, Pysty 7, Vaaka 2, Yläkisko 2, Alakisko 2). Tämä on käsin perusteltu profiilikohtainen tankomääräminimi.
- **Testi A jäännöksillä:** `totalBars = 22`, `newBars = 10`, `remnantBars = 12`, kaikki 12 annettua jäännöstä käytetään ja uusista tangoista syntyy nykyisin 9 säästettävää jäännöstä.
- **Testi D1:** Pysty 2200 mm × 2, vanha Pysty-jäännös 3900 mm × 1 ja rajaton uusi materiaali. Odotettu tulos on yksi uusi tanko, 2200 mm × 2, noin 1594 mm jäännös ja vanha 3900 mm jäännös käyttämättä.

Aja tehtävän laajuuteen nähden soveltuvat tarkistukset. Käytä `node --check`-syntaksitarkistusta muuttuneille JavaScript-tiedostoille (nyt `app.js`, `src/cutting-physics.js` ja `run-regressions.cjs`), jos Node on saatavilla, ja `git diff --check`-tarkistusta. Optimointia, persistenssiä tai selainlatausta muuttava työ vaatii lisäksi relevantit regressiot ja mahdollisuuksien mukaan selaintestin. Älä väitä selaintestiä tehdyksi, jos sitä ei voitu ajaa.

## Toimintavaltuudet ja yhteistyötapa

Toimi opettavana ohjelmointiparina.

- Kun käyttäjä pyytää analyysiä, katselmusta, diagnoosia tai suunnitelmaa, tutki relevantit tiedostot ja raportoi muuttamatta niitä.
- Kun käyttäjä pyytää toteuttamaan, jatkamaan tai korjaamaan, tee pyynnön rajaiset paikalliset muutokset ja aja relevantit ei-tuhoavat tarkistukset. Älä anna pelkkiä kopioitavia koodiohjeita, ellei käyttäjä pyydä niitä.
- Kun käyttäjä pyytää ohjeistamaan muutoksen tekemistä itse, älä muokkaa tiedostoja. Näytä todelliset ympäröivät koodirivit ja tarkka lisäys- tai korvauskohta.
- Tee yksi looginen ja testattava vaihe kerrallaan. Jos seuraava käyttäytymismuutos riippuu käyttäjän selaintestistä, anna täsmälliset testivaiheet ja odota havainto ennen seuraavaa vaihetta.
- Tutki aina nykyinen repo ja Git-tila ennen täsmällisiä muutosohjeita tai toteutusta. Säilytä käyttäjän keskeneräiset ja tehtävään liittymättömät muutokset.
- Jos käyttäjä vastaa pitkän ohjeen aikaisempaan kohtaan, älä oleta myöhempien kohtien toteutuneen.
- Selitä olennainen algoritmi ja vaikeat ehdot selkeällä suomella. Perussyntaksia ei tarvitse opettaa ilman tarvetta.
- Käytä sanaa **korvaa** vain, kun vanha koodi todella poistetaan. Muuten sano **lisää** ja nimeä tarkka kohta.
- Säilytä projektin nimeämistapa ja UTF-8. Kommentoi syytä tai vaikeaa sääntöä, älä itsestään selvää syntaksia.
- Raportoi tehtävän ulkopuolinen todellinen ongelma erikseen. Kirjaa se `BACKLOG.md`:hen konkreettisena havaintona, mutta älä korjaa sitä samalla ilman lupaa.
- Kirjaa uusi tuotanto- tai liiketoimintafakta `DOMAIN_NOTES.md`:hen niin, että lähde, varmuustaso ja avoin vaikutus koodiin erotetaan toisistaan.

Älä tee suurta ominaisuutta, laajaa refaktorointia tai arkkitehtuurin vaihtoa omin päin. Esitä ensin lyhyt suunnitelma, vaikutus nykyiseen toimintaan ja pienin järkevä ensimmäinen vaihe, ja odota käyttäjän hyväksyntä.

## Turvalliset muutosrajat

Ilman käyttäjän erillistä pyyntöä älä:

- vaihda ohjelmointikieltä, käyttöliittymäkehystä tai projektirakennetta;
- lisää riippuvuuksia, paketinhallintaa, palvelinta, tietokantaa tai pilvipalvelua;
- korvaa koko algoritmia tai poista legacy-polkuja;
- muuta käyttöliittymän toimintaa, termejä tai ulkoasua;
- muuta sahausvaran, jäännöksen tai optimointiprioriteettien merkitystä;
- muuta score-parametreja ilman regressiotestejä;
- tee tehtävään liittymätöntä siivousta tai muotoilua;
- tee commitia, pushia, julkaisua tai muuta ulkoista kirjoitusta.

Refaktoroinnin pitää ensisijaisesti parantaa luettavuutta tai testattavuutta muuttamatta käyttäytymistä. Ota regressiot talteen ennen refaktorointia, erota käyttäytymisen muutos rakenteen muutoksesta, vältä abstraktioita ennen kahta todellista käyttötapaa ja poista vanhaa vasta korvaavan polun käytön, testauksen ja käyttäjän hyväksynnän jälkeen.

## Git ja valmisraportointi

Tee yksi ymmärrettävä ja testattu idea per commit. Commit-viesti on englanniksi, alkaa isolla imperatiiviverbillä, ei käytä `feat:`-tyyppistä etuliitettä eikä pääty pisteeseen.

Commitoi tai pushaa vain, kun käyttäjä pyytää nimenomaisesti commitia tai pushia. Pelkkä tiedoston tai repon sisällön muokkauspyyntö ei anna commit-lupaa.

Kerro valmiin muutoksen yhteydessä:

1. mitä muuttui;
2. miksi;
3. miten ja millä syötteillä se testattiin;
4. mitä jätettiin tarkoituksella tekemättä;
5. pienin luonteva seuraava askel.

Mainitse suoraan tarkistukset, joita ei voitu tehdä.
