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

### Mittavasteen siirto ja kustannusten tarkennus (2026-09-07)

- **Lähde:** käyttäjän projektimuistiinpanot, 2026-09-07.
- **Terminologia:** käytetään sanaa mittavaste; aiempi ”stopperi/stoppari” tarkoitti samaa laitteen osaa.
- **Karkea arvio:** mittavasteen siirto kestää ehkä 10 sekuntia.
- **Käyttäjän ilmoittama palkka:** 12 €/h. Tämä ei vielä määritä työnantajan kokonaiskustannusta.
- **Keskimääräinen materiaalihinta:** 7 €/m; profiili- ja värikohtaisia hintoja ei ole määritelty.
- **Johdettu vertailu:** 10 s × 12 €/h / 3600 s/h ≈ 0,0333 € per siirto. Hinnalla 7 €/m tämä vastaa noin 4,8 mm uutta profiilia. Yksi metri vastaa noin 35 minuutin palkkaa ja tarkentaa aiempaa puolen tunnin suuruusluokka-arviota.
- **Päätetty suunta:** optimointia jatketaan materiaali edellä. Mittavasteen siirtoaika voidaan myöhemmin huomioida eriteltynä työaikakustannuksena pisteytyksessä.
- **Nykyinen vaikutus koodiin:** ei muutosta. Nykyiseen materiaalipisteytykseen ei lisätä euroja sellaisenaan eikä arvioita muuteta automaattisesti score-parametreiksi.
- **Ennen toteutusta selvitettävä:** ajan vaihtelu ja palkkakustannuksen soveltamisala. Materiaalikustannus ja työaika muunnetaan vertailukelpoisiin yksiköihin ja raportoidaan erikseen; regressioilla varmistetaan materiaalin ensisijaisuus.

## Raakatangon fyysiset ominaisuudet

- **Luokitus:** vahvistettu tuotantohavainto
- Uuden tangon tavallinen pituus on 6000 mm.
- Tangon toisessa päässä on noin 8 mm ripustusreikä.
- Tangot asetetaan sahalle ehjä pää vasemmalla mittavastetta vasten ja reiällinen, huonompi pää oikealle.
- Laskenta säilyttää yleisen `stockLength`-syötteen nimellispituutena. Aktiivinen `sourceCapacityAllowance` vähentää siitä turvallisen optimointikapasiteetin; varaus ei muuta tallennettua nimellispituutta.

## Mittatoleranssi ja kapasiteetin turvallisuusvarat

