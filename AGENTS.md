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

Tavoite ei ole vain vähentää sahahukkaa. Ratkaisun pitää huomioida erillisinä ja selitettävinä ainakin uuden materiaalin käyttö, olemassa olevat jäännökset, syntyvien jäännösten arvo, sahahukka ja varaston pirstaloituminen. Työaika ja sahausjärjestys tulevat myöhemmin. Kustannuskomponentteja ei saa piilottaa yhteen perustelemattomaan kokonaispisteeseen.

Oppiminen on yhtä tärkeää kuin toimiva tulos. Perustele olennaiset oletukset, algoritmimuutokset ja testit käyttäjälle ymmärrettävästi.

## Nykyinen rakenne

Projekti toimii suoraan selaimessa ilman rakennusvaihetta tai paketinhallintaa:

- `index.html`: mobiiliystävälliset syötteet, työtoiminnot ja tulosalue.
- `app.js`: käyttöliittymä, materiaalivarasto, optimizerit, pisteytys, renderöinti, dev-testit ja localStorage-työtila.
- `style.css`: mobiili ensin -asettelu ja tuloskorttien tilat.

Tallennetun työtilan nykyinen versiointi:

- `WORK_STATE_SCHEMA_VERSION = 3`
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

Pidä materiaalinäkymä ja tuleva tuotantonäkymä erillään:

- materiaali: `bar`/`source` ja varaston tilasiirtymät;
- tuotanto: yksi `cut operation` kuvaa sahausliikkeen ja juuri siinä liikkeessä mukana olevat lähteet.

Tarkemmat tuotantohavainnot ja keskeneräiset talousoletukset ovat `DOMAIN_NOTES.md`:ssä.

## Aktiivinen optimointipolku

Käyttöliittymän aktiivinen polku on inventory-aware:

`calculate()`
→ `getCutsFromForm()`
→ `getMaterialAvailabilityFromForm()`
→ `createMaterialInventory()`
→ `optimizeOrderByProfileTypeWithInventory()`
→ `getMaterialSourcesForProfile()`
→ `optimizeOrderInventoryBeamDP()`
→ `scoreCompleteMaterialTransitionPlan()`
→ `adaptMaterialOptimizationForUi()`
→ `renderCuttingPlan()`

`optimizeOrderByProfileTypeWithInventory()` optimoi profiilityypit erikseen ja yhdistää tulokset lopuksi. Tämä on nykyisen single-order-prototyypin tarkoituksellinen rajaus.

`optimizeOrderInventoryBeamDP()` kantaa tilassa jäljellä olevat tilauskappaleet ja materiaalilähteet. Tila-avain huomioi äärellisten lähteiden jäljellä olevat määrät. `consumeMaterialSource()` ei saa mutatoida muiden beam-haarojen lähteitä.

Valmiit ratkaisut pisteytetään `scoreCompleteMaterialTransitionPlan()`-funktiolla. Osittaisten beam-tilojen järjestys on edelleen heuristinen eikä käytä täysin samaa materiaalitalousmallia.

Legacy- ja vertailupolkuja ovat muun muassa `optimizeOrderMaterialBeamDP()`, `optimizeOrderBeamDP()`, `optimizeOrderDP()`, `optimizeCuts()` sekä `generateCombinations() → evaluateCombination() → findBestCombination() → optimizeOrder()`. Niitä ei ole kytketty aktiiviseen käyttöliittymään eikä niitä saa ottaa varapoluksi, poistaa tai olettaa oikeiksi ilman erillistä tehtävää ja testejä. Yhdistelmäpolkua ei saa käyttää suurille syötteille ilman suorituskyvyn arviointia.

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
5. **Tuotantotehokkuus:** stopparin siirrot ja samanaikainen sahaus ovat tärkeimmät myöhemmät tuotantokriteerit; materiaalikustannus on nyt ensisijainen.
6. **Deterministisyys ja selitettävyys:** sama syöte tuottaa saman tuloksen, ja kustannusvaikutukset voidaan eritellä.

Beam-haun tulosta ei saa väittää globaaliksi optimiksi ilman käsin tehtyä todistusta tai täsmäratkaisijaa. Käytä tarvittaessa ilmaisuja `heuristinen`, `paras tutkituista vaihtoehdoista` tai `optimum todistettu täsmäratkaisijalla`.

## Käyttöliittymän ja persistenssin invariantit

Raakalista, Jäännökset ja Sahattavat pidetään käyttöliittymässä erillisinä. Tankokortissa näkyvät profiilityyppi, materiaalilähde, lähdepituus, sahattavat kappaleet, syntyvä jäännös ja sahahukka. Osittaista ratkaisua ei saa näyttää valmiina sahaussuunnitelmana.

`TEHTY`-merkintä on palautettava käyttöliittymätila eikä muuta materiaalivarastoa. Varasto muuttuu vain työn finalisoinnissa `calculatePostOrderMaterialInventory()`-tuloksen perusteella.

Finalisointi noudattaa persistoi-ensin/commitoi-sitten-järjestystä: lopullinen snapshot kirjoitetaan onnistuneesti ennen varasto-DOM:n vaihtamista ja suunnitelman tyhjentämistä. Epäonnistunut tallennus ei saa muuttaa live-työtä.

Tallennettu suunnitelma validoidaan rakenteellisesti, semanttisesti ja sahausfysiikan kannalta ennen DOM-palautusta. Persistoiduilla lomakeriveillä on 1000 rivin raja, ja tallennettujen stock-varianttien duplikaatit tarkistetaan UI:n kanonisoidulla värillä.

## Testaus

Projektissa ei vielä ole varsinaista testikehystä. Käytä `app.js`:n nimettyjä `run...RegressionTest(s)()`-funktioita sekä selaimen dev-apureita, kuten `loadTestA()`, `loadTestAWithRemnants()`, `loadTestD1()` ja `runCurrentOrderSummaryTest()`. DOM:ia muuttavan apurin palauttama `undefined` on normaali.

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

Aja tehtävän laajuuteen nähden soveltuvat tarkistukset. Käytä `node --check app.js`-syntaksitarkistusta, jos Node on saatavilla, ja `git diff --check`-tarkistusta. Optimointia tai persistenssiä muuttava työ vaatii lisäksi relevantit regressiot ja mahdollisuuksien mukaan selaintestin. Älä väitä selaintestiä tehdyksi, jos sitä ei voitu ajaa.

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
