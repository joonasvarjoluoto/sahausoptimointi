# Jäännösvaraston vaikutus batch-hakuun — 8.9.2026

Keskeinen löydös on yksittäisen materiaalilaskennan tarkka nopeutus Node-koeversiossa: tyhjien DP-tilojen ohittaminen säilytti vertailusuunnitelmat, ja neljä valittua 2–5 tilauksen perusbatchia valmistuivat kaikissa kolmessa jäännösvarastossa alle viidessä sekunnissa. Tämä ei ole yleinen vasteaikatakuu: haun suosimalle monimittaiselle kolmen tilauksen batchille on lisäksi erillinen vaikean tapauksen mittaus. Nykyinen production-toteutus ei vielä sisällä nopeutusta; sen suurimmat vertailut ylittivät 60 sekuntia.

Automaattisen haun parhaat löytymisajat A/B/C-varastoissa olivat 52.5 s / 19.2 s / 59.3 s. Alla erotetaan nämä laatukäyrät käsin valitun batchin nopeudesta, äärellisen varaston toteutuskelpoisuudesta ja syöttöjärjestyksen vaikutuksesta.

Tutkimus käyttää samaa 23 tilauksen, 79 aukon ja 1 231 kappaleen aineistoa. Tilaus 16 on kokonaan poissa. Batch-rajat ovat 200 / 250 / 300 kappaletta, kaikki tilaukset kokonaisia. Pisteet ovat nykyisen materiaalimallin ekvivalenttimillimetrejä, eivät euroja tai todistettuja optimeja. Production-koodi, pisteytys ja selainpolku eivät muutu.

## Varaston muodostus ja rajaukset

Neljä kierrosta aineiston 23 tilauksesta sahattiin yksittäin nykyisellä kevyellä inventory-optimizerilla, 6 000 mm uudella materiaalilla ja 3 mm kerfillä. Jokaisen mittarivin pituuteen lisättiin deterministinen ±30 mm poikkeama (0,1 mm tarkkuus, LCG-seed 230908). Kappalemäärät, profiilit, värit ja ala-/yläkiskon yhteinen mitta säilyivät. Jokainen valmis historiallinen suunnitelma validoitiin. Vain nykyisen dispositionin säästettävät palat hyväksyttiin.

92 historiallisesta tilauksesta syntyi 1036 käyttökelpoisen jäännöksen pooli. Varianttikiintiöt jaettiin 100 kappaleeseen poolin suhteilla ja suurimman jakojäännöksen menetelmällä. A on kiintiöiden sisäinen satunnaisotos (seed 90823); B valitsee lyhimmät ja C pisimmät. B ja C ovat tarkoituksella voimakkaita stressiskenaarioita, eivät väite tyypillisistä varastoista. Kaikissa profiili- ja värimäärät ovat samat. Pituuksia ei arvottu irrallaan sahauksesta.

Simulaatio ei mallinna varaston vanhenemista, aiempien jäännösten uudelleenkäyttöä tai ihmisen säilytysvalintaa. Siksi A on uskottava synteettinen otos samanlaisesta kysynnästä, ei rekonstruoitu todellinen inventaario. Neljän kierroksen otos ja pituushäiriö eivät poista sitä, että historiallinen ja tuleva kysyntä ovat samaa tuoteperhettä.

Kaikki mitatut varastot on kanonisoitu sovelluksen omalla createMaterialInventory-adapterilla: 100 fyysistä jäännöstä muodostaa A:ssa 98, B:ssä 83 ja C:ssä 93 variantti-/pituusriviä. Ensimmäiset yhdistämättömien rivien kokeet on eristetty superseded-unnormalized-hakemistoon, eivätkä ne kuulu tämän raportin tuloksiin.

| Profiili | Harmaa | Musta | Valkoinen | Yhteensä | Kysyntä kpl | Kysyntä m |
| --- | --- | --- | --- | --- | --- | --- |
| U-profiili | 5 | 13 | 2 | 20 | 168 | 372.8 |
| Pystyprofiili | 16 | 21 | 2 | 39 | 422 | 891.3 |
| Vasteprofiili | 3 | 3 | 1 | 7 | 26 | 56.9 |
| Vaakaprofiili | 4 | 3 | 1 | 8 | 451 | 406.6 |
| Yläkisko | 6 | 6 | 1 | 13 | 82 | 201.2 |
| Alakisko | 6 | 6 | 1 | 13 | 82 | 201.2 |

| Varasto | kpl | Yhteensä m | Min mm | Q25 | Mediaani | Q75 | Max |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 100 | 267.8 | 1085.3 | 1618.1 | 2087.4 | 3858.8 | 5447.8 |
| B | 100 | 140.3 | 1051.6 | 1178.1 | 1336.6 | 1538.0 | 3147.6 |
| C | 100 | 426.7 | 3590.8 | 3976.4 | 4082.2 | 4476.7 | 5447.8 |

## Mittausmenetelmä

Kaikki ajoitetut laskennat ajettiin peräkkäin samassa paikallisessa Node-ympäristössä. Materiaaliarvioinnin VM-aikaraja on 60 sekuntia tai jäljellä oleva kokonaisbudjetti. Rajan yli valmistunutta tulosta ei kirjata aiempaan checkpointiin. A/B/C ajettiin jatkuvina 600 sekunnin hakuina; F1/F2 ja neljä lisäpermutaatioita 120 sekunnin hakuina. Permutaatioiden vertailussa alkuperäisestä A-ajosta käytetään sen 120 sekunnin checkpointia. Käynnistys ja lähteiden lataus eivät sisälly aikaan, ehdokkaiden valmistelu sisältyy.

