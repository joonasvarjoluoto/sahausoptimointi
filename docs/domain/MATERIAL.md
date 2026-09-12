# Aktiivinen materiaalimalli

Tämä dokumentti kuvaa koodin materiaalifysiikan, varaston ja pisteytyksen kanoniset säännöt. Toteutus on [materiaalimoduulissa](../../src/material.js), [sahausmoduulissa](../../src/cutting-physics.js) ja optimizerin/scorejen osalta [app.js](../../app.js):ssä. Moduulirajat: [arkkitehtuuri](../ARCHITECTURE.md). Fyysiset havainnot ja kalibroimattomien arvojen perusteet: [DOMAIN_NOTES.md](../../DOMAIN_NOTES.md).

## Identiteetti ja syötteet

| `profileType` | Nimi | Mittarooli |
| --- | --- | --- |
| `uProfile` | U-profiili | `doorHeight` |
| `verticalProfile` | Pystyprofiili | `doorHeight` |
| `closingProfile` | Vasteprofiili | `doorHeight` |
| `horizontalProfile` | Vaakaprofiili | `doorWidth` |
| `topRail` | Yläkisko | `openingWidth` |
| `bottomRail` | Alakisko | `openingWidth` |

Fyysiset profiilit eivät ole vaihtokelpoisia. Materiaalin vähimmäisidentiteetti on `profileType + color`; väriraja on kova myös eri tilausten kysyntää yhdistettäessä. Nykyiset UI-värit ovat `gray`, `black`, `white`. Mallin on sallittava myöhemmät materiaaliattribuutit, mutta niitä ei päätellä nykyisestä syötteestä. Tuotantonipun värien sekoittaminen ei muuta lähteen ja kappaleen materiaalista yhteensopivuutta.

Uuden salon nimellispituus tulee `stockLength`-syötteestä, oletus 6000 mm. Sahausvaran eli kerfin oletus on 3 mm, ja laskenta käyttää syötettyä arvoa. Pituudet käsitellään 0,1 mm:n kokonaislukuyksiköissä (`DP_DIMENSION_SCALE = 10`); tukematonta tarkkuutta ei pyöristetä huomaamatta. Lähde- ja kappalemitta ovat positiivisia, kerf ja kapasiteettivarat vähintään nolla.

Käyttäjän näkyvä fyysisen materiaalilähteen termi on **salko**: salon, salkoa, salossa, salot, salkoja, salkojen. Tekniset `bar`, `source`, `barId` ja schema-kentät säilyvät; sanaston vuoksi ei tehdä identiteetti- tai skeemamuutosta. Raakalista, Jäännökset ja Sahattavat ovat erillisiä näkymiä.

## Varasto, lähteet ja kulutus

Esimerkkejä saatavuusriveistä:

```js
{ profileType: "verticalProfile", color: "black", unlimited: false, quantity: 4 }
{ profileType: "verticalProfile", color: "black", length: 2600, quantity: 3 }
```

Rajattomalla uudella lähteellä `quantity` on `null`. Äärellinen määrä on kokonaisluku vähintään nolla; nollamääräistä lähdettä ei tarjota optimizerille. Rajattomuus on laskentaoletus, ei tunnettu fyysinen varastosaldo.

`createMaterialInventory()` validoi ja yhdistää jäännökset avaimella `profileType + color + length`; `quantity` kertoo fyysisten palojen määrän. Pysyviä yksilöllisiä jäännös-ID:itä ei ole. Haku voi luoda väliaikaisia lähdeinstansseja. Identtisten varastopalojen vaihtokelpoisuus ei tee eri pituisiksi sahatuista työn lähteistä samaa identiteettiä.

`getMaterialSourcesForProfile()` muodostaa yhden profiilin ja värin käytettävissä olevat uudet ja vanhat lähteet. `consumeMaterialSource()` palauttaa päivitetyn lähdetilan mutatoimatta alkuperäistä tai muita beam-haaroja. Rajattoman saatavuus säilyy, äärellisen määrä vähenee. Beam-tilan identiteetti huomioi jäljellä olevan kysynnän ja äärelliset lähdemäärät.

Tuotannon [rajatussa jatkohaussa](PRODUCTION.md) lähteellä ja ehdokkaalla on lisäksi fyysinen `sourceId`, jonka on täsmättävä kulutuksessa. Tavallisista varastoryhmistä kenttä puuttuu molemmilta. Tämä ei lisää varastoon pysyviä yksilötunnisteita.

Uuden työn raakalistassa on jokaiselle kuudelle profiilille rajaton harmaa oletusrivi (`additional: false`) ja rajaton musta poistettava lisärivi. Palautus ei korvaa tallennettuja saatavuuksia tällä oletuksella. Tallennuksen yhden oletusrivin ja duplikaattien säännöt ovat arkkitehtuuridokumentissa.