- **Lähde ja päivämäärä:** käyttäjän muistio ”Tuleva tilaus-UI, varastonhallinta ja sahaustoleranssit”, 2026-09-06.
- **Vahvistettu tuotantohavainto:** positiiviset mittavirheet voivat kasautua. Viisi kappaletta, joista kukin on 0,5 mm nimellismittaa pidempi, kuluttavat yhteensä 2,5 mm lisäpituutta. Laskennallinen nolla- tai lähes nollajäännös voi silloin jättää viimeisen kappaleen vajaaksi.
- **Käyttäjän ilmoittamat likimääräiset mitat:** hyväksyttävä mittatoleranssi on noin ±1 mm, vaikka tavallisesti pyritään tarkempaan tulokseen. Todellinen terän leveys on noin 3,4 mm. Soveltamisala ja mitatut arvot tarkennetaan ennen mallin lukitsemista.
- **Tuotantopreferenssi:** muutaman millimetrin ylimääräinen hukka per tanko on hyväksyttävämpi kuin viimeisen kappaleen jääminen liian lyhyeksi.
- **Käyttäjän päätös 10.9.2026:** aktiivinen yhteinen oletus on `sourceCapacityAllowance = 20 mm` jokaiselle uudelle ja vanhalle jäännöslähteelle sekä `pieceCapacityAllowance = 1 mm` jokaiselle kappaleelle. Arvot ovat alustavia konservatiivisia oletuksia, eikä niitä ole kalibroitu laajalla tuotantodatalla.
- **Nykyinen vaikutus koodiin:** kerfin oletus on edelleen 3 mm ja laskenta käyttää lomakkeen kerf-arvoa. Lähteen nimellispituus ei muutu: 6000 mm lähteen turvallinen alkukapasiteetti on 5980 mm ja 1500 mm jäännöksen 1480 mm. Kappaleen nimellismitta ei muutu; 950 mm kappale käyttää ennen kerfiä 951 mm kapasiteettia.
- **Materiaalitase:** `nominalRemaining` on nimellisestä lähteestä nimellisten kappaleiden ja todellisen kerfin jälkeen laskettu loppupituus. `remaining` on turvallisesti uudelleenkäytettävä kapasiteettijäännös. Niiden erotus on `sourceCapacityAllowance + kappalemäärä × pieceCapacityAllowance`. Varausta ei raportoida kerf-hukkana eikä kirjata finalisoinnissa automaattisesti romuksi tai fyysiseksi jäännösriviksi.
- **Nollajäännös ja viimeinen kappale:** turvallinen `remaining` saa olla täsmälleen 0. Oletusvarojen vuoksi salossa on silloin silti nimellistä varattua päätä, joten scheduler tekee viimeisestä kappaleesta `cut`-operaation. `release` säilyy vain aidolle nimelliselle täsmäsovitukselle ilman kapasiteettivaroja.
- **Avoin kalibrointi:** 20 mm:n lähdevaraa ja 1 mm:n kappalevaraa pitää myöhemmin verrata mitattuihin uusiin tankoihin, jäännöksiin, ripustusreikiin, huonoihin päihin ja kappalekohtaisiin mittapoikkeamiin. Laskennan 0,1 mm:n resoluutio ei takaa tuotannon mittatarkkuutta.

## Uuden materiaalin saldot ja täydennys

### Raakalistan uuden työn oletukset (8.9.2026)

- **Luokitus:** käyttäjän vahvistama käyttöliittymäpäätös, tämän keskustelun selaintestipalautteen perusteella.
- **Päätös:** jokaiselle profiilille luodaan valmiiksi kaksi rajatonta materiaaliriviä: harmaa ja musta. Näin uuden työn käyttämättömät profiilit eivät jää ilman materiaaliväriä.
- **Vaikutus:** `createDefaultStockProfileRows()` käyttää harmaata oletusriviä ja mustaa tavallista lisäriviä. Tallennetut saatavuudet säilyvät ennallaan; rajattomuus on laskentaoletus, ei fyysisen saldon vahvistus.

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

- **Prioriteettipäätös 2026-09-07:** käyttäjä nosti nippusahauksen ja tilausten putkituksen kehitysjärjestyksessä ylemmäs. Materiaali säilyy ensisijaisena. Putkituksen tarkka työnkulku ja tavoitemittari rajataan ennen toteutusta; sitä ei oleteta automaattisesti rolling-horizon-yhteisoptimoinniksi.

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

### U-listojen ja kiskojen oletuskappalemäärä

