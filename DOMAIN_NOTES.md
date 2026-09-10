# Tuotantohavainnot ja avoimet kysymykset

Tämä on todellisesta tuotannosta saatujen tietojen kanoninen muistio. **Vahvistettu fakta** kuvaa käyttäjän kertomaa käytäntöä tai nimenomaista päätöstä; **karkea arvio** vaatii mittausta/kalibrointia; **avoin kysymys** vaatii lisätietoa. Havainto ei yksin anna lupaa muuttaa koodia eikä nykyinen käytäntö ole automaattisesti optimaalinen.

Aktiivisen koodin säännöt ovat [materiaalimallissa](docs/domain/MATERIAL.md) ja [tuotantomallissa](docs/domain/PRODUCTION.md). Ohjelman sisäiset rakenteet ja versiot ovat [arkkitehtuurissa](docs/ARCHITECTURE.md). Alla kuvataan perusteet ja epävarmuudet, ei rinnakkaista toteutusspesifikaatiota.

## Työkalun rooli ja fyysinen työprosessi

- **Vahvistettu projektirajaus, käyttäjä 9.9.2026:** profiilituotanto on nuorta. Muun tuotannon tarpeet, koneviat, materiaalisaatavuus ja vaihteleva tilaustilanne muuttavat rytmiä. Sovellus on joustava sahaus- ja päätöksentekotyökalu kokeneelle työnjohtajalle/työntekijälle, ei koko tehtaan pitkän aikavälin automaattinen tuotannonohjaus.
- **Tuotantohavainto, kirjattu viimeistään 7.9.2026:** Pysty ja Vaaka kannattaa sahata aikaisin ja lähekkäin kokoonpanon aloittamiseksi. U-listoja tarvitaan vasta asennuksessa ja ne voidaan tehdä myöhemmin. Ala- ja yläkisko pakataan saman aukon mukaan. Tilauksessa voi olla useita aukkoja; neljää ovea per aukko ei saa olettaa.
- **Prioriteettipäätös, käyttäjä 7.9.2026:** nippusahaus ja tilausten yhteinen käsittely nostettiin kehitysjärjestyksessä ylemmäs, materiaali edellä. Putkitus ei tarkoita automaattisesti rolling-horizon-yhteisoptimointia.
- **Työprosessi, käyttäjän oikea sahaustyö 9.9.2026:** koko noin 250 kappaleen batchin materiaalit eivät välttämättä mahdu sahan ympärille. Yhden profiiliblokin salot tuodaan, numeroidaan, sahataan ja kappaleet kelmutetaan/käsitellään aukoittain ja siirretään pois ennen seuraavaa profiilia. Päätetty järjestys on Pysty, Vaste, Vaaka, U ja yhteinen kiskoblokki; aktiivinen sääntö on tuotantomallissa.
- **Nimenomainen päätös, käyttäjä 10.9.2026:** ohjelma näyttää koko aktiivisen profiiliblokin materiaalitarpeen; operaattori päättää itse kantomäärät ja varastoreissut. Tästä ei johdeta kanto-, scheduler- tai score-optimointia.
- **Avoin arviointitarve, 9.9.2026:** 250 pitkää Pystyä ja 250 lyhyttä Vaakaa kuormittavat tilaa ja käsittelyä eri tavalla. Mahdollinen workload-aware batch sizing voisi huomioida metrit, profiilin, tilantarpeen ja jälkikäsittelyn. Kaavaa tai uusia rajoja ei ole päätetty; [B-010](BACKLOG.md).

## Sahausliike, mittavaste ja niput

**Käyttäjän tarkennus selaintestipalautteessa 8.9.2026:** sahausliikkeessä saha käynnistetään ja terä lasketaan käsin leikkuuseen. Mittavaste siirretään ensin ensimmäisen kappaleen mittaan ja uudelleen mitan vaihtuessa. Nippu tuottaa yhdellä liikkeellä monta kappaletta. Käytä termiä **mittavaste** aiemman stopparin/stopperin sijaan.

**Tuotantohavainto:** nippu voi muuttua leikkausten välillä; uudet salot, jäännökset ja värit voivat sekoittua vain turvallisesti yhteensopivina. Vanha yleinen ”4 tai 6” oli karkea havainto, ei kaikkien profiilien yhteinen kapasiteetti. Käyttäjän 8.9.2026 profiilikohtaiset alustavat nippupäätökset on kirjattu aktiiviseen tuotantomalliin. **Avoin tieto:** Vasteprofiilin todellista nippukapasiteettia ei ole vahvistettu; toteutuksen varovainen oletus ei ole konekapasiteetin mittaus.

