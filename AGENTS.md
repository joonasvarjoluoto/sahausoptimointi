# AGENTS.md

## Projektin tarkoitus

Tämä on oppimisprojekti, jossa rakennetaan selaimessa toimivaa sahausoptimointia 6000 mm:n alumiiniprofiileille. Tavoite ei ole vain minimoida sahahukkaa, vaan muodostaa tuotannon kannalta järkevä kokonaisratkaisu, joka huomioi uuden materiaalin käytön, olemassa olevat jäännökset, syntyvien jäännösten arvon, materiaalivaraston pirstaloitumisen ja myöhemmin myös työajan sekä sahausjärjestyksen.

6000 mm on projektin tavallinen ja käyttöliittymän oletusarvoinen uuden raakatangon pituus. Pidä laskenta silti nykyisen `stockLength`-syötteen mukaisesti yleiskäyttöisenä, ellei tehtävässä erikseen päätetä lukita pituutta.

Projektissa oppiminen on yhtä tärkeä tavoite kuin toimiva lopputulos. Ratkaisujen, oletusten ja algoritmimuutosten pitää olla käyttäjän ymmärrettävissä ja perusteltavissa vaihe vaiheelta.

## Fyysinen tuotantomalli

Projektissa on tällä hetkellä viisi fyysisesti erillistä profiilityyppiä:

- `uProfile` = U-profiili, mittarooli `doorHeight`
- `verticalProfile` = Pystyprofiili, mittarooli `doorHeight`
- `horizontalProfile` = Vaakaprofiili, mittarooli `doorWidth`
- `topRail` = Yläkisko, mittarooli `openingWidth`
- `bottomRail` = Alakisko, mittarooli `openingWidth`

Eri profiilityypit eivät ole keskenään vaihtokelpoisia. Optimizeri ei saa koskaan käyttää esimerkiksi Vaakaprofiilin uutta tankoa tai jäännöstä Pystyprofiilin kappaleeseen.

Uudet tangot ovat tällä hetkellä kaikissa profiilityypeissä saman `stockLength`-pituuden mukaisia, käytännössä yleensä 6000 mm. Uuden materiaalin saatavuus annetaan profiilityypeittäin joko rajattomana tai äärellisenä kappalemääränä.

Jäännös kuuluu aina tietylle profiilityypille. Jäännökset ryhmitellään käytännössä avaimella `(profileType, length)`.

Sahausvaran oletusarvo on 3 mm. `cutPiece()` on sahausvaran nykyinen keskitetty sääntö. Älä muuta huomaamatta sitä, milloin terän leveys vähennetään. Nykyisessä mallissa terän leveys syntyy vain, kun sahaus oikeasti vaatii terän leveyden verran materiaalia; täydelliseen loppusovitukseen liittyvä semantiikka on toteutettu `cutPiece()`-funktion kautta ja sitä pitää käsitellä yhtenä projektin ydinsääntönä.

## Nykyinen rakenne

Projekti on pieni, ilman rakennustyökaluja suoraan selaimessa toimiva prototyyppi:

- `index.html` sisältää mobiiliystävälliset syötteet, työpainikkeet ja tulosalueen. Se lataa `style.css`:n ja `app.js`:n suoraan ilman rakennusvaihetta.
- `app.js` sisältää käyttöliittymän käsittelyn, materiaalivaraston muodostamisen, sahauslaskennan, DP- ja beam-hakufunktiot, pisteytyksen, tulosten muodostamisen, dev-testit sekä versioidun localStorage-työtilan.
- `style.css` sisältää mobiili ensin -asettelun, tankokortit, materiaaliosioiden visuaaliset erot, valmistumistilat ja työpöydän leveämmän asettelun.
- Projektissa ei toistaiseksi ole paketinhallintaa, rakennusvaihetta tai varsinaista automaattista testikehystä.

Nykyinen tallennetun työtilan versiointi:

- `WORK_STATE_SCHEMA_VERSION = 3`
- `WORK_STATE_ENGINE_VERSION = "material-v0.3"`

Moottoriversiota käytetään estämään vanhalla materiaalimallilla muodostettujen suunnitelmien palautuminen uuden mallin alle.

## Aktiivinen optimointipolku

Käyttöliittymän aktiivinen polku on inventory-aware. Älä oleta vanhoja beam- tai greedy-funktioita aktiivisiksi vain siksi, että ne ovat edelleen tiedostossa.

