# Roadmap

Tämä kuvaa kehityssuunnan, ei anna lupaa toteuttaa koko suunnitelmaa. Aktiivinen rakenne on [arkkitehtuurissa](docs/ARCHITECTURE.md), toteutuksen säännöt [materiaalimallissa](docs/domain/MATERIAL.md) ja [tuotantomallissa](docs/domain/PRODUCTION.md). Avoimet yksittäiset ongelmat ovat [backlogissa](BACKLOG.md), fyysiset perusteet [tuotantomuistiinpanoissa](DOMAIN_NOTES.md).

## Nykyinen checkpoint

Sovellus valitsee kokonaisista tilauksista materiaalipisteellä batchin, optimoi materiaalin ja muodostaa erillisellä schedulerilla nippusahauksen profiiliblokeittain. Worker-numerointi, järjestetyt kuittaukset, undo/reload, UI:n toistoryhmät, 3+3-esitys ja aktiivisen blokin materiaalivalmistelu toimivat. Operaattori päättää materiaalin kantotavan. B-009:n ensiversio kirjaa yhden korvatun salon nykyisessä operaatiossa, säilyttää alkuperäisen suunnitelman ja johtaa fyysisen toteuman. Mahdoton jatko pysäyttää työn; kelvollinen valmis toteuma määrää finalisoinnin varastosiirtymän.

B-013:n rajattu jatkopolku on käytössä: pysähtyneestä työstä muodostetaan tekemättömille kappaleille V3-jatkosuunnitelma alkuperäisiltä fyysisiltä lähteiltä. Sama tuotantokortti säilyttää worker-numerot, reload/undo-rajan ja yhdistetyn finalisoinnin. Koko käyttöpolku sekä jatkon kiskosekapari on testattu oikeassa selaimessa; näyttö ja rajat ovat [valmistuneissa backlog-kohdissa](docs/history/COMPLETED_BACKLOG.md).

Mahdollisessa esimiesdemossa kokonaisuus esitellään prototyyppinä; demo tai regressioiden läpäisy ei yksin todista tuotantovalmiutta. Näkyvä käyttöpolku ja materiaalitalouden selitettävyys säilyvät tärkeinä.

Sahausfysiikka ja ensimmäinen material/inventory-core ovat omissa moduuleissaan. Kapasiteettivarat ovat käytössä erillään kerfistä. Reachable-state-DP ja vakaa pattern-merge ovat productionissa. Batch-selector on edelleen synkroninen exhaustive-haku; tutkimuksen anytime-hakua ei ole kytketty selaimeen. Testit ja checkpointien käyttö on kuvattu [TESTING.md](docs/TESTING.md):ssä.

## Seuraava konkreettinen vaihe

**Jatkopolun käytännön tuotantovarmistus ja seuraavan työalueen valinta.** B-013:n pysähdys → jatko → reload/undo → finalisointi on toteutettu ja testattu. Pienin seuraava askel on operaattorin arvio nykyisillä käyttöohjeilla realistisesta työstä; seuraava koodivaihe rajataan erikseen alla olevista avoimista työalueista. Jatkon uutta poikkeamakierrosta tai manifestin ulkopuolista materiaalia ei lisätä automaattisesti.

## Seuraavat työalueet ja riippuvuudet