**Käyttäjän aukkoparisääntö 8.9.2026:** kun aukossa on yksi ala- ja yksi yläkisko, ne kelmutetaan ja nimetään heti pariksi ja kannattaa sahata yhdessä. Neljästä yhteiskappaleesta alkaen profiilit niputetaan erikseen; saman aukon samaa mittaa kannattaa tehdä peräkkäin. Tarkat valmius- ja yhteensopivuusehdot ovat tuotantomallissa.

## Tilauksen ja fyysisen salon jäljitettävyys

**Vahvistettu tuotantokuvaus, käyttäjän muistio 6.9.2026:** tilaus on käytännössä yhtä väriä ja tavallisesti tarvitsee kaikkia profiileja. Tämä ei tarkoita, että vain joitakin profiileja sisältävä tilaus pitäisi hylätä. Ylä- ja alakiskoilla on samat mitat ja määrät.

**Käyttäjän tarkennus 7.9.2026:** yhteisen kiskorivin kappalemäärä tarkoittaa fyysistä yhteismäärää, esimerkiksi 2 = yksi ala + yksi ylä. Tämä korjaa vanhan kaksinkertaisen tulkinnan. U-profiili tulee aukon molemmille pystysivuille ja sitä tehdään käytännössä parillisina määrinä. U:n oletusmäärä 2 on päätetty, mutta **parittomien U-määrien estämisestä ei ole päätöstä**. Nykyisen syötteen ja migraation toteutus kuvataan aktiivisissa dokumenteissa.

**Fyysisen salon poikkeama, käyttäjä 9.9.2026:** työssä oli 25 sahausliikettä ja 64 kappaletta. Kolmanteen liikkeeseen suunniteltiin salot 1, 2, 7 ja 4, mutta sahalle otettiin 1, 2, 3 ja 4. Tarvitaan helposti merkittävät, yksiselitteiset numerot; saman salon jatkoleikkauksen on säilytettävä numero. Worker-numerointi on toteutettu, mutta toteutuneen väärän lähteen käsittely on [B-009](BACKLOG.md). Alkuperäinen suunnitelma tulee säilyttää vertailtavana; pelkkä ID:n vaihto ei selvitä fyysisiä seurauksia.

**Sanasto, käyttäjän demopäätös:** fyysisestä alumiiniprofiilin materiaalilähteestä käytetään käyttäjän näkyvässä tekstissä sanaa salko. Tekniset bar/source-nimet eivät vaadi uudelleennimeämistä. Aktiivinen sanastosopimus on materiaalimallissa.

## Raakasalon ominaisuudet ja mittatoleranssi

**Vahvistettu tuotantohavainto, aiemmat käyttäjän muistiinpanot:** uuden salon tavallinen pituus on 6000 mm. Toisessa päässä on noin 8 mm ripustusreikä. Ehjä pää asetetaan vasemmalle mittavastetta vasten, reiällinen/huonompi pää oikealle. Avatut salot halutaan käyttää tehokkaasti ilman tarpeetonta jäännösvaraston kasvua.

**Käyttäjän muistio 6.9.2026:** positiiviset mittavirheet voivat kasautua: viiden kappaleen +0,5 mm tekee yhteensä +2,5 mm. Nimellinen nolla- tai lähes nollajäännös voi jättää viimeisen kappaleen vajaaksi. Muutama millimetri lisähukkaa on parempi kuin liian lyhyt kappale.

**Likimääräinen havainto:** hyväksyttävä toleranssi on noin ±1 mm, vaikka pyritään tarkempaan; todellinen terä noin 3,4 mm. Soveltamisala ja mitattu vaihtelu ovat avoimia. Tämä ei ole uusi aktiivinen kerf-oletus. 0,1 mm:n laskentaresoluutio ei takaa fyysistä mittatarkkuutta.

**Päätös 10.9.2026:** yhteiset lähde- ja kappalevarat otettiin käyttöön alustavina konservatiivisina oletuksina. Aktiiviset luvut, soveltuminen uusiin/jäännöslähteisiin ja nimellisen/turvallisen pituuden ero ovat vain [MATERIAL.md](docs/domain/MATERIAL.md):ssä.