- **Luokitus:** käyttäjän päättämä tuleva UI-muutos.
- **Lähde ja päivämäärä:** käyttäjän projektimuistiinpanot, 2026-09-07.
- **Toteutettu 2026-09-07:** uusia U-profiilin mittarivejä lisättäessä oletusmäärä on 2. `getDefaultOrderQuantity()` määrittää oletuksen myös tyhjän rivin tunnistukselle.
- **Käyttäjän vahvistama tuotantofakta, 2026-09-07:** U-profiili asennetaan oviaukon molemmille pystysivuille, joten sitä sahataan aina parillisina määrinä. Oletusmäärä 2 tarkoittaa kahta U-profiilin kappaletta; määrää ei puoliteta adapterissa kuten yhteisessä kiskosyötössä.
- **Avoin vaikutus validointiin:** oletusmäärä 2 on päätetty. Parittomien U-profiilimäärien mahdollinen estäminen rajataan erikseen ennen toteutusta; tuotantohavainto ei yksin muuta nykyistä core-validointia tai testitapausten kysyntää.
- **Käyttäjän tarkennus 2026-09-07:** yhteisen ”Ala- ja yläkisko” -rivin ”Määrä (kpl)” tarkoittaa kiskojen yhteiskappalemäärää. Oletusarvo 2 tarkoittaa 1 alakiskoa ja 1 yläkiskoa; 4 tarkoittaa 2 alakiskoa ja 2 yläkiskoa. Kiskot sahataan aina pareittain. Tämä oikaisee aiemman virheellisen tulkinnan kahdesta kappaleesta kumpaakin profiilia.
- **Nykyinen vaikutus koodiin (8.9.2026):** U-profiilin ja kiskojen oletus on 2. Kiskojen yhteismäärä puolitetaan profiileille ja vaaditaan positiiviseksi parilliseksi kokonaisluvuksi. Skeeman 4 kiskomäärät kaksinkertaistetaan palautuksessa skeemaan 5 fyysisen kysynnän säilyttämiseksi. Moottoriversio ei muutu.
- **Varmistus:** U-profiilin oletus, adapterin tyhjät ja täytetyt rivit sekä tallennetun suunnitelman validointi katetaan regressioilla. Selaimen palautusta ja lisäyspainiketta ei voitu testata: käytettävissä oleva selain esti paikallisen tiedostosivun avaamisen.
- **Määrän uusi merkitys toteutettu:** adapteri, otsikon yhteismäärä, fixture-muunnos ja regressiot käyttävät yhteismäärää. Vanhan tallenteen materiaaliratkaisu ja kuittaukset validoidaan migraation jälkeen.

### Tuotantokohdistus ja batchit (päivitetty 8.9.2026)

- **Luokitus:** käyttäjän vahvistama tuotantomallin päätös; lähde: toteutustehtävä 8.9.2026.
- Batch selectorissa tilaus on jakamaton yksikkö: kaikki tilauksen kappaleet kuuluvat samaan batchiin. Batchin sisällä material optimizer saa käsitellä kappaleita yksittäin ja yhdistellä eri tilausten kappaleita.
- Rajat ovat asetuksia: min 200, pehmeä tavoite 250, max 300. Yksittäinen suurempi tilaus on sallittu yksin oversized-batchina.
- Ainoa aktiivinen objective on nykyinen materiaalipiste. Nippusahaus on schedulerin aktiivinen execution-ominaisuus, eikä sen hyötyä tai mittavasteen siirtoja pisteytetä.
- Profiilikohtaiset alustavat nippukapasiteetit: U/Pysty/Vaaka 4, Ylä-/Alakisko 2. **Avoin tuotantotieto:** Vasteelle ei annettu kapasiteettia; toteutuksen varovainen oletus on 1, ei vahvistettu konekapasiteetti.
- Valinnainen mittarivin `openingId` säilyy syötteessä, tallennuksessa ja kappalekohtaisessa operaatiotuloksessa yhdessä `orderId`:n kanssa. Puuttuvaa aukkotunnistetta ei päätellä. Eri aukot syötetään eri riveille.
- Saman ajon jäännösten käyttö muodostaa eksplisiittiset operaatiodependencyt. Vanha syötetty jäännösvarasto säilyy erillisenä materiaalilähteenä.
- Continuous-/rolling-/span-/age-plannerit, anti-starvation ja tuotantoaikakustannukset ovat myöhempää mahdollista kehitystä. Toteutuksen täsmällinen malli, testit ja rajaukset: `BATCH_AND_BUNDLE_SAWING_PLANNING.md`.

### Fyysisen salon tunnistus ja poikkeama suunnitelmasta (9.9.2026)