Nykyinen korkean tason polku on:

`calculate()`
-> `getCutsFromForm()`
-> `getMaterialAvailabilityFromForm()`
-> `createMaterialInventory()`
-> `optimizeOrderByProfileTypeWithInventory()`
-> profiilikohtainen `getMaterialSourcesForProfile()`
-> `optimizeOrderInventoryBeamDP()`
-> valmiiden ratkaisujen `scoreCompleteMaterialTransitionPlan()`
-> `adaptMaterialOptimizationForUi()`
-> `renderCuttingPlan()`

`optimizeOrderByProfileTypeWithInventory()` käsittelee jokaisen profiilityypin erillään ja yhdistää tulokset vasta lopuksi. Tämä on tarkoituksellista, koska profiilityypit ovat fyysisesti eri materiaalia.

`optimizeOrderInventoryBeamDP()` kantaa tilassa sekä jäljellä olevia tilauskappaleita että jäljellä olevia materiaalilähteitä. Tilan avain huomioi myös äärellisten lähteiden jäljellä olevat määrät, jotta kaksi samaa leikkaustilannetta mutta eri varastotilannetta eivät yhdisty virheellisesti.

Valmiit ratkaisut pisteytetään `scoreCompleteMaterialTransitionPlan()`-funktiolla. Osittaisia beam-tiloja ei vielä pisteytetä samalla täydellisellä materiaalitalousmallilla, vaan niiden ranking on edelleen heuristinen. Tämä on tiedossa oleva jatkokehityskohde.

Tiedostossa säilytetään vertailua varten myös vanhempia polkuja, kuten `optimizeOrderMaterialBeamDP()`, `optimizeOrderBeamDP()`, `optimizeOrderDP()`, `optimizeCuts()` sekä yhdistelmäpohjainen polku:

`generateCombinations()` -> `evaluateCombination()` -> `findBestCombination()` -> `optimizeOrder()`

Näitä legacy-polkuja ei ole kytketty aktiiviseen käyttöliittymään eikä niitä käytetä virhetilanteen varapolkuna. Älä oleta niitä valmiiksi tai oikeiksi vain siksi, että funktiot ovat olemassa. Kaikkien yhdistelmien muodostaminen kasvaa eksponentiaalisesti, joten sitä ei saa ottaa käyttöön suurille syötteille ilman suorituskyvyn arviointia.

## Materiaalivarasto

Käyttöliittymässä uusi materiaali annetaan profiilityypeittäin muodossa, joka vastaa tätä rakennetta:

```js
{
    profileType: "verticalProfile",
    unlimited: false,
    quantity: 4
}
```

Rajattomalla lähteellä `quantity` on `null`. Äärellisellä lähteellä `quantity` on kokonaisluku vähintään 0. Arvo 0 tarkoittaa, että kyseistä uutta materiaalia ei ole saatavilla.

Jäännös on esimerkiksi:

```js
{
    profileType: "verticalProfile",
    length: 2600,
    quantity: 3
}
```

`createMaterialInventory()` yhdistää saman profiilityypin ja saman pituuden jäännökset yhdeksi ryhmäksi.

`getMaterialSourcesForProfile()` palauttaa vain valitun profiilityypin yhteensopivat jäännökset ja mahdollisen uuden materiaalin. Nollamääräistä äärellistä uutta materiaalia ei saa lisätä lähteeksi.

`consumeMaterialSource()` ei saa mutatoida muiden beam-haarojen materiaalilähteitä.

## Optimointiperiaatteet

Noudata seuraavaa tärkeysjärjestystä, ellei käyttäjä muuta sitä tehtävässä:

1. **Oikeellisuus:** jokainen tilattu kappale sahataan täsmälleen pyydetty määrä, oikeasta profiilityypistä ja lähteestä, johon se mahtuu.
2. **Materiaalitalous:** minimoi uuden materiaalin todellinen kustannus huomioiden olemassa olevien jäännösten käyttö, syntyvien jäännösten arvo, sahahukka ja jäännösvaraston pirstaloituminen. Älä minimoi pelkkää käsiteltyjen materiaalikappaleiden määrää materiaalikustannuksen kustannuksella.
3. **Olemassa olevien jäännösten järkevä käyttö:** käytä olemassa olevia jäännöksiä ennen uuden tangon avaamista, kun niiden käyttö on kokonaisuuden kannalta järkevää. Tämä ei ole absoluuttinen greedy-sääntö; huono jäännös voidaan jättää käyttämättä, jos sen käyttäminen johtaisi huonompaan kokonaisratkaisuun.
4. **Varaston muoto:** yksi koskematon 6000 mm tanko ei ole samanarvoinen kuin useampi lyhyempi jäännös, vaikka materiaalipituuksien summa olisi lähes sama. Jäännösten lukumäärällä, pituusjakaumalla ja myöhemmin profiilityypillä, iällä sekä varastomäärällä on merkitystä.
5. **Työaika ja käsittely:** stopparin siirrot, batch-sahaus, käsiteltävien tankojen määrä ja tuotantojärjestys ovat tärkeitä, mutta materiaalikustannus on tällä hetkellä ensisijainen optimointikriteeri.
6. **Deterministisyys ja selitettävyys:** sama syöte ja samat asetukset tuottavat saman tuloksen. Tasatilanteissa suosi vakaata ja helposti perusteltavaa valintaa.

Käyttäjän tuotannon karkea kustannusvertailu on, että noin 1 metri hukkaprofiilia vastaa suuruusluokaltaan noin puolen tunnin palkkaa. Käytä tätä vain suuntaa-antavana kalibrointiperiaatteena, älä kovakoodattuna talouslakina ilman erillistä päätöstä.

## Nykyinen pisteytyscheckpoint

`PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings` sisältää tällä hetkellä olennaisesti seuraavat arvot:

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

Jäännöksen arvo on jatkuva pituuden funktio, ei kiinteä 1000 mm raja. Älä palauta vanhaa ajatusta, jossa kaikki alle 1000 mm automaattisesti heitetään pois.

`reusableRemnantHandlingPenalty` liittyy säästettävän jäännöksen käsittelyyn ja vaikuttaa myös siihen, kumpi disposition on taloudellisesti järkevä.

`newStockRemnantCreationPenalty` on eri käsite: nykyinen arvo 50 lisätään vain silloin, kun **uudesta raakatangosta** syntyy uusi **säästettävä** jäännös. Tarkoitus on mallintaa jäännösvaraston pirstaloitumista. Kun olemassa olevaa jäännöstä sahataan ja siitä jää edelleen yksi jäännös, tätä uutta 50 pisteen syntymisrangaistusta ei lisätä.

Älä yhdistä näitä kahta penaltya yhdeksi asetukseksi ilman nimenomaista syytä ja regressiotestejä.

`scoreCompleteMaterialTransitionPlan()` käyttää uuden tangon lähdearvona täyttä `sourceLength`-arvoa. Olemassa olevan jäännöksen lähdearvo perustuu sen nykyiseen jäännösarvoon. Syntyvä säästettävä jäännös antaa arvokrediitin, romu saa `scrapValueFactor`-krediitin, ja lisäksi huomioidaan käsittely- sekä romurangaistukset.

Nykyiset score-parametrit ovat **kalibroitu checkpoint**, eivät lopullisesti todistetut optimiarvot. Muuta niitä vain testien kautta.

## Tuotannon käytännön säännöt myöhempää optimointia varten

Seuraavat säännöt ovat tiedossa, mutta kaikki eivät vielä vaikuta aktiiviseen scoreen tai sahausjärjestykseen:

- Pysty- ja Vaakaprofiilit kannattaa sahata peräkkäin ja mieluiten aikaisin, jotta kokoonpano voi alkaa.
- U-listat tarvitaan vasta asennuksessa, joten ne voidaan sahata myöhemmin ja varastoida erikseen.
- Ala- ja Yläkisko ovat saman aukon mittaisia ja ne pakataan yhteen aukon mukaan.
- Yksi tilaus voi sisältää useita aukkoja. Älä hardkoodaa oletusta neljästä ovesta per aukko.
- Materiaalikustannus on yleensä tärkeämpi kuin työajan säästö.
- Käytännössä halutaan käyttää avatut 6000 mm tangot tehokkaasti eikä kasvattaa jäännösvarastoa tarpeettomasti.
- Pitkä käyttökelpoinen jäännös voi olla arvokkaampi kuin useampi lyhyt jäännös, mutta koskematon 6000 mm tanko on joustavampi kuin saman materiaalimäärän pirstoutuminen useaksi jäännökseksi.