| Työalue | Pienin järkevä eteneminen | Edellytys |
| --- | --- | --- |
| Tuotannon luotettavuus | Toteutuneen jatkopolun tuotantovarmistus; myöhemmin erikseen rajattu batch-historia. Vasteen nippukapasiteetti vahvistetaan erikseen | Fysiikka, jäljitettävyys ja persistoi-ensin-turva säilyvät |
| Vaihe 1b: pienet moduulirajat | Material-core on irrotettu. Seuraava raja valitaan todellisista riippuvuuksista; optimizer vasta materiaalirajan selkiydyttyä, UI/persistenssin I/O myöhemmin | Täydet ennen/jälkeen-regressiot; ei käyttäytymismuutosta samassa refaktorissa |
| Vaihe 1c: varaston käytettävyys | Todellisten saldojen käyttöönotto → hälytysluokittelu → profiiliaccordionit ja poikkeusyhteenveto → erillinen vastaanotto | Tuntemattoman/rajattoman saldon tulkinta ja alkusaldojen kirjaaminen päätetään; hälytys ei muuta optimizerin saatavuutta |
| Kapasiteetin tuotantovarmistus | Mittaa lähteet, päät ja kappalepoikkeamat; kalibroi yhteiset varat erikseen | Nykyinen malli on toteutettu, mutta konservatiiviset oletukset eivät vielä ole laajasti tuotannossa kalibroituja |
| Hakulaatu ja suorituskyky | B-011:n jäljellä oleva kuviolaskentatyö ja B-006:n batch-haun laatukäyrät erillisinä tutkimuksina | Eri jonot, siemenet ja äärelliset varastot; normaalin valitun batchin laskenta ei saa hidastua |
| Vaihe 2: laatumittaus | Kiinteät vaikeat fixturet, seedatut satunnais-/property-testit ja pienten tapausten oracle | Mittarit: optimum-osumat, keski-/p95/p99-/pahin poikkeama; ei viritystä vain muutamalla esimerkillä |

Nämä voidaan rytmittää tarpeen mukaan; UI:n täydellinen uudelleenjärjestely ei ole oraclen tai satunnaistestauksen edellytys. Nykyinen optimizer toimii jo ilman DOM:ia. Jokainen työ rajataan erikseen.

Batchin fyysistä kuormaa (B-010) tutkitaan myöhemmin kappalemäärän, metrien, profiilin, tilan ja jälkikäsittelyn avulla. Nykyistä kokoa tai pisteytystä ei muuteta ilman mitattua mallia. Materiaalihakijan sisäinen rivijärjestysherkkyys on erillinen laatututkimus, ei tekninen siivous.

## Myöhemmät suunnat

- **Materiaalivaihtoehdot:** pieni top-K/Pareto-joukko aidosti erilaisia varastosiirtymiä; näytä uuden materiaalin, jäännösarvon, hukan ja pirstoutumisen erot. Edellyttää laatumittausta.
- **Tuotanto ja haku:** peruutettava taustalaskenta, anytime-tulos ja suuren jonon rajattu ehdokasgeneraattori vasta tutkimuksen jälkeen. Deadline, anti-starvation, työaikapisteet ja mahdollinen rolling/continuous-suunnittelu ovat erillisiä päätöksiä.
- **Talouskalibrointi:** todellinen kysyntähistoria ja jäännösten kierto ennen parametriverkkoja tai muuta viritystä. Koneoppiminen vain riittävällä datalla ja selvällä tavoitemuuttujalla; ei automaattista neuroverkkoratkaisijaa.
- **Tilausten tuonti:** mahdollinen kuvatulkinta → käyttäjän tarkistus → normalisoitu kysyntä; myöhemmin Easoft-/yritysjärjestelmäadapteri, jos rajapinta saadaan. Core ei riipu tuontimuodosta. Salainen API-avain ei kuulu selaimeen; nykyinen staattinen julkaisu ei tarjoa salaista backendia.

## Suunnan kannalta olennaiset checkpointit

- Testattava puhdas core ja tilauspohjainen syöte mahdollistivat erillisen materiaalin ja tuotannon kehityksen.
- Diskreetti kokonaisia tilauksia käsittelevä batch ja nippusahaus korvasivat aiemmat putkitusluonnokset; kuittaukset ja aukkotunnukset ovat jo toteutettuja.
- Jäännösvirran tutkimus suljettiin tältä erää: [raportin](benchmarks/batch-search/flow-replay/RESULTS.md) varastojakauma ei kuvaa fyysistä varastoa. Score-kalibrointia tai laajaa uutta simulointia ei käynnistetä samalla pienellä aineistolla automaattisesti.

Vanha vaiheistus ja yksityiskohtaiset toteutus-/testitulokset säilyvät [roadmap-arkistossa](docs/history/ROADMAP_2026-09-10.md). [Demoluonnos](docs/history/DEMO_PLAN.md) on historiaa, ei toinen prioriteettilista. Päivitä tätä tiedostoa vain, kun checkpoint, seuraava vaihe tai kehityssuunta muuttuu.