- **Lähde ja varmuus:** käyttäjän suora havainto todellisesta työstä. Työssä oli 25 sahausliikettä ja 64 kappaletta. Kolmanteen liikkeeseen suunniteltiin salonumerot 1, 2, 7 ja 4, mutta käytännössä sahalle otettiin salot 1, 2, 3 ja 4.
- **Tuotantotarve:** työntekijän pitää voida merkitä fyysiset salot helposti ennen sahausta ja nähdä nykyisessä työvaiheessa suuret, yksiselitteiset salonumerot. Saman fyysisen salon jatkoleikkauksen ja saman ajon jäännöksen pitää säilyttää sama numero.
- **Toteutettu vaikutus:** worker-numero johdetaan materiaaliplanin vakaasta `bars`-järjestyksestä erikseen jokaiselle profiilityypille. Valmistelunäkymä, profiiliblokkeihin etenevä scheduler ja järjestetty toteumaloki lisättiin muuttamatta materiaaliratkaisua. Nykyinen toteumaloki hyväksyy vielä vain suunnitellut lähteet.
- **Avoin vaikutus:** väärän salon toteuman kirjaaminen, siitä seuraavan materiaalitaseen laskenta ja mahdollinen osittainen uudelleenoptimointi ovat erillinen seuraava vaihe. Alkuperäinen suunnitelma pitää säilyttää vertailtavana eikä poikkeamaa saa korjata vain vaihtamalla lähde-ID:tä ilman fysiikan validointia.

### Profiiliblokit ja batchin fyysinen työkuorma (9.9.2026)

- **Lähde ja varmuus:** käyttäjän oikeasta sahaustyöstä tekemä tuotantotarkennus. Noin 250 kappaleen batch voi vaatia niin monta uutta salkoa, etteivät koko batchin materiaalit mahdu yhtä aikaa sahan ympärille.
- **Työprosessi:** sahalle tuodaan yhden profiiliblokin salot, ne numeroidaan ja sahataan, kappaleet kelmutetaan tai käsitellään aukkokohtaisesti ja siirretään pois ennen seuraavaa profiilia. Oletusjärjestys on Pysty, Vaste, Vaaka, U ja yhteinen ala-/yläkiskoblokki.
- **Numerointi:** worker-numero alkaa jokaisessa fyysisessä profiilityypissä yhdestä. Se on suunnitelmasta johdettu merkintä, ei materiaalin sisäinen identiteetti. Kiskoblokissa Ala 1 ja Ylä 1 erotetaan profiilinimellä.
- **Tuleva arviointitarve:** sama kappalemäärä voi merkitä hyvin erilaista kuormaa; esimerkiksi pitkät Pystyt vievät eri tavalla tilaa ja käsittelyaikaa kuin lyhyet Vaa'at. Mahdollinen workload-aware batch sizing voi myöhemmin huomioida kappalemäärän, kokonaismetrit, profiilityypin, tilantarpeen ja jälkikäsittelyn. Täsmällistä kaavaa tai uusia rajoja ei ole päätetty.
- **Nykyinen rajaus:** batchin min/tavoite/max pysyvät arvoissa 200/250/300 ja valintalogiikka ennallaan.

## Uuden merkinnän malli

```md
### Aihe

- **Luokitus:** vahvistettu fakta | karkea arvio | avoin kysymys
- **Havainto:** ...
- **Lähde ja päivämäärä:** ...
- **Nykyinen vaikutus koodiin:** ei vaikutusta | nykyinen asetus/funktio
- **Ennen toteutusta selvitettävä:** ...
```

### Sahausliikkeen, mittavasteen ja minimierän tarkennus (8.9.2026)

