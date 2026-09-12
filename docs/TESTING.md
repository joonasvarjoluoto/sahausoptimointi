# Testaus ja tarkistusten valinta

Tämä on testauskäytännön kanoninen ohje. Valitse testit muutoksen todellisten vastuualueiden mukaan; yhden CSS-rivin muutos ei tarvitse raskasta optimizer-benchmarkia. Materiaalin, tuotannon ja tallennuksen oikeellisuusmuutoksissa pelkkä käyttöliittymän silmämääräinen tarkistus ei riitä.

## Ajurit ja niiden roolit

Komennot ajetaan repon juuresta Node.js:llä. Ajurit käyttävät sisäänrakennettuja moduuleja, samoja sovelluslähteitä ja [arkkitehtuurin](ARCHITECTURE.md) latausjärjestystä. Testikehystä tai paketinhallintaa ei ole.

| Komento | Mitä se tarkistaa | Rajoite |
| --- | --- | --- |
| `node run-regressions.cjs` | [Eksplisiittinen core-ajuri](../run-regressions.cjs), 39 ryhmää: core/fysiikka, materiaalitase ja kapasiteetti, variantit, inventory-beam, adapterit, tallennevalidointi, finalisointi sekä puhdas tuotanto, lähdepoikkeaman replay ja suoritusnäkymän johdettu data | Tuoreet VM:t ilman DOM:ia tai localStoragea; ei oikea selain |
| `node run-material-regressions.cjs` | [Materiaalirajan ajuri](../run-material-regressions.cjs): suora CommonJS-lataus, eristetty classic-script-ympäristö ja globaalialiaset; neljän fixturen täydet varastot, optimoinnit, UI-planit, scoret, kulutus, jälkivarastot, operaatiot ja virhetulos | VM:n selainmoduulilataus ei ole oikea selain |
| `node run-production-ui-regressions.cjs` | [Ohjausajuri](../run-production-ui-regressions.cjs), 151 tarkistusta: oikea calculate/restore/finalize, kuittaus/undo, lokin palautus, toistoryhmien ohjaus, tallennusvirheet, lähdepoikkeama sekä V3-jatkon aktivointi/hylkäys, tuplapainallusesto, aktiivinen renderöinti ja worker-numerot, kiskosekanippu, lokiraja, reload ilman hakua, yhdistetty varastotransaktio ja korruptoituneen tallenteen säilyttävä palautuslukko | DOM-/storage-testikaksoisia; ei layout-, mobiili- tai selaimen DOM-testi |
| `node benchmarks/batch-search/run-pattern-regressions.cjs` | [Pysyvä kuvioregressio](../benchmarks/batch-search/run-pattern-regressions.cjs): 1 354 järjestettyä DP-tapausta sekä 15 täydellistä materiaaliplan/score/scheduler-checkpointia | Voi kestää selvästi perusajoa pidempään; ei benchmark eikä browser |
| `node benchmarks/batch-search/tests.cjs` | [Node-hakukokeen testit](../benchmarks/batch-search/tests.cjs): ehdokkaat, rajat, anytime/checkpoint ja välimuistin eristys | Tutkimushaku, ei aktiivinen selainselector |
| `node benchmarks/batch-search/flow-replay/tests.cjs` | [Replay-testit](../benchmarks/batch-search/flow-replay/tests.cjs): fyysinen tutkimuspolitiikka, lähteiden seuranta ja mahdolliset paikalliset ajot | Tutkimuksen varastopolitiikka eroaa production-dispositionista |

Ryhmä-/tarkistusmäärät kuvaavat tämän dokumentin checkpointia; ajurin eksplisiittinen lista määrää todellisen testijoukon. Päivitä ohje, kun ajurin vastuu tai määrä muuttuu. Historiallisten raporttien 18/32/35/36-luvut eivät korvaa nykyisiä ajureita.

