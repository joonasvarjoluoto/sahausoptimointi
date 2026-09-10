# Järjestettyjen pattern-listojen suora merge — 9.9.2026

> Historiallinen ennen/jälkeen-checkpoint 9.9.2026. Vakaa merge on productionissa; mittaukset edeltävät kapasiteettivaramallia eivätkä ole nykyversion nopeuslupaus. Nykytila: [materiaalimalli](../../docs/domain/MATERIAL.md), [tuotantomalli](../../docs/domain/PRODUCTION.md).

## Muutos ja semantiikka

`findCandidatePatternsDP()` yhdisti aiemmin kapasiteetin vanhan ja uuden pattern-listan, muodosti jokaiselle määrävektorille `join(",")`-avaimen, deduplikoi Mapilla, lajitteli koko tuloksen ja otti `maxPatterns` ensimmäistä.

Molemmat syötelistat ovat jo `comparePatternQuantities()`-järjestyksessä, distinct-muodossa ja enintään `maxPatterns` pitkiä. Uusi lista muodostetaan lähdelistasta lisäämällä jokaiselle vektorille sama määrä samaan komponenttiin. Muunnos on injektio ja säilyttää comparator-järjestyksen. Suora vakaa merge tuottaa siksi saman järjestetyn distinct-joukon. Comparator-tasatilanteessa vanha lista valitaan ensin, mikä vastaa aiemman `[...old, ...new]`-syötteen ja Mapin first-wins-käyttäytymistä. Kiintiö katkaisee vasta järjestetyn distinct-tuloksen.

Binary quantity chunkit, laskeva kapasiteettijärjestys, patternien item-järjestys, beam-haku, fysiikka ja pisteytys eivät muuttuneet.

## Ennen ja jälkeen

Ajat ovat materiaalilaskennan aikoja millisekunteina. Jokainen ajo käynnistettiin erillisessä Node-prosessissa samalla koneella ja samoilla asetuksilla. Ennen-ajat ovat erillisestä profilointicheckpointista `404b885`; jälkeen-ajot käyttävät tätä toteutusta.

| Tapaus | Ennen, yksittäiset | Ennen-mediaani | Jälkeen, yksittäiset | Jälkeen-mediaani | Nopeutus |
| --- | --- | ---: | --- | ---: | ---: |
| A 3/9/21, 200 kpl | 36 998,9 / 34 690,2 / 33 800,3 | 34 690,2 | 19 556,6 / 22 425,0 / 20 227,1 | 20 227,1 | 1,71× |
| A 1/4/17/18, 200 kpl | 2 416,0 / 2 308,7 / 2 300,3 | 2 308,7 | 1 940,2 / 2 077,5 / 1 777,8 | 1 940,2 | 1,19× |
| Ei jäännöksiä, 1/4/17/18, 200 kpl | 852 / 889 / 772 | 852 | 497 / 492 / 491 | 492 | 1,73× |

Jokaisessa tapauksessa koko tankosuunnitelma, materiaalipiste ja scheduler-operaatiot vastaavat täsmälleen ennen-muutosta tallennettua tulosta. Vaikean ja nopean A-tapauksen plan-hashit ovat vastaavasti `24306390ba723df1cb1c430c9b021731e26589256d1e372f963e84a56cdef9f2` ja `588c354271bd9c3ecb79a40cfc99da2e97c202b1d2516cf810fc412fac2559b1`.

## Poistunut työ ja uusi profiili

Vaikean harmaan Vaakaprofiilin DP tekee edelleen samat 898 kuviokutsua, 6 893 183 kapasiteettimergeä, 17 113 286 määrävektorikopiota ja 1 135 146 lopullista saavutettua kapasiteettitilaa. Beam-tilastot säilyvät samoina.

Näissä mergeissä aiemmin käsitellyt 48 565 146 pattern-viittausta eivät enää muodosta `join(",")`-avainta. Samoin 6 893 183 Map-deduplikointia ja yleistä lajittelua poistuivat. Jälkeen-laskuri tuottaa saman 36 884 890 kiintiön jälkeen säilytetyn välituloksen viittausta.

Jälkeen-ajon erillisessä CPU-otannassa `mergeDistinctSortedPatterns()` on suurin yksittäinen kehys: noin 8,41 s eli 45,1 % noin 18,67 sekunnin näyteajasta. `findCandidatePatternsDP()`-funktion muu oma työ vie noin 8,02 s eli 43,0 %. Seuraava rajattu tutkimuskohde on siten merge-kutsujen määrä ja kapasiteettipäivitysten vektorikopiointi, ei scoring tai scheduler.

## Varmistus

- Core-regressiot: 36/36 ryhmää.
- Tuotannon ohjaus- ja persistenssit: 18/18 tarkistusta.
- Pattern-regressio: 1 354 järjestettyä DP-tapausta samalla digestillä.
- Tallennetut kokonaiset tulokset: 14 aiemmin valmistunutta suunnitelmaa sekä yksi aiemmin aikakatkaistu mutta myöhemmin valmistunut referenssi; scoret ja operaatiot identtiset.
- Benchmark-apurien omat tarkistukset: 20/20.
- HTTP-selainpolku: nykyinen tallennettu 2 kappaleen kiskotilaus laskettiin osoitteessa `http://127.0.0.1:5500/index.html`; valmis kahden tangon suunnitelma ja yhden sahausliikkeen tuotantobatch muodostuivat ilman virhettä.
- Muuttuneiden JavaScript-tiedostojen syntaksitarkistus ja `git diff --check`: läpäisty.

Raaka-ajat ja hashit ovat tiedostossa `pattern-merge-results.json`. Profiloinnin ennen- ja jälkeen-ajot ovat `reachable-profile/`-hakemistossa.
