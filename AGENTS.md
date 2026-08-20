# AGENTS.md

## Projektin tarkoitus

Tämä on oppimisprojekti, jossa rakennetaan selaimessa toimivaa sahausoptimointia 6000 mm:n alumiiniprofiileille. Käyttäjä syöttää sahattavien kappaleiden pituudet ja määrät sekä sahanterän leveyden. Ohjelman tehtävä on muodostaa ymmärrettävä sahaussuunnitelma, joka käyttää mahdollisimman vähän raakatankoja ja käsittelee jäännöspalat sekä sahahukan johdonmukaisesti.

6000 mm on projektin tavallinen ja käyttöliittymän oletusarvoinen raakatangon pituus. Pidä laskenta silti yleiskäyttöisenä nykyisen `stockLength`-syötteen mukaisesti, ellei tehtävässä erikseen päätetä lukita pituutta.

Projektissa oppiminen on yhtä tärkeä tavoite kuin toimiva lopputulos. Ratkaisujen pitää olla käyttäjän ymmärrettävissä vaihe vaiheelta.

## Nykyinen rakenne

Projekti on pieni, ilman rakennustyökaluja suoraan selaimessa toimiva prototyyppi:

- `index.html` sisältää mobiiliystävälliset syötteet, työpainikkeet ja tulosalueen. Se lataa `style.css`:n ja `app.js`:n suoraan ilman rakennusvaihetta.
- `app.js` sisältää käyttöliittymän käsittelyn, sahauslaskennan, DP- ja beam-hakufunktiot, tulosten muodostamisen sekä versioidun localStorage-työtilan.
- `style.css` sisältää mobiili ensin -asettelun, tankokortit, valmistumistilat ja työpöydän leveämmän asettelun.
- Projektissa ei toistaiseksi ole testikehystä, paketinhallintaa tai rakennusvaihetta.

`calculate()` validoi ja ryhmittelee käyttöliittymän tiedot ja kutsuu tällä hetkellä `optimizeOrderMaterialBeamDP()`-funktiota keskitettyjen `PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS`-asetusten kautta. Tulos muunnetaan erillisellä adapterilla tankokorteiksi.

Tiedostossa säilytetään vertailua varten myös vanha `optimizeCuts()` sekä yhdistelmäpohjainen polku:

`generateCombinations()` -> `evaluateCombination()` -> `findBestCombination()` -> `optimizeOrder()`

Näitä legacy-polkuja ei ole kytketty käyttöliittymään eikä niitä käytetä virhetilanteen varapolkuna. Älä oleta niitä valmiiksi tai oikeiksi vain siksi, että funktiot ovat olemassa. Kaikkien yhdistelmien muodostaminen kasvaa eksponentiaalisesti, joten sitä ei saa ottaa käyttöön suurille syötteille ilman suorituskyvyn arviointia.

## Kehityssuunta

Käyttöliittymällä on nyt yksi aktiivinen materiaaliin painottuva optimointipolku. Kehitä v0.1-prototyyppiä pienissä, erikseen testattavissa vaiheissa:

1. Säilytä nykyisen aktiivisen materiaalioptimoijan oikeellisuus, deterministisyys ja Vaaka-regressiot.
2. Kerää ensin kokemusta oikeista sahaustöistä ennen uusia pisteytys- tai hakusääntöjä.
3. Muuta hakuasetuksia, pisteytystä tai jäännössemantiikkaa vain omana rajattuna tehtävänään ja vertaa tulokset nykyiseen versioon.
4. Pidä palautettava työtila yhteensopivana skeema- ja moottoriversioiden avulla; älä palauta vanhaa suunnitelmaa muuttuneille syötteille.
5. Poista legacy-algoritmeja vasta käyttäjän hyväksynnällä ja toimivien regressioiden jälkeen.

