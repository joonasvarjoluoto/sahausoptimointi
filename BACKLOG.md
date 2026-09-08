# BACKLOG.md

## Tarkoitus

Tähän kirjataan todelliset mutta ei-välitöntä korjausta vaativat virheet, tekniset rajoitteet ja rajatut parannusideat. Tiedosto estää pienten havaintojen unohtumisen ilman, että ne keskeyttävät nykyisen työn.

Backlog-merkintä ei ole toteutuslupa eikä todistus virheestä. Ennen korjausta tarkista havainto nykyisestä lähdekoodista ja tee mahdollisuuksien mukaan toistettava regressiotapaus.

Roadmap-vaiheet kuuluvat `ROADMAP.md`:hen. Liiketoiminta- ja tuotantofaktat sekä epävarmat oletukset kuuluvat `DOMAIN_NOTES.md`:hen.

## Tilat ja prioriteetit

Tilat:

- `havaittu`: alustava mutta konkreettinen havainto;
- `vahvistettu`: toistettu nykyisellä koodilla;
- `suunniteltu`: rajaus ja hyväksymiskriteerit sovittu;
- `valmis`: toteutettu ja testattu; valmis kohta voidaan myöhemmin siirtää historiaksi.

Prioriteetit:

- `korkea`: voi rikkoa oikeellisuuden, materiaalitaseen tai käyttäjän työn;
- `keskitaso`: haittaa käyttöä tai luotettavuutta mutta sillä on turvallinen kiertotapa;
- `matala`: rajattu UX-, ylläpidettävyys- tai harvinainen reunatapaus.

## Avoimet havainnot

### B-006 — Batch-yhdistelmien synkroninen haku suurissa tilausjonoissa

- **Tila:** havaittu 2026-09-08
- **Prioriteetti:** keskitaso suurissa jonoissa
- **Alue:** `PRODUCTION_PLANNING.selectBatch`, selaimen laskennan reagointi.
- **Havainto:** selector luettelee kokorajaan mahtuvat tilausyhdistelmät ja arvioi ne synkronisesti. Kymmenen pientä tilausta voi tuottaa 1023 yhdistelmää; lomake sallii enintään 100 tilausta, jolloin haku voi olla käytännössä mahdoton. Ongelma koskee hakumäärää ja pääsäikeen varaamista, ei materiaalipisteen oikeellisuutta.
- **Rajaus:** käyttäjän pyynnön mukaisesti ensimmäiseen versioon ei lisätty heuristista esikarsintaa. Tyypillinen arvioitu jono on 5–10 tilausta.
- **Mittaus 8.9.2026:** viisi 50 kappaleen Pysty-tilausta eri mitoilla vaati kuuden ehdokkaan arviointiin noin 27,4 sekuntia Nodessa.
- **Seuraava askel:** mittaa todellinen 5–10 tilauksen aineisto ja suunnittele peruutettava taustalaskenta sekä selkeä hakubudjetti. Älä palauta karsitun haun tulosta kaikkien batchien parhaana.



### B-005 — Core-profiilitestien paluuarvo ei vastaa Node-ajurin määritystä

- **Tila:** valmis 2026-09-08. Lähtöajossa vahvistettiin 33/34-tulos; batch-työn koko testipaketin ajamiseksi ryhmä määritettiin kahdeksan rivin taulukoksi. Kaikki kahdeksan tapausta ja koko 35 ryhmän ajo läpäisevät. Alkuperäinen havainto oli vahvistettu myös commitin `838158d` lähteistä.
- **Prioriteetti:** keskitaso
- **Alue:** `run-regressions.cjs`, testiryhmän paluuarvon tarkistus.
- **Havainto:** `runCoreProfileTypeValidationRegressionTests()` palauttaa kahdeksan PASS/FAIL-riviä, mutta ryhmä on ajurin boolean-listassa ilman `expectedRows`-arvoa. Kaikki kahdeksan tapausta läpäisevät, mutta `result === true` hylkää taulukon ja koko ajo päättyy tulokseen 33/34 sekä paluukoodiin 1.
- **Hyväksymiskriteeri:** ryhmä määritetään eksplisiittisesti kahdeksan rivin taulukoksi; väärä rivimäärä tai yksikin FAIL hylätään edelleen. Korjausta ei yhdistetty U-profiilin oletusmäärämuutokseen.