Core-ajuri hyväksyy vain `true`-arvon tai tunnetun mittaisen taulukon, jonka jokainen `result` on `PASS`. Pelkkä truthy, tyhjä taulukko, `undefined` tai konsolin PASS ei riitä. Taulukkoryhmän `expectedRows` pidetään ajan tasalla. Epäonnistuminen, poikkeus, lähteen latausvirhe tai 60 sekunnin ryhmäkohtainen aikakatkaisu johtaa paluukoodiin 1; ryhmän virheen jälkeen muut ryhmät ajetaan. Tuore ympäristö estää tilavuodot. Onnistuminen palauttaa 0.

## Muutostyyppi → tarkistukset

Kaikissa muutoksissa tarkista Git-diff ja `git diff --check`. Muuttuneille JavaScript-tiedostoille aja `node --check <tiedosto>`.

| Muutos | Soveltuva vähimmäisvarmistus |
| --- | --- |
| Material-domain, kapasiteetti, kerf tai score | Core + material + tuotannon ohjaus; kohdistetut fysiikka-/raja-/varastotestit. Optimointituloksen muuttuessa pattern/plan-checkpointit. Oikea selain laskenta–palautus–finalisointi-polulle |
| Optimizer tai hakujärjestys | Core + material + pattern/plan-vertailu + ohjaus. Säilyttävässä optimoinnissa täydet ennen/jälkeen-tulokset ja mittaus ilman instrumentointia; aktiivisessa selainpolussa vähintään yksi oikea selainlaskenta |
| Scheduler, batch tai execution | Core (sisältää tuotantoryhmät) + ohjaus + täydet relevantit plan/operation-vertailut. Scheduleria muuttavassa työssä myös pattern-ajurin scheduler-checkpointit. Oikea selain kuittaus/undo/reload/finalisoinnille |
| UI-only | Kohdistettu DOM-/renderöintitesti ja oikea selain muokatulle näkymälle; mobiili/työpöytä tarvittaessa. Tuotannon ohjauksen muuttuessa ohjausajuri ja esitysregressiot. Pelkkään paikalliseen tyyli-/tekstikorjaukseen ei kaikkia materiaaliajoja |
| Persistenssi, luonnokset, palautus tai finalisointi | Core-tallenne- ja finalisointiregressiot + ohjaus; kelvolliset/virheelliset tallenteet, migraatio, versionristiriita ja storage-virhe. Materiaalitiedon muuttuessa material/pattern. Oikea selaimen tallennus–reload–finalisointi |
| Käyttäytymisen säilyttävä refaktorointi | Vertailut ennen siirtoa; kaikki nykyiset core-, material- ja ohjausregressiot sekä relevantit täydet plan/score/operation-checkpointit. Lataus-/moduulirajassa myös eristetty lataus, aliaset, CommonJS ja oikea selain |
| Documentation-only | Vain dokumentit Git-diffissä; linkit, tiedostopolut, siirrettyjen nimien viittaukset, canonical-ristiriidat ja sääntöjen säilyminen. Ei sovellusajoja tai raskaita benchmarkkeja |
| Benchmark/research-only | Apurin omat testit, production-lähteiden muuttumattomuus, mitattujen tulosten riippumaton validointi ja tehtävän tarvitsemat referenssit. Säilytä lähde-/fixturehashit, asetukset ja rajaukset. Selainta tarvitaan vain, jos siitä esitetään tuloksia tai selainpolku muuttuu |

Laajenna tarkistuksia uuden epävarmuuden tai havaitun virheen vuoksi. Älä toista raskaita ajoja ilman muutosta tai uutta perustetta. Jos tarvittavaa testiä ei voi ajaa, kerro rajoite; testikaksoinen ei korvaa sitä raportoinnissa.

## Hyväksymiskriteerit

### Behavior-no-op

Ota vertailut ennen refaktorointia tai täsmällistä suorituskykyoptimointia samalla syötteellä ja asetuksilla. Hyväksymiskriteeri on käytännössä **behavioral diff = 0**: koko sahausjako, lähteet ja järjestys, määrät, hukka, jäännökset, score-erittely, disposition, operaatiot/provenance ja virheraportointi säilyvät. Tarkista myös mutatoimattomuus ja deterministinen toisto. Pelkkä sama score tai salkomäärä ei riitä. Älä päivitä checkpointia rakenteellisen siirron vuoksi.

