# Batch-haun Node-koeversio

Tämä hakukoe ei ole kytketty selaimeen. Se käyttää nykyistä materiaalihaku-, pisteytys-, validointi- ja scheduler-koodia muuttamatta niiden lähteitä. Myös käyttöliittymän normaalit hakuasetukset säilyvät.

## Aineisto ja toisto

`orders-23.json` on luettu `Order_history_tarkistettu.xlsx`-tiedostosta. Tilauksen 16 RR32-väri jätetään käyttäjän pyynnöstä pois. Jäljellä on 23 tilausta, 79 aukkoa ja 1 231 fyysistä kappaletta. Värimuunnos on RAL7024 → harmaa, RAL9005 → musta, RAL9010 → valkoinen. Pystyistä käytetään saraketta ”Pysty sahattava kpl”; vasteet ovat erillinen kysyntä. Kiskomäärät ovat yhteismääriä. Excelin SHA-256 on tallennettu aineistoon.

Mittauksen materiaalioletus: 6000 mm uutta materiaalia rajattomasti jokaiselle profiilille kolmessa tuetussa värissä, kerf 3 mm, ei vanhoja jäännöksiä. Tämä ei kuvaa mitattua fyysistä varastoa. Automaattihaun rajat ovat 200/250/300. Pienaineistojen vertailurajat näkyvät niiden tuloksissa.

Projektikansiosta:

```powershell
node benchmarks/batch-search/tests.cjs
node benchmarks/batch-search/pilot.cjs
node benchmarks/batch-search/search.cjs 600 search-results.json
node benchmarks/batch-search/search.cjs 30 anytime-result-test.json
node benchmarks/batch-search/compare-small.cjs
node benchmarks/batch-search/cache-probe.cjs
```

Aja ajastetut benchmarkit peräkkäin, jotta ne eivät kilpaile prosessorista. Tuore JSON-aineisto luodaan `extract_orders.py <xlsx> <output.json>` -komennolla Pythonilla, jossa on openpyxl. Node-ajot tarvitsevat vain Noden sisäänrakennetut moduulit. Exceliä ei kirjoiteta. Tulokset sisältävät käytettyjen sovelluslähteiden SHA-256-tunnisteet.

## Hakustrategia

1. Node-prototyyppi luettelee kokorajoihin sopivat kokonaiset tilausjoukot. Tässä 23 tilauksen aineistossa se on halpaa. Bittimaskit on rajattu enintään 23 tilaukseen; tämä ei ole ratkaisu käyttöliittymän 100 tilauksen enimmäisrajaan.
2. Lähtöjoukossa on ehdokkaita kolmelta kokoalueelta, lyhyttä kokonaiskysyntää, tilausjonon eri aloituskohtia ja eri kiertosuuntia. Kysynnän kokonaispituus on ainoastaan tutkimisjärjestyksen apu, ei materiaalipiste eikä todistettu alaraja.
3. Neljästä kevyestä arvioinnista kolme etsii add/remove/swap-naapureita kuuden parhaaksi pisteytetyn batchin ympäriltä. Yksi käyttää uutta lähtökohtaa. Lähtökohtien jälkeen jatketaan kiinteällä siemenellä sekoitettuun ehdokasjoukkoon. Kokoluokkia vuorotellaan.
4. Jokaisen neljän kevyen arvioinnin jälkeen yksi lupaavin vielä tarkentamaton valmis ehdokas saa normaalin materiaalihakunsa. Kevyt ja perusteellinen tulos kilpailevat samalla nykyisellä materiaalipisteellä. Tavoitekoon etäisyys ja tilaus-ID ratkaisevat vain tasapisteet kuten nykyisessä selectorissa.
5. Kaikki valmiit tulokset validoidaan riippumattomalla nykyisellä tarkistuksella. Scheduler ja kappalekohdistus muodostetaan myös, mutta niiden mittarit eivät vaikuta pisteeseen. `not-found` ja aikakatkaisu eivät todista mahdottomuutta.

Kevyt haku käyttää beamWidth 2, patternsPerState 2, candidatePoolSize 10. Normaali haku käyttää nykyisiä 20/10/50-arvoja. Muut asetukset, myös scoreSettings, maxExtraBars ja rajattu feasibility-fallback, säilyvät samoina.

Lähdekoodin tarkennus jatkotutkimuksessa: aktiivinen inventory-beam käyttää näistä `beamWidth`- ja `patternsPerState`-rajoja. `candidatePoolSize` ja `maxExtraBars` kulkevat asetusten mukana, mutta tämän inventory-funktion silmukka ei lue niitä. Niiden pienentämisestä ei siten saa päätellä tämän polun lisänopeutusta.

## Anytime ja välimuisti

Paras valmis validoitu tulos säilyy jokaisen arvioinnin jälkeen. Myös huonomman tarkennuksen jälkeen säilytetään parempi kevyt tulos. Väliraportit kuvaavat sitä, mikä oli oikeasti valmistunut budjetin kohdalla; rajan yli kestänyttä arviota ei siirretä jälkikäteen aiempaan checkpointiin. Node VM:n aikaraja katkaisee kesken olevan laskennan viimeistään kokonaisbudjetilla. Prosessin käynnistys/lähteiden lataus ei sisälly hakuaikaan; ehdokkaiden valmistelu sisältyy. Tässä ei ole käyttöliittymää eikä käyttäjän peruutuspainiketta.

Ryhmätason välimuisti kytketään vain erilliseen VM-ympäristöön. Tarkka avain sisältää kappaleiden mitat ja määrät alkuperäisessä järjestyksessä, kaikki lähdeominaisuudet ja määrät, kerfin sekä koko hakuasetuksen. Vain valmis ryhmäratkaisu tallennetaan. Tulokset palautetaan kopioina, eikä tilaus-/aukkokohdistusta tallenneta välimuistiin. Välimuisti on ajokohtainen ja enintään 1000 ryhmäratkaisua. Tämä välttää tuotanto-optimizerin refaktorin; raakamuotoinen avain voi jättää joitakin samanarvoisia ryhmiä yhdistämättä, mikä vaikuttaa osumiin eikä oikeellisuuteen.

Vakioitu työmäärä tuottaa saman hakujärjestyksen. Aikabudjetilla valmistuvien ehdokkaiden määrä voi vaihdella koneen ja kuorman mukaan. Yhden aineiston tasaantuminen ei todista muiden jonojen laatua tai globaalia optimia. Pienaineistojen exhaustive-vertailu arvioi kaikki batch-ehdokkaat nykyisellä heuristisella materiaalihakulla.

## Tulostiedostot

- `pilot-results.json`: käsin valitut 2, 3, 4 ja 5 tilausta, kevyt ja normaali materiaalihaku sekä valmiin suunnitelman muodostaminen.
- `search-results.json`: koko jatkuva ajo, checkpointit, improvement history, piste-erittelyt, materiaalimäärät, arviointimäärät ja välimuistin osumat.
- `small-results.json`: kolme pientä tilausjoukkoa, nykyinen exhaustive-selector ja rajattu uusi haku.
- `cache-results.json`: sama arviointijono välimuistilla ja ilman; suunnitelman, materiaalipisteen ja provenancen identtisyys tarkistetaan.
- `anytime-result-test.json`: lyhyt toisto koko validoidun voittajasuunnitelman ja operaatioiden säilyttämisen tarkistamiseksi; sama paras piste kuin 600 s mittauksessa.
- `RESULTS.md`: tulosten yhteenveto ja rajaukset.

## Jäännös- ja äärellisen varaston jatkotutkimus

Tulokset ovat erillisessä `inventory-study/`-hakemistossa; ensimmäisen jäännöksettömän tutkimuksen tuloksia ei kirjoiteta yli.

```powershell
node benchmarks/batch-search/inventory-study.cjs generate
node benchmarks/batch-search/inventory-study.cjs pilot
node benchmarks/batch-search/pattern-cache-probe.cjs
node benchmarks/batch-search/sparse-probe.cjs
node benchmarks/batch-search/inventory-study.cjs suite
node benchmarks/batch-search/manual-complex-probe.cjs
node benchmarks/batch-search/inventory-sanity.cjs
node benchmarks/batch-search/finite-probe.cjs
node benchmarks/batch-search/permutation-audit.cjs
node benchmarks/batch-search/inventory-audit.cjs
node benchmarks/batch-search/validation-runner.cjs
node benchmarks/batch-search/finalize-study.cjs
node benchmarks/batch-search/inventory-report.cjs
```

`generate` tekee deterministisesti neljä historiallista 23 tilauksen kierrosta. Pituushäiriöt ovat ±30 mm (seed 230908), määrät/värit/profiilit säilyvät ja tilaus 16 puuttuu. Kevyt nykyinen materiaalihaku tuottaa fyysiset jäännökset; vain nykyinen `reusable`-disposition hyväksytään. Skenaarioiden yhteiset varianttikiintiöt perustuvat syntyneiden jäännösten määriin. A on satunnaisotos (seed 90823), B lyhyimpien ja C pisimpien palojen stressitesti. Jäännöspoolin jokaiseen lähdetankoon pääsee `provenance`-tiedoilla. Tämä ei mallinna varaston todellista kiertoa eikä aseta tuotantosaldoja.

`pilot` mittaa 2–5 käsin valittua tilausta normaalilla haulla, ilman välimuistia, enintään 60 s per tapaus. `suite` ajaa A/B/C:n 600 s käyrät, F1/F2:n 120 s äärelliset testit ja neljä A-varaston 120 s lisäpermutaatioita. Viiden järjestyksen vertailussa käytetään myös alkuperäisen A-ajon 120 s checkpointia. Hakusiemen pysyy 230916:ssa, vain syöttöjärjestys muuttuu. F1/F2 sisältävät saldoihin mahtuvan aiemmin validoidun kokonaisen batchin toteutuskelpoisuustodistajan; epäonnistunut kevyt haku ei muuta tätä tosiasiaa.

Yksittäinen ajo: `node benchmarks/batch-search/inventory-study.cjs search A 600 1`. Tulostiedoston nimi on `search-<scenario>-<permutationSeed>.json`. `keepImprovementPlans` säilyttää jokaisen uuden parhaan tuloksen koko validoidun suunnitelman operaatioineen; tämä on vain tutkimusraportin lisäkenttä eikä muuta ehdokkaiden valintaa.

`inventory-sanity.cjs` tallentaa saman batchin kevyen ja normaalin haun suunnitelmat uuden materiaalin määrän ja loppuvaraston arvon vertailuun. `inventory-audit.cjs` toistaa tallennettujen tankojen leikkuut authoritative `cutPiece()`-funktiolla ja laskee jäädytetyn pisteytyscheckpointin aritmetiikan erikseen. Tämä tarkistaa toteutuksen johdonmukaisuutta, ei pistekertoimien taloudellista kalibrointia.

Fixture rakennetaan aina sovelluksen `createMaterialInventory()`-adapterilla: samat variantti-/pituusrivit yhdistyvät määriksi ja lähteet saavat saman järjestyksen kuin selainpolussa. Ensimmäiset yhdistämättömillä riveillä ajetut pilotit ja keskeytetty A-haku on eristetty `inventory-study/superseded-unnormalized/`-hakemistoon. Niitä ei käytetä tulostaulukoissa. Duplikaattien yhdistäminen ja molempien fyysisten lähteiden käyttö on lukittu erillisellä regressiolla.