- **Luokitus:** käyttäjän vahvistama tuotantokuvaus ja batch-valinnan päätös; lähde: tämän keskustelun selaintestipalaute.
- **Sahausliike:** saha käynnistetään ja terä lasketaan käsin alas, jolloin terä suorittaa leikkuun. Nippu voi tuottaa monta kappaletta yhdellä sahausliikkeellä.
- **Mittavasteen siirto:** käyttäjä siirtää mittavasteen seuraavan sahausliikkeen mittaan. Batchin ensimmäinen asetus lasketaan mukaan, samoin jokainen myöhempi sahausmitan muutos. Saman mitan toistaminen ei lisää siirtoa.
- **Batchin minimi:** estää pienen osajoukon valinnan suuresta jonosta. Jos koko avoimessa jonossa on alle minimin kappaleita, kaikki tilaukset valitaan samaan batchiin; yksittäisiä halvempia tilauksia ei poimita siitä erikseen.
- **Vaikutus koodiin:** `schedule()` laskee ensiasetuksen mukaan `stopPositionChanges`-mittariin. `selectBatch()` arvioi lyhyen jonon kokonaan; vähintään minimikokoisesta jonosta se ei valitse alikokoista erää. Materiaalin puute ei oikeuta osittaista valmisratkaisua. Materiaalipisteytys ei muutu.
- **Käyttäjän vahvistama testihavainto:** testin 2 materiaalitulos ja raakalistan rajattomat harmaa/musta-oletukset toimivat oikein. Vahvistus ei koske kaikkia aiemman selaintestilistan kohtia.

### Aukkokohtainen kiskonippu (8.9.2026)

- **Lähde ja varmuus:** käyttäjän tämän tehtävän nimenomainen tuotantosääntö: kaksi kiskoa kelmutetaan ja nimetään heti aukon pariksi.
- **Toteutettu vaikutus:** saman tilauksen nimetyn aukon 1 ala + 1 ylä sahataan mahdollisuuksien mukaan samalla liikkeellä. Neljästä kokonaiskappaleesta alkaen profiilit niputetaan erikseen. Saman aukon samanmittaisia valmiita operaatioita suositaan peräkkäin.
- **Rajaus:** puuttuva aukkotunnus ei oikeuta arvaamaan pareja. Lähteiden riippuvuudet, release-poiminnat ja profiilien kapasiteetit voivat estää yhteisen sahausliikkeen. Tuotantomittareita ei lisätä materiaalipisteytykseen.

### Erilliset laskenta-ajan tavoitteet (8.9.2026)

- **Lähde ja varmuus:** käyttäjän tämän tutkimustehtävän nimenomainen käyttövaatimus, ei väite jo saavutetusta vasteajasta kaikilla syötteillä.
- **Käsin valittu batch:** 2–5 tilauksen normaalin materiaaliratkaisun, schedulerin ja sahaussuunnitelman pitää valmistua sekuntien suuruusluokassa. Automaattisen selectorin parantaminen ei saa hidastaa tätä polkua merkittävästi.
- **Automaattinen batch-haku:** minuutit, kymmenet minuutit tai tarvittaessa tunnit ovat hyväksyttäviä, jos lisäaika tuottaa mitattavasti hyödyllisemmän materiaaliratkaisun. Oletusbudjettia ei päätetä ennen laatukäyrämittauksia.
- **Vaikutus koodiin:** vain erillinen Node-tutkimus tässä vaiheessa. Materiaalipisteytys säilyy; työaikaa, nippuja tai mittavasteen siirtoja ei lisätä pisteisiin. Ensimmäiset mittaukset ja niiden rajaukset ovat `benchmarks/batch-search/RESULTS.md`:ssä.

### Jäännösvaraston kokoluokka tutkimuksessa (8.9.2026)

