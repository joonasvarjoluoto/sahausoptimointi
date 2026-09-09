# Batch-haun tutkimustulokset, 8.9.2026

## Rajaus ja aineisto

Erillinen Node-koeversio; tuotannon selainpolkua, materiaali- tai scheduler-lähteitä ei muutettu tässä tutkimuksessa. Aiemmat paikalliset kiskomuutokset olivat mukana lähteissä. Sovelluslähteiden SHA-256-tunnisteet ovat JSON-tuloksissa. Node v24.19.0. Mittaukset tehtiin peräkkäisinä CPU-ajoina tällä koneella, ilman rinnakkaisia benchmarkeja.

Excelistä 23 tilausta / 79 aukkoa / 1 231 kappaletta. Tilaus 16 jätettiin pois käyttäjän pyynnöstä. 6000 mm, kerf 3 mm, kaikki tuetut värit rajattomina, ei vanhoja jäännöksiä. Tämä on materiaalioletus, ei oikea varastosaldo. Kokorajoilla 200/250/300 on 85030 kelvollista batch-ehdokasta.

## Strategia ja hakuasetukset

Rajattu deterministinen monialoitushaku, kuuden parhaan batchin add/remove/swap-naapurit ja säännölliset uudet lähtökohdat. Kokoalueita vuorotellaan. Kokonaiskysynnän pituus auttaa valitsemaan tutkittavia ehdokkaita mutta ei korvaa materiaalipisteytystä. Neljän kevyen arvioinnin jälkeen tarkennetaan yksi lupaava ehdokas. Parempi kevyt tulos säilyy myös huonomman tarkennuksen jälkeen.

Kevyt haku: beamWidth 2 / patternsPerState 2 / candidatePoolSize 10. Normaali haku: 20 / 10 / 50. Muut parametrit ja kaikki pistekomponentit samat. Jokainen valmis materiaalisuunnitelma validoidaan, ja normaali scheduler muodostetaan provenancen tarkistamiseksi. Schedulerin mittareita ei käytetä valintaan. Tuntematon tai katkaistu haku ei ole todiste mahdottomuudesta.

Koeversion ehdokasluettelointi käyttää enintään 23 tilauksen bittimaskeja. Tuotannon 100 tilauksen raja tarvitsee myöhemmin rajatun generaattorin ilman kaikkien osajoukkojen luettelointia.

## Laatu ajan funktiona

Yksi jatkuva haku. Taulukko kertoo, mikä valmis validoitu tulos oli saatavilla juuri annetun budjetin kohdalla. Arvioinnin aikana ylitettyyn aikapisteeseen ei kirjata sen myöhemmin valmistunutta tulosta. Täyden budjetin ajo kesti 600.02 s, lopetussyy observed-plateau.

| Budjetti s | Eri ehdokkaita | Kevyitä valmiiksi käsitelty | Perusteellisia käsitelty | Paras piste | Uusia tankoja | Uutta m | Kerf m | Romujäännös m | Säästettävät kpl / m | Paras löytyi s | Ilman parannusta s |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 10 | 4 | 4 | 0 | 286147.5 | 51 | 306.0 | 0.572 | 4.740 | 13 / 36.962 | 1.7 | 8.3 |
| 30 | 12 | 12 | 2 | 282845.5 | 52 | 312.0 | 0.579 | 4.566 | 13 / 43.129 | 18.9 | 11.1 |
| 60 | 34 | 34 | 8 | 282845.5 | 52 | 312.0 | 0.579 | 4.566 | 13 / 43.129 | 18.9 | 41.1 |
| 120 | 76 | 76 | 19 | 282845.5 | 52 | 312.0 | 0.579 | 4.566 | 13 / 43.129 | 18.9 | 101.1 |
| 300 | 132 | 132 | 32 | 282845.5 | 52 | 312.0 | 0.579 | 4.566 | 13 / 43.129 | 18.9 | 281.1 |
| 600 | 356 | 356 | 88 | 282845.5 | 52 | 312.0 | 0.579 | 4.566 | 13 / 43.129 | 18.9 | 581.1 |

Kevyt/perusteellinen laskuri tarkoittaa loppuun käsiteltyjä arviointiyrityksiä (myös mahdollinen not-found); JSON erittelee tilan. Rajalla kesken oleva yritys ei kuulu aikapisteen laskureihin. Koko ajossa 444 valmisratkaisua validoitiin; 1 arviointia päättyi muuhun tilaan.