Valinnainen `createRuntime(data,{patternCache:true})` kokeilee täsmällistä `findCandidatePatternsDP`-välimuistia vain Node-VM:ssä. Avain sisältää koko alkuperäisen argumenttijonon: kappaleet määrineen ja järjestyksineen, lähdepituuden, kerfin ja kuviorajan. Tulokset palautetaan kopioina; äärellinen saatavuus käsitellään tämän jälkeen edelleen nykyisellä lähdekulutuksella. Välimuistin enimmäiskoko on 20 000 kuviotulosta. Oletus on pois päältä, joten alkuperäiset laatukäyrät pysyvät vertailukelpoisina. `pattern-cache-probe.cjs` vertaa kylmän välimuistin normaalia hakua pilotin täsmälleen samaan syötteeseen ja vaatii identtisen pisteen, tankosuunnitelman ja schedulerin tuloksen kaikissa valmistuneissa vertailuissa.

Jatkotutkimuksen pääajot käyttävät `sparsePatterns:true`-koetta, eivät yllä olevaa kuviovälimuistia. `sparse-patterns.cjs` muuntaa vain Node-VM:ään ladatun alkuperäisen kuviofunktion kapasiteettivaraston ja silmukat käsittelemään saavutettuja tiloja. Se vaatii jokaiselle lähdemuunnosankkurille täsmälleen yhden osuman ja pysähtyy lähteen muuttuessa; production-funktiota ei kirjoiteta. Määrälohkot, järjestys, kuviokiintiöt ja fysiikka säilyvät. `sparse-probe.cjs` vertaa 1 354 kuviotapausta sekä pilotin kokonaiset suunnitelmat alkuperäiseen.

`suite` aloittaa A:n 120 sekunnin alkuperäisen DP:n vertailulla (`search-A-1-dense.json`) ja käyttää sen jälkeen saavutettujen tilojen kokeilua kaikissa pääajoissa ja permutaatioissa. Alkuperäisen yksittäinen ajo: `node benchmarks/batch-search/inventory-study.cjs search A 120 1 off`. Pääajoissa ryhmävälimuisti säilyy ennallaan. Tavallinen koko JSON:n tallennus tehdään arvion valmistuessa, kun edellisestä kirjoituksesta on kulunut vähintään 10 sekuntia. Parannus, uusi checkpoint-tieto ja lopetus pakottavat tallennuksen. Lopputulos sisältää kaikki arviot. Synkronisen laskentakutsun aikana tiedosto ei päivity. Tämä estää nopeutunutta hakua käyttämästä kohtuuttomasti aikaa kasvavan raportin toistuvaan kirjoittamiseen.

`finite-probe.cjs` tekee tunnetun A-suunnitelman tarpeeseen rajatun erillisen saatavuustestin ja tarkentaa enintään kolme epäonnistunutta kevyttä ehdokasta kummastakin äärellisestä hausta. `permutation-audit.cjs` vertaa myös samoja batcheja samoilla arviointitasoilla eri järjestyksissä. `inventory-audit.cjs` tarkistaa tallennetuista operaatioista tilausten ja aukkojen kappalemäärät sekä äärellisten materiaalien käytön.

`manual-complex-probe.cjs` mittaa lisäksi haun valitseman A-batchin kylmänä manuaalisena laskentana. Tämä estää nopeusjohtopäätöksen yleistämisen vain helpoista esimerkeistä: tilausmäärän lisäksi saman variantin eri mittojen määrä ratkaisee paljon. `finite-capacity-certificates.json` erottaa itsenäisellä, kerfin sivuuttavalla pituusalarajalla todistetut materiaalivajeet muista epäonnistumisista; riittävä yhteispituus ei todista pakkausratkaisun olemassaoloa.

Loppuregressiot:

```powershell
node run-regressions.cjs
node run-production-ui-regressions.cjs
node benchmarks/batch-search/tests.cjs
node benchmarks/batch-search/run-sparse-regressions.cjs
```

Viimeinen komento käyttää nykyisen core-ajurin täsmälleen samaa eksplisiittistä testilistaa ja onnistumissääntöjä. Sen eristetty tiedostonlukusovitin muuntaa vain VM:ään ladatun app.js:n; production-tiedostoa ei kirjoiteta. Selain-UI ei kuulu näihin Node-koemittauksiin.
