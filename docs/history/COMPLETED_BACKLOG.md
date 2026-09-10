# Valmistuneet backlog-kohdat

> Historiallinen arkisto 10.9.2026. Alkuperäiset havainto- ja testitiedot säilyvät alla; ne eivät määritä nykyistä toimintaa. B-004:n vanha otsikko oli ristiriidassa sen valmistumismerkinnän kanssa: korjaus on valmis. B-007:n jäljellä oleva suorituskykyrajoite jatkuu [avoimen backlogin](../../BACKLOG.md) kohdassa B-011.

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
