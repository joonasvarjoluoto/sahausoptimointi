# DOMAIN_NOTES.md

## Tarkoitus

Tähän kirjataan tuotannosta ja liiketoiminnasta saadut faktat, karkeat arviot ja avoimet kysymykset. Merkintä auttaa myöhempää suunnittelua, mutta ei yksin oikeuta muuttamaan optimizerin sääntöjä tai parametreja.

Luokittele tieto:

- **vahvistettu fakta:** käytännössä varmistettu toimintatapa tai ominaisuus;
- **karkea arvio:** suuntaa antava luku, joka pitää kalibroida ennen talousmalliin lukitsemista;
- **avoin kysymys:** asia, josta tarvitaan lisätietoa tai päätös.

Kun arviota käytetään koodissa, dokumentoi samalla yksikkö, lähde, päivämäärä, soveltamisala ja regressiot.

## Materiaalin arvo ja romualumiini

### Hukkapalojen jälleenmyyntiarvo

- **Luokitus:** karkea arvio
- **Lähde ja kirjauspäivä:** käyttäjän tuotantotieto, 2026-09-03
- Käyttökelvottomat alumiiniset hukkapalat myydään romualumiinina eteenpäin.
- Niistä saatava arvo on karkeasti noin 10 % vastaavan uuden materiaalin arvosta.
- Nykyisessä score-checkpointissa `scrapValueFactor: 0.1` antaa romulle samansuuntaisen materiaalikrediitin.
- Nykyistä arvoa ei ole vielä sidottu toteutuneisiin euroihin, kilogrammoihin, profiilityyppien massaan tai ajantasaiseen romualumiinin hintaan. Siksi 0,1 on edelleen kalibroitava oletus, ei todistettu talouskerroin.
- `kerfRecoveryFactor: 0` käsittelee sahausvaran tällä hetkellä kokonaan menetettynä. Älä muuta sitä vain hukkapalojen 10 % arvion perusteella.

Ennen mahdollista muutosta selvitä:

1. koskeeko noin 10 % kaikkia profiilityyppejä vai vaihteleeko suhde hankintahinnan, seoksen tai massan mukaan;
2. lasketaanko romuhyvitys käytännössä kilogrammoina, pituutena vai profiilikohtaisena euromääränä;
3. saadaanko myös sahauslastuista tai terän viemästä materiaalista hyvitystä;
4. aiheutuuko romun lajittelusta, säilytyksestä tai kuljetuksesta kustannuksia;
5. mikä on toteutuneiden osto- ja romumyyntihintojen vaihteluväli.

### Materiaalin ja työajan karkea vertailu

- **Luokitus:** karkea arvio
- Noin yksi metri hukkaprofiilia vastaa suuruusluokaltaan noin puolen tunnin palkkaa.
- Käytä tätä vain materiaalin ja työajan painotusten suuntaa antavana kalibrointina. Älä kovakoodaa suhdetta ennen euro- ja profiilityyppikohtaista tarkennusta.

## Raakatangon fyysiset ominaisuudet

- **Luokitus:** vahvistettu tuotantohavainto
- Uuden tangon tavallinen pituus on 6000 mm.
- Tangon toisessa päässä on noin 8 mm ripustusreikä.
- Tangot asetetaan sahalle ehjä pää vasemmalla stopparia vasten ja reiällinen, huonompi pää oikealle.
- Nykyinen laskenta käyttää silti yleistä `stockLength`-syötettä eikä vähennä kiinteää päävaraa.
- Tuleva malli voi tarvita esimerkiksi `usableLength`- ja `endAllowance`-kentät.

## Tuotannon järjestys ja pakkaaminen

- **Luokitus:** vahvistettu tuotantohavainto, ei vielä aktiivinen score-sääntö
- Pysty- ja Vaakaprofiilit kannattaa sahata peräkkäin ja mieluiten aikaisin, jotta kokoonpano voi alkaa.
- U-listoja tarvitaan vasta asennuksessa, joten ne voidaan sahata myöhemmin ja varastoida erikseen.
- Ala- ja Yläkisko ovat saman aukon mittaisia ja pakataan yhteen aukon mukaan.
- Yksi tilaus voi sisältää useita aukkoja; neljää ovea per aukko ei saa kovakoodata.
- Materiaalikustannus on yleensä työajan säästöä tärkeämpi.
- Avatut 6000 mm tangot halutaan käyttää tehokkaasti ilman tarpeetonta jäännösvaraston kasvua.

## Jäännösten tuleva arvo

- **Luokitus:** avoin mallinnuskysymys
- Pitkä käyttökelpoinen jäännös voi olla arvokkaampi kuin usea lyhyt jäännös, mutta koskematon uusi tanko on joustavampi kuin saman pituuden pirstoutuminen.
- Tuleva arvo voi riippua profiilityypistä, väristä, pituudesta, varastomäärästä, iästä ja kausittaisesta kysynnästä.
- Mahdollinen kenttä iälle on esimerkiksi `ordersSinceUse`.
- Historiallista kysyntä- ja tuotantodataa tarvitaan ennen luotettavaa terminal inventory value -kalibrointia.

## Sahausniput ja turvallisuus

- **Luokitus:** osittain vahvistettu, osittain avoin
- Nykyinen turvallinen oletus on yksi profiilityyppi per sahausliike.
- Tuleva yhteensopivuus pitää mallintaa muokattavana turvallisuussääntönä eikä kaikkien profiilien kovana identtisyysvertailuna.
- Sahausnippu ei ole pysyvä: lähteitä voidaan lisätä ja poistaa leikkausten välillä.
- Yhdessä liikkeessä voi myöhemmin olla useita uusia tankoja ja/tai jäännöksiä sekä eri värejä, jos turvallisuussäännöt sallivat sen.
- `maxStackSize` on profiilityyppikohtainen. Tyypillinen arvo on usein 4 tai 6, mutta sitä ei saa tehdä globaaliksi vakioksi ilman tarkempaa tietoa.

## Tilausten jäljitettävyys

- **Luokitus:** tavoiteltu tuotantovaatimus
- Tilaus ei ole optimizerille jakamaton kokonaisuus; eri tilausten kappaleita voidaan myöhemmin yhdistellä materiaalin kannalta.
- Jokaisessa kappaleessa pitää säilyttää `orderId` ja `openingId`, jotta sahaus, merkintä, pakkaus ja asennus voidaan yhdistää oikeaan tilaukseen ja aukkoon.
- Rolling-horizon-uudelleenoptimointi on sallittu, kun osa työstä on tehty tai varasto ja tulevat tilaukset muuttuvat.

## Uuden merkinnän malli

```md
### Aihe

- **Luokitus:** vahvistettu fakta | karkea arvio | avoin kysymys
- **Havainto:** ...
- **Lähde ja päivämäärä:** ...
- **Nykyinen vaikutus koodiin:** ei vaikutusta | nykyinen asetus/funktio
- **Ennen toteutusta selvitettävä:** ...
```
