# Dokumentaatiorakenteen auditointi 10.9.2026

> Historiallinen muutosraportti, ei uusi aktiivinen ohjetiedosto. Tehtäväreititys ja ylläpito ovat [AGENTS.md](../../AGENTS.md):ssä. Auditoinnin lähtöcommit on `e22debf` ja työpuu oli puhdas. Ohjelmakoodia, testejä, fixtureja, skeemaa tai moottoriversiota ei muutettu.

## Lähtöaineisto ja tiedon sijoitus

Luettiin koko vanha AGENTS, roadmap, backlog, tuotantomuistiinpanot, tuotantosuunnitelma ja demoluonnos sekä rootin tulosraportti ja benchmark-dokumentit. Muut rootin ja benchmark-hakemistojen Markdown-tiedostot kartoitettiin. Rootin tuotantoaikaluonnos oli tyhjä. Lähdekoodista tarkistettiin moduulien todelliset riippuvuudet, latausjärjestys, materiaalikapasiteetti ja score, selector, scheduler, execution-esitys, tallennevalidointi, migraatiot ja finalisoinnin ehto. Testiajureista tarkistettiin vastuut, testimäärät ja checkpoint-vertailun nykyinen toteutus.

Ennen kirjoittamista tunnistetut kriittiset sääntöluokat ja niiden kanoninen säilytyspaikka:

| Sääntöluokka | Uusi kanoninen paikka | Säilytetty ydin |
| --- | --- | --- |
| Työn rajaus, valtuudet, yhteistyö, Git | [AGENTS](../../AGENTS.md) | Ei sivumuutoksia, refaktori erikseen, englanninkielinen commit, erillinen commit/push-lupa, ymmärrettävä raportointi |
| Päätösten auktoriteetti ja dokumentoinnin ylläpito | AGENTS | Tehtäväkohtainen lukeminen, ristiriidan tutkiminen, muuttuneen totuuden päivitys vain oikeaan paikkaan |
| Tekninen perusratkaisu | [Arkkitehtuuri](../ARCHITECTURE.md) | Classic-script, yhteinen Node/selain-toteutus, ei build-/pakettimuutosta |
| Moduulirajat ja riippuvuudet | Arkkitehtuuri | Physics → material, puhdas production, app/integration-I/O; score ja jälkivarasto sovelluksessa |
| Aktiivinen putki ja legacy | Arkkitehtuuri | Inventory-aware materiaalihaku, erillinen scheduler; legacy ei varapolku |
| Tilan omistajuus | Arkkitehtuuri | Materiaaliplani ja execution-logi erillisiä; worker/esitys johdetaan, ei rinnakkaista totuutta |
| Versiot ja migraatiot | Arkkitehtuuri | Skeema 6 / material-v0.4, 4→5→6, 3 hylätään; moottoriyhteensopivuus myös luonnokselle |
| Tallenteen rakenne ja semanttinen validointi | Arkkitehtuuri | Rivi-/tilaus-/merkkirajat, omat profiiliavaimet, yksi oletusrivi, canonical värit, validointi ennen DOM:ia |
| Materiaali-identiteetti ja profiilit | [Materiaali](../domain/MATERIAL.md) | Kuusi fyysistä profiilia, kova väriraja, tulevien attribuuttien mahdollisuus |
| Varasto, lähteet, määrät ja kulutus | Materiaali | Ryhmitellyt jäännökset, finite/unlimited, nollamäärien suodatus, haarojen mutatoimattomuus |
| Nimellinen sahausfysiikka | Materiaali | stockLength-syöte, kerf erillään, 0,1 mm tarkkuus, cutPiece-rajasäännöt |
| Kapasiteettivarat ja kaksi jäännöspituutta | Materiaali | Lähde-/kappalevara, sourceLength/usableCapacity/nominalRemaining/remaining, turvallinen nolla ja materiaalitase |
| Disposition, score ja jälkivarasto | Materiaali | Arvokäyrä, erilliset komponentit, luonti vain uudesta, turvallisen pituuden krediitti ja varastointi |
| Haun järjestys, kiintiöt ja prioriteetit | Materiaali | Reachable-DP, binary chunkit, laskevat kapasiteetit, vakaa merge/old-first, sama rivijärjestys, heuristiikan rajat |
| Uuden työn materiaalioletus ja sanasto | Materiaali | Rajaton harmaa + musta, restore säilyttää rivit, salko-taivutus muuttamatta teknisiä nimiä |
| Tilauskortit ja normalisoitu kysyntä | [Tuotanto](../domain/PRODUCTION.md) | Nimi/ID/väri, viisi osiota, U/rails-oletukset, kiskon yhteismäärä, collapsed, muokkauksen mitätöinti |
| Batchin kokonaiset tilaukset ja valinta | Tuotanto | 200/250/300 asetuksina, koko lyhyt jono, oversized, materiaalipiste ennen tavoite-etäisyyttä |
| Provenance ja fyysiset lähteet | Tuotanto | orderId/openingId/pieceId/sourceId, ei aukon arvausta, worker-numero profiileittain |
| Scheduler, niput ja dependencies | Tuotanto | Profiiliblokit, maxStack, eksplisiittinen 1+1-kiskopoikkeus, >2 erikseen, DAG ja saman ajon jatko |
| Cut/release ja tuotantomittarit | Tuotanto | Todellinen sahausliike vs poiminta, mittavasteen ensiasetus, ei työaikaa scoreen |
| Toteuma ja finalisointi | Tuotanto | Digest/etuliite/undo/reload, vain suunnitellut actualSourceIds, salon valmistuminen erillinen, persistoi ensin |
| Suoritus-UI ja valmistelu | Tuotanto | Konservatiiviset toistoryhmät, yksi event/painallus, 3+3 ryhmän ulkopuolelta, koko aktiivinen blokki, operaattorin kantopäätös |
| Testit ja hyväksymisportit | [Testaus](../TESTING.md) | Ajurien roolit, strict PASS, täydet no-op-vertailut, fixture-muutoksen peruste, oikea selain vs testikaksoinen |
| Tuotantofaktat ja kalibrointi | [DOMAIN_NOTES](../../DOMAIN_NOTES.md) | Lähde/varmuus/päivä, 3,4 mm havainto, fyysiset rajat/kierto, hinnat/ajat, varastohälytysideat, väärän salon havainto |
| Kehityssuunta | [Roadmap](../../ROADMAP.md) | Seuraava lähdepoikkeamavaihe, pienet moduulirajat, varasto, kapasiteettikalibrointi, laatumittaus, myöhemmät suunnat |
| Avoimet ongelmat ja tutkimusnäyttö | [Backlog](../../BACKLOG.md) ja aiheen [benchmark-raportti](../../benchmarks/batch-search/README.md) | B-002/006/008/009/010 säilyvät; B-007:n avoin loppu jatkuu B-011:nä |

## Siirrot ja poistot

- [Vanha roadmap](ROADMAP_2026-09-10.md) säilyttää aiemman vaiheistuksen, yksityiskohtaiset testitulokset ja checkpointit. Aktiivinen roadmap on lyhyt tulevaisuuskuvaus.
- [Vanha tuotantosuunnitelma](BATCH_AND_BUNDLE_SAWING_PLANNING.md) on arkistoitu historiallisena. Aktiivinen tuotantospesifikaatio on vain PRODUCTION.md; vanhat aktiiviset viittaukset ohjaavat siihen.
- [Demoluonnos](DEMO_PLAN.md) on arkistoitu. Sen edelleen voimassa oleva salko-sanasto siirrettiin materiaalimalliin; tulevat varastotarpeet ja demorajaus säilyvät muistiinpanoissa/roadmapissa tai historiallisena suunnitelmana.
- [Valmistunut backlog](COMPLETED_BACKLOG.md) säilyttää B-001/B-003/B-004/B-005/B-007:n alkuperäiset havainto- ja testitiedot. Jäljellä olevaa DP-kustannusta ei merkitty ratkaistuksi.
- Rootin `RESULTS.md` poistettiin vasta bittitarkan identtisyyden tarkistuksen jälkeen. Molempien alkuperäinen SHA-256 oli `5236a4241f6a4ecce2bc26ccd8d6ba600c2b642bea95c19104a8ea18615ea2b1`. Kanoninen tulos on [inventory-study/RESULTS.md](../../benchmarks/batch-search/inventory-study/RESULTS.md). Siihen lisättiin vain historiallista soveltamisalaa selittävä aloitus, ei muutettu mittauksia.
- Rootin `PRODUCTION_TIME_OPTIMIZATION_DRAFT.md` poistettiin: 0 tavua eikä sisältöä tai viittauksia säilytettäväksi.
- Benchmark-raportteihin lisättiin aikakauden ja nykytilan erottava huomautus; README sai aiheen mukaan ohjaavan kartan. Replay-raportin search.cjs-viittaus korjattiin suhteelliseksi poluksi. Mittauksia, raakadataa tai tutkimuskoodeja ei muutettu.

## Korjatut dokumentaatioristiriidat

1. **Materiaalimoduulin riippuvuus:** vanha AGENTS ja lähdetiedoston otsikkokommentti sanoivat ”vain mitta-apurit”. Toteutus käyttää kapasiteettitaseessa myös cutPiece-funktiota. Arkkitehtuuri kuvaa todellisen riippuvuuden. Koodikommentti jätettiin muuttamatta documentation-only-rajauksen vuoksi.
2. **Moottoriversion soveltamisala:** vanha teksti korosti vanhan lasketun suunnitelman hylkäämistä. Todellinen validointi hylkää väärän engine-version myös luonnoksesta. Tämä kirjattiin eksplisiittisesti; palautuksen käyttäytymistä ei muutettu.
3. **Valmistuneet tuotanto-ominaisuudet:** vanha roadmap/muistio kuvasi aukkotunnusta, kohdistusta ja operaatiokuittausta osin tuleviksi. Aktiivinen tieto kuvaa niiden toteutuksen; vanhat suunnitelmat on merkitty historiaksi.
4. **Kapasiteettivarat:** vanhassa vaiheistuksessa toteutus oli vielä ehdotus ja nimellinen täsmäsovitus sekoittui myöhempään turvalliseen nollaan. Aktiivinen malli erottaa nämä. 3,4 mm pysyy havaintona, ei asetuksena.
5. **Testiviitteet:** vanhat eri vaiheiden testimäärät ja dense/sparse-vertailun kuvaukset sekoittuivat nykyiseen digest-ajuriin. TESTING kuvaa todelliset nykyajurit ja erottaa historialliset vertailut sekä testikaksoiset selaimesta.
6. **B-004/B-007:** B-004 oli avoimissa, vaikka valmis; B-007 oli valmis, mutta sisälsi ratkaisemattoman jatkorajoitteen. Valmiit osuudet siirrettiin historiaan ja avoin suorituskykytyö säilytettiin B-011:nä.
7. **Benchmarkien ”nykyinen”:** sparse-prototyypin ja merge-profiloinnin luvut koskevat aikaisempia lähteitä. Raportit eivät nyt näyttäydy nykyisen kapasiteettimallin aktiivisena määritelmänä tai nopeuslupauksena.
8. **Vanhan tutkimusmuunnoksen toistettavuus:** runtime.cjs:n sparsePatterns-valinta yrittää dense-ankkurimuunnosta myös nykyiselle sparse-productionille. Kevyt runtime-alustus vahvisti `Sparse experiment anchor changed` -virheen ilman optimointiajoa. Rajoite kirjattiin [B-012:een](../../BACKLOG.md) ja benchmark-ohjeeseen; koodia ei korjattu.

Lisäksi varmistettiin finalisoinnin todellinen portti: kaikki salot valmiiksi täydellisessä epätyhjässä suunnitelmassa, ei erillistä execution-logi-valmiusehtoa. Tätä ei muutettu eikä dokumentoitu kuvitteellisena tiukempana turvana.

## Koko ja tarkistukset

Vanha AGENTS työpuussa: **35 774 tavua / 299 riviä**. Gitin LF-normalisoitu lähtösisältö oli 35 475 tavua. Uusi UTF-8/LF-tiedosto: **9 041 tavua / 78 riviä** (noin 8,83 KiB). Ero ei perustu pelkkään rivinvaihtomuunnokseen: pakollisesta ohjeesta poistui vastuualueisiin siirretty yksityiskohtainen tietopankki.

Dokumentaatiovarmistus: 20 Markdown-tiedostoa, 131 sisäisen linkin kohdetta, 40 Node-komentoviittausta ja 20 muuta backtick-muotoista koodi-/dokumenttipolkua tarkistettu. Raportin TABLES.md on erikseen varmistettu generoitu tulos, ei puuttuva lähde. Siirrettyjen root-nimien viittaukset ja sääntöluokkien kattavuus tarkistettiin. Kolmen kokonaisen arkistodokumentin ja viiden valmiin backlog-merkinnän sisältö säilyi; kuuden benchmark-raportin mittausosat säilyivät, ainoastaan soveltamisalahuomautukset ja yksi suhteellinen tiedostopolku muuttuivat. Kaikkien 107 seurattavan ei-Markdown-tiedoston Git-blobit vastasivat lähtöcommittia. `git diff --check` tarkistetaan myös stagetuista uusista tiedostoista ennen commitia.

Core-, UI-, selain- tai benchmark-ajoja ei tehty tämän documentation-only-työn vuoksi. Tutkimusmuunnoksen alustusvirhe tarkistettiin erikseen ilman materiaalihakua tai tulostiedostojen kirjoittamista. Historialliset PASS-luvut ovat aiempien töiden tuloksia. Ohjelman uudet ominaisuudet, koodikommentin korjaus, tutkimusmuunnoksen korjaus, suorituskykymittaus ja avoimet domain-päätökset jäivät erillisiin tehtäviin.