### B-002 — Osittaisten inventory-beam-tilojen heuristinen järjestys

- **Tila:** havaittu ja dokumentoitu
- **Prioriteetti:** matala ennen systemaattista laatumittausta
- **Alue:** optimizerin hakulaatu
- **Havainto:** valmiit ratkaisut käyttävät `scoreCompleteMaterialTransitionPlan()`-pisteytystä, mutta osittaiset beam-tilat järjestetään kevyemmällä heuristiikalla.
- **Vaikutus:** beam voi karsia haaran, joka olisi päätynyt parempaan valmiiseen materiaaliratkaisuun.
- **Ennen toteutusta:** rakenna mittaus ja pienien tapausten oracle; älä muuta heuristiikkaa yksittäisen esimerkin perusteella.
- **Hyväksymiskriteeri:** uusi ranking parantaa mitattua laatua edustavassa testipankissa ilman kohtuutonta suorituskykyhaittaa.

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

## Valmistuneet

### B-003 — Persistoidun profiilinimen tarkistus hyväksyy perityn ominaisuuden

- **Tila:** valmis; automaattiset Node- ja selaintestit sekä käyttäjän tarkistus läpäisty 2026-09-06
- **Prioriteetti:** keskitaso
- **Alue:** localStorage / profiilityypin validointi ja palautus
- **Korjaus:** raakalistan rivit, sahattavat rivit, jäännösrivit ja suunnitelman tangot hyväksyvät vain `PROFILE_TYPES`-olion omat avaimet. Prototyypistä perittyjä nimiä ei hyväksytä profiileiksi.
- **Testit:** `runStoredProfileTypeValidationRegressionTests()` kattaa 90 tapausta: kuusi kelvollista profiilia sekä perityt nimet, tuntemattomat nimet ja virheelliset tyypit kaikissa neljässä tallennuskohdassa. Vanha koodi epäonnistui 48 tapauksessa; korjattu läpäisee kaikki. Node-ajurissa 30/30 ryhmää läpäisty. Eristetyssä Edgessä 84 virheellistä tallennetta hylättiin ennen varastorivien palautusta ja 12 nykyistä/legacy-tallennetta palautui käynnistyksessä suunnitelmineen ja TEHTY-merkintöineen.
- **Rajaus:** tallennusskeema 3 ja moottoriversio `material-v0.3` säilyvät; kelvollisten tallenteiden muoto ei muutu. Suorien core-kutsujen vastaava tarkistus on erillinen B-004. Optimointia tai moduulirakennetta ei muutettu.

### B-001 — Persistoidun stock-ryhmän default/additional-invariantti

- **Tila:** valmis; automaattiset testit ja käyttäjän selaintarkistus läpäisty 2026-09-06
- **Prioriteetti:** matala
- **Alue:** localStorage / uuden materiaalin rivit
- **Korjaus:** jokaisella profiiliryhmällä vaaditaan täsmälleen yksi oletusrivi ennen työtilan palautusta. Validointi ja palautus käyttävät samaa `isAdditionalStoredStockProfileRow()`-sääntöä.
- **Legacy-yhteensopivuus:** puuttuva `additional` tulkitaan oletusriviksi vain profiilin ensimmäisellä rivillä. Eksplisiittinen oletusrivi saa edelleen olla lisärivin jälkeen. Skeema säilyy versiona 3.
- **Testit:** uusi `runStoredStockDefaultRowValidationRegressionTests()` kattaa 14 tapausta sekä luonnokselle että suunnitelmalliselle työtilalle. Vahvistettu selaimessa yhden oletusrivin ja poistettavuuden säilyminen, viiden korruptin riviyhdistelmän hylkäys ennen varaston palautusta sekä nykyisen ja legacy-työn palautuminen suunnitelmineen ja TEHTY-merkintöineen. Väri-, persistenssi-, finalisointi- ja perusregressiot läpäisty.

## Uuden merkinnän malli

```md
### B-NNN — Lyhyt nimi

- **Tila:** havaittu
- **Prioriteetti:** matala | keskitaso | korkea
- **Alue:** ...
- **Havainto:** mitä tapahtuu
- **Toisto tai näyttö:** pienin tunnettu tapaus
- **Vaikutus:** miksi asialla on merkitystä
- **Kiertotapa:** jos sellainen on
- **Hyväksymiskriteeri:** milloin kohta voidaan merkitä valmiiksi
```
