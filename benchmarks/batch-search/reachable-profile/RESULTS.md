# A-varaston vaikean batchin kuviolaskennan profilointi — 9.9.2026

Batchin 3/9/21 noin 35 sekunnin laskenta kuluttaa 98,2 % materiaalilaskenta-ajasta harmaaseen Vaakaprofiiliin. Sen 74 kappaletta ja 13 eri lyhyttä mittaa synnyttävät paljon vaihtoehtoisia määrävektoreita samoihin kapasiteetteihin. Kumulatiivinen pattern-käsittely kasvaa paljon enemmän kuin saavutettujen kapasiteettien tai beam-tilojen määrä. CPU-otannassa keepDistinctPatterns kattaa noin 76 % koko ajosta, ja määrävektorin join-avaimen muodostus on sen selvästi raskain rivi.

Productioniin ei tehty muutoksia. Pohja on commit 4d967b66b4a5268249e22455155b2e36dc0fc6c5. Tarkat lähde-, fixture- ja inventaariohashit ovat jokaisessa ajotiedostossa. Kaikki 12 ajoa vertasivat koko tankosuunnitelmaa, scorea ja scheduler-operaatioita aiemmin tallennettuun referenssiin ja läpäisivät vertailun. Instrumentoinnilla mitataan samaa hakua; mitään välimuistia tai uusia hakujärjestyksiä ei käytetä.

## Asetelma ja mittauksen rajat

- Vaikea: tilaukset 3/9/21, 200 kappaletta. Vertailu: 1/4/17/18, myös 200 kappaletta. Tilaus 16 ei kuulu aineistoon.
- Molemmat käyttävät täsmälleen samaa kanonisoitua A-varastoa (100 fyysistä jäännöstä / 98 riviä), rajattomia 6000 mm uusia lähteitä ja 3 mm kerfiä. Koko jonosta ei haeta batchia; valitut tilaukset lasketaan sellaisinaan alkuperäisessä fixturejärjestyksessä.
- Normaalit asetukset: beamWidth 20 ja patternsPerState 10, muuttamattomat scoreSettings. Kaikki kuusi profiilia lasketaan väreittäin erikseen.
- Jokainen ajo on uusi Node-prosessi ja uusi VM. Ajot suoritettiin peräkkäin. Käynnistys, VM:n lataus, tiedostoluku ja tuloksen vertailu/tallennus jäävät raportoidun kokonaisajan ulkopuolelle; validointi, UI-adapteri, scheduler ja mittaustuloksen serialisointi sisältyvät.
- Baseline sisältää vain yhden ajastuksen per variantti. Kolme toistoa erottavat vaihtelun ilmiöstä. Ne eivät ole p95-palvelulupaus.
- Counts lisää kokonaislukulaskurit, kuviokutsukohtaisen ajastuksen ja täsmällisen syöteavaimen uusintojen tunnistukseen. Se ei kutsu kelloa jokaisessa kapasiteetti- tai pattern-iteraatiossa. Counts-ajon aikaa ei käytetä production-nopeutena: vaikea ajo kestää 44,34 s, noin 28 % baseline-mediaania enemmän. Mittarien keruu ja JIT-vaikutus ovat siis näkyviä.
- CPU on erillinen, sisäisiltä laskureiltaan muuttamaton ajo Node inspectorin 1000 µs otannalla. Vaikean profiloidun ajon kesto on noin 39,15 s. Taulukon funktioajat ovat pinonäytteiden aikapainotettuja arvioita, eivät eksakteja funktioajastuksia. GC ja V8:n inlining voivat sijoittaa aikaa kutsujalle tai erilliseen kehykseen.
- Sample-ajossa kellot lisätään vain noin joka 1024. keep-kutsuun ja vastaavaan kopiointiryhmään. Valinta käyttää kutsukohtaisesti suolattua kokonaislukuhajautuksen yläosaa, joten myös lyhyiden kuviokutsujen alku voi tulla mukaan. Samplattuun dedup-vaiheeseen kuuluu join sekä Map-operaatiot; sort-vaiheeseen values-kopio, lajittelu ja slice. Otos on suuntaa antava vaihe-erittely, jota ei summata CPU-aikojen päälle. Ensimmäinen systemaattinen otos korvattiin tällä tasaisemmin hajautetulla otoksella.

