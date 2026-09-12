# Valmistuneet backlog-kohdat

> Historiallinen arkisto 10.9.2026. Alkuperäiset havainto- ja testitiedot säilyvät alla; ne eivät määritä nykyistä toimintaa. B-004:n vanha otsikko oli ristiriidassa sen valmistumismerkinnän kanssa: korjaus on valmis. B-007:n jäljellä oleva suorituskykyrajoite jatkuu [avoimen backlogin](../../BACKLOG.md) kohdassa B-011.

### B-014 — Nimetyn snapshotin turvallinen palautus aktiiviseksi työksi

- **Tila:** ensimmäinen rajattu versio valmis 12.9.2026.
- **Toteutus:** validoitu canonical `workState` voidaan palauttaa luonnoksesta tai lasketusta suunnitelmasta ennen ensimmäistä fyysistä tapahtumaa. Vahvistus näyttää kohteen ja aktiivisen työn yhteenvedot, luo nykyisestä työstä automaattisen IndexedDB-turvasnapshotin ja kirjoittaa kohteen aktiiviseen localStorageen ennen live-näkymän vaihtoa. Täysin tyhjästä oletustyöstä ei tehdä turhaa kopiota. Snapshotin tallennettu `presentation` ei siirry aktiiviseksi tiedoksi eikä palautus aja optimizeria tai batch-hakua.
- **Turvaraja:** recovery-lukko, yksikin V1/V2/V3-tapahtuma tai yksikin `completedBarIds`-merkintä estää palautuksen sekä aktiivisen työn että kohdesnapshotin puolella. `completedBarIds` tulkitaan konservatiivisesti fyysiseksi salon käsittelyn valmistumiseksi. Fyysisesti aloitetun snapshotin reconciliation on erillinen [B-015](../../BACKLOG.md).
- **Virheraja:** kohde luetaan ID:llä uudelleen ja validoidaan ennen turvakopiota. Turvakopion virhe keskeyttää kaiken; active-store-virhe jättää live-tilan ennalleen ja turvakopio saa säilyä. Jos aktiivinen kirjoitus onnistuu mutta renderöinti epäonnistuu, uusi persisted canonical tila jää totuudeksi ja UI pyytää lataamaan sivun uudelleen. Alkuperäinen snapshot-record säilyy immutable-katselukopiona.
- **Näyttö:** snapshot-ajurin 67 tarkistusta, oikean IndexedDB:n 20 tarkistusta sekä core 39/39, material-fixturet ja 151 production/controller-tarkistusta läpäisivät. Oikeassa Codex in-app -selaimessa erillisellä `127.0.0.1:8773`-originilla D1:n tapahtumaton 0/2-plan palautettiin luonnoksen päälle, turvakopio ja reload tarkistettiin, luonnos palautettiin takaisin planin päälle sekä aktiivisen 1/2-tapahtuman ja in-progress V3-kohteen estot varmennettiin. Käyttäjän oikeaa työtä ei käytetty.

### B-013 — Pysähtyneen työn jatkosuunnitelma alkuperäisillä fyysisillä lähteillä

- **Tila:** valmis rajatussa ensiversiossa 12.9.2026. B-009:n lähdepoikkeama voi estää alkuperäisen tulevan suunnitelman; tehtyjä sahauksia ei voi palauttaa undolla.
- **Toteutus:** tekemättömien alkuperäisten piece-ID:iden haku alkuperäisiltä fyysisiltä sourceId:iltä, V3:n erillinen jatkodigest ja tapahtumaloki, deterministinen reload ilman optimizeria, undo/hylkäysraja, palautuslukko sekä yhdistetty finalisointi. UI tarjoaa aktivoinnin, jatkon operaatiokortin, alkuperäiset worker-numerot ja nykyiset kuittaus-/valmistumisohjaimet.
- **Näyttö:** core 39/39, 151 ohjaus-/persistenssitarkistusta, neljä material-fixturea sekä 1354 pattern-tapausta ja 15 muuttumatonta tavallisen plan/score/scheduler-checkpointia. Oikeassa Codex in-app -selaimessa erillisellä localhost-testialkuperällä ajettiin 7 × 6000 mm musta Pysty / kerf 3: 7 → 3 -poikkeama, pysähdys, aktivointi, tyhjän jatkon reload ja hylkäys, uudelleenaktivointi, kuittaus, reload, undo, loppukuittaukset, valmis reload, kaikki salon valmistumismerkinnät, niiden reload ja finalisointi. Jäljelle jäi 2 uutta Pysty-salkoa sekä 4976 mm × 3 ja 4272 mm × 1 jäännökset; batch poistui. Lisäksi kiskofixturen 5000 mm:n 1+1-sekanippu, sen reload ja kuittaus sekä korruptoituneen V3:n näkyvä palautuslukko ja reload tarkistettiin. Käyttäjän oikeaa työtä ei käytetty.
- **Säilyvät rajat:** vain alkuperäisen manifestin lähteet, yksi jatkosuunnitelma, jatkossa vain suunnitellut lähteet, synkroninen rajattu haku. Ulkopuolinen materiaali, jatkon uudet lähdepoikkeamat, pysyvä batch-historia ja laaja recovery-editori eivät sisälly tähän hyväksymisrajaan. Aktiivinen sopimus on [tuotantomallissa](../domain/PRODUCTION.md).