- **Lähde ja varmuus:** käyttäjän karkea arvio nykyisestä tuotannosta: yhteensä noin 100 käyttökelpoista jäännöstä. Profiilijakauma ei ole tasainen; tarkkoja saldoja, värejä tai pituuksia ei ole annettu.
- **Vaikutus:** erillisen Node-benchmarkin synteettinen varasto johdetaan 23 tilauksen kysynnästä (tilaus 16 jätetään pois) ja nykyisellä sahausfysiikalla syntyvistä säästettävistä jäännöksistä. Simuloitu jakauma ei ole havaittu varastosaldo eikä automaattisesti sovelluksen oletus.
- **Avoin kysymys:** todellinen jäännösten säilytys- ja uudelleenkäyttökierto voi muuttaa etenkin pituusjakaumaa; tuotantokelpoisuus pitää myöhemmin tarkistaa oikealla inventaariolla.

### Jäännösten säilytyskäytäntö ja historiallinen replay (9.9.2026)

- **Lähde ja varmuus:** käyttäjän ilmoittama nykyinen käytäntö: U-, Pysty- ja Vaste-profiilien säilytysraja 1000 mm, Vaaka 500 mm ja molemmat kiskot 800 mm. Rajojen optimaalisuutta ei ole vahvistettu.
- **Tutkimusta koskeva päätös:** käyttäjä vahvisti, että rajan mittainen tai pidempi loppupala säästetään simulaatiossa myös silloin, kun nykyinen score luokittelee sen romuksi. Suunnitelma lasketaan ja pisteytetään ensin muuttumattomalla production-koodilla; fyysinen säilytyssääntö on tutkimuksen erillinen varastopäivitys.
- **Aineiston tulkinta:** käyttäjän mukaan 24 tilauksen otos vaikuttaa normaalilta tuotannolta. Tilaus 24 on vanhin (27.7.2026), tilaus 1 uusin (7.9.2026); saapumisjärjestys on 24 → 1. Nykyinen kelvollinen benchmark-fixture sisältää 23 tilausta, koska tilaus 16 / RR32 on jätetty pois.
- **Vaikutus ja rajaus:** production-scorea, varastopäivitystä tai käyttöliittymää ei muutettu. Tulokset, jäljitettävät jäännökset ja otoksen rajaukset ovat `benchmarks/batch-search/flow-replay/RESULTS.md`:ssä. Säilytysrajoja tai score-kertoimia ei kalibroida tämän otoksen perusteella.
- **Fyysisen varaston reality check:** käyttäjän havainto 9.9.2026: varastossa on noin 100 palaa, suurin osa noin 1300–1800 mm ja enintään noin kolme yli 2000 mm. Pitkät käyttökelpoiset palat käytetään melko nopeasti, jos kysyntää löytyy. Replayhin jäi 34 vähintään 3000 mm palaa, joten sen kappalemäärä on mahdollinen mutta pituusjakauma ja kokonaismetrit eivät kuvaa nykyistä fyysistä varastoa.
- **Tulkinta:** pitkien palojen ero voi liittyä scoreen, tutkimuksen scoresta erilliseen säilytyspolitiikkaan, simuloituun kysyntä-/batch-virtaan tai niiden yhdistelmään. Se ei osoita scorea väärin kalibroiduksi. A/B/C-varastot säilyvät stressi- ja algoritmitesteinä.

### Työkalun rooli tuotannossa (9.9.2026)

- **Lähde ja varmuus:** käyttäjän projektirajaus. Profiilituotanto on nuorta ja tuotantorytmiin vaikuttavat muun tuotannon tarpeet, koneviat, materiaalisaatavuus ja vaihteleva tilaustilanne.
- **Tavoite:** sovellus on helppokäyttöinen ja joustava sahaus- ja päätöksentekotyökalu, jota kokenut työnjohtaja tai työntekijä käyttää senhetkisen tilanteen mukaan. Tavoite ei ole koko tehtaan pitkän aikavälin automaattinen tuotannonohjaus.
- **Rajaus:** nykyiset tuotantokäytännöt ovat baselineja, eivät automaattisesti optimaalisia sääntöjä. Niitä voidaan muuttaa erikseen validoidun paremman käytännön perusteella.