Kevyt haku: beamWidth 2 / patternsPerState 2 / candidatePoolSize 10. Tarkennus: nykyiset 20 / 10 / 50. Neljän kevyen arvion jälkeen tarkennetaan yksi paras vielä tarkentamaton valmis ehdokas. Välimuisti on ajokohtainen ja käyttää täsmällisiä materiaaliryhmän syötteitä. Scheduler ja validointi sisältyvät jokaiseen valmiiseen arvioon; ne eivät vaikuta pisteeseen. `not-found` ja `timeout` eivät ole mahdottomuustodistuksia.

Päätaulukoiden Node-ajot käyttävät tarkistettua sparsePatterns-koetta: findCandidatePatternsDP käsittelee vain saavutettuja kapasiteetteja, samassa laskevassa järjestyksessä kuin alkuperäinen. Tyhjien solujen ohittaminen ei muuta binäärisiä määrälohkoja, kuviokiintiötä, tasatilanteita tai cutPiece-tarkistusta. Kuviokohtainen erillinen välimuisti on pääajoissa pois päältä; materiaaliryhmävälimuisti on päällä kuten aiemmassa prototyypissä. candidatePoolSize ja maxExtraBars kulkevat asetuksissa, mutta nykyinen inventory-beam ei lue niitä.

Sparse-kokeen hyväksyntä: 1 354 alkuperäiseen funktioon verrattua kuviotapausta samoine järjestyksineen (mm. 0/3/3,4 mm kerf, 0,1 mm mitat, tarkat loppusovitukset, määrät ja kuviokiintiöt 1/2/10). Lisäksi 14 alkuperäisellä haulla valmistunutta kokonaista manuaalista suunnitelmaa pisteineen ja operaatioineen säilyi identtisenä. Kaksi C:n aikakatkaistua tapausta valmistui uudella toteutuksella; neljän tilauksen tapauksessa tulos vastasi myös alkuperäisen kuviovälimuistikokeen valmistunutta suunnitelmaa.

Koko JSON-raportin tavallinen tallennus tehdään valmistuneen arvion jälkeen, kun edellisestä tallennuksesta on kulunut vähintään 10 sekuntia. Parannus, uusi aikapistetieto ja lopetus tallennetaan heti. Yksittäisen synkronisen laskennan aikana tiedosto ei päivity. Näin nopeutunut haku ei kirjoita kasvavaa raporttia jokaisen arvioinnin jälkeen. Lopullinen tiedosto sisältää kaikki arviot. Kaikki ajoitetut batch-hakujen vertailut käyttävät samaa tallennusrytmiä.

## Laatu ajan funktiona

| Varasto | 10 s | 30 s | 60 s | 120 s | 300 s | 600 s |
| --- | --- | --- | --- | --- | --- | --- |
| A | 279283.7 | 279283.7 | 275865.0 | 275865.0 | 275865.0 | 275865.0 |
| B | 284097.3 | 280972.1 | 280972.1 | 280972.1 | 280972.1 | 280972.1 |
| C | 273471.8 | 273471.8 | 269497.6 | 269497.6 | 269497.6 | 269497.6 |
| F1 | 279283.7 | 279283.7 | 275865.0 | 275865.0 | — | — |
| F2 | 279283.7 | 279283.7 | 275865.0 | 275865.0 | — | — |

| Varasto | Paras piste | Tilaukset | Kpl | Uusia salkoja | Vanhoja käytetty | Kerf mm | Romu mm | Säästettäviä kpl / m | Löytyi s |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 275865.0 | 3, 9, 21 | 200 | 41 | 15 | 581.0 | 5063.4 | 15 / 32.1 | 52.5 |
| B | 280972.1 | 3, 9, 21 | 200 | 48 | 3 | 579.0 | 3863.8 | 12 / 27.3 | 19.2 |
| C | 269497.6 | 3, 9, 21 | 200 | 36 | 14 | 583.3 | 4735.8 | 7 / 14.7 | 59.3 |
| F1 | 275865.0 | 3, 9, 21 | 200 | 41 | 15 | 581.0 | 5063.4 | 15 / 32.1 | 49.2 |
| F2 | 275865.0 | 3, 9, 21 | 200 | 41 | 15 | 581.0 | 5063.4 | 15 / 32.1 | 45.5 |

Romu tarkoittaa tämän työn lähteiden loppupaloja, jotka nykyinen disposition romuttaa. Säästettävät ovat käytettyjen lähteiden loppujäännöksiä; taulukko ei laske käyttämättömiä varaston jäännöksiä uusiksi. Eri varastojen pisteitä ei pidä tulkita pelkäksi uuden materiaalin rahasäästöksi, koska myös käytettyjen vanhojen jäännösten lähdearvot eroavat.

| Varasto | Tutkitut batchit | Kevyt / full | Valmiit | Ei löytynyt | Aikakatkaisut | Viimeisestä parannuksesta s |
| --- | --- | --- | --- | --- | --- | --- |
| A | 224 | 224 / 56 | 277 | 0 | 3 | 547.5 |
| B | 540 | 540 / 135 | 674 | 0 | 1 | 580.8 |
| C | 244 | 244 / 61 | 302 | 0 | 3 | 540.8 |
| F1 | 20 | 20 / 5 | 11 | 13 | 1 | 70.8 |
| F2 | 20 | 20 / 5 | 11 | 13 | 1 | 74.6 |