Myöhempää jäännösmallia varten on tarkoitus huomioida profiilityyppikohtainen käyttökelpoisuus, jäännöksen pituus, varastossa oleva määrä ja ikä, esimerkiksi `ordersSinceUse`.

## Käyttöliittymän nykyinen tila

UI:ssa Raakalista, Jäännökset ja Sahattavat on erotettu visuaalisesti toisistaan. Älä poista tätä eroa huomaamatta.

Sahaussuunnitelman tankokortissa näkyy nykyisin:

- profiilityyppi
- materiaalilähde: `Jäännös` tai `Uusi tanko`
- lähdepituus
- sahattavat kappaleet
- syntyvä jäännös
- sahahukka

Jos optimointia ei voida suorittaa loppuun, käyttöliittymä näyttää käsittelemättä jääneiden kappaleiden yhteydessä myös profiilityypin, esimerkiksi `Pystyprofiili · 2700 mm × 1`.

Osittaista ratkaisua ei saa esittää valmiina sahaussuunnitelmana.

## Kehityssuunta

Kehitä nykyistä prototyyppiä pienissä, erikseen testattavissa vaiheissa. Lähimmät tärkeät suunnat ovat:

1. Jatka inventory-aware optimizerin ja pisteytyksen kalibrointia realistisilla sekä tarkoituksella hankalilla regressioilla.
2. Paranna testattavuutta niin, että samoja tilauksia ei tarvitse syöttää käsin uudelleen.
3. Lisää myöhemmin käyttöliittymään useiden nimettyjen töiden/testitilausten tallennus ja lataus. Nykyinen `currentWork`-localStorage tukee vain yhtä aktiivista työtilaa.
4. Rakenna myöhemmin systemaattinen testipankki ja automaattinen laatumittaus.
5. Lisää vasta tämän jälkeen uusia tuotantojärjestyksen, stopparin siirtojen tai monen tilauksen yhteisoptimoinnin sääntöjä.
6. Kuvasta luettava sahauslista on realistinen myöhempi välivaihe ennen suoraa integraatiota yrityksen järjestelmään. Se ei ole nykyinen prioriteetti; optimizerin pitää ensin olla luotettava.
7. Lopullinen tavoite voi olla tilaustietojen hakeminen suoraan yrityksen järjestelmästä ilman paperin tai kuvan välivaihetta, jos integraatiomahdollisuus myöhemmin saadaan.

Pidä käyttöliittymä ja optimointilogiikka mahdollisuuksien mukaan erillään. Laskentafunktioiden tulisi ottaa arvot parametreina ja palauttaa dataa; DOM:n lukeminen ja HTML-tuloksen muodostaminen kuuluvat käyttöliittymäkerrokseen. Tee tätä erottelua vain tehtävän kannalta tarpeellisina, pieninä refaktorointeina.

## Nykyiset dev-testit

`app.js`:n lopussa on tällä hetkellä tarkoituksellisia väliaikaisia kehitysapureita:

- `loadDevelopmentTestCase()`
- `loadTestA()`
- `loadTestAWithRemnants()`
- `loadTestD1()`
- `runCurrentOrderSummaryTest()`

Näitä saa käyttää konsolista regressioiden nopeaan lataamiseen. Konsolin `undefined` on normaali tulos funktiolle, joka muuttaa DOM:ia mutta ei palauta arvoa.

Dev-testit ovat väliaikainen ratkaisu siihen asti, että nimetyt työt/testit voidaan tallentaa sovellukseen. Niitä ei tarvitse poistaa pelkästään siksi, että varsinainen tallennusominaisuus myöhemmin lisätään; ne voivat muodostaa pysyvän regressiotestipankin alun. Myöhemmin ne voidaan siirtää esimerkiksi `dev-tests.js`:ään, jos se parantaa rakennetta.

### Nykyiset tärkeät regressiot

**Testi A ilman jäännöksiä**

Nykyisillä score-asetuksilla tavoite ja havaittu tulos ovat:

- U-profiili: 4 uutta tankoa
- Pystyprofiili: 7 uutta tankoa
- Vaakaprofiili: 2 uutta tankoa
- Yläkisko: 2 uutta tankoa
- Alakisko: 2 uutta tankoa
- yhteensä 17 uutta tankoa

Tässä 17 on käsin perusteltu teoreettinen minimimäärä kyseiselle testille profiilikohtaisesti.

**Testi A jäännöksillä**

Nykyisillä score-asetuksilla havaittu regressiotulos:

- `totalBars = 22`
- `newBars = 10`
- `remnantBars = 12`
- kaikki annetut 12 olemassa olevaa jäännöstä käytetään
- uusista tangoista syntyy tällä hetkellä 9 käyttökelpoiseksi luokiteltua jäännöstä

Pelkkä `totalBars` ei ole tämän testin ensisijainen tavoite; olennaista on uuden materiaalin käyttö ja jäännösten järkevä hyödyntäminen.

**Testi D1**

Syöte:

- Pystyprofiili 2200 mm × 2
- olemassa oleva Pystyprofiilin jäännös 3900 mm × 1
- uusi Pystyprofiili rajaton

Nykyisillä score-arvoilla oikea ja testattu ratkaisu on:

- yksi uusi 6000 mm tanko
- siitä 2200 mm × 2
- syntyvä jäännös noin 1594 mm
- vanha 3900 mm jäännös jätetään käyttämättä

Tämä regressio suojaa erityisesti siltä virheeltä, jossa optimizeri avaa kaksi uutta tankoa vain saadakseen kaksi pitkää jäännöstä.

## Testausohjeet

Testaa laskentalogiikkaa pienillä käsin tarkistettavilla tapauksilla sekä realistisilla moniprofiilitöillä. Tarkista jokaisesta tuloksesta vähintään:

- kaikki pyydetyt kappaleet esiintyvät täsmälleen oikean määrän;
- kappaleen `profileType` vastaa käytetyn lähteen profiilityyppiä;
- uusia tankoja tai jäännöksiä ei käytetä enempää kuin varastossa on;
- yhden lähdekappaleen kappaleet, sahahukka ja jäännös eivät ylitä lähdepituutta;
- mahdoton kappale ei päädy kelvolliseen valmiiseen sahaussuunnitelmaan;
- osittainen tulos raportoidaan osittaisena eikä valmiina;
- lähdetaulukoita tai käyttäjän antamia olioita ei mutatoida odottamatta;
- sama syöte tuottaa saman tuloksen joka ajolla;
- score-muutos ei korjaa yhtä regressiota rikkomalla aiempia regressioita.

Kun korjaat virheen, tee ensin tapaus, joka osoittaa virheen, ja varmista muutoksen jälkeen, että tapaus toimii ja aiemmat perustapaukset säilyvät.

Älä väitä beam-heuristiikan löytämää ratkaisua globaalisti optimaaliseksi vain siksi, että se näyttää hyvältä. Jos optimum voidaan todistaa käsin tai täsmäratkaisijalla, kerro perustelu erikseen.

## Tuleva systemaattinen optimizerin laadun arviointi

Pelkkä itse keksittyjen rajatapauksien kokoelma ei riitä lopulliseksi laadunvarmistukseksi. Tavoittele myöhemmin yhdistelmää seuraavista menetelmistä:

1. **Kiinteät regressiot:** käsin valitut tunnetut tapaukset kuten Testi A ja D1.
2. **Seedattu RNG / fuzz testing:** generoi suuri määrä satunnaisia tilauksia, varastoja, profiilityyppejä ja jäännöksiä. Käytä toistettavaa seed-arvoa, jotta löytynyt ongelmatapaus voidaan generoida uudelleen.
3. **Kohdistetut vaikeat generaattorit:** painota mittoja lähelle kapasiteetti- ja kerf-rajoja, lähes sopivia jäännöksiä, niukkaa varastoa ja useita lähes samanarvoisia ratkaisuja. Pelkkä tasainen satunnaisjakauma tuottaa liikaa helppoja tapauksia.
4. **Property-testit:** varmista yleiset invariantit riippumatta siitä, mikä optimum on. Esimerkiksi profiilityyppi ei saa vaihtua, materiaalimäärää ei saa ylittää, rivijärjestyksen muuttamisen ei pitäisi huonontaa ratkaisun laatua perusteettomasti ja lisämateriaalin lisääminen ei saa tehdä aiemmin mahdollisesta tilauksesta mahdotonta.
5. **Täsmäratkaisija / oracle pienille tapauksille:** rakenna myöhemmin hidas mutta varma vertailuratkaisija esimerkiksi exhaustive searchilla, MILP:llä tai CP-SAT:lla. Käytä sitä tuhansien pienten satunnaistapausten optimumin todentamiseen.
6. **Laatumittarit:** raportoi esimerkiksi kuinka usein heuristiikka löytää täsmälleen optimumin, keskimääräinen poikkeama optimumista, 95./99. prosenttipiste ja pahin havaittu tapaus.
7. **Oikeat tuotantotilaukset:** vertaa myöhemmin historiallisia töitä optimizerin tuloksiin ja, kun mahdollista, täsmäratkaisun alarajaan tai todistettuun optimumiin.