### B-009 — Toteutuneen fyysisen salon poikkeama, ensimmäinen turvallinen versio

- **Tila:** valmis 10.9.2026. Lähtöhavainto 9.9.2026: suunnitellun nipun 1/2/7/4 sijasta käytettiin 1/2/3/4.
- **Toteutus:** yhden salon valinta nykyiselle operaatiolle, V2-toteuma alkuperäisen digestin alla, koko fyysisen taseen replay sekä jäljellä olevan planin simulointi. Kelvoton jatko pysähtyy; finalisointi käyttää vain toteutunutta lähdekulutusta ja todellisia turvallisia jäännöspituuksia. Alkuperäinen plan säilyy avoimessa työssä muuttumattomana.
- **Näyttö:** 39/39 core-ryhmää, 71 tuotannon ohjaus-/persistenssitarkistusta, neljä täydellistä material-fixturea ja 1 354 patternin sekä 15 kokonaisen suunnitelman muuttumattomat checkpointit. Oikea Chrome 152 -selain, 1280 px vaalea ja 390 px tumma: kirjaus, reload, undo, finalisointi ja jatkoesto. Käyttäjän avointa työtä ei käytetty testidatana.
- **Jatkoraja:** usean salon UI-korvaus, manifestin ulkopuoliset lähteet ja pysyvä batch-historia eivät sisälly työhön. Mahdottoman jatkon uudelleenoptimointi jatkuu kohdassa [B-013](../../BACKLOG.md).

### B-001 — Persistoidun stock-ryhmän default/additional-invariantti

- **Tila:** valmis; automaattiset testit ja käyttäjän selaintarkistus läpäisty 2026-09-06
- **Prioriteetti:** matala
- **Alue:** localStorage / uuden materiaalin rivit
- **Korjaus:** jokaisella profiiliryhmällä vaaditaan täsmälleen yksi oletusrivi ennen työtilan palautusta. Validointi ja palautus käyttävät samaa `isAdditionalStoredStockProfileRow()`-sääntöä.
- **Legacy-yhteensopivuus:** puuttuva `additional` tulkitaan oletusriviksi vain profiilin ensimmäisellä rivillä. Eksplisiittinen oletusrivi saa edelleen olla lisärivin jälkeen. Skeema säilyy versiona 3.
- **Testit:** uusi `runStoredStockDefaultRowValidationRegressionTests()` kattaa 14 tapausta sekä luonnokselle että suunnitelmalliselle työtilalle. Vahvistettu selaimessa yhden oletusrivin ja poistettavuuden säilyminen, viiden korruptin riviyhdistelmän hylkäys ennen varaston palautusta sekä nykyisen ja legacy-työn palautuminen suunnitelmineen ja TEHTY-merkintöineen. Väri-, persistenssi-, finalisointi- ja perusregressiot läpäisty.


### B-003 — Persistoidun profiilinimen tarkistus hyväksyy perityn ominaisuuden

- **Tila:** valmis; automaattiset Node- ja selaintestit sekä käyttäjän tarkistus läpäisty 2026-09-06
- **Prioriteetti:** keskitaso
- **Alue:** localStorage / profiilityypin validointi ja palautus
- **Korjaus:** raakalistan rivit, sahattavat rivit, jäännösrivit ja suunnitelman tangot hyväksyvät vain `PROFILE_TYPES`-olion omat avaimet. Prototyypistä perittyjä nimiä ei hyväksytä profiileiksi.
- **Testit:** `runStoredProfileTypeValidationRegressionTests()` kattaa 90 tapausta: kuusi kelvollista profiilia sekä perityt nimet, tuntemattomat nimet ja virheelliset tyypit kaikissa neljässä tallennuskohdassa. Vanha koodi epäonnistui 48 tapauksessa; korjattu läpäisee kaikki. Node-ajurissa 30/30 ryhmää läpäisty. Eristetyssä Edgessä 84 virheellistä tallennetta hylättiin ennen varastorivien palautusta ja 12 nykyistä/legacy-tallennetta palautui käynnistyksessä suunnitelmineen ja TEHTY-merkintöineen.
- **Rajaus:** tallennusskeema 3 ja moottoriversio `material-v0.3` säilyvät; kelvollisten tallenteiden muoto ei muutu. Suorien core-kutsujen vastaava tarkistus on erillinen B-004. Optimointia tai moduulirakennetta ei muutettu.


### B-004 — Suoran core-kutsun profiilivalidointi hyväksyy perityn ominaisuuden

Päivitys 8.9.2026: nykyinen lähdekoodi hylkää nämä profiilit ja kaikki kahdeksan core-profiiliregressiota läpäisevät. Alla oleva virhekuvaus on historiallinen; korjaus oli repossa ennen batch-työtä. Tässä työssä korjattiin vain B-005:n ajurimääritys.

- **Tila:** vahvistettu Node-ajolla 2026-09-06
- **Prioriteetti:** keskitaso
- **Alue:** core-rajapintojen syötevalidointi; ei tallennetun työtilan validointi
- **Havainto:** `validateCutProfileTypes()` ja eräät materiaalin validointikohdat käyttävät edelleen `PROFILE_TYPES[avain] === undefined` -tarkistusta, joka ei erota omia profiileja prototyypin ominaisuuksista.
- **Toisto tai näyttö:** `validateCutProfileTypes([{ profileType: "constructor", color: "gray", length: 1000, quantity: 1 }])` palauttaa `true`. Samalla syötteellä ja kuuden normaalin harmaan profiilin rajattomalla varastolla `optimizeOrderByProfileTypeWithInventory()` palauttaa `complete: true`, nolla tankoa ja tyhjän `remainingItems`-listan.
- **Vaikutus:** suora core-kutsuja voi saada virheellisestä profiilista virheellisen valmiin tuloksen. Tavallinen UI-valikko ei tuota tätä nimeä, ja `calculate()`-polun riippumaton tulosvalidointi hylkää kappaletaseen poikkeaman. B-003 estää vastaavat nimet tallenteista.
- **Ennen toteutusta:** kartoita puhtaiden core-rajapintojen profiilijäsenyyden tarkistukset ja lisää niiden omat regressiot. Älä yhdistä korjausta moduuli-irrotukseen.
- **Hyväksymiskriteeri:** suorat core-rajapinnat hylkäävät perityt ja tuntemattomat profiilinimet; kuusi sallittua profiilia ja normaalit optimointitulokset säilyvät ennallaan.


### B-005 — Core-profiilitestien paluuarvo ei vastaa Node-ajurin määritystä

- **Tila:** valmis 2026-09-08. Lähtöajossa vahvistettiin 33/34-tulos; batch-työn koko testipaketin ajamiseksi ryhmä määritettiin kahdeksan rivin taulukoksi. Kaikki kahdeksan tapausta ja koko 35 ryhmän ajo läpäisevät. Alkuperäinen havainto oli vahvistettu myös commitin `838158d` lähteistä.
- **Prioriteetti:** keskitaso
- **Alue:** `run-regressions.cjs`, testiryhmän paluuarvon tarkistus.
- **Havainto:** `runCoreProfileTypeValidationRegressionTests()` palauttaa kahdeksan PASS/FAIL-riviä, mutta ryhmä on ajurin boolean-listassa ilman `expectedRows`-arvoa. Kaikki kahdeksan tapausta läpäisevät, mutta `result === true` hylkää taulukon ja koko ajo päättyy tulokseen 33/34 sekä paluukoodiin 1.
- **Hyväksymiskriteeri:** ryhmä määritetään eksplisiittisesti kahdeksan rivin taulukoksi; väärä rivimäärä tai yksikin FAIL hylätään edelleen. Korjausta ei yhdistetty U-profiilin oletusmäärämuutokseen.