**Avoin kalibrointi:** vertaa varoja mitattuihin uusiin salkoihin, vanhoihin jäännöksiin, ripustusreikiin, huonoihin päihin ja kappalekohtaisiin poikkeamiin. Laaja tuotantodata puuttuu. Kerf, lähdevara ja kappalevara pidetään erillisinä; fyysistä turvallisuutta ei todisteta vain testien läpäisyllä.

## Uuden materiaalin saldot, hälytykset ja vastaanotto

**Käyttäjän käyttötarve 6.9.2026:** runsaan varaston tarkkaa määrää ei tarvitse näyttää jatkuvasti. Vähäinen saldo on tärkeä täydennykselle. Todelliset saldot halutaan profiilin ja värin mukaan; rajaton saatavuus ei ole tunnettu saldo.

**Käyttöliittymäpäätös 8.9.2026:** uuden työn jokaiselle profiilille valmiiksi rajaton harmaa ja musta, jotta käyttämätön profiili ei vaadi värin valintaa ennen laskentaa. Tämä on prototyypin lähtöoletus, ei inventaario. Aktiivinen oletus-/lisärivisopimus on materiaalimallissa.

**Alustava, toteuttamaton hälytysmalli:** tilausraja 50 ja kriittinen raja 10 uutta salkoa per variantti. Nämä ovat logistisia kokeilurajoja, eivät optimeja tai score-asetuksia.

| Todellinen saldo | Ehdotettu tila |
| --- | --- |
| Yli 50 | Normaali |
| 11–50 | Tilaa lisää |
| 1–10 | Kriittisen vähän |
| 0 | Loppu |

34 salon hälytys ei vähennä optimizerin saatavuutta: käytettävissä on edelleen 34. Ennen toteutusta päätetään oikeiden alkusaldojen kirjaaminen ja tuntemattoman/rajattoman saldon näyttäminen. Raja voi myöhemmin olla profiili-/värikohtainen ja riippua kulutuksesta, toimitusajasta ja turvavarastosta.

**Tuleva vastaanottotarve:** lisätään saapunut määrä oikean variantin saldoon, esimerkiksi 7 + 100 = 107. Virheellinen syöte tai tallennusvirhe ei saa jättää osittaista muutosta. Avoimen suunnitelman käsittely on rajattava toteutuksessa. Ensimmäinen vastaanotto ei tarvitse varastotapahtumahistoriaa. Hälytyksiä ja vastaanottoa ei ole vielä toteutettu.

## Jäännökset ja niiden kierto

**Vahvistettu fakta, käyttäjä 6.9.2026:** esimerkiksi viisi harmaata 1600 mm Pysty-jäännöstä ovat keskenään samanarvoisia. Fyysisen varaston pysyvä yksilö-ID ei tuo tähän tarpeellista eroa. Kesken työn eri pituisiksi sahatut tai eri jatkoleikkauksia odottavat lähteet täytyy silti erottaa. Tulevien attribuuttien vaikutus vaihtokelpoisuuteen on avoin.

**Havainto 7.9.2026:** vanha fyysinen jäännösvarasto voi olla epätarkka; saman ajon välijäännökset tunnetaan laskennallisesti paremmin. Tämä ei anna lupaa keksiä saldoa tai ohittaa syötettyä varastoa.

**Karkea kokoluokka, käyttäjä 8.9.2026:** yhteensä noin 100 käyttökelpoista jäännöstä, epätasainen profiilijakauma. **Tarkennus 9.9.2026:** suurin osa noin 1300–1800 mm, enintään noin kolme yli 2000 mm. Pitkät palat käytetään melko nopeasti, jos kysyntää löytyy. Täydellisiä profiili-/väri-/pituussaldoja ei ole mitattu.

**Nykyinen fyysinen säilytyskäytäntö, käyttäjä 9.9.2026:** U/Pysty/Vaste vähintään 1000 mm, Vaaka 500 mm, ylä-/alakisko 800 mm. Rajojen optimaalisuutta ei ole vahvistettu. Ne eivät ole productionin disposition-algoritmi.