Tavoite on lopulta pystyä sanomaan optimizerin laadusta mitattavasti, ei vain että se "näyttää hyvältä".

## Parametrien automaattinen viritys ja koneoppiminen

Projektissa voidaan myöhemmin hyödyntää automaattista parametrien viritystä. Ensimmäinen järkevä käyttökohde ei ole neuroverkon käyttäminen cutting-stock-ratkaisijan korvaajana, vaan score- ja hakuparametrien optimointi testipankkia vasten.

Mahdollisia menetelmiä ovat esimerkiksi grid/random search, Bayesian optimization ja evoluutioalgoritmit. Parametreja ei saa kuitenkaan virittää vain yhteen tai muutamaan käsin valittuun tapaukseen; tarvitsemme laajan testijoukon ja selkeän tavoitefunktion.

Jos myöhemmin kertyy oikeaa tuotantohistoriaa, koneoppimista voidaan käyttää esimerkiksi arvioimaan todennäköisyyttä, että tietyn profiilityypin ja pituisen jäännöksen voi oikeasti käyttää tulevissa tilauksissa. Tällainen malli voisi myöhemmin täydentää käsin määriteltyä jäännösarvokäyrää.

## Kuvasta luettava sahauslista ja myöhempi integraatio

Kuvasta luettava sahauslista on mahdollinen myöhempi ominaisuus. Käyttöpolku voisi olla:

1. käyttäjä ottaa puhelimella kuvan puhtaasta sahauslistasta;
2. vision-malli lukee vain tarvittavat painetut sahausrivit;
3. backend palauttaa rakenteisen JSON-tuloksen;
4. sovellus näyttää tunnistetut tiedot käyttäjälle tarkistettavaksi;
5. vasta käyttäjän hyväksynnän jälkeen tiedot lisätään optimizerille.

Älä lähetä API-avainta selaimen `app.js`:ssä. Jos ulkoista vision-API:a joskus käytetään, salainen avain kuuluu backendille. GitHub Pages ei itsessään aja tällaista backend-koodia.

Kuvantulkinta on tällä hetkellä roadmap-ominaisuus, ei nykyisen optimizerikehityksen prioriteetti. Lopullisesti tilausdata olisi parempi hakea suoraan yrityksen järjestelmästä, jos rajapinta tai muu integraatiotapa saadaan myöhemmin käyttöön.

## Codexin ja ChatGPT:n työskentelytapa

Toimi opettavana ohjelmointiparina, älä projektin itsenäisenä uudelleenkirjoittajana.

- Tutki aina nykyinen repo ennen täsmällisiä koodimuutosohjeita. GitHubista ei näe käyttäjän commitoimattomia paikallisia muutoksia; erottele tämä selvästi.
- Tee yksi rajattu, ymmärrettävä ja testattava muutos kerrallaan.
- Kun käyttäjä tekee muutokset itse VS Codessa, näytä aina todelliset ympäröivät koodirivit ja tarkka lisäyskohta.
- Käytä sanaa **"korvaa"** vain silloin, kun vanha koodi todella poistetaan ja uusi koodi tulee sen tilalle. Jos koodia lisätään, sano esimerkiksi **"lisää tämä tämän rivin jälkeen"** tai **"lisää tähän kohtaan"**.
- Jos HTML-rakenne on olennainen, näytä mieluummin valmis ympäröivä lohko kuin epämääräinen ohje kuten "lisää ennen Jäännös-kohtaa".
- Jos käyttäjä vastaa pitkän ohjeen aikaisempaan kohtaan, älä oleta että myöhemmät saman viestin muutokset on tehty.
- Säilytä käyttäjän oma koodi ja nimeämistapa aina kun se on järkevää.
- Selitä muutoksen kannalta olennainen algoritmi ja tärkeät ehdot selkeällä suomella. Perussyntaksia ei tarvitse selittää ilman tarvetta.
- Näytä, miten muutos voidaan tarkistaa käytännössä, mielellään rajatapauksella tai kontrastitestillä, jossa väärä ja oikea käyttäytyminen erottuvat selvästi.
- Kerro oletukset, epävarmuudet ja havaitut riskit suoraan.
- Jos huomaat tehtävän ulkopuolisen ongelman, raportoi se erikseen. Älä korjaa sitä samalla ilman lupaa.
- Kommentoi koodissa syytä tai vaikeaa sääntöä, älä itsestään selvää syntaksia.
- Pidä tekstit ja lähdekoodit UTF-8-muodossa. Älä muuta kokonaisen tiedoston merkistökoodausta sivuvaikutuksena.