## Nimellinen fysiikka ja turvallinen kapasiteetti

`cutPiece(remaining, piece, kerf)` on nimellisen sahausfysiikan auktoritatiivinen toteutus. Kun `excess = remaining − piece`:

- `excess < 0`: kappale ei mahdu, materiaali ei muutu.
- `excess >= kerf`: hukka on kerf ja loppupituus `excess − kerf`.
- `0 <= excess < kerf`: kappale mahtuu, hukka on koko `excess` ja loppupituus nolla.

Nimellinen täsmäsovitus (`excess = 0`) ei tuota terähukkaa. Tuotannon `release`-tulkinta on [tuotantomallissa](PRODUCTION.md); pelkkä turvallisen kapasiteetin loppuminen ei tarkoita täsmäsovitusta.

`MATERIAL_CAPACITY_DEFAULTS` sisältää yhteiset **alustavat konservatiiviset** arvot:

| Asetus | Aktiivinen oletus | Soveltamisala |
| --- | ---: | --- |
| `sourceCapacityAllowance` | 20 mm | Jokainen käytetty uusi tai vanha jäännöslähde |
| `pieceCapacityAllowance` | 1 mm | Jokainen sahattava kappale |

Varat eivät muuta nimellisiä lähde- tai kappalemittoja eivätkä kerfiä. Ne eivät ole laajalla tuotantodatalla kalibroituja. Noin 3,4 mm:n terähavainto on tuotantomuistiinpanoissa; se ei muuta aktiivista kerf-oletusta. Laskennan tarkkuus ei takaa tuotannon mittatarkkuutta.

| Kenttä | Merkitys |
| --- | --- |
| `sourceLength` | Lähteen ilmoitettu nimellispituus; ei turvavaralla lyhennetty tunniste |
| `usableCapacity` | `max(0, sourceLength − sourceCapacityAllowance)` |
| `nominalRemaining` | Nimellisestä lähteestä nimellisten kappaleiden ja `cutPiece()`-hukan jälkeen jäävä laskennallinen fyysinen pituus |
| `remaining` | Turvallisesti uudelleenkäytettävä kapasiteettijäännös |
| `totalPieceCapacityAllowance` | Kappalemäärä × kappalevara |
| `totalCapacityAllowance` | Lähdevara + kappalevarat yhteensä |
| `waste` | Todellinen mallinnettu sahaushukka, ilman kapasiteettivarauksia |

`calculateMaterialBarCapacity()` tarkistaa jokaisen kappaleen nimellisen fysiikan ja vähentää turvallisesta kapasiteetista kappaleen nimellismitan, kappalevaran ja toteutuvan kerf-hukan. Kelvollisessa käytetyssä salossa:

```text
sourceLength = kappaleiden nimellispituudet + waste + nominalRemaining
nominalRemaining = remaining + totalCapacityAllowance
```

Esimerkiksi 6000 mm salosta kaksi 2200 mm kappaletta kerfillä 3 mm: hukka 6 mm, nimellinen loppupituus 1594 mm, varat yhteensä 22 mm ja turvallinen jäännös 1572 mm. Turvallinen `remaining` saa olla täsmälleen nolla.

Nimellinen pituus on materiaalitaseen lähtötieto, ei tuotannossa mitattu toteumaloki. Turvallinen kapasiteetti on konservatiivinen käyttöraja. Varausta ei esitetä kerf-hukkana, myytävänä romuna tai uutena fyysisenä jäännösrivinä. Score, disposition ja finalisoinnin uusi jäännös käyttävät turvallista `remaining`-pituutta; vara ei saa jäännöskrediittiä. Seuraavaan työhön kirjattu jäännös on uusi tarjottu lähde, johon nykyinen yhteinen lähdevara jälleen soveltuu.

Suora `findCandidatePatternsDP()`-vertailukutsu ilman kapasiteettiasetuksia käyttää nollavaroja vanhan kuviokutsusopimuksen säilyttämiseksi. Aktiivinen inventory-polku käyttää lähteiden mukana yhteisiä oletusvaroja. Älä päättele vanhojen suorien DP-testien nollavaroista käyttöliittymän käyttäytymistä.

## Disposition ja materiaalipiste

Kanoninen aktiivinen pisteytyskutsu on `scoreCompleteMaterialTransitionPlan()` ja sille välitetty `PROTOTYPE_MATERIAL_OPTIMIZER_SETTINGS.scoreSettings`:

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

Tämä on regressioilla lukittu checkpoint, ei todistettu taloudellinen optimi. Joidenkin yleisten score-apurien omat puuttuvien asetusten fallback-arvot eroavat tästä; aktiivisen polun totuus on sille välitetty asetuskokonaisuus.

