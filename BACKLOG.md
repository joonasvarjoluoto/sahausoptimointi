# Avoin backlog

Tässä ovat todelliset avoimet ongelmat ja rajoitteet. Merkintä ei anna toteutuslupaa. Kehitysjärjestys on [roadmapissa](ROADMAP.md); [valmistuneet B-001/B-003/B-004/B-005/B-007/B-009/B-013](docs/history/COMPLETED_BACKLOG.md) ovat historiassa. ID:tä ei käytetä uudelleen.

Tila: havaittu, suunniteltu tai tutkittavana. Prioriteetti kertoo vaikutuksesta, ei automaattisesta toteutusjärjestyksestä. Sulje valmistunut kohta siirtämällä sen olennainen näyttö historiaan tai tutkimusraporttiin.

## B-014 — Restore named snapshot as active work safely

- **Tila / prioriteetti:** suunniteltu, erikseen rajattava; käyttäjän jatkotehtävä 12.9.2026.
- **Rajoite:** nimetty snapshot on vain katseltava arkisto. Sitä ei voi palauttaa aktiiviseksi työksi eikä sen tuotantoa jatkaa.
- **Hyväksymisraja:** päätä myöhemmin aktiivisen työn suojaus, fyysisen tuotannon ja varaston vanhenemisen käsittely, V1/V2/V3-toteumien palautuskelpoisuus, vahvistus, atominen vaihto sekä recovery/undo-rajat. Pelkkä vanhan JSONin kirjoitus currentWork-avaimeen ei ole turvallinen restore. [Snapshot-sopimus](docs/ARCHITECTURE.md#nimetyt-paikalliset-snapshotit).

## B-006 — Synkroninen batch-haku suurissa tilausjonoissa

- **Tila / prioriteetti:** havaittu, keskitaso; tutkittava ennen suuren jonon tavallista käyttöä. Havaittu 8.9.2026.
- **Ongelma:** aktiivinen selector käy kaikki sopivat tilausyhdistelmät läpi synkronisesti; jokainen tarvitsee materiaaliratkaisun. Syöteraja 100 tilausta ei takaa käytettävää vasteaikaa.
- **Näyttö / vaikutus:** 10 pientä tilausta voi tuottaa 1023 osajoukkoa. Historiallisessa 23 tilauksen / 1231 kappaleen aineistossa (16 pois) oli 85 030 kelvollista ehdokasta. Aiempi noin 11 päivän arvio oli ekstrapolaatio, ei tehty kokonaisajo eikä nykyversion mittaus.
- **Tutkimus:** [Node-hakukoe](benchmarks/batch-search/RESULTS.md) ja [inventory-study](benchmarks/batch-search/inventory-study/RESULTS.md) tukevat rajattua kaksivaiheista hakua, mutta eivät todista yleistä laatua tai oletusaikaa. Koeversio ei ole selaimessa.
- **Seuraava hyväksymisraja:** uusia jonoja, aloitussiemeniä ja äärellisiä varastoja; materiaalilaatu ajan funktiona ja paras valmis validoitu tulos. Erota materiaalihakijan rivijärjestysherkkyys selectorin ehdokasvalinnasta: samankin batchin piste vaihteli tutkimuksessa. Säilytä alkuperäinen järjestys, kunnes erillinen laatututkimus perustelee muutoksen. Ennen UI-toteutusta rajaa peruutus, syöterevisio ja suurten jonojen generaattori ilman täyttä osajoukkoluetteloa.

## B-011 — Monimittaisen materiaalivariantin jäljellä oleva DP-kustannus

- **Tila / prioriteetti:** havaittu, keskitaso. Jatkaa B-007:n avoimeksi jäänyttä osaa; kirjattu erilliseksi 10.9.2026, havainto 9.9.2026.
- **Ongelma:** reachable-state-DP ja vakaa merge poistivat tyhjien kapasiteettien ja join/Map/sort-polun työtä, mutta pienien pattern-listojen yhdistämistä ja määrävektorien kopiointia kertyy edelleen paljon.
- **Näyttö:** [merge-raportissa](benchmarks/batch-search/PATTERN_MERGE_RESULTS.md) A / 3+9+21 -materiaalimediaani oli 34,69 → 20,23 s; jälkeen-profiilissa merge noin 45,1 % ja DP:n muu oma työ 43,0 %. Harmaan Vaakan 74 kappaletta / 13 mittaa hallitsi aikaa. Nämä ovat kapasiteettivaramallia edeltäviä mittauksia, eivät nykyversion uudelleen mitattuja nopeuksia.
- **Vaikutus:** yksittäinen normaalisti laskettava batch voi edelleen jäädä sekuntien käyttötavoitteen ulkopuolelle; yleistä vasteaikatakuuta ei ole.
- **Seuraava tutkimus:** varmista ilmiö nykyisillä kapasiteettiasetuksilla pienessä vertailussa, profiloi merge-kutsujen määrä ja vektorikopiot ilman kuumimman silmukan kellotusta. Priorisoi täsmällistä työn vähentämistä. Hyväksy mahdollinen optimointi vain samoilla järjestetyillä kuvioilla, täydellä plan/score/operation-tuloksella ja mutatoimattomuudella; ei score-, rivijärjestys- tai beam-karsintamuutosta samalla.

## B-002 — Osittaisten inventory-beam-tilojen heuristinen järjestys

- **Tila / prioriteetti:** havaittu, matala.
- **Ongelma:** osittaisten tilojen järjestys ei käytä samaa materiaalitalousmallia kuin valmiiden suunnitelmien scoreCompleteMaterialTransitionPlan.
- **Vaikutus:** lupaava tila voi karsiutua ennen kokonaispisteytystä. Valmis tulos voi olla kelvollinen mutta heikompi kuin toinen löydettävissä oleva.
- **Hyväksymisraja:** ensin pienet oracle- tai kattavat vertailut ja konkreettinen laatupoikkeama; vasta sitten rajattu ranking-muutos. Ei hakulaadun väittämistä pelkkien PASS-regressioiden perusteella. [Materiaalimalli](docs/domain/MATERIAL.md).

## B-008 — Replayn pitkät jäännökset poikkeavat fyysisestä varastosta

- **Tila / prioriteetti:** havaittu, matala; avataan uudelleen vain erillisen score-/varastokalibroinnin yhteydessä. Havaittu 9.9.2026.
- **Ongelma:** replayhin jäi 34 vähintään 3000 mm palaa; käyttäjän noin 100 palan varastossa suurin osa on noin 1300–1800 mm ja enintään noin kolme yli 2000 mm.
- **Vaikutus:** synteettistä pituusjakaumaa ei voi pitää normaalina inventaariona tai score-kalibroinnin todisteena.
- **Seuraava tutkimus:** suurempi tilausaineisto ja fyysinen reality check. Erota scoren, scoresta erillisen säilytyspolitiikan ja kysyntä-/batch-virran vaikutukset. Poikkeama ei yksin todista scorea vääräksi. [Replay-raportti](benchmarks/batch-search/flow-replay/RESULTS.md), [tuotantohavainnot](DOMAIN_NOTES.md).

## B-010 — Kappalemäärä ei yksin kuvaa batchin työkuormaa

- **Tila / prioriteetti:** havaittu, keskitaso; erillinen myöhempi mittaustyö. Havaittu 9.9.2026.
- **Ongelma:** sama 250 kappaletta voi olla pitkiä Pystyjä tai lyhyitä Vaakoja; sahan ympäristön tila, kantaminen ja jälkikäsittely kuormittuvat eri tavalla.
- **Vaikutus:** nykyinen kappalemääräraja ei ennusta fyysistä kuormaa, vaikka profiiliblokit rajaavat valmistelua.
- **Hyväksymisraja:** mittaa kokonaismetrit, profiili, tilantarve ja jälkikäsittely ennen laskentakaavaa. Kantomäärä on operaattorin päätös. Älä muuta selectorin nykyisiä kokorajoja tai scorea ilman erillistä päätöstä. [Tuotantohavainnot](DOMAIN_NOTES.md).

## B-012 — Vanha sparse-tutkimusmuunnos ei hyväksy nykyistä productionia

- **Tila / prioriteetti:** havaittu, matala; tutkimustyökalun toistettavuus. Vahvistettu 10.9.2026 dokumentaatioauditissa.
- **Ongelma:** `createRuntime(data, { sparsePatterns: true })` kutsuu alkuperäiselle dense-funktiolle tehtyä lähdemuunnosta ilman jo-sparse-tarkistusta. Nykyisen lähteen alustus päättyy `Sparse experiment anchor changed` -virheeseen ennen optimointia. Esimerkiksi vanha sparse-probe ja inventory-study-haun oletusreitti käyttävät tätä valintaa.
- **Vaikutus:** vanhat toistokomennot eivät sellaisenaan toista koetta nykyversiolla. Erillinen run-sparse-regressions-ajuri tunnistaa jo-sparse-productionin ja on eri polku; pysyvä nykyversion pattern-ajuri ei tarvitse tutkimusmuunnosta.
- **Hyväksymisraja:** rajaa erillisessä työssä vanhan dense/sparse-kokeen ja nykyversion tutkimuksen lähdeversiot; älä naamioi kahta nykyistä sparse-ajoa dense/sparse-vertailuksi. Lukitse vanhan lähteen muunnos, nykyisen lähteen käsittely ja aidosti muuttuneen ankkurin hylkäys. Production-optimizeria tai historiallisia tuloksia ei muuteta tämän korjauksen vuoksi. [Benchmark-ohje](benchmarks/batch-search/README.md).