## Improvement history ja materiaalierot

- 1.68 s: piste 286147.546, light, tilaukset 3, 9, 21, 200 kpl, 51 uutta tankoa, kerf 0.572 m, romujäännöstä 4.740 m, säästettäviä 13 kpl / 36.962 m.
- 18.88 s: piste 282845.517, full, tilaukset 3, 9, 21, 200 kpl, 52 uutta tankoa, kerf 0.579 m, romujäännöstä 4.566 m, säästettäviä 13 kpl / 43.129 m.

Ensimmäisestä parhaaseen piste pieneni 3302.028 eli 1.154 %. Uusia tankoja 51 → 52; uutta materiaalia 306.0 → 312.0 m. Valitut tilaukset säilyivät samoina, joten tämä on saman kysynnän materiaalivertailu.

Pisteparannus perustui suurempaan jäännöskrediittiin ja pienempään suuren romun rangaistukseen. Uutta materiaalia kului yksi tanko enemmän. Tätä ei siten pidä raportoida raakamateriaalin kulutuksen vähentymisenä; materiaalimallin prioriteetteja ei muutettu tutkimuksessa.

Paras löytyi 18.88 s; viimeiset 581.1 s kuluivat ilman parannusta. Tämä osoittaa havaitun tasaantumisen tämän jonon, varastooletuksen ja hakustrategian yhdistelmässä. Se ei todista globaalia optimia, tyypillistä 99 % hyötysuhdetta eikä ettei myöhempi uusi lähtökohta voisi parantaa tulosta. 30 ja 60 minuutin ajoa ei tehty ensimmäisellä kierroksella, koska 10 minuutin käyrä oli jo tasainen; eri jonot ja varastot ovat hyödyllisempi seuraava koe kuin yhden tasaisen ajon jatkaminen tuntiin. Viimeinen kesken ollut arviointi katkaistiin 600 sekunnin aikabudjettiin; plateau-ehto täyttyi samalla. Aiempi valmis paras tulos säilyi.

Paras materiaalipiste on ekvivalenttipituutta, ei euroja:

| Komponentti | Arvo mm-ekvivalenttia |
| --- | ---: |
| sourceValueEquivalent | 312000.000 |
| recoveredRemnantValueEquivalent | 32585.583 |
| kerfRecoveredValueEquivalent | 0.000 |
| newStockRemnantCreationPenaltyEquivalent | 650.000 |
| remnantHandlingPenaltyEquivalent | 260.000 |
| largeScrapPenaltyEquivalent | 2521.100 |
| totalCostEquivalent | 282845.517 |

## Jo valitun batchin normaali laskenta

Automaattinen selector ohitettiin. Samat nykyiset normaalihaun asetukset; mukana materiaalihaku, validointi, UI-suunnitelman tietorakenne ja scheduler. Ei selain-DOM:n renderöintimittausta. Lähteiden lataus ei sisälly lukuihin. Välimuisti pois.

| Tilaukset | Tilausten määrä | Kappaleita | Yhteensä s | Materiaalihaku s | Scheduler ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1, 2 | 2 | 88 | 3.12 | 3.12 | 3 |
| 1, 2, 3 | 3 | 136 | 3.74 | 3.73 | 7 |
| 1, 4, 17, 18 | 4 | 200 | 8.21 | 8.19 | 11 |
| 8, 12, 15, 17, 20 | 5 | 280 | 10.39 | 10.36 | 22 |

Kevyt haku samoille neljälle batchille kesti 0.32–1.33 s. Yksittäiset nopeudet eivät ole kaikkien 2–5 tilauksen tai äärellisen varaston takuu. Normaali pieni batch säilyi tässä sekuntien suuruusluokassa.

## Exhaustive-vertailu pienillä aineistoilla

Nykyinen PRODUCTION_PLANNING.selectBatch arvioi jokaisen kelvollisen batchin normaalilla heuristisella materiaalihakulla. Uusi haku saa kahdeksan arvioinnin työbudjetin ja enintään 120 s, välimuisti pois molemmilta. Ei väitettä globaalista materiaalioptimista. Positiivinen piste-ero tarkoittaa uuden haun huonompaa tulosta.

