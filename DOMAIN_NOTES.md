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

## Mittatoleranssi ja kapasiteetin turvallisuusvarat

- **Lähde ja päivämäärä:** käyttäjän muistio ”Tuleva tilaus-UI, varastonhallinta ja sahaustoleranssit”, 2026-09-06.
- **Vahvistettu tuotantohavainto:** positiiviset mittavirheet voivat kasautua. Viisi kappaletta, joista kukin on 0,5 mm nimellismittaa pidempi, kuluttavat yhteensä 2,5 mm lisäpituutta. Laskennallinen nolla- tai lähes nollajäännös voi silloin jättää viimeisen kappaleen vajaaksi.
- **Käyttäjän ilmoittamat likimääräiset mitat:** hyväksyttävä mittatoleranssi on noin ±1 mm, vaikka tavallisesti pyritään tarkempaan tulokseen. Todellinen terän leveys on noin 3,4 mm. Soveltamisala ja mitatut arvot tarkennetaan ennen mallin lukitsemista.
- **Tuotantopreferenssi:** muutaman millimetrin ylimääräinen hukka per tanko on hyväksyttävämpi kuin viimeisen kappaleen jääminen liian lyhyeksi.
- **Nykyinen vaikutus koodiin:** ei parametrimuutosta. Kerfin oletus on edelleen 3 mm ja laskenta käyttää lomakkeen kerf-arvoa. `src/cutting-physics.js`:n `cutPiece()` hyväksyy nimellismittojen täsmäsovituksen; erillistä toleranssi- tai kapasiteettivaraa ei ole. Laskennan 0,1 mm:n resoluutio ei takaa tuotannon mittatarkkuutta.

### Ehdotettu malli, ei vielä käytössä

Pidä erillisinä nimellinen kappalemitta, terän todellinen/nimellinen leveys ja käytettävissä olevan tangon pituus sekä niiden mahdolliset turvallisuusvarat:

- kappale: nimellismitta + kappalekohtainen kapasiteettivara;
- sahaus: kerf + erikseen määritelty kerfin turvallisuusvara;
- lähde: `stockLength` − mahdollinen `endAllowance` − mahdollinen tankokohtainen turvallisuusvara.

Noin **1 mm / sahattava kappale** on alustava konservatiivinen kokeiluarvo, ei päätetty tuotantoasetus. Se varaisi kapasiteettia eikä käskisi sahaamaan kappaletta 1 mm ylipitkäksi. Myös kerfin ympärille voidaan arvioida oma pieni marginaali. Kappaletoleranssia ei piiloteta keinotekoiseksi esimerkiksi 5 mm:n kerfiksi.

**Ennen toteutusta selvitettävä:** kalibroi varat tuotantohavainnoilla; määrittele soveltuminen uusiin tankoihin ja jäännöksiin, viimeiseen katkaisuun sekä päävaraan. Erota laskennallisesti varattu kapasiteetti toteutuneesta sahahukasta ja fyysisestä jäännöksestä. Nykyisen `cutPiece()`-säännön tai tallennetun suunnitelman tulkinnan muuttaminen vaatii erillisen päätöksen, yhteensopivuusarvion ja täsmäsovitus-/kumuloitumisregressiot.

## Uuden materiaalin saldot ja täydennys

- **Lähde ja päivämäärä:** käyttäjän muistio ”Tuleva tilaus-UI, varastonhallinta ja sahaustoleranssit”, 2026-09-06.
- **Vahvistettu käyttötarve:** runsaan varaston tarkkaa määrää ei tarvitse pitää jatkuvasti näkyvissä. Vähäinen saldo on tärkeä sekä optimoinnille että täydennystilauksille.
- **Tavoite:** tuotannossa seurataan todellisia uuden materiaalin kappalesaldoja variantilla `profileType + color`. Prototyypin `unlimited` on hyödyllinen laskentaoletus, mutta ei tunnettu fyysinen saldo eikä riittävä lähtötieto automaattisille hälytyksille.
- **Nykyinen vaikutus koodiin:** rajalliset `quantity`-saldot ja rajaton materiaali ovat jo tuettuja. Finalisointi vähentää käytetyn uuden materiaalin authoritative post-order-varaston kautta. Erillisiä varastohälytyksiä tai vastaanottotoimintoa ei vielä ole.

### Kaksi alustavaa hälytysrajaa

**Luokitus:** alustava, myöhemmin kalibroitava tuotantosääntö. Yhteiset kokeilurajat ovat `reorderThreshold = 50` ja `criticalStockThreshold = 10`, yksikkönä uuden materiaalin tankojen kappalemäärä per materiaalivariantti.

| Todellinen saldo | Suunniteltu tila |
| --- | --- |
| Yli 50 kpl | Normaali |
| 11–50 kpl | Tilaa lisää |
| 1–10 kpl | Kriittisen vähän |
| 0 kpl | Loppu |

50 tangon raja on logistinen ennakkovaroitus, ei optimoinnin käyttöraja. Esimerkiksi 34 tangon saldo antaa optimizerille edelleen 34 tankoa, vaikka käyttöliittymä kehottaa tilaamaan lisää. Hälytys ei muuta saldoa tai pisteytystä.

**Ennen toteutusta selvitettävä:** tuntemattoman/rajattoman saldon esitystapa ja todellisten alkusaldojen kirjaaminen. Rajat eivät ole todistettuja optimeja; myöhemmin ne voivat olla profiili- ja värikohtaisia sekä perustua kulutukseen, toimitusaikaan ja turvavarastoon.

### Saapuvan materiaalin vastaanotto