## Tavalliset toistoajat

| Ajo | Vaikea kokonais-s | Vertailu kokonais-s |
| --- | --- | --- |
| 1 | 37,012 | 2,431 |
| 2 | 34,703 | 2,323 |
| 3 | 33,813 | 2,315 |

Vaikean materiaalilaskennan mediaani on 34,690 s ja vertailun 2,309 s. Harmaan Vaakaprofiilin mediaanit ovat 34,072 s ja 1,847 s: ero 18,5-kertainen. Schedulerin mediaanit ovat 9,78 ms ja 11,53 ms. Materiaalipisteet ovat 275 865,033489 ja 425 770,046235; eri kysyntöjen pisteitä ei käytetä nopeuden selityksenä.

## Variantit, kysyntä ja beam

| Tapaus | Profiili/väri | Kpl | Eri mittoja | Mediaani ms | Lähderivit | Jäännöksiä kpl | Beam laajennettu | Lapsitiloja | Beam max |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hard | uProfile/gray | 26 | 8 | 90 | 6 | 5 | 161 | 3 552 | 20 |
| hard | verticalProfile/gray | 72 | 8 | 459 | 16 | 16 | 427 | 19 953 | 20 |
| hard | closingProfile/gray | 2 | 2 | 1 | 4 | 3 | 9 | 35 | 8 |
| hard | horizontalProfile/gray | 74 | 13 | 34 072 | 5 | 4 | 201 | 7 677 | 20 |
| hard | topRail/gray | 13 | 13 | 33 | 7 | 6 | 101 | 2 512 | 20 |
| hard | bottomRail/gray | 13 | 13 | 33 | 7 | 6 | 101 | 2 496 | 20 |
| fast | uProfile/gray | 20 | 7 | 48 | 6 | 5 | 200 | 2 502 | 20 |
| fast | uProfile/black | 8 | 4 | 20 | 14 | 13 | 81 | 1 109 | 20 |
| fast | verticalProfile/gray | 50 | 7 | 216 | 16 | 16 | 501 | 10 092 | 20 |
| fast | verticalProfile/black | 18 | 4 | 109 | 21 | 21 | 181 | 5 525 | 20 |
| fast | closingProfile/gray | 4 | 4 | 4 | 4 | 3 | 51 | 339 | 20 |
| fast | horizontalProfile/gray | 54 | 9 | 1 847 | 5 | 4 | 161 | 5 670 | 20 |
| fast | horizontalProfile/black | 18 | 4 | 19 | 4 | 3 | 70 | 1 356 | 20 |
| fast | topRail/gray | 10 | 9 | 18 | 7 | 6 | 81 | 1 646 | 20 |
| fast | topRail/black | 4 | 4 | 4 | 7 | 6 | 41 | 334 | 20 |
| fast | bottomRail/gray | 10 | 9 | 19 | 7 | 6 | 81 | 1 650 | 20 |
| fast | bottomRail/black | 4 | 4 | 4 | 7 | 6 | 41 | 340 | 20 |

Lähderivit tarkoittavat variantin saatavilla olevia pituus-/alkuperärivejä, eivät uusien tankojen fyysistä määrää (uusi materiaali on rajaton). Beam-tilat ovat productionin omat stats-laskurit. Täydet deduplikointi-, valmistumis- ja fallback-tilastot säilyvät JSONissa. Fallback ei käynnistynyt kummassakaan tapauksessa.

## Kysynnän pituusjakaumat

Raportin pituudet on lajiteltu vain lukemista varten. Laskennan sisäistä rivijärjestystä ei muuteta.

- hard uProfile/gray: 1205 mm × 2; 1235 mm × 4; 1255 mm × 4; 1285 mm × 2; 1610 mm × 2; 1865 mm × 4; 2163 mm × 6; 2165 mm × 2. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): 2163/2165.
- hard verticalProfile/gray: 1098 mm × 6; 1128 mm × 12; 1148 mm × 12; 1178 mm × 6; 1503 mm × 4; 1758 mm × 9; 2056 mm × 17; 2058 mm × 6. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): 2056/2058.
- hard closingProfile/gray: 1758 mm × 1; 2056 mm × 1. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): ei.
- hard horizontalProfile/gray: 488 mm × 6; 563 mm × 4; 581 mm × 6; 585 mm × 6; 634 mm × 6; 638 mm × 6; 640 mm × 6; 643 mm × 6; 717 mm × 6; 906 mm × 4; 1001 mm × 6; 1011 mm × 6; 1046 mm × 6. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): 581/585, 634/638, 638/640, 640/643, 1001/1011.
- hard topRail/gray: 1115 mm × 1; 1435 mm × 1; 1715 mm × 1; 1725 mm × 1; 1800 mm × 1; 1873 mm × 1; 1885 mm × 1; 1890 mm × 1; 1900 mm × 1; 2123 mm × 1; 2975 mm × 1; 3005 mm × 1; 3110 mm × 1. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): 1715/1725, 1885/1890, 1890/1900.
- hard bottomRail/gray: 1115 mm × 1; 1435 mm × 1; 1715 mm × 1; 1725 mm × 1; 1800 mm × 1; 1873 mm × 1; 1885 mm × 1; 1890 mm × 1; 1900 mm × 1; 2123 mm × 1; 2975 mm × 1; 3005 mm × 1; 3110 mm × 1. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): 1715/1725, 1885/1890, 1890/1900.
- fast uProfile/gray: 2451 mm × 2; 2477 mm × 6; 2712 mm × 2; 2784 mm × 2; 2790 mm × 2; 2792 mm × 4; 2809 mm × 2. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): 2784/2790, 2790/2792.
- fast uProfile/black: 2060 mm × 2; 2316 mm × 2; 2322 mm × 2; 2325 mm × 2. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): 2316/2322, 2322/2325.
- fast verticalProfile/gray: 2344 mm × 5; 2370 mm × 17; 2605 mm × 7; 2677 mm × 4; 2683 mm × 4; 2685 mm × 8; 2702 mm × 5. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): 2677/2683, 2683/2685.
- fast verticalProfile/black: 1953 mm × 2; 2209 mm × 4; 2215 mm × 6; 2218 mm × 6. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): 2209/2215, 2215/2218.
- fast closingProfile/gray: 2344 mm × 1; 2370 mm × 1; 2605 mm × 1; 2702 mm × 1. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): ei.
- fast horizontalProfile/gray: 616 mm × 4; 684 mm × 8; 705 mm × 4; 762 mm × 6; 807 mm × 6; 880 mm × 8; 923 mm × 6; 1047 mm × 6; 1136 mm × 6. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): ei.
- fast horizontalProfile/black: 741 mm × 4; 775 mm × 6; 791 mm × 6; 1144 mm × 2. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): ei.
- fast topRail/gray: 1220 mm × 1; 1399 mm × 1; 1748 mm × 2; 2257 mm × 1; 2391 mm × 1; 2688 mm × 1; 2741 mm × 1; 3112 mm × 1; 3379 mm × 1. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): ei.
- fast topRail/black: 1470 mm × 1; 2295 mm × 1; 2343 mm × 1; 2500 mm × 1. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): ei.
- fast bottomRail/gray: 1220 mm × 1; 1399 mm × 1; 1748 mm × 2; 2257 mm × 1; 2391 mm × 1; 2688 mm × 1; 2741 mm × 1; 3112 mm × 1; 3379 mm × 1. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): ei.
- fast bottomRail/black: 1470 mm × 1; 2295 mm × 1; 2343 mm × 1; 2500 mm × 1. Lähekkäiset peräkkäiset mitat (ero ≤10 mm): ei.

Vaikean Vaakaprofiilin kaikki 13 mittaa ovat 488–1046 mm. Niitä mahtuu yksittäiseen lähteeseen useita, mikä mahdollistaa paljon määrävektoriyhdistelmiä. 634/638/640/643 mm ja 581/585 mm ovat läheisiä; myös muut yhdistelmät voivat osua samaan käytettyyn pituuteen. Tämä on havaittua rakennetta ja selittävä mekanismi, ei erillinen koe läheisten mittojen kausaalivaikutuksesta. Esimerkiksi vaikean batchin kiskoilla on myös 13 mittaa mutta vain 13 kappaletta ja pidemmät pituudet: pelkkä erilaisten mittojen lukumäärä ei selitä hitautta.

## Kuviokutsut, määrälohkot ja saavutetut kapasiteetit

| Tapaus | Profiili/väri | DP-kutsut | Chunkit yht. | Chunk max/kutsu | Kapasiteetit yht. | Mediaani/kutsu | P95/kutsu | Huippu/kutsu | keep-kutsut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| hard | uProfile/gray | 924 | 3 255 | 18 | 13 405 | 3 | 77 | 226 | 18 382 |
| hard | verticalProfile/gray | 6 684 | 18 873 | 20 | 62 299 | 3 | 33 | 329 | 74 043 |
| hard | closingProfile/gray | 30 | 34 | 2 | 65 | 2 | 3 | 4 | 35 |
| hard | horizontalProfile/gray | 898 | 14 994 | 39 | 1 135 146 | 589 | 3 430 | 3 946 | 6 893 183 |
| hard | topRail/gray | 592 | 2 091 | 13 | 7 860 | 3 | 49 | 215 | 7 366 |
| hard | bottomRail/gray | 616 | 2 192 | 13 | 6 853 | 4 | 41 | 215 | 6 327 |
| fast | uProfile/gray | 1 171 | 2 305 | 14 | 4 940 | 1 | 20 | 36 | 5 351 |
| fast | uProfile/black | 1 097 | 974 | 8 | 2 252 | 1 | 5 | 15 | 1 372 |
| fast | verticalProfile/gray | 7 977 | 9 744 | 14 | 21 778 | 1 | 8 | 36 | 18 876 |
| fast | verticalProfile/black | 3 600 | 5 039 | 8 | 9 337 | 1 | 5 | 15 | 6 446 |
| fast | closingProfile/gray | 149 | 281 | 4 | 488 | 3 | 7 | 11 | 339 |
| fast | horizontalProfile/gray | 620 | 8 531 | 28 | 415 537 | 293 | 2 167 | 2 720 | 1 036 637 |
| fast | horizontalProfile/black | 240 | 925 | 11 | 4 715 | 8 | 130 | 223 | 6 144 |
| fast | topRail/gray | 486 | 1 331 | 10 | 2 916 | 3 | 21 | 63 | 2 515 |
| fast | topRail/black | 233 | 264 | 4 | 567 | 2 | 4 | 11 | 334 |
| fast | bottomRail/gray | 508 | 1 384 | 10 | 2 787 | 3 | 17 | 63 | 2 364 |
| fast | bottomRail/black | 245 | 274 | 4 | 585 | 2 | 7 | 11 | 340 |

Chunkit lasketaan varsinaisessa funktiossa lähdepituudella rajatun binäärisen hajotelman jälkeen. Kapasiteettisumma on jokaisen kutsun lopullisten saavutettujen kapasiteettien summa, sisältäen nollatilan. Sama kapasiteetti eri kutsussa lasketaan uudelleen; luku ei ole yhtä aikaa muistissa oleva koko. Kapasiteettien määrä kasvaa monotonisesti kutsun sisällä, joten lopullinen koko on myös kyseisen kutsun huippu. Kaikkien kutsujen arvot ovat counts-JSONin calls-taulukossa.

Vaikean harmaan Vaakaprofiilin ensimmäisessä 6000 mm kutsussa on 39 chunkia, vertailussa 28 (jäännöslähteillä 39 ja 27). Huippukapasiteetit 3 946 vs 2 720 kasvavat vain 1,45-kertaisiksi. Lopullisten kapasiteettien kumulatiivinen määrä kasvaa 2,73-kertaiseksi, mutta keep-kutsut 6,65-kertaisiksi ja käsiteltävät pattern-viittaukset 20,28-kertaisiksi. Vaikean huippu on vain noin 6,6 % 60 031 mahdollisesta kapasiteetista: pääongelma ei ole täyden kapasiteettitaulukon paluu.

## Pattern-työ ennen ja jälkeen deduplikoinnin

| Tapaus | Profiili/väri | Uusia vektorikopioita | keep syöte | Distinct ennen kiintiötä | Säilytetty kiintiön jälkeen | Palautetut kuviot |
| --- | --- | --- | --- | --- | --- | --- |
| hard | uProfile/gray | 18 747 | 25 029 | 19 657 | 19 657 | 3 552 |
| hard | verticalProfile/gray | 75 501 | 95 302 | 78 956 | 78 956 | 19 953 |
| hard | closingProfile/gray | 35 | 35 | 35 | 35 | 35 |
| hard | horizontalProfile/gray | 17 113 286 | 48 565 146 | 44 854 331 | 36 884 890 | 7 677 |
| hard | topRail/gray | 7 385 | 7 483 | 7 483 | 7 483 | 2 512 |
| hard | bottomRail/gray | 6 358 | 6 448 | 6 448 | 6 448 | 2 496 |
| fast | uProfile/gray | 5 351 | 6 933 | 5 351 | 5 351 | 2 502 |
| fast | uProfile/black | 1 372 | 1 589 | 1 372 | 1 372 | 1 109 |
| fast | verticalProfile/gray | 18 876 | 23 951 | 18 876 | 18 876 | 10 092 |
| fast | verticalProfile/black | 6 446 | 7 155 | 6 446 | 6 446 | 5 525 |
| fast | closingProfile/gray | 339 | 339 | 339 | 339 | 339 |
| fast | horizontalProfile/gray | 1 205 591 | 2 394 985 | 1 973 675 | 1 971 152 | 5 670 |
| fast | horizontalProfile/black | 6 144 | 7 813 | 6 144 | 6 144 | 1 356 |
| fast | topRail/gray | 2 515 | 2 600 | 2 515 | 2 515 | 1 646 |
| fast | topRail/black | 334 | 334 | 334 | 334 | 334 |
| fast | bottomRail/gray | 2 364 | 2 449 | 2 364 | 2 364 | 1 650 |
| fast | bottomRail/black | 340 | 340 | 340 | 340 | 340 |

Kaikki keep-luvut ovat kumulatiivisia välivaihelukuja: jo säilytetty vektori voidaan lukea taas seuraavassa päivityksessä. Distinct ei tarkoita kaikkien ajon kuvioiden globaalia uniikkimäärää. Vaikealla Vaakaprofiililla syntyy 17 113 286 uusia määrävektoreita; kopioitavia vektorielementtejä kertyy 207 647 074 (vertailussa 10 234 756). keep syötteessä jokainen viittaus aiheuttaa yhden join-avaimen.

Vaikeassa tapauksessa 48 565 146 syöteviittauksesta jää deduplikoinnin jälkeen 44 854 331, ja kymmenen kuvion kiintiön jälkeen 36 884 890. Duplikaatteja poistuu 7,6 %, ja kiintiö leikkaa 7 969 441 välivaiheviittausta. Yhdessä keep-kutsussa on korkeintaan 20 syötekuviota / 20 uniikkia; säilytettyjä korkeintaan 10. Siis yksittäinen distinct-joukko on rajattu, mutta toistuvien pienten joukkojen käsittely on valtava.

## Mihin aika kuluu

| Funktio/kehys | Vaikea CPU-arvio ms | Osuus % | Vertailu CPU-arvio ms |
| --- | --- | --- | --- |
| findCandidatePatternsDP | 36 209 | 92,38 | 2 265 |
| keepDistinctPatterns | 29 836 | 76,12 | 1 454 |
| (garbage collector) | 1 111 | 2,84 | 99 |
| compareQuantities | 513 | 1,31 | 16 |

Inclusive-rivit ovat sisäkkäisiä: keep sisältyy DP:hen, ja compareQuantities sisältyy keepiin. Niitä ei saa laskea yhteen. CPU-ajon keep-osuus 76,1 % vastaa sen omassa noin 39 s ajossa 29,84 sekuntia. Jos osuus siirretään baseline-mediaaniin, karkea arvio on noin 26,4 sekuntia keepin alla; tämä on arvio eikä erikseen mitattu eksakti aika.

Keepin omista positionTicks-näytteistä 13 070 / 18 400 (71,0 %) osuu app.js:n riville 2953, quantities.join(','). Tämä tukee noin puolen koko ajoajan käyttämistä avainten muodostukseen, mutta JIT/inlining estää tarkkojen yksittäisoperaatiosekuntien väittämisen. Mapin luonti, has/set, values-taulukko ja sort näkyvät myös. findCandidatePatternsDP:n omissa näytteissä (15,75 % koko ajosta) näkyvät määrävektorin kopiointi rivillä 2992, syötteen array-levitykset rivillä 3002 ja kapasiteettien sort rivillä 2979. findMaterialSourceCandidates-kehykselle kohdistuu 3,36 % ja GC:lle noin 2,8 %; muistin varaukset ovat merkittävä sivukulu mutta eivät yksin selitä 35 sekuntia. Scoring, sahausfysiikka ja scheduler eivät ole pääpullonkaula.

| Tapaus / Vaakaprofiili harmaa | Otoksia | Kopiointiryhmät ms otoksessa | join+Map ms otoksessa | values+sort+slice ms otoksessa |
| --- | --- | --- | --- | --- |
| hard | 6716 | 5,305 | 37,567 | 5,883 |
| fast | 1017 | 0,532 | 2,125 | 0,463 |

Otosajat eivät ole koko ajon aikoja, eikä jokaisen join-kutsun ympärille lisätty kelloa. Ne näyttävät vaiheiden keskinäistä suuruusluokkaa. Sample-ajojen kokonaisajat ovat 46,31 s ja 4,13 s; niitä ei käytetä production-nopeuksina. Count- ja sample-ajojen jokaisen 26 070 DP-kutsun kuviotyömäärät täsmäävät. Kaikkien 12 ajon 102 varianttituloksen kysyntä, lähteet ja beam-tilastot täsmäävät saman tapauksen baselineen. Myös lähde- ja aineistohashit tarkistetaan nykyisiin tiedostoihin; validation.json tallentaa tarkistuksen yhteenvedon.

## Toistuvat kuviokutsut ja lähteet

Vaikealla Vaakaprofiililla on 898 kutsua, 777 täsmälleen erilaista [items järjestyksineen ja määrineen, sourceLength, kerf, limit] -syötettä sekä 167 erilaista kysyntäsyötettä ilman lähdepituutta. 121 täsmällistä uusintaa kuluttaa counts-ajossa yhteensä vain 1,15 ms / 43 428 ms kuviolaskenta-ajasta. Lähdepituuksien väliset kutsut ovat samankaltaisia, mutta eivät samoja; kapasiteettiraja muuttaa chunkien rajauksia ja välitiloja, joten tuloksia ei voi yhdistää pelkällä epätarkalla avaimella.

| Vaakaprofiili harmaa, lähde mm | Vaikea kutsut | Vaikea keep-kutsut | Vertailu kutsut | Vertailu keep-kutsut |
| --- | --- | --- | --- | --- |
| 5447.8 | 137 | 1 126 081 | 40 | 156 024 |
| 5172.5 | 183 | 1 279 613 | 129 | 196 984 |
| 5005.4 | 187 | 1 181 666 | 140 | 160 428 |
| 4901.7 | 190 | 1 172 866 | 150 | 173 696 |
| 6000 | 201 | 2 132 957 | 161 | 349 505 |

Kummallakin on samat neljä jäännöstä 5447,8 / 5172,5 / 5005,4 / 4901,7 mm ja rajaton uusi 6000 mm. Materiaalilähteiden määrä ei siis selitä eroa. Beam laajentaa 201 vs 161 tilaa, ja max on molemmissa 20. Vertailun koko batchilla on jopa enemmän variantteja ja DP-kutsuja: kutsumäärä tai beam-leveys ei ole ensisijainen syy.

## Kolme rajattua optimointivaihtoehtoa

1. **Yhdistä kaksi jo järjestettyä pattern-listaa suoraan.** Kohdekapasiteetin vanha lista on lexicografisesti järjestetty, uniikki ja enintään 10 pitkä. Lähdekapasiteetin lista on samoin järjestetty; saman itemIndex-komponentin vakiosiirto säilyttää sen järjestyksen ja uniikkiuden myös uusissa vektoreissa. Kahden listan merge voi vertailla compareQuantities-säännöllä, poistaa identtiset vierekkäiset vektorit ja pysähtyä kymmenenteen. Tasatilanteessa valitaan vanhan listan ensimmäinen vektori kuten nykyisen Mapin first-wins-logiikassa. Tämä poistaa join-avaimet, Mapin ja yleisen sortin. Muistia tarvitaan vain enintään 10 tulosviittaukseen nykyisen usean välirakenteen sijaan. Monimutkaisuus on pieni/keskisuuri; riski on väärä järjestys-, dedup- tai katkaisuehto. Potentiaali on suurin: kohde on noin 76 % CPU-ajasta. Teoreettinen nollakustannuksen yläraja on noin 4,2× koko ajolle; käytännön 1,5–3× on tutkimushypoteesi, ei mitattu lupaus. Kuviojoukkoa, järjestystä, tasatilanteita tai beam-semanttiikkaa ei tarvitse muuttaa.

2. **Laske muuttumattoman määrävektorin avain vain kerran.** WeakMap vektorioliosta sen join-avaimeen voisi säilyttää nykyisen Map-deduplikoinnin ja sortin. Vaakaprofiililla 48,6 miljoonaa keep-viittausta mutta 17,1 miljoonaa uutta vektorikopiota viittaa enintään noin 65 % join-uusintojen poistopotentiaaliin; todellinen hyöty riippuu avainvälimuistin hinnasta ja vektorien elinkaaresta. Jos join on noin puolet ajasta, karkea laskennallinen yläraja tällä osuudella on noin 1,5× ennen välimuistin kustannusta. Muistia kuluu lisää elävien vektorien avaimiin ja WeakMapiin; pysyvä tavallinen Map voisi pitää kuolleet vektorit turhaan muistissa. Monimutkaisuus pieni, semanttinen riski pieni vain jos vektorien muuttumattomuus varmistetaan. Ei muutosta kuviojoukkoon, järjestykseen, tasatilanteisiin tai beam-hakuun. Tämä on vaihtoehto mergelle, ei automaattisesti sen päälle lisättävä ratkaisu.

3. **Ohita yleinen dedup/sort tyhjälle kohdekapasiteetille.** Kun kohdetta ei vielä ole, uusi lista on yksinään jo järjestetty ja uniikki. Siinä on enintään 10 vektoria. Tällöin keep-rakenteita ei tarvita. Vaakaprofiilin uusien kohteiden määrä on saavutettujen kapasiteettien summa miinus nollatilat eli 1 134 248 / 6 893 183 päivitystä (noin 16,5 %). Nämä ovat keskimäärin pienempiä listoja, joten prosentti ei ole sama kuin säästettävä aika; potentiaali on todennäköisesti selvästi mergeä pienempi ja mitattava erikseen. Lisämuistia ei tarvita, välivaraukset vähenevät. Monimutkaisuus hyvin pieni. Semantiikka voi säilyä täysin, mutta uusien listojen järjestys/uniikkius ja myöhempi mutatoimattomuus on todistettava. Hyöty limittyy merge-vaihtoehdon kanssa.

Täsmällisen kokonaisen kuviotuloksen välimuistia ei suositella ensimmäiseksi: mitattu uudelleenlaskennan ajansäästö on tässä vaikeassa variantissa vain millisekuntien luokkaa. Mittojen yhdistäminen, pyöristäminen, rivien uudelleenjärjestäminen, kiintiön pienentäminen tai beam-haun karsiminen muuttaisivat hakua eivätkä kuulu näihin ehdotuksiin.

## Hyväksymistestit mahdolliselle seuraavalle toteutukselle

- Vertaile vanhaa ja ehdotettua keep/merge-tulosta samoilla järjestetyillä listoilla: identtiset vektorit listojen välillä, tyhjä kohde, yksi kuvio, täydet 10+10 listat, kiintiö 1/2/10, erot vasta viimeisessä vektorikomponentissa ja old-first-tasatilanne. Uusien vektorien muodostuksen pitää käyttää alkuperäistä item-järjestystä.
- Aja nykyiset 1 354 järjestettyä kuvioregressiota sekä koko plan/score/operation-vertailu; lisää kerf 0/3/3,4, 0,1 mm rajat, binäärisen hajotelman loppulohkot ja äärelliset lähteet. Pelkkä sama score ei riitä.
- Vaikean ja nopean tapauksen koko suunnitelman sekä beam stats -lukujen tulee säilyä. Syötteet ja rinnakkaiset tilat eivät saa mutatoitua. Avainvälimuistin tapauksessa varmista erikseen vektorien elinkaari ja että avain ei jää vanhaksi mutaation jälkeen.
- Core 35/35, production/persistence 18/18 ja productioniin siirrettäessä vähintään oikea selainpolku. Mittaa nopeus instrumentointia käyttämättä vähintään kolmella peräkkäisellä toistolla sekä muistivaikutus erikseen.

## Toistaminen ja tiedostot

Tämän tutkimuksen lopputarkistukset: core-ajurin 35/35 ryhmää, tuotannon ohjaus-/persistenssit 18/18, 1 354 järjestettyä kuviotapausta, 14 tallennettua kokonaista suunnitelmaa samoine scoreineen ja operaatioineen sekä yksi aiemmin aikakatkaistu tapaus valmistunutta referenssiä vasten läpäistiin. Molempien uusien apurien syntaksitarkistus ja git diff --check läpäistiin. Gitin seuraamiin tiedostoihin ei jäänyt eroja HEADiin; lisäykset ovat vain tämän tutkimuksen benchmark-apurit, raportti ja mittausaineisto. Selaintestiä ei ajettu tässä Node-profilointitehtävässä.

Projektijuuresta: node benchmarks/batch-search/profile-reachable.cjs hard baseline 1. Vaihda hard → fast, baseline → counts/cpu/sample ja toiston numero tarpeen mukaan. Baseline ajettiin numeroilla 1–3, muut tilat numerolla 1. Aja peräkkäin. Sen jälkeen node benchmarks/batch-search/summarize-reachable-profile.cjs kokoaa summary.jsonin ja tämän raportin. Node käyttää vain sisäänrakennettuja moduuleja. Koodi ei kirjoita production-tiedostoihin, inventory-study-fixtureihin tai selainvarastoon.

reachable-profile/*.json sisältävät varianteittaiset tiedot ja counts/sample-ajoissa jokaisen DP-kutsun laskurit. *.cpuprofile ovat Node inspectorin raakanäytteitä. Baseline-ajoissa calls on tarkoituksella tyhjä (ei lisälaskureita), ei nolla todellista kutsua. Raportin laskurit tulevat counts-ajosta; baseline-ajat erillisistä kolmesta toistosta. Laskuriajojen millisekunteja ei pidä käyttää vertailukelpoisina production-aikoina. Prosessien tai JIT:n vaihtelun vuoksi prosenttiosuudet ovat arvioita.

Raakadatan capacityKeysSorted-laskurin nimi on epätarkka: se laskee chunk-kierrosten alussa otettujen kapasiteettiavainkuvien koon ennen kapasiteettirajan suodatusta, ei varsinaiseen sortiin päätyvien avainten määrää. Sitä ei käytetä lajittelutyön täsmällisenä mittana. Raportin kapasiteettitaulukko käyttää erillistä reachable-laskuria.

Pienin suositeltu seuraava toteutus on kahden järjestetyn pattern-listan täsmällinen merge, ensin erillisenä regressiovertailuna. Tässä tehtävässä sitä ei toteutettu. Ei commitia.