### Tarkoituksellinen käyttäytymismuutos

Kirjaa hyväksytty muuttuva sääntö, rajaa sen vaikutus ja lisää oikeellisuusvirheelle ensin epäonnistuva tapaus. Säilytä muut invariantit. Fixture-odotusta saa muuttaa vain, kun ero seuraa hyväksytystä uudesta semantiikasta ja uusi tulos on riippumattomasti validoitu. Raportoi mitä ja miksi muuttui; älä kirjoita vanhoja tutkimustuloksia uudeksi historiaksi. Esimerkki perustellusta checkpoint-muutoksesta: [kapasiteettivaramallin vertailu](../benchmarks/batch-search/CAPACITY_ALLOWANCE_RESULTS.md).

Tarkista correctness-muutoksissa ainakin kysynnän täsmällinen täyttyminen, profiili/väri, äärelliset lähderajat, materiaalitase, mahdottoman ja kesken jääneen haun erottelu, rinnakkaisten tilojen mutatoimattomuus ja deterministisyys. Tallenteen tarkistus tehdään ennen DOM-palautusta. Tallennusvirhe ei saa osittain finalisoida työtä.

## Kiinteät regressiot

`createDevelopmentTestCases()` tuottaa tuoreet lähtötiedot. `runCoreRegressionTests()` ajaa ilman DOM-/storage-muutoksia neljä fixturea, tarkat checkpointit, riippumattoman validoinnin, fysiikan, syötteen mutatoimattomuuden ja toiston:

| Tapaus | Keskeinen nykyinen odotus |
| --- | --- |
| A ilman jäännöksiä | 17 uutta salkoa: U 4, Pysty 7, Vaaka 2, Ylä 2, Ala 2; käsin perusteltu profiilikohtainen salkomääräminimi |
| A jäännöksillä | 22 lähdettä: 10 uutta, kaikki 12 annettua jäännöstä; uusista syntyy 9 säästettävää jäännöstä |
| D1 | Pysty 2200 mm × 2, vanha 3900 mm ja rajaton uusi 6000 mm: yksi uusi salko, turvallinen jäännös 1572 mm, nimellinen 1594 mm, vanha käyttämättä |
| Profiilieristys | Väärän profiilin materiaali ei kelpaa; epätäydellinen tulos, ei valmista osasuunnitelmaa |

Muut tärkeät nimet core-ajurissa:

- `runCuttingPhysicsRegressionTests()` (23): mittamuunnokset, 0,1 mm rajat, nollakerf ja virheellinen tarkkuus; täydentää `runCutPieceBoundaryTests()`- ja `runDecimalExactFitRegressionTest()`-testejä. Testidata ei kuulu puhtaan fysiikkamoduulin riippuvuuksiin.
- `runMaterialCapacityAllowanceRegressionTests()` (8): lähde- ja kappalevara, hylättävä raja, turvallinen nolla, muuttumaton kerf, kapasiteettitase, jälkivarasto ja viimeinen cut.
- `runCandidatePatternMergeRegressionTests()`: suora merge vs vanha Map/dedup/sort, duplikaatit molempien listojen sisällä/välillä, comparator-tasatilanteet, old-first, kiintiö, tyhjät/yhden alkion listat sekä kerf/täsmäsovitus.
- `runOrderInputRegressionTests()` ja `runStoredOrderValidationRegressionTests()`: tilausadapteri, kiskojen yhteismäärä, ID:t, perustulokset sekä tallenteen rakenne, kysyntä ja vanhan skeeman hylkäys.
- `runProductionRegressionTests()`: kokonaiset batchit ja kokorajat, materiaalivalinta, profiilit/värit, niput ja kiskojen 2/4/6-tapaukset, riippuvuudet, provenance, worker-numerot, profiiliblokit, digest, kuittaus/undo ja migraatio.
- `runProductionPresentationRegressionTests()`: toistoryhmien konservatiivinen identiteetti, lokista johdettu laskuri, 3+3-indeksit, reload/undo ja valmisteluryhmät.
- `runProductionSourceDeviationRegressionTests()`: nipun salon 7 korvaaminen salolla 3, kelvollinen/mahdoton jatko, fyysinen tase, reload/undo, V1/V2 ja digest, väärä väri/profiili, päällekkäinen tai ulkopuolinen lähde, kapasiteettiraja, cut/release-raja, 0/3,4 mm kerf sekä äärellisen uuden ja vanhan jäännöksen toteutunut kulutus. Fixture on käsin muodostettu materiaalijako; scheduler tuottaa operaatiot normaalisti.
- Sama ryhmä ajaa jatkon input-, plan- ja V3-state-aliryhmät: alkuperäinen piece-ID/provenance, äärelliset fyysiset sourceId:t, kiskojen jatkon alun jäljellä oleva parikonteksti, täydellinen validoitu jatkohaku, kanoninen digest ja semanttinen validointi, yhdistetty replay sekä undo/hylkäysraja. V3-ohjausfixture käyttää optimizerista riippumatonta jakoa: bar-7 → 5000 mm, bar-3 → 800 + 700 mm jo tehdyn 1000 mm:n lisäksi. Seitsemästä lähteestä käytetään viisi; jäljelle jää kaksi uutta salkoa ja jäännökset 4976 mm × 3 sekä 3468 mm × 1, 976 mm päätyy nykyisellä dispositionilla romuksi. Sama tarkistus tehdään bar-3:n ollessa vanha 6000 mm:n jäännös. Odottava batchin ulkopuolinen tilaus säilyy. Aktivointi, kuittaus, undo, hylkäys, salon valmistumismerkintä ja finalisointi sisältävät tallennusvirhetapaukset.
- `runCoreProfileTypeValidationRegressionTests()` palauttaa eksplisiittisesti kahdeksan PASS/FAIL-riviä. Muut profiili-, väri-, lähde- ja tallennevalidoinnit löytyvät ajurin nimetyistä ryhmistä.

Pysyvä pattern-ajuri ei nykyisin aja jokaista tapausta rinnakkain vanhalla dense-toteutuksella. Se lukitsee 1 354 järjestetyn kuviotuloksen digestin: seedatut tapaukset, kerfit 0/3/3,4 mm, kiintiöt 1/2/10 ja täsmäsovitukset, suoran DP-kutsun nollavaroilla. Lisäksi se laskee samat 14 aiemmin valmistunutta batch-fixturea sekä yhden aiemmin aikakatkaistun, myöhemmin referenssiksi valmistuneen tapauksen. Nykyiset kapasiteettimallin täydet score/plan-tulokset ja scheduler-tulokset lukitaan erillisiin digesteihin. Pelkkiä historiallisia scoreja ei verrata uuden kapasiteettimallin scoreihin identtisinä. Dense/sparse-alkuperäisvertailun historia on [inventory-study-raportissa](../benchmarks/batch-search/inventory-study/RESULTS.md).

## Oikea selaintestaus

`runOrderInputUiRegressionTests()` on selaimessa ajettava irrotetun tilauskortin DOM-roundtrip, joka ei muuta avointa työtä. Se ei yksin kata koko työnkulkua. Käytä erillistä testi-alkuperää tai muuten turvaa käyttäjän avoin työ ennen muuttavia testejä. Fixture-loaderit `loadTestA()`, `loadTestAWithRemnants()`, `loadTestD1()` ja `loadTestProfileIsolation()` **vaihtavat syötteet ja tallentavat työn**; niiden `undefined` on normaali. Myös `runAllRegressionTests()` käyttää lomakelatauksia. `runCurrentOrderSummaryTest()` kokoaa nykyisen lomakkeen yhteenvedon.

Loaderit käyttävät `createDevelopmentOrdersFromCuts()`-adapteria. Eriävät ylä-/alakiskolistat hylätään ennen lomakkeen muuttamista; tämä on loaderin/UI:n raja, ei suoran coren tai tallennemigraation rajoitus.