**Tutkimukseen rajattu päätös:** replay säästi rajan mittaisen tai pidemmän palan myös scoren luokitellessa sen romuksi. Suunnitelma pisteytettiin ensin muuttamattomasti ja fyysinen varastopolitiikka sovellettiin erikseen. Aineiston 24 tilausta vaikutti käyttäjästä normaalilta tuotannolta: 24 vanhin (27.7.2026), 1 uusin (7.9.2026). Benchmarkin 23 tilauksesta puuttuu käyttäjän pyynnöstä kokonaan 16/RR32. Raportti: [historiallinen replay](benchmarks/batch-search/flow-replay/RESULTS.md).

Replayn pitkien palojen kertymä poikkesi fyysisestä havainnosta. Se voi johtua scoresta, erillisestä säilytyspolitiikasta, kysyntä-/batch-virrasta tai yhdistelmästä; se ei yksin osoita scorea vääräksi. A/B/C-varastot ovat stressitestejä, eivät normaalin inventaarion malleja. Tutkimus suljettiin tältä erää; myöhempi reality check ja laajempi aineisto kuuluvat [B-008](BACKLOG.md):aan.

**Avoin arvomalli:** jäännöksen tuleva hyöty voi riippua profiilista, väristä, pituudesta, määrästä, iästä ja kausikysynnästä. Pitkä pala voi olla useaa lyhyttä joustavampi; koskematon uusi salko on edelleen joustavampi kuin pirstottu samanpituinen materiaali. `ordersSinceUse` on mahdollinen tuleva ikätieto, ei nykyinen kenttä. Terminal inventory value tarvitsee kysyntä- ja tuotantohistoriaa.

## Materiaalin arvo ja työaika

**Romualumiini, karkea arvio käyttäjältä 3.9.2026:** käyttökelvottomat palat myydään ja arvo on noin 10 % vastaavan uuden materiaalin arvosta. Aktiivinen score-checkpoint on materiaalidokumentissa. Arvio ei ole sidottu toteutuneisiin euroihin, kilogrammoihin, profiilimassoihin tai ajantasaiseen hintaan eikä osoita sahauslastun hyvitystä.

Ennen kalibrointia selvitä profiili-/seoskohtaiset suhteet, hyvityksen yksikkö, lastujen hyvitys, lajittelun/säilytyksen/kuljetuksen kulut ja osto-/romuhintojen vaihtelu.

**Aiempi karkea vertailu:** metri hukkaprofiilia vastaa noin puolen tunnin palkkaa. **Käyttäjän tarkennukset 7.9.2026:** mittavasteen siirto ehkä 10 s, palkka 12 €/h, keskimääräinen materiaali 7 €/m. Johdettu vertailu: 10 s × 12 €/h / 3600 ≈ 0,0333 € eli noin 4,8 mm profiilia; yksi metri vastaa noin 35 minuutin palkkaa. Palkka ei tarkoita työnantajan kokonaiskustannusta ja profiili-/värikohtaiset hinnat puuttuvat.

Materiaali säilyy ensisijaisena. Työaika voidaan myöhemmin huomioida eriteltynä, vertailukelpoiseen yksikköön muunnettuna kustannuksena. Ajan vaihtelu ja kustannuksen soveltamisala pitää ensin selvittää. Euroja ei lisätä sellaisenaan nykyiseen ekvivalenttipituuspisteeseen.

## Laskenta-ajan käyttötavoitteet

**Nimenomainen käyttäjävaatimus 8.9.2026, ei mitattu palvelulupaus:** käsin valitun 2–5 tilauksen normaalin materiaaliratkaisun, schedulerin ja suunnitelman pitäisi valmistua sekuntien suuruusluokassa. Automaattinen suuren jonon haku saa käyttää minuutteja, kymmeniä minuutteja tai tarvittaessa tunteja, jos lisäaika tuottaa mitattavaa materiaalihyötyä. Oletusbudjetista ei päätetä yhden laatukäyrän perusteella. Nykyiset rajoitteet ovat backlogissa, mittaukset [benchmark-hakemistossa](benchmarks/batch-search/README.md).

## Uuden havainnon kirjaaminen

Kirjaa aihe, luokitus, havainto, käyttäjä/muu lähde ja päivämäärä, mahdollinen aktiiviseen domain-dokumenttiin osoittava linkki sekä ennen toteutusta selvitettävä asia. Erota käyttäjän päätös, mitattu fakta, johdettu arvio ja avoin kysymys toisistaan. Älä kopioi toteutuksen koko teknistä kuvausta tähän.