## Parannushistoriat ja tasaantuminen

### A

| Aika s | Arvio | Piste | Tilaukset | Kpl | Uusia | Vanhoja | Romu mm | Jäännöksiä kpl / mm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5.99 | light | 279283.704 | 3, 9, 21 | 200 | 40 | 16 | 5087.1 | 17 / 34908.9 |
| 52.50 | full | 275865.033 | 3, 9, 21 | 200 | 41 | 15 | 5063.4 | 15 / 32103.6 |

Ajettu 600.0 s; viimeinen parannus 52.5 s; sen jälkeen 547.5 s ilman parannusta. Tämä on havaittu tasaantuminen tällä aloituksella, ei todiste optimista.

### B

| Aika s | Arvio | Piste | Tilaukset | Kpl | Uusia | Vanhoja | Romu mm | Jäännöksiä kpl / mm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.36 | light | 284097.291 | 3, 9, 21 | 200 | 48 | 3 | 4035.8 | 13 / 27120.7 |
| 19.23 | full | 280972.117 | 3, 9, 21 | 200 | 48 | 3 | 3863.8 | 12 / 27285.7 |

Ajettu 600.0 s; viimeinen parannus 19.2 s; sen jälkeen 580.8 s ilman parannusta. Tämä on havaittu tasaantuminen tällä aloituksella, ei todiste optimista.

### C

| Aika s | Arvio | Piste | Tilaukset | Kpl | Uusia | Vanhoja | Romu mm | Jäännöksiä kpl / mm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4.37 | light | 273471.773 | 3, 9, 21 | 200 | 36 | 16 | 3228.1 | 12 / 24351.5 |
| 59.26 | full | 269497.620 | 3, 9, 21 | 200 | 36 | 14 | 4735.8 | 7 / 14740.9 |

Ajettu 600.0 s; viimeinen parannus 59.3 s; sen jälkeen 540.8 s ilman parannusta. Tämä on havaittu tasaantuminen tällä aloituksella, ei todiste optimista.

### F1

| Aika s | Arvio | Piste | Tilaukset | Kpl | Uusia | Vanhoja | Romu mm | Jäännöksiä kpl / mm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.76 | light | 279283.704 | 3, 9, 21 | 200 | 40 | 16 | 5087.1 | 17 / 34908.9 |
| 49.25 | full | 275865.033 | 3, 9, 21 | 200 | 41 | 15 | 5063.4 | 15 / 32103.6 |

Ajettu 120.0 s; viimeinen parannus 49.2 s; sen jälkeen 70.8 s ilman parannusta. Tämä on havaittu tasaantuminen tällä aloituksella, ei todiste optimista.

### F2

| Aika s | Arvio | Piste | Tilaukset | Kpl | Uusia | Vanhoja | Romu mm | Jäännöksiä kpl / mm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.79 | light | 279283.704 | 3, 9, 21 | 200 | 40 | 16 | 5087.1 | 17 / 34908.9 |
| 45.46 | full | 275865.033 | 3, 9, 21 | 200 | 41 | 15 | 5063.4 | 15 / 32103.6 |

Ajettu 120.0 s; viimeinen parannus 45.5 s; sen jälkeen 74.6 s ilman parannusta. Tämä on havaittu tasaantuminen tällä aloituksella, ei todiste optimista.

30 ja 60 minuutin lisäajoja ei tehty: kaikissa kolmessa 600 sekunnin pääajossa paras oli löytynyt jo ennen 300 sekuntia eikä loppupuoli tuonut lisähyötyä. Tämä rajaa turhan pitkät kokeet tämän aineiston havaittuun tasaantumiseen; muiden jonojen oletusaikaa ei lukita.

## Äärellinen uusi materiaali

F1 ja F2 käyttävät A:n 100 jäännöstä. F1:n saldot ovat noin neljännes yhden historiallisen 23 tilauksen kierroksen uusista saloista, ylöspäin pyöristettynä + yksi varasalko per variantti. Jokainen saldo korotetaan tarvittaessa aiemmin validoidun tilausten 3, 9 ja 21 kokonaan uusista saloista tehtävän suunnitelman tarpeeseen. F2 käyttää tämän toteutuskelpoisuustodistajan tarkkoja määriä; muille varianteille jää neljänneksen historiallinen määrä. Molemmissa on siis ainakin yksi tunnettu fyysisesti mahdollinen kokonainen batch, mutta vaihtoehtojen saatavuus vaihtelee. Tämä on mitoitettu synteettinen saldo, ei oikean varaston mittaus.

| Variantti | F1 salkoa | F2 salkoa |
| --- | --- | --- |
| bottomRail|black | 7 | 6 |
| bottomRail|gray | 8 | 5 |
| bottomRail|white | 2 | 1 |
| closingProfile|black | 4 | 3 |
| closingProfile|gray | 4 | 2 |
| closingProfile|white | 2 | 1 |
| horizontalProfile|black | 10 | 9 |
| horizontalProfile|gray | 12 | 9 |
| horizontalProfile|white | 3 | 2 |
| topRail|black | 7 | 6 |
| topRail|gray | 8 | 5 |
| topRail|white | 2 | 1 |
| uProfile|black | 11 | 10 |
| uProfile|gray | 11 | 8 |
| uProfile|white | 3 | 2 |
| verticalProfile|black | 21 | 20 |
| verticalProfile|gray | 27 | 23 |
| verticalProfile|white | 4 | 3 |