### B-007 — Tyhjien DP-kapasiteettisolujen kustannus jäännösvarastolla

- **Tila:** valmis 2026-09-09; saavutettujen kapasiteettien toteutus siirretty production-funktioon.
- **Prioriteetti:** keskitaso ennen suuremman varaston koekäyttöä.
- **Alue:** `findCandidatePatternsDP`, yksittäisen materiaaliratkaisun laskenta.
- **Havainto:** 6 000 mm lähde ja 3 mm kerf muodostavat 0,1 mm tarkkuudella 60 031 kapasiteettisolua, joista jokainen alustetaan taulukoksi. Jokainen määrälohko käy myös tyhjät kapasiteetit läpi. Tätä toistetaan beam-tilojen eri jäännöspituuksille.
- **Näyttö:** kanonisella 100 jäännöksen A-varastolla 4/5 tilauksen normaalit suunnitelmat kestivät noin 54/50 sekuntia; pitkien C-jäännösten vastaavat ajot katkaistiin 60 sekunnissa. Erillisessä profiloinnissa lähes kaikki aika kului kuviolaskentaan. Tarkat syötteet ja tulokset: `benchmarks/batch-search/inventory-study/`.
- **Rajattu Node-koe:** saavutettujen kapasiteettien käsittely samassa järjestyksessä säilytti 1 354 kuviotestin tulokset sekä kaikki 14 valmistunutta normaalia vertailusuunnitelmaa pisteineen ja operaatioineen. 2–5 tilauksen manuaaliset testit valmistuivat noin 0,04–4,8 sekunnissa; myös kaksi aiemmin aikakatkaistua tapausta valmistui.
- **Rajoite:** haun valitsema monimittainen samanvärinen kolmen tilauksen yhdistelmä 3/9/21 kesti erillisessä kylmässä A-varaston mittauksessa edelleen noin 32,8 s. Perusbatchien nopeutusta ei saa yleistää kaikkiin samankokoisiin valintoihin. Alkuperäisen ja Node-kokeen 35/35 regressioryhmää läpäistiin.
- **Toteutus ja varmistus:** production käyttää vain saavutettuja kapasiteetteja ja käsittelee ne samoissa laskevissa järjestyksissä. Ennen/jälkeen-vertailu säilytti 1 354 järjestettyä kuviotulosta sekä 14 tallennettua kokonaista suunnitelmaa scoreineen ja operaatioineen. Core 35/35, tuotannon ohjaus-/persistenssit 18/18 ja HTTP-selainpolku läpäistiin. Scorea, kerfiä, batch-hakua tai scheduleria ei muutettu.
- **Pattern-merge 9.9.2026:** jatkoprofilointi osoitti, että harmaan Vaakaprofiilin 6,89 miljoonaa `keepDistinctPatterns()`-kutsua käsitteli 48,57 miljoonaa pattern-viittausta. Production yhdistää nyt kaksi valmiiksi järjestettyä ja distinct-listaa vakaalla suoralla mergellä ilman kuuman polun `join()`-avaimia, Map-deduplikointia tai yleistä lajittelua. 1 354 kuviotulosta, 15 tallennettua suunnitelmaa scoreineen ja operaatioineen sekä beam-tilastot säilyivät identtisinä.
- **Jäljelle jäävä suorituskykyraja:** vaikean 3/9/21-batchin materiaalimediaani laski 34,69 sekunnista 20,23 sekuntiin. CPU-otannassa suora `mergeDistinctSortedPatterns()` on nyt suurin yksittäinen kehys, noin 45,1 % profiloidusta ajosta; `findCandidatePatternsDP()`-funktion muu oma työ vie noin 43,0 %. Mahdollinen seuraava tutkimus kohdistetaan merge-kutsujen määrään ja kapasiteettipäivitysten vektorikopioihin semantiikkaa muuttamatta.