- **Luokitus:** tuleva käyttötarve, ei vielä toteutettu.
- Saapunut määrä kirjataan lisäyksenä oikean materiaalivariantin saldoon, ei uuden kokonaissaldon käsin korvaamisena: 7 varastossa + 100 vastaanotettua = 107 tankoa.
- Vastaanoton on säilyttävä onnistuneesti tallennuksessa; virheellinen syöte tai tallennusvirhe ei saa jättää osittain muuttunutta saldoa.
- Varastotapahtumien historia voidaan lisätä myöhemmin. Ensimmäinen vastaanottotoiminto ei edellytä tapahtumakirjanpitoa.

## Tuotannon järjestys ja pakkaaminen

- **Luokitus:** vahvistettu tuotantohavainto, ei vielä aktiivinen score-sääntö
- Pysty- ja Vaakaprofiilit kannattaa sahata peräkkäin ja mieluiten aikaisin, jotta kokoonpano voi alkaa.
- U-listoja tarvitaan vasta asennuksessa, joten ne voidaan sahata myöhemmin ja varastoida erikseen.
- Ala- ja Yläkisko ovat saman aukon mittaisia ja pakataan yhteen aukon mukaan.
- Yksi tilaus voi sisältää useita aukkoja; neljää ovea per aukko ei saa kovakoodata.
- Materiaalikustannus on yleensä työajan säästöä tärkeämpi.
- Avatut 6000 mm tangot halutaan käyttää tehokkaasti ilman tarpeetonta jäännösvaraston kasvua.

## Samanlaisten jäännösten vaihtokelpoisuus

- **Luokitus:** vahvistettu tuotantofakta
- **Lähde ja päivämäärä:** käyttäjän tarkennus, 2026-09-06
- **Havainto:** esimerkiksi viisi harmaata 1600 mm Pystyprofiilin jäännöstä ovat keskenään samanarvoisia ja vaihtokelpoisia. Tuotannolle ei ole merkitystä, mikä näistä fyysisistä kappaleista valitaan.
- **Nykyinen vaikutus koodiin:** nykyinen `profileType + color + length` -ryhmittely ja `quantity` vastaavat tätä tarvetta. Pysyviä yksilöllisiä varastotunnuksia ei tarvita; tarkennus ei muuta laskentaa.
- **Vaikutus myöhempään suunnitteluun:** identtisten lähteiden pelkkä keskinäinen vaihto ei saa muodostaa erillisiä optimointivaihtoehtoja. Työkohtaisia lähdeviitteitä voidaan käyttää sahausoperaatioiden ja valmistumisen seurantaan. Tällainen viite saa säilyä työn tallennuksessa, mutta se ei tarkoita pysyvää fyysisen varastokappaleen tunnusta.
- **Ennen toteutusta selvitettävä:** tuotanto-operaatioiden malli voi erottaa kesken työn lähteet, joiden jäljellä oleva pituus, sijoitus tai jatkoleikkaukset eroavat. Samanlaisessa tilassa olevat lähteet voidaan edelleen käsitellä ryhmänä. Mahdollisten myöhempien materiaaliattribuuttien vaikutus vaihtokelpoisuuteen päätetään erikseen.

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

### Tilauksen väri ja manuaalinen syöttö

- **Luokitus:** käyttäjän vahvistama tuotantofakta.
- **Lähde ja päivämäärä:** muistio ”Tuleva tilaus-UI, varastonhallinta ja sahaustoleranssit”, 2026-09-06.
- Yksi tilaus on käytännössä yhtä materiaaliväriä, ja normaalissa tilauksessa tarvitaan kaikkia nykyisiä profiilityyppejä. Tämä ei ole vaatimus hylätä osittain täytettyjä tai vain joitakin profiileja sisältäviä tilauksia.
- **Jo toteutettu:** tilauskortin yhteinen väri, viisi profiiliaccordionia ja pelkät mitta-/määräkentät riveillä. Muistion kuvaama hidas rivikohtainen profiilin ja värin valinta koskee vanhaa UI:ta.
- `getOrdersFromForm() → normalizeOrderCuts()` tuottaa optimizerin nykyiset `profileType + color + length + quantity` -rivit ja säilyttää `orderId`:n. Tunniste ei ole optimointikriteeri. Tulevan tuloskohdistuksen rajoite kuvataan alla.

### Yhteinen ylä- ja alakiskosyöttö

- **Luokitus:** käyttäjän vahvistama tuotantosääntö
- **Lähde ja päivämäärä:** tilauspohjaisen Sahattavat-UI:n tehtävänanto, 2026-09-06
- **Havainto:** yhden tilauksen ylä- ja alakiskoilla on samat mitat ja samat kappalemäärät.
- **Nykyinen vaikutus koodiin:** yhteinen `rails`-UI-osio laajenee adapterissa erillisiksi `topRail`- ja `bottomRail`-riveiksi. Fyysisiä profiilityyppejä tai niiden materiaalivarastoja ei yhdistetä. Aukkokohtaista mallia ei vielä ole.

### Tuleva tuotantokohdistus

- **Luokitus:** tavoiteltu tuotantovaatimus
- Tilaus ei ole optimizerille jakamaton kokonaisuus; eri tilausten kappaleita voidaan myöhemmin yhdistellä materiaalin kannalta.
- Jokaisessa kappaleessa pitää säilyttää `orderId` ja `openingId`, jotta sahaus, merkintä, pakkaus ja asennus voidaan yhdistää oikeaan tilaukseen ja aukkoon.
- Tilaus-UI:n ensimmäisessä toteutuksessa `orderId` säilyy tilauskortissa, tallenteessa ja adapterin cut-riveissä. Optimizerin ryhmitellyssä tuloksessa ei vielä ole kappalekohtaista tilauskohdistusta, eikä `openingId`:tä luoda ilman aukkokohtaista syöttömallia.
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