`calculateRemnantValueFactor()` antaa enintään `minimumLength`-pituudelle minimikertoimen, vähintään `fullValueLength`-pituudelle maksimikertoimen ja välissä jatkuvan nousun. Normalisoidulla `t`:llä nousuosuus on `t^p / (t^p + (1−t)^p)`. Kiinteää 1000 mm:n säästämisrajaa ei ole.

`evaluateRemnantDisposition()` vertaa turvallisen jäännöksen säästämisen materiaalihäviötä + käsittelykulua romuttamisen materiaalihäviöön. Säästö valitaan vain **aidosti pienemmällä** kustannuksella; tasatilanne on `scrap`. Disposition ei sisällytä tähän vertailuun uuden salon luontikulua tai suuren romun lisäkulua; ne lasketaan täydellisen suunnitelman pisteeseen erikseen.

Täydellisen suunnitelman piste on materiaalin ekvivalenttipituutta, ei euroja:

```text
lähdearvo − loppujäännöskrediitti − kerf-krediitti
  + jäännöskäsittely + uuden jäännöksen luonti + suuri romu
```

Uuden salon lähdearvo on koko nimellinen `sourceLength`; käytetyn vanhan jäännöksen lähdearvo on sen nykyinen jäännösarvo. Loppukrediitti määräytyy turvallisen jäännöksen dispositionista. Käsittelykulu koskee säästettävää jäännöstä. Luontikulu koskee vain uudesta materiaalista syntyvää säästettävää jäännöstä, ei vanhan lyhentämistä. Suuren romun lisäkulu koskee romuksi valitun loppupalan vapaan rajan ylittävää osaa. Näitä komponentteja ei yhdistetä tai lasketa kahdesti. Sahauslastun nykyinen hyvitys on nolla; romun jälleenmyyntiarvio ei yksin muuta sitä.

`calculatePostOrderMaterialInventory()` vähentää käytetyt äärelliset uudet salot ja vanhat jäännökset, säilyttää käyttämättömät lähteet sekä lisää vain dispositionin säästettävät turvalliset loppujäännökset ryhmiteltyinä. Saman salon jatkoleikkauksista ei tehdä useaa varastovähennystä. Batchin finalisointi antaa funktiolle toteumalokista johdetun fyysisen käytön: poikkeaman vuoksi käyttämättömäksi jäänyttä suunniteltua salkoa ei vähennetä, ja syntyvät jäännökset perustuvat oikeasti käytettyjen salojen turvallisiin loppupituuksiin. Alkuperäinen suunnitelma ja sen score säilyvät vertailuna. Tuotannon fyysinen validointi ja finalisointitransaktio on kuvattu [tuotantomallissa](PRODUCTION.md). Tutkimuksen profiilikohtaiset fyysiset säilytysrajat eivät ole tämän funktion sääntö.

## Haun säilytettävät invariantit

Tavoitejärjestys on oikeellisuus → materiaalitalous → jäännösten järkevä käyttö → varaston joustava muoto → tuotantotehokkuus → deterministisyys ja selitettävyys. Kaikki kysytyt kappaleet tehdään täsmälleen kerran oikeasta variantista. Pitkä koskematon lähde on joustavampi kuin saman pituuden pirstoutuminen. Jäännöksen pakotettu käyttö tai pienin uusien salkojen määrä ei yksin määritä parasta materiaalipistettä.

Inventory-beam kantaa kysyntää ja lähteiden määriä; osittaisten tilojen heuristinen järjestys ei käytä täysin samaa talousmallia kuin valmiiden tulosten score. Epäonnistunut rajattu haku ei yksin todista fyysistä mahdottomuutta. Rajoitteet ja laatututkimus ovat [backlogissa](../../BACKLOG.md).

`findCandidatePatternsDP()` käsittelee vain saavutettuja kapasiteetteja laskevassa järjestyksessä. Binääriset quantity-chunkit, kysyntärivien/mittojen järjestys ja kuviokiintiö ovat hakusemantiikkaa. Jokaisen kapasiteetin vektorit ovat `comparePatternQuantities()`-järjestyksessä, distinct-muodossa ja `maxPatterns`-kiintiössä. Chunk-päivitys yhdistää vanhan ja järjestyksensä säilyttävän uuden listan vakaalla suoralla mergellä. Täsmällisessä duplikaatissa vanhan listan alkio voittaa; kiintiö koskee järjestettyä distinct-tulosta. Järjestystä, etusijaa tai kiintiön paikkaa ei muuteta ilman täsmällisiä kuvioregressioita.

Materiaalirivien ensiesiintymisjärjestys voi vaikuttaa heuristiikan tulokseen. Rivien lajittelu ei ole automaattisesti käyttäytymistä säilyttävä siivous. Scoren, dispositionin, fysiikan ja kapasiteetin muutokset vaativat tarkoituksellisen päätöksen ja [materiaalitestit](../TESTING.md).