Valitse oikeaan selaimeen muutoksen kannalta relevantit syötteet, esimerkiksi:

1. D1: laskenta, näkyvät nimellinen/turvallinen jäännös, reload, salon valmistuminen ja finalisoinnin 1572 mm jäännös. Tarkista myös käyttämätön vanha 3900 mm.
2. Kolme mustaa tilausta Pysty 2200/3800/3772 mm × 1, aukot A/B/C, 6000 mm, kerf 3, ei jäännöksiä, batch 2/2/2: 2200+3772 valitaan, turvallinen jäännös 0 ja nimellinen 22 mm. Finalisoinnin jälkeen 3800 jää jonoon ja sallitaan alle minimin koko jonona.
3. Yksi äärellinen uusi 6000 mm musta Pysty, 4000+1000 mm eri aukkoihin: kaksi saman lähteen peräkkäistä leikkausta, worker-numero säilyy, nimellinen loppupituus 994 ja turvallinen 972 mm. Älä oleta rajattoman materiaalin valitsevan tätä samaa jakoa.
4. Kiskon 4000 mm yhteismäärät 2, 4 ja 6 samalle nimetylle aukolle: oletusvaroilla vastaavasti 1, 2 ja 4 cut-operaatiota; vain 2 kappaleessa ala+ylä-sekanippu. Tarkista eri aukot, eri tilaukset ja puuttuva aukko erikseen.
5. Toistoryhmä: musta Pysty 1300 × 16, musta Vaaka 1000 × 20, harmaa Pysty 1300 × 10, harmaat Pysty-jäännökset 1740 ja 1510 mm × 1; oletusmateriaalit, 6000/3. Tarkista yhden kuittauksen eteneminen, reload, undo, ryhmäraja, 3+3 sekä koko aktiivisen blokin valmistelu.

Tarkista painikkeet ja todellinen palautus, ei vain konsolin funktiotulos. UI-muutoksessa tarkista tarvittava tumma/vaalea näkymä ja puhelin-/työpöytäleveys. Puhelinemulaatio ei ole fyysisen laitteen testi. Raportoi selain, syöte, tehty polku ja rajoitteet; älä väitä vanhaa checkpoint-ajoa tässä tehtävässä uudelleen tehdyksi.

### B-009:n toistettava selainfixture

Käytä erillistä testi-alkuperää, esimerkiksi tämän repon paikallista HTTP-palvelinta eri portissa kuin avoin oikea työ. `production-regressions.js` ei kuulu sovelluksen normaaliin lataukseen. Lataa se testi-ikkunan kehittäjäkonsolissa kerran ja avaa kelvollisen poikkeaman fixture:

```js
await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "production-regressions.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
});
loadProductionSourceDeviationTest(false);
```

Loader **korvaa testialkuperän tallennetun ja avoimen työn**. Se käyttää seitsemää äärellistä mustaa Pysty-salkoa, 6000 mm / kerf 3 mm ja oletusvaroja 20/1. Ensimmäinen nippu on 1000 mm saloilta 1/2/4/7; salon 3 myöhempi mitta on 2000 mm.

1. Avaa **Käytin eri salkoa**, valitse suunniteltu Pysty 7 ja toteutunut Pysty 3, kirjaa. Tarkista 7 → 3 -historia, salon 3 nimellinen 4997 / turvallinen 4976 mm sekä käyttämätön salko 7. Syötteet, LASKE ja UUSI TYÖ ovat lukittuja.
2. Reload säilyttää havainnon. Peru viimeisin kuittaus: tapahtuma poistuu, pituudet palautuvat johdetussa taseessa ja lukko vapautuu. Kirjaa sama poikkeama uudelleen.
3. Kuittaa muut operaatiot ja merkitse kaikki manifestin salot valmiiksi. Finalisointi jättää yhden seitsemästä uudesta Pysty-salosta käyttämättä ja tallentaa salon 3 jäännökseksi 2972 mm (nimellinen 2994 mm). Reload palauttaa finalisoidun varaston, tyhjän jonon ja vapaat syötteet.
4. Lataa testiskripti uudelleen reloadin jälkeen ja kutsu `loadProductionSourceDeviationTest(true)`. Salon 3 tuleva mitta on nyt 5000 mm. Sama 7 → 3 -kirjaus tallentuu, mutta työ pysähtyy. Reload säilyttää eston, kaikki salon valmistumismerkinnät eivät avaa finalisointia, ja undo poistaa viimeisimmän virheellisen kirjauksen sekä eston. Älä tulkitse undo-toimintoa todellisen leikkauksen peruuttamiseksi.