120 sekunnin äärelliset ajot ovat erillinen saatavuuskoe, eivät 600 sekunnin plateau-todistus. Täydet 10 minuutin laatukäyrät mitattiin kolmella jäännöspituusskenaariolla.

Lisäkoe rajasi valitun batchin (3, 9, 21) kysytyt variantit täsmälleen aiemmin validoidun A-suunnitelman uusien salkojen tarpeeseen. Kaikki A:n vanhat jäännökset ja muiden värien saldot säilyivät. Tallennettu valmis suunnitelma toimii toteutuskelpoisuustodistajana; tätä tietoa ei syötetty optimizerille ratkaisuksi.

| Arvio | Tila | Piste | Uusia | Vanhoja | Aika s |
| --- | --- | --- | --- | --- | --- |
| light | complete | 279321.9 | 39 | 17 | 2.185 |
| full | complete | 275865.0 | 41 | 15 | 37.704 |

Äärellisten hakujen ensimmäisistä epäonnistuneista kevyistä ehdokkaista tarkennettiin erikseen 6 (enintään kolme per varasto). Näistä valmistui 0; 6 jäi tilaan not-found ja 0 aikakatkaistiin. Tämä otos ei todista jäljelle jääneiden ehdokkaiden mahdottomuutta.

| Varasto | Tilaukset | Normaalin haun tulos | Piste |
| --- | --- | --- | --- |
| F1 | 2, 3, 9, 20, 21 | not-found | — |
| F1 | 2, 3, 9 | not-found | — |
| F1 | 2, 3, 9, 11 | not-found | — |
| F2 | 2, 3, 9, 20, 21 | not-found | — |
| F2 | 2, 3, 9 | not-found | — |
| F2 | 2, 3, 9, 11 | not-found | — |

3 lisätarkennuksen tapaukselle löytyi myös riippumaton yhteispituuden vajetodistus (sahahukka sivuutetaan, joten vaje riittää mahdottomuuden toteamiseen). Muista not-found-tuloksista ei tehdä tätä päätelmää.

| Varasto / tilaukset | Variantti | Tarvitaan mm | Yhteensä saatavilla mm | Vaje mm |
| --- | --- | --- | --- | --- |
| F2 / 2, 3, 9, 20, 21 | verticalProfile / white | 27084.0 | 21894.9 | 5189.1 |
| F2 / 2, 3, 9 | verticalProfile / white | 27084.0 | 21894.9 | 5189.1 |
| F2 / 2, 3, 9, 11 | verticalProfile / white | 27084.0 | 21894.9 | 5189.1 |

## Tilausten syöttöjärjestys

LCG-permutaatioseed 1 tarkoittaa alkuperäistä järjestystä; seed 2–5 sekoittaa tilaukset. Hakustrategian oma satunnaissiemen on kaikissa sama 230916. Näin syöttöjärjestyksen vaikutusta ei sekoiteta hakusiemenen vaihtumiseen. Budjetti on kaikissa 120 sekuntia.

| Seed | Piste | Tilaukset | Kpl | Uusia | Vanhoja | Kerf mm | Romu mm | Säästettävä mm |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 275865.033 | 3, 9, 21 | 200 | 41 | 15 | 581.0 | 5063.4 | 32103.6 |
| 2 | 275022.586 | 9, 21, 3 | 200 | 40 | 17 | 578.8 | 4932.3 | 36144.0 |
| 3 | 275070.186 | 9, 3, 21 | 200 | 40 | 17 | 578.8 | 4932.3 | 36144.0 |
| 4 | 275359.086 | 21, 3, 9 | 200 | 40 | 17 | 580.8 | 5219.4 | 35854.9 |
| 5 | 275063.706 | 3, 21, 9 | 200 | 40 | 17 | 580.8 | 5058.3 | 36016.0 |

Best / median / worst: 275022.586 / 275070.186 / 275865.033. Worst-vs-best: 0.306 %. Valmis tulos 5/5 ajossa. Viisi järjestystä yhdellä varastolla on rajattu herkkyystesti, ei kattava satunnaistutkimus.

Sama batch samalla arviointitasolla löytyi vähintään kolmesta järjestyksestä 55 kertaa. Suurin tällaisen materiaalipisteen vaihtelu oli 1.047 %. Tämä erottaa materiaalihakijan järjestysherkkyyden ehdokkaiden valinnan vaikutuksesta. Nykyinen mergeGroupedCuts säilyttää mittojen ensiesiintymisjärjestyksen ja DP:n tasatilanteet vertaavat tämän järjestyksen määrävektoreita. Siksi mahdollinen ero ei automaattisesti johdu vain candidate generatorista.

| Sama batch / arvio | Seed | Piste | Uusia | Vanhoja |
| --- | --- | --- | --- | --- |
| 3, 9, 11, 19, 21 / light | 1 | 338199.482 | 52 | 16 |
| 9, 19, 21, 3, 11 / light | 2 | 337686.020 | 51 | 17 |
| 9, 19, 3, 11, 21 / light | 3 | 337814.846 | 51 | 17 |
| 21, 11, 3, 19, 9 / light | 4 | 338616.787 | 52 | 16 |
| 11, 3, 21, 9, 19 / light | 5 | 341222.266 | 52 | 16 |

## Käsin valitun batchin nopeus

| Varasto | Tilauksia | Kpl | Tulos | Koko laskenta s | Material s | Scheduler ms |
| --- | --- | --- | --- | --- | --- | --- |
| none | 2 | 88 | complete | 2.716 | 2.704 | 8 |
| none | 3 | 136 | complete | 4.208 | 4.198 | 6 |
| none | 4 | 200 | complete | 8.441 | 8.426 | 10 |
| none | 5 | 280 | complete | 12.109 | 12.080 | 23 |
| A | 2 | 88 | complete | 11.367 | 11.344 | 14 |
| A | 3 | 136 | complete | 24.779 | 24.753 | 9 |
| A | 4 | 200 | complete | 54.425 | 54.380 | 13 |
| A | 5 | 280 | complete | 49.634 | 49.591 | 22 |
| B | 2 | 88 | complete | 5.102 | 5.091 | 4 |
| B | 3 | 136 | complete | 7.075 | 7.058 | 7 |
| B | 4 | 200 | complete | 25.030 | 25.006 | 10 |
| B | 5 | 280 | complete | 29.094 | 29.052 | 22 |
| C | 2 | 88 | complete | 11.599 | 11.584 | 4 |
| C | 3 | 136 | complete | 17.367 | 17.339 | 10 |
| C | 4 | — | timeout | 60.018 | — | — |
| C | 5 | — | timeout | 60.018 | — | — |

Tuore runtime ilman välimuistia per mittaus, normaalit materiaalihaun asetukset. Kokonaisaika sisältää materiaalin, validoinnin, muuttumattomuustarkistuksen, UI-adapterin ja schedulerin. Sekuntien tavoitetta ei voi päätellä pelkästä jäännöksettömästä testistä. Yksittäinen mittaus ei ole p95-vasteaika; 60 sekunnin aikakatkaisu on alaraja, ei valmistumisaika.

### Täsmälliset Node-nopeuskokeet

| Varasto | Tilauksia | Alkuperäinen s | Pelkkä kuviovälimuisti s | Vain saavutetut DP-tilat s | Sparse material s | Sparse scheduler ms |
| --- | --- | --- | --- | --- | --- | --- |
| none | 2 | 2.716 | — | 0.038 | 0.030 | 4 |
| none | 3 | 4.208 | — | 0.098 | 0.086 | 8 |
| none | 4 | 8.441 | — | 0.893 | 0.877 | 11 |
| none | 5 | 12.109 | — | 1.649 | 1.613 | 27 |
| A | 2 | 11.367 | 3.674 | 0.115 | 0.100 | 7 |
| A | 3 | 24.779 | 10.683 | 0.600 | 0.577 | 8 |
| A | 4 | 54.425 | 42.588 | 2.968 | 2.942 | 10 |
| A | 5 | 49.634 | 46.345 | 4.824 | 4.780 | 22 |
| B | 2 | 5.102 | 2.973 | 0.076 | 0.065 | 4 |
| B | 3 | 7.075 | 7.057 | 0.281 | 0.259 | 10 |
| B | 4 | 25.030 | 18.521 | 1.791 | 1.756 | 15 |
| B | 5 | 29.094 | 20.675 | 1.920 | 1.877 | 24 |
| C | 2 | 11.599 | 4.139 | 0.125 | 0.112 | 5 |
| C | 3 | 17.367 | 9.786 | 0.568 | 0.548 | 9 |
| C | 4 | >60 | 56.683 | 3.797 | 3.771 | 10 |
| C | 5 | >60 | >60 | 4.179 | 4.135 | 23 |

Erillinen instrumentointi (A, tilaukset 1+2): 3014 kuviokutsua, 16.588 s kuviolaskennassa / 16.759 s koko arvioinnissa (99.0 %). Tämä paikantaa pullonkaulan; erillisen profilointiajon aikaa ei käytetä identtisen kuorman nopeutuskertoimena. Node-kokeen nopeus ei tarkoita, että selain olisi jo nopeutettu.

Vaikean tapauksen erillinen kylmä mittaus: A-varasto, käsin lukitut tilaukset 3, 9, 21, 200 kappaletta, sparse-DP ja ei välimuistia. Tulos complete; kokonaisaika 32.765 s, materiaali 32.738 s ja scheduler 10 ms. Pelkkä tilausten lukumäärä ei siis ennusta nopeutta: saman materiaalivariantin erilaisten mittojen yhdistelmämäärä vaikuttaa. Alle viiden sekunnin perusbatchituloksia ei saa yleistää kaikkiin 2–5 tilauksen valintoihin.

| A, 120 s | Piste | Tutkitut batchit | Kevyt / full |
| --- | --- | --- | --- |
| Alkuperäinen DP | 279283.704 | 12 | 12 / 2 |
| Saavutetut DP-tilat | 275865.033 | 52 | 52 / 12 |

## Parempi piste mutta enemmän uusia salkoja

### Varasto none, tilaukset 3, 9, 21

|  | Kevyt | Normaali |
| --- | --- | --- |
| Piste | 286147.546 | 282845.517 |
| Uudet salot | 51 | 52 |
| Romu mm | 4740.0 | 4566.0 |
| Säästettäviä kpl | 13 | 13 |
| sourceValueEquivalent | 306000.000 | 312000.000 |
| recoveredRemnantValueEquivalent | 24074.054 | 32585.583 |
| kerfRecoveredValueEquivalent | 0.000 | 0.000 |
| newStockRemnantCreationPenaltyEquivalent | 650.000 | 650.000 |
| remnantHandlingPenaltyEquivalent | 260.000 | 260.000 |
| largeScrapPenaltyEquivalent | 3311.600 | 2521.100 |
| totalCostEquivalent | 286147.546 | 282845.517 |

Uutta materiaalia käytetään 6000 mm enemmän. Pisteessä kokonaislähdearvon muutos on 6000.000, loppukrediitin muutos 8511.528, käsittely- ja luontikulujen yhteismuutos 0.000 ja romurangaistuksen muutos -790.500. Näiden nettovaikutus on -3302.028 ekvivalenttimillimetriä. Jäännösvarastoa käyttävissä tapauksissa lähdearvoon sisältyy myös käytettyjen vanhojen palojen arvon muutos.

Kevyt, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 3834.0 |
| verticalProfile / gray | 1882.0, 1882.0, 1882.0, 1882.0, 1882.0, 1882.0, 3941.0, 3941.0 |
| closingProfile / gray | 3941.0, 4239.0 |
| topRail / gray | 2887.0 |
| bottomRail / gray | 2887.0 |

Normaali, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 3834.0 |
| verticalProfile / gray | 1880.0, 1882.0, 1882.0, 3939.0, 3939.0, 3939.0, 3939.0, 3941.0 |
| closingProfile / gray | 3941.0, 4239.0 |
| topRail / gray | 2887.0 |
| bottomRail / gray | 2887.0 |

### Varasto none, tilaukset 1, 2

|  | Kevyt | Normaali |
| --- | --- | --- |
| Piste | 158858.177 | 156209.766 |
| Uudet salot | 29 | 31 |
| Romu mm | 9676.0 | 6554.0 |
| Säästettäviä kpl | 13 | 18 |
| sourceValueEquivalent | 174000.000 | 186000.000 |
| recoveredRemnantValueEquivalent | 27871.923 | 38582.934 |
| kerfRecoveredValueEquivalent | 0.000 | 0.000 |
| newStockRemnantCreationPenaltyEquivalent | 650.000 | 900.000 |
| remnantHandlingPenaltyEquivalent | 260.000 | 360.000 |
| largeScrapPenaltyEquivalent | 11820.100 | 7532.700 |
| totalCostEquivalent | 158858.177 | 156209.766 |

Uutta materiaalia käytetään 12000 mm enemmän. Pisteessä kokonaislähdearvon muutos on 12000.000, loppukrediitin muutos 10711.010, käsittely- ja luontikulujen yhteismuutos 350.000 ja romurangaistuksen muutos -4287.400. Näiden nettovaikutus on -2648.410 ekvivalenttimillimetriä. Jäännösvarastoa käyttävissä tapauksissa lähdearvoon sisältyy myös käytettyjen vanhojen palojen arvon muutos.

Kevyt, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 1092.0 |
| uProfile / white | 3922.0 |
| verticalProfile / gray | 1306.0, 3392.0, 3653.0 |
| closingProfile / gray | 3392.0, 3653.0 |
| horizontalProfile / gray | 1878.0 |
| horizontalProfile / white | 1664.0 |
| topRail / gray | 3309.0, 3740.0 |
| bottomRail / gray | 3309.0, 3740.0 |

Normaali, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 1092.0 |
| uProfile / white | 3922.0 |
| verticalProfile / gray | 1306.0, 1306.0, 3392.0, 3653.0 |
| closingProfile / gray | 3392.0, 3653.0 |
| horizontalProfile / gray | 1878.0 |
| horizontalProfile / white | 1664.0 |
| topRail / gray | 3309.0, 3740.0 |
| topRail / white | 3409.0, 3499.0 |
| bottomRail / gray | 3309.0, 3740.0 |
| bottomRail / white | 3409.0, 3499.0 |

### Varasto none, tilaukset 1, 2, 3

|  | Kevyt | Normaali |
| --- | --- | --- |
| Piste | 212840.573 | 211309.302 |
| Uudet salot | 39 | 40 |
| Romu mm | 8504.0 | 7273.0 |
| Säästettäviä kpl | 15 | 17 |
| sourceValueEquivalent | 234000.000 | 240000.000 |
| recoveredRemnantValueEquivalent | 31600.227 | 37253.598 |
| kerfRecoveredValueEquivalent | 0.000 | 0.000 |
| newStockRemnantCreationPenaltyEquivalent | 750.000 | 850.000 |
| remnantHandlingPenaltyEquivalent | 300.000 | 340.000 |
| largeScrapPenaltyEquivalent | 9390.800 | 7372.900 |
| totalCostEquivalent | 212840.573 | 211309.302 |

Uutta materiaalia käytetään 6000 mm enemmän. Pisteessä kokonaislähdearvon muutos on 6000.000, loppukrediitin muutos 5653.370, käsittely- ja luontikulujen yhteismuutos 140.000 ja romurangaistuksen muutos -2017.900. Näiden nettovaikutus on -1531.270 ekvivalenttimillimetriä. Jäännösvarastoa käyttävissä tapauksissa lähdearvoon sisältyy myös käytettyjen vanhojen palojen arvon muutos.