| Tilaukset | Min/tavoite/max | Exhaustive-ehdokkaita | Uuden eri ehdokkaat / tarkennukset | Exhaustive s | Uusi s | Exhaustive piste | Uusi piste | Piste-ero | Samat tilaukset |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1, 2, 3, 4 | 100/130/160 | 7 | 7 / 1 | 23.99 | 4.71 | 138846.6 | 138846.6 | 0.000 % | kyllä |
| 10, 11, 15, 19, 21 | 70/85/100 | 10 | 7 / 1 | 19.36 | 3.75 | 134916.5 | 134916.5 | 0.000 % | kyllä |
| 3, 5, 18, 20, 24 | 90/110/130 | 9 | 7 / 1 | 26.06 | 4.38 | 149015.2 | 149015.2 | 0.000 % | kyllä |

Konkreettiset materiaalimäärät, valitut tilaukset ja score-komponentit molemmille poluille ovat small-results.jsonissa. Kolme pientä joukkoa on ensimmäinen vertailu, ei riittävä yleinen laatutakuu.

## Välimuisti

Ajokohtainen profiili-/väriryhmän puhtaan optimizer-kutsun välimuisti toteutettiin vain VM-kääreeseen. Koko kysyntä, lähteet, kerf ja asetukset ovat avaimessa. Palautetaan kopio; provenance muodostetaan uudelleen. Ei tuotanto-optimizerin refaktoria. Koko haun viimeiset tilastot: {"hits":4339,"misses":1360,"evictions":360,"eligibleRepeats":4402}.

Sama kolmen haun jono ilman välimuistia 15.04 s, välimuistilla 11.08 s. Mukana on tarkoituksellinen saman batchin toisto ja osittain muuttunut batch. Tulosten, score-komponenttien ja provenancen identtisyys tarkistettiin. Säästö ei ole lupaus samasta nopeutuskertoimesta missä tahansa jonossa.

## Suositus ja rajaukset

Säilytä käsin valitun batchin normaali materiaalihaku erillisenä automaattisesta selectorista. Jatka kaksivaiheisen haun ja turvallisen ryhmävälimuistin tutkimusta useammalla jonolla, äärellisellä materiaalilla ja vanhoilla jäännöksillä ennen production-kytkentää. Mittaa myös toinen aloitussiemen ja pidempi vertailu ainakin aineistolla, jossa käyrä jatkaa paranemista. Tämän yhden jonon perusteella automaattihaulle ei vielä lukita oletusaikaa.

Node-koeversio osoittaa huomattavan hakukertojen vähennyksen ja varhaisen tasaisen parhaan tuloksen tällä aineistolla. Mahdollisen UI:n, Web Workerin, peruutuspainikkeen, laskennanaikaisen syöterevision sekä osajoukkoluettelosta luopuvan suuren jonon generaattorin toteutus jää myöhemmäksi. Mitään ei commitoitu tai pushattu tässä tutkimuksessa.

## Tarkistukset

Tutkimusajurin 16 tarkistusta läpäisty: kandidaattien vastaavuus nykyiseen selectoriin pienissä tapauksissa, min/oversized/lyhyt jono, checkpointin valmistumisraja, myöhäisen tuloksen hylkäys, huonomman tarkennuksen käsittely, työbudjetin determinismi, välimuistin suunnitelma-/score-/provenance-yhtäläisyys sekä kerfin, hakubudjetin ja äärellisen määrän eristys. Mukana on myös koko validoidun suunnitelman ja operaatioiden säilyttäminen incumbentissa seuraavien hakujen yli. Nykyinen regressiopaketti 35/35 ja ohjaus-/persistenssiajuri 18 tarkistusta läpäisty. Syntaksit ja diff tarkistettu. Tässä Node-tutkimuksessa ei tehty uutta selain-UI:ta tai selaintestiä.

Varsinainen 600 s mittaus tallensi suunnitelmien validoidut yhteenvedot. Sen jälkeen koeversioon lisättiin koko voittajasuunnitelman ja operaatioiden vienti kenttään bestValidatedResultSoFar. Erillinen 30.00 s toisto varmisti tämän: sama paras piste ja samat tilaukset löytyivät 23.91 s kohdalla, ja aikakatkaisun jälkeen koko valmis suunnitelma oli saatavilla. Tämän toiston tulos on anytime-result-test.jsonissa. Taulukon 600 s ajat ovat alkuperäisestä mittauksesta; pienet raportointi-/validointitäydennykset eivät muuta haun pisteytys- tai ehdokassääntöä.