Pidä käyttöliittymä ja optimointilogiikka mahdollisuuksien mukaan erillään. Laskentafunktioiden tulisi ottaa arvot parametreina ja palauttaa dataa; DOM:n lukeminen ja HTML-tuloksen muodostaminen kuuluvat käyttöliittymäkerrokseen. Tee tätä erottelua vain tehtävän kannalta tarpeellisina, pieninä refaktorointeina.

## Optimointiperiaatteet

Noudata seuraavaa tärkeysjärjestystä, ellei käyttäjä muuta sitä tehtävässä:

1. **Oikeellisuus:** jokainen tilattu kappale sahataan täsmälleen pyydetty määrä, eikä yhtään kappaletta sijoiteta tankoon, johon se ei mahdu.
2. **Raakatankojen määrä:** minimoi käytettyjen raakatankojen määrä.
3. **Jäännösten hyödyllisyys:** suosi ratkaisua, jonka jäännöstä voidaan käyttää johonkin vielä sahaamatta olevaan tilauskappaleeseen.
4. **Materiaalihukka:** kun ylemmät tavoitteet ovat samat, suosi pienempää käyttökelvotonta jäännöstä ja raportoi sahanterän aiheuttama hukka erikseen.
5. **Selitettävyys:** jos kaksi ratkaisua ovat muuten samanarvoisia, suosi vakaata ja helposti perusteltavaa valintaa.

Älä määrittele käyttökelpoista jäännöstä pysyvällä 1000 mm:n rajalla. Jäännös on tässä kehityssuunnassa käyttökelpoinen, jos siitä voidaan sahata jokin vielä tarvittava kappale nykyisen sahausmallin ja terän leveyden mukaan. Jos myöhemmin halutaan varastoitavan jäännöspalan vähimmäispituus, tee siitä erillinen nimetty sääntö tai käyttäjän asetus vasta sovittaessa.

Käytä `cutPiece()`-funktiota sahausvaran nykyisenä keskitettynä sääntönä. Älä muuta huomaamatta sitä, milloin terän leveys vähennetään. Jos sahausmallia pitää muuttaa, kuvaa vanha ja uusi sääntö, lisää rajatapaukset ja pyydä käyttäjältä hyväksyntä semantiikan muutokselle.

Hylkää tai ilmoita selvästi virheelliset syötteet. Ainakin seuraavat tapaukset pitää huomioida:

- raakatangon pituus ei ole positiivinen;
- terän leveys on negatiivinen;
- kappaleen pituus tai määrä ei ole positiivinen;
- määrä ei ole kokonaisluku;
- kappale on raakatankoa pidempi;
- syötteitä ei ole lainkaan.

Älä koskaan luo tulokseen tankoa epäonnistuneen `cutPiece()`-kutsun pohjalta. Desimaalimittojen vertailussa huomioi tarvittaessa liukulukujen tarkkuus, mutta älä lisää toleranssia ilman nimettyä perustetta ja testiä.

## Codexin työskentelytapa

Toimi opettavana ohjelmointiparina, älä projektin itsenäisenä uudelleenkirjoittajana.

- Tutki nykyinen toteutus ennen muutoksia ja kerro lyhyesti, mitä aiot muuttaa ja miksi.
- Tee yksi rajattu, ymmärrettävä muutos kerrallaan.
- Säilytä käyttäjän oma koodi ja nimeämistapa aina kun se on järkevää.
- Selitä muutoksen kannalta olennainen algoritmi ja tärkeät ehdot selkeällä suomella.
- Näytä, miten muutos voidaan tarkistaa käytännössä.
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
- poista kumpaakaan algoritmipolkua;
- muuta käyttöliittymän toimintaa, termejä tai ulkoasua;
- muuta sahausvaran, jäännöksen tai optimointiprioriteettien merkitystä;
- optimoi suorituskykyä tavalla, joka vaikeuttaa opeteltavuutta ennen kuin ongelma on mitattu;
- siivoa tai muotoile tehtävään liittymättömiä tiedostoja;
- tee committeja, julkaisuja tai muita ulkoisia toimia.