Älä tee suurta ominaisuutta, laajaa refaktorointia tai arkkitehtuurin vaihtoa omin päin. Esitä ensin lyhyt suunnitelma, vaikutus nykyiseen toimintaan ja pienin järkevä ensimmäinen vaihe. Odota käyttäjän hyväksyntä ennen toteutusta.

## Turvalliset muutosrajat

Ilman käyttäjän erillistä pyyntöä älä:

- vaihda ohjelmointikieltä, käyttöliittymäkehystä tai projektin rakennetta;
- lisää npm-riippuvuuksia, pakettienhallintaa, palvelinta, tietokantaa tai pilvipalvelua;
- korvaa koko algoritmia yhdellä kertaa;
- poista legacy-algoritmeja;
- muuta käyttöliittymän toimintaa, termejä tai ulkoasua;
- muuta sahausvaran, jäännöksen tai optimointiprioriteettien merkitystä;
- muuta score-parametreja ilman regressiotestejä;
- optimoi suorituskykyä tavalla, joka vaikeuttaa opeteltavuutta ennen kuin ongelma on mitattu;
- siivoa tai muotoile tehtävään liittymättömiä tiedostoja;
- tee committeja, julkaisuja tai muita ulkoisia toimia ilman käyttäjän pyyntöä.

Säilytä vanhat vertailupolut niin kauan kuin niistä on hyötyä regressioissa tai uuden polun ymmärtämisessä. Älä jätä sovellusta tilanteeseen, jossa käyttöliittymä kutsuu keskeneräistä toteutusta.

## Refaktorointiohjeet

Refaktoroinnin pitää ensisijaisesti parantaa luettavuutta tai testattavuutta muuttamatta käyttäytymistä.

- Ota lähtötilanteesta talteen konkreettiset regressiot ennen refaktorointia.
- Erota käyttäytymisen muutos ja rakenteen muutos eri vaiheisiin ja mielellään eri committeihin.
- Siirrä tai nimeä vain tehtävän kannalta tarpeellinen koodi.
- Vältä yleiskäyttöisiä abstraktioita ennen kuin niille on vähintään kaksi todellista käyttötapaa.
- Pidä funktiot pieninä ja vastuut selkeinä, mutta älä pilko koodia pelkän rivimäärän vuoksi.
- Poista vanhaa tai päällekkäistä koodia vasta, kun korvaava polku on käytössä, testattu ja käyttäjä on hyväksynyt poiston.
- Jos muutos koskee useita funktioita tai tiedostoja, kerro riippuvuudet ja ehdota vaiheistus ennen muokkaamista.

## Commit-käytäntö

Tee yksi ymmärrettävä ja testattu idea per commit aina kun se on käytännöllistä.

Commit-viestit ovat englanniksi, alkavat isolla imperatiiviverbillä, eivät käytä `feat:`-tyyppisiä etuliitteitä eivätkä pääty pisteeseen.

Älä tee committia automaattisesti ilman käyttäjän pyyntöä. Kun käyttäjä pyytää suoraan päivittämään tiedoston ja tekemään muutoksen repoon, suora dokumentaatiocommit on sallittu kyseisen pyynnön rajoissa.

## Valmiin muutoksen raportointi

Kerro lopuksi tiiviisti:

1. mitä muuttui;
2. miksi muutos tehtiin;
3. miten se testattiin ja millä syötteillä;
4. mitä jäi tarkoituksella tekemättä;
5. mikä on pienin luonteva seuraava askel.

Jos et voinut todentaa muutosta selaimessa tai automaattisilla testeillä, sano se selvästi. Älä väitä optimointitulosta optimaaliseksi ilman perustelua tai testiä; käytä tarvittaessa tarkempaa ilmaisua kuten `heuristinen`, `paras tutkituista yhdistelmistä` tai `optimum todistettu täsmäratkaisijalla`.