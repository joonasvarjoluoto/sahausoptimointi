# Kapasiteettivaramallin fixture-vertailu

Vertailun lähtöpiste on commit `863f612` ennen lähde- ja kappalekohtaisten
kapasiteettivarojen käyttöönottoa. Uusi aktiivinen malli käyttää 20 mm:n
`sourceCapacityAllowance`-varaa lähdettä kohti ja 1 mm:n
`pieceCapacityAllowance`-varaa kappaletta kohti. Nimelliset lähde- ja
kappalepituudet sekä kerf-asetus säilyvät.

Kaikkien nykyisten suunnitelmien jokainen salko läpäisi kapasiteettitaseen:

`sourceLength = kappaleiden nimellispituudet + waste + remaining + totalCapacityAllowance`

Kun vanha ja uusi kuvio olivat samat, uuden `nominalRemaining`-kentän arvo oli
aina täsmälleen vanha `remaining`. Turvallinen `remaining` pieneni tällöin vain
lähde- ja kappalevarausten verran. Score-asetuksia, comparator-järjestystä,
beam-leveyttä tai kuviokiintiöitä ei muutettu. Kuvio-, tankomäärä-, disposition-
ja scheduler-erot syntyvät siitä, että uusi fyysinen kelvollisuusraja poistaa
vanhoja raja-arvokuvioita ja pisteyttää vain turvallisesti käytettävän
jäännöksen.

## Neljä kehitysfixturea

| Fixture | Ennen | Jälkeen | Selitys |
| --- | --- | --- | --- |
| Testi A ilman jäännöksiä | 17 salkoa, score 95615.790, 21 sahausoperaatiota | 17 salkoa, score 95721.067, 25 sahausoperaatiota | Kaksi vaakaprofiilisalkoa jakautuu uudelleen, koska vanhojen kuvioiden turvallinen kapasiteetti ei riitä. Muiden salkojen kuviot ja nimelliset loppupituudet säilyvät; turvalliset jäännökset vähenevät kapasiteettivaroilla. |
| Testi A jäännöksillä | 22 salkoa, score 78575.206, 24 sahausoperaatiota | 22 salkoa, score 78621.516, 24 sahausoperaatiota | Lähteet, kuviot, kerf-hukka ja scheduler-operaatiot ovat identtiset. Vain turvalliset jäännökset, disposition-arvot ja niistä johdettu score muuttuvat. |
| Testi D1 | uusi 6000 mm salko, jäännös 1594 mm, score 5758.243 | nimellinen loppupituus 1594 mm, turvallinen jäännös 1572 mm, score 5769.726 | Kaksi kappalevarausta ja 20 mm lähdevaraus vähentävät turvallista jäännöstä 22 mm. Vanha 3900 mm jäännös jää edelleen käyttämättä, ja kuvio, kerf sekä kaksi scheduler-operaatiota säilyvät. |
| Profiilieristys | epätäydellinen, 0 salkoa | epätäydellinen, 0 salkoa | Tulos ei muutu. |

## Tallennetut batch-search-fixturet

`run-pattern-regressions.cjs` käyttää edelleen samoja 15 tapausta ja lukitsee
niiden nykyiset täydet scoret ja materiaaliplanit yhteen digestiin. Historiallisia
`manual`- ja `pattern-cache`-tuloksia ei muutettu. Taulukon kuviosalkojen määrä
kertoo, kuinka monen salkoindeksin lähde tai kuvio eroaa vanhasta checkpointista;
jos tankomäärä muuttuu, myös siirtyneet profiiliblokit sisältyvät määrään.

| Varasto | Tilaukset | Salot | Score ennen → jälkeen | Kuviosalkoja | Dispositioneja | Operaatiot | Release |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| ei jäännöksiä | 1+2 | 31 → 31 | 156209.766 → 156313.966 | 9 | 2 | 55 → 61 | 0 → 0 |
| ei jäännöksiä | 1+2+3 | 40 → 39 | 211309.302 → 212043.650 | 30 | 13 | 79 → 83 | 0 → 0 |
| ei jäännöksiä | 1+4+17+18 | 80 → 76 | 449276.088 → 449684.015 | 66 | 25 | 107 → 99 | 4 → 0 |
| ei jäännöksiä | 8+12+15+17+20 | 109 → 110 | 568334.910 → 573523.470 | 38 | 16 | 136 → 128 | 5 → 0 |
| A | 1+2 | 35 → 35 | 143924.795 → 143685.020 | 6 | 1 | 51 → 55 | 0 → 0 |
| A | 1+2+3 | 46 → 45 | 200816.919 → 201261.460 | 44 | 15 | 73 → 80 | 0 → 0 |
| A | 1+4+17+18 | 84 → 83 | 425770.046 → 426397.237 | 35 | 13 | 96 → 95 | 1 → 0 |
| A | 8+12+15+17+20 | 113 → 116 | 550818.842 → 552380.960 | 53 | 23 | 132 → 124 | 5 → 0 |
| B | 1+2 | 39 → 37 | 146239.770 → 146994.453 | 11 | 3 | 51 → 53 | 0 → 0 |
| B | 1+2+3 | 46 → 43 | 203360.331 → 204660.559 | 32 | 14 | 77 → 79 | 0 → 0 |
| B | 1+4+17+18 | 84 → 80 | 440958.504 → 443506.799 | 70 | 22 | 98 → 104 | 2 → 0 |
| B | 8+12+15+17+20 | 111 → 113 | 562334.020 → 565470.812 | 39 | 19 | 136 → 127 | 5 → 0 |
| C | 1+2 | 34 → 33 | 149363.930 → 149347.346 | 14 | 3 | 58 → 55 | 0 → 0 |
| C | 1+2+3 | 44 → 44 | 193483.268 → 193840.185 | 13 | 1 | 80 → 78 | 0 → 0 |
| C | 1+4+17+18 | 80 → 78 | 431620.852 → 430343.560 | 62 | 19 | 97 → 102 | 1 → 0 |

Vanhojen `release`-operaatioiden poistuminen on odotettu scheduler-muutos.
Oletusvarojen kanssa turvallisen kapasiteetin loppuminen ei ole nimellinen
täsmäsovitus: fyysisessä salossa on vielä viimeisteltäväksi varattu pää, joten
viimeinen kappale tehdään `cut`-operaationa. Ilman kapasiteettivaroja aidon
nimellisen täsmäsovituksen `release`-semantiikka säilyy regressiotesteissä.

Järjestettyjen 1 354 DP-kuviotapauksen määrävektorit ja järjestys säilyivät,
kun kapasiteettivarojen arvot ovat nolla. Niiden rakenteellinen digest muuttui,
koska candidate-olioihin lisättiin nolla-arvoiset kapasiteettimetatiedot.