Tarkista myös puhelinleveys, näkyvä pysähdysteksti ja disabled-painikkeet. Ohjausajuri kattaa erikseen kuittauksen, undon ja finalisoinnin tallennusvirheet sekä suoran funktiokutsun jatkoeston.

### B-013:n toistettava jatkopolku

Lataa edellisen kohdan testiskripti erillisellä testi-alkuperällä ja kutsu `loadProductionSourceDeviationTest(true)`. Kirjaa ensimmäisen 1000 mm:n nipun 7 → 3 -poikkeama normaalilla UI:lla. Paina **MUODOSTA JATKOSUUNNITELMA**: näkyviin tulee JATKOSUUNNITELMA, 4 tehtyä ja 3 jäljellä olevaa kappaletta sekä jatkon ensimmäinen kortti. Tarkista alkuperäiset worker-numerot: nykyisessä hakutuloksessa 700 mm / Pysty 1, sitten 5000 mm ja 800 mm / Pysty 5.

Tarkista tyhjän jatkon reload ja estetty undo, erillinen hylkäys takaisin samaan pysähdykseen, uudelleenaktivointi, yksi kuittaus, reload, undo ja uudelleenkuittaus. Kuittaa jatko loppuun, tarkista 7/7 kappaletta ja valmis reload. Merkitse kaikki seitsemän manifestin salkoa valmiiksi, tarkista merkintöjen reload ja finalisoi. Nykyisen fixturen hakutulos jättää 2 uutta Pysty-salkoa, jäännökset 4976 mm × 3 ja 4272 mm × 1 sekä tyhjän tilausjonon. Tämä UI-hakutulos on eri kohdistus kuin ohjausajurin erikseen määritelty riippumaton materiaalijako; kumpikin validoidaan omalla fyysisellä taseellaan.

12.9.2026 tämä polku ajettiin oikeassa Codex in-app -selaimessa erillisessä `127.0.0.1:8769`-alkuperässä; kapea tumma kortti tarkistettiin kuvasta. Lisäksi `createRailContinuationRegressionFixture()`-fixturen alkuperäisestä planista aloitettu työ, 1000 mm:n ala- ja yläkiskon kirjaus (yläkisko 1 → 2), pysähdys ja aktivointi näyttivät 5000 mm:n 1+1-sekanipun (Yläkisko 1 + Alakisko 2). Reload säilytti kortin ja yksi kuittaus valmisti molemmat kappaleet. Testialkuperän vioitettu V3-digest näytti säilyttävän palautuslukon myös reloadissa, ilman sahauskorttia ja LASKE/UUSI TYÖ -mahdollisuutta. Selaimen virheloki oli tyhjä. Tallennusvirheet, hakutuloksen puuttuminen ja tuplapainallus testattiin erikseen controller-ajurilla, ei selainvirheinjektiolla.

## Tutkimuksen toistettavuus

Valitse vain aiheen [benchmark-ohjeet](../benchmarks/batch-search/README.md). Ajoita CPU-benchmarkit peräkkäin samalla koneella ja samoilla asetuksilla; ilmoita yksittäiset ajat, mediaani, rajat ja lähde-/fixtureversio. Erottele instrumentointi, kylmä materiaalikutsu, koko batch-haku ja selainrenderöinti. `not-found` tai timeout ei ole mahdottomuustodistus, eikä historiallinen tulos ole nykyisen moottorin vasteaikatakuu. Älä ylikirjoita historiallisia tuloksia uusinta-ajolla huomaamatta.