Säilytä vanha toimiva polku palautettavissa, kun uutta algoritmipolkua vasta kokeillaan. Älä jätä sovellusta tilanteeseen, jossa käyttöliittymä kutsuu keskeneräistä toteutusta.

## Testausohjeet

Testaa laskentalogiikkaa pienillä, käsin tarkistettavilla tapauksilla. Tarkista jokaisesta tuloksesta vähintään:

- kaikki pyydetyt kappaleet esiintyvät täsmälleen oikean määrän;
- yhden tangon kappaleet, sahahukka ja jäännös eivät ylitä raakatangon pituutta;
- mahdoton kappale ei päädy kelvolliseen sahaussuunnitelmaan;
- tankojen lukumäärä ja valitut yhdistelmät vastaavat määriteltyjä prioriteetteja;
- syötetaulukoita tai käyttäjän antamia olioita ei muuteta odottamatta;
- sama syöte tuottaa saman tuloksen joka ajolla.

Käytä vähintään näitä tapaustyyppejä algoritmia muutettaessa:

- yksi kappale, joka mahtuu väljästi;
- kappale, joka täyttää tangon täsmälleen;
- kaksi tai useampi kappale sekä niiden väliset sahausvarat;
- useita samanpituisia kappaleita;
- tapaus, jossa tarvitaan useampi tanko;
- tapaus, jossa jäännös sopii vielä odottavaan kappaleeseen;
- kappale, joka on raakatankoa pidempi;
- nolla-, negatiiviset, desimaaliset ja tyhjät syötteet soveltuvin osin;
- riittävän suuri kappalemäärä paljastamaan yhdistelmähakujen suorituskykyongelmat.

Projektissa ei ole vielä testikehystä. Älä lisää raskasta testikirjastoa oma-aloitteisesti. Tee nykyisessä vaiheessa toistettavat manuaaliset tarkistukset selaimessa ja raportoi käytetyt syötteet sekä odotettu ja saatu tulos. Jos tehtävä koskee algoritmia laajemmin, ehdota ensin pientä automaattista testirakennetta puhtaille laskentafunktioille.

Kun korjaat virheen, tee ensin tapaus, joka osoittaa virheen, ja varmista muutoksen jälkeen, että tapaus toimii ja aiemmat perustapaukset säilyvät.

## Refaktorointiohjeet

Refaktoroinnin pitää ensisijaisesti parantaa luettavuutta tai testattavuutta muuttamatta käyttäytymistä.

- Ota lähtötilanteesta talteen muutama konkreettinen esimerkkitulos ennen refaktorointia.
- Erota käyttäytymisen muutos ja rakenteen muutos eri vaiheisiin.
- Siirrä tai nimeä vain tehtävän kannalta tarpeellinen koodi.
- Vältä yleiskäyttöisiä abstraktioita ennen kuin niille on vähintään kaksi todellista käyttötapaa.
- Pidä funktiot pieninä ja vastuut selkeinä, mutta älä pilko koodia pelkän rivimäärän vuoksi.
- Poista vanhaa tai päällekkäistä koodia vasta, kun korvaava polku on käytössä, testattu ja käyttäjä on hyväksynyt poiston.
- Jos muutos koskee useita funktioita tai tiedostoja, kerro riippuvuudet ja ehdota vaiheistus ennen muokkaamista.

## Valmiin muutoksen raportointi

Kerro lopuksi tiiviisti:

1. mitä muuttui;
2. miksi muutos tehtiin;
3. miten se testattiin ja millä syötteillä;
4. mitä jäi tarkoituksella tekemättä;
5. mikä on pienin luonteva seuraava askel.

Jos et voinut todentaa muutosta selaimessa tai automaattisilla testeillä, sano se selvästi. Älä väitä optimointitulosta optimaaliseksi ilman perustelua tai testiä; käytä tarvittaessa tarkempaa ilmaisua kuten "heuristinen" tai "paras tutkituista yhdistelmistä".