Kevyt, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 3546.0 |
| uProfile / white | 3922.0 |
| verticalProfile / gray | 1306.0, 1331.0, 1592.0, 1878.0, 1878.0 |
| closingProfile / gray | 3392.0, 3653.0 |
| horizontalProfile / gray | 3886.0 |
| horizontalProfile / white | 1664.0 |
| topRail / gray | 3740.0, 4282.0 |
| bottomRail / gray | 3740.0, 4282.0 |

Normaali, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 3584.0 |
| uProfile / white | 3922.0 |
| verticalProfile / gray | 1306.0, 1331.0, 3392.0, 3392.0, 3939.0 |
| closingProfile / gray | 3392.0, 3653.0 |
| horizontalProfile / gray | 3886.0 |
| horizontalProfile / white | 1664.0 |
| topRail / gray | 2022.0 |
| topRail / white | 3409.0, 3499.0 |
| bottomRail / gray | 2022.0 |
| bottomRail / white | 3409.0, 3499.0 |

### Varasto none, tilaukset 8, 12, 15, 17, 20

|  | Kevyt | Normaali |
| --- | --- | --- |
| Piste | 573097.829 | 568334.910 |
| Uudet salot | 102 | 109 |
| Romu mm | 17332.0 | 14723.0 |
| Säästettäviä kpl | 36 | 45 |
| sourceValueEquivalent | 612000.000 | 654000.000 |
| recoveredRemnantValueEquivalent | 56847.971 | 100650.490 |
| kerfRecoveredValueEquivalent | 0.000 | 0.000 |
| newStockRemnantCreationPenaltyEquivalent | 1800.000 | 2250.000 |
| remnantHandlingPenaltyEquivalent | 720.000 | 900.000 |
| largeScrapPenaltyEquivalent | 15425.800 | 11835.400 |
| totalCostEquivalent | 573097.829 | 568334.910 |

Uutta materiaalia käytetään 42000 mm enemmän. Pisteessä kokonaislähdearvon muutos on 42000.000, loppukrediitin muutos 43802.519, käsittely- ja luontikulujen yhteismuutos 630.000 ja romurangaistuksen muutos -3590.400. Näiden nettovaikutus on -4762.919 ekvivalenttimillimetriä. Jäännösvarastoa käyttävissä tapauksissa lähdearvoon sisältyy myös käytettyjen vanhojen palojen arvon muutos.

Kevyt, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 4118.0 |
| uProfile / white | 1716.0, 3856.0, 3860.0 |
| uProfile / black | 1347.0, 1347.0, 1362.0, 1874.0 |
| verticalProfile / white | 1926.0, 1926.0, 1930.0, 1930.0, 1930.0, 3967.0 |
| verticalProfile / black | 1558.0, 1561.0, 1561.0, 1564.0, 1570.0, 1576.0, 3788.0 |
| closingProfile / white | 1930.0, 3967.0 |
| closingProfile / black | 3989.0, 3989.0 |
| horizontalProfile / gray | 2589.0 |
| horizontalProfile / white | 3672.0 |
| horizontalProfile / black | 5287.0 |
| topRail / gray | 1463.0 |
| topRail / white | 1399.0, 3579.0 |
| topRail / black | 3702.0 |
| bottomRail / gray | 1463.0 |
| bottomRail / white | 1399.0, 3579.0 |
| bottomRail / black | 3702.0 |

Normaali, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 4118.0 |
| uProfile / white | 3856.0, 3856.0, 3860.0, 3860.0 |
| uProfile / black | 1344.0, 1350.0, 1362.0, 1874.0 |
| verticalProfile / white | 3963.0, 3963.0, 3963.0, 3963.0, 3963.0, 3963.0, 3963.0, 3967.0, 3967.0, 3967.0, 3967.0 |
| verticalProfile / black | 1558.0, 1561.0, 1561.0, 1561.0, 1561.0, 1570.0, 4044.0 |
| closingProfile / white | 3963.0, 3967.0, 3967.0 |
| closingProfile / black | 3989.0, 3989.0 |
| horizontalProfile / gray | 4203.0, 4386.0 |
| horizontalProfile / white | 3672.0 |
| topRail / gray | 1463.0 |
| topRail / white | 1399.0, 3579.0 |
| topRail / black | 1356.0, 3176.0 |
| bottomRail / gray | 1463.0 |
| bottomRail / white | 1399.0, 3579.0 |
| bottomRail / black | 1356.0, 3176.0 |

### Varasto A, tilaukset 3, 9, 21

|  | Kevyt | Normaali |
| --- | --- | --- |
| Piste | 279283.704 | 275865.033 |
| Uudet salot | 40 | 41 |
| Romu mm | 5087.1 | 5063.4 |
| Säästettäviä kpl | 17 | 15 |
| sourceValueEquivalent | 292429.247 | 289819.977 |
| recoveredRemnantValueEquivalent | 17180.143 | 17482.024 |
| kerfRecoveredValueEquivalent | 0.000 | 0.000 |
| newStockRemnantCreationPenaltyEquivalent | 400.000 | 350.000 |
| remnantHandlingPenaltyEquivalent | 340.000 | 300.000 |
| largeScrapPenaltyEquivalent | 3294.600 | 2877.080 |
| totalCostEquivalent | 279283.704 | 275865.033 |

Uutta materiaalia käytetään 6000 mm enemmän. Pisteessä kokonaislähdearvon muutos on -2609.270, loppukrediitin muutos 301.880, käsittely- ja luontikulujen yhteismuutos -90.000 ja romurangaistuksen muutos -417.520. Näiden nettovaikutus on -3418.670 ekvivalenttimillimetriä. Jäännösvarastoa käyttävissä tapauksissa lähdearvoon sisältyy myös käytettyjen vanhojen palojen arvon muutos.

Kevyt, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 3834.0 |
| verticalProfile / gray | 1178.6, 1281.5, 1882.0, 1882.0, 1882.0, 1882.0, 1882.0, 1882.0 |
| closingProfile / gray | 1088.6, 1554.0 |
| horizontalProfile / gray | 4096.4, 4264.7 |
| topRail / gray | 1071.3, 3022.0 |
| bottomRail / gray | 1071.3, 1154.5 |

Normaali, syntyneet säästettävät jäännökset (mm; toistuva mitta tarkoittaa erillistä palaa):

| Variantti | Pituudet mm |
| --- | --- |
| uProfile / gray | 1666.0 |
| verticalProfile / gray | 1176.6, 1279.5, 1878.0, 1882.0, 1882.0, 3939.0, 3941.0, 3941.0 |
| closingProfile / gray | 1088.6, 1554.0 |
| horizontalProfile / gray | 4443.8 |
| topRail / gray | 1206.3 |
| bottomRail / gray | 1071.3, 1154.5 |

Pisteen ja materiaalitaseen erillinen aritmeettinen tarkistus käyttää tallennettuja kokonaisia suunnitelmia. Se tarkistaa jokaisen leikkuun samalla authoritative cutPiece-fysiikalla sekä laskee checkpointin arvokäyrän ja kaikki pistekomponentit erikseen. Käyttäytyminen seuraa nykyisestä lähdearvo − loppuarvo + käsittely/romu -mallista. Se ei yksin todista loppuvaraston arvon taloudellista kalibrointia: pitkien jäännösten oikea uudelleenkäyttö ja varaston kierto pitää mitata ennen kuin 0,87:n enimmäiskerrointa voidaan pitää tuotannossa perusteltuna. Scorea ei muutettu.

## Johtopäätökset ja seuraava vaihe

Kaksivaiheinen materiaalihaku löysi näissä kolmessa varastossa parhaansa ensimmäisen minuutin aikana. Lisäminuutit tutkivat paljon vaihtoehtoja mutta eivät parantaneet näiden aloitusten voittajaa. Tämä tukee anytime-toteutusta ja näkyvää parhaan valmiin tuloksen säilyttämistä, ei yleistä 30 tai 60 sekunnin oletusbudjettia.

Täsmällinen saavutettujen DP-tilojen kokeilu ratkaisi suuren osan perusbatchien nopeusongelmasta. Jäljelle jäävä monimittainen, yhteen materiaalivarianttiin painottuva tapaus tarvitsee kuitenkin oman kuviolaskennan profiloinnin ja optimoinnin ennen yleistä nopeuslupausta. Pienin seuraava tekninen tutkimus on tämän saman vaikean batchin kuviotilojen käsittelyn nopeuttaminen nykyistä tulosta muuttamatta.

Syöttöjärjestyksen hallinta on myös tarpeen: testissä batch-valinta pysyi samana, mutta materiaalihakijan sisäinen mittojen järjestys muutti pisteitä. Seuraavassa Node-kokeessa kannattaa verrata vakioituja sisäisiä aloitusjärjestyksiä ja säilyttää niistä paras samalla materiaalipisteellä. Pelkkää rivien lajittelua ei pidä olettaa laadullisesti parhaaksi ilman vertailua. Äärellisessä varastossa epäonnistuneille kevyille arvioille tarvitaan rajattu uudelleenyrityskäytäntö; niitä ei saa merkitä mahdottomiksi.

Production-UI:ta, Web Workeria, oletushakuaikaa tai materiaalipisteytystä ei muutettu. Node-nopeutuksen mahdollinen siirto varsinaiseen funktioon on erillinen selkeä toteutusvaihe core-regressioineen ja selaintesteineen. Työaikaa, niputusta tai mittavasteen siirtoja ei lisätä materiaalipisteeseen.

## Toistaminen ja tarkistukset

Loppuvalidointi PASS: alkuperäisen coren 35/35 regressioryhmää, sparse-koeversion 35/35 samaa ryhmää, 18 tuotannon ohjaus-/persistenssitestiä ja 20 Node-koeversion testiä. Lisäksi 1354 täsmällistä kuviokohtaista vertailua, 63 tallennetun benchmark-suunnitelman auditointi ja 1922 historiallisen tangon fysiikka-/pistetarkistus. 27 JavaScript-tiedoston syntaksitarkistus ja git diff --check läpäisty. Neljän tuotantolähteen SHA-256-tunnisteet säilyivät muuttumattomina.

Komennot ja tiedostomuodot on kuvattu `../README.md`:ssä. JSON-tulokset säilyttävät jokaisen arvioinnin, checkpointit, parannushistorian ja jokaisen parannuksen koko validoidun suunnitelman operaatioineen. `checkpoints.csv` sisältää vertailukelpoiset aikapisteet. `audit.json` sisältää riippumattoman piste-/fysiikkatarkistuksen yhteenvedon. Regressioajojen lokit on tallennettu tähän hakemistoon. Selaintestiä ei tehty tässä Node-tutkimuksessa. Ei commitia tai pushia.
