# ROADMAP.md

## Tarkoitus

Tämä tiedosto kuvaa projektin etenemissuunnan ja työvaiheiden järjestyksen. Se ei ole lupa toteuttaa kaikkia kohtia kerralla. Jokainen vaihe rajataan, toteutetaan ja testataan erikseen käyttäjän pyynnöstä.

Pidä tässä:

- nykyinen kehitysvaihe;
- seuraava konkreettinen työvaihe;
- myöhempien vaiheiden riippuvuudet;
- valmistuneet merkittävät checkpointit.

Ei-kiireelliset yksittäiset virheet ja parannukset kuuluvat `BACKLOG.md`:hen. Tuotanto- ja liiketoimintafaktat kuuluvat `DOMAIN_NOTES.md`:hen.

## Nykyinen checkpoint

Tuotannon suoritusnäkymän perusta toteutettu 9.9.2026. Fyysiset salot saavat profiilityyppikohtaiset 1..N-worker-numerot materiaaliplanin vakaasta järjestyksestä. Scheduler ja valmistelunäkymä etenevät yhtenäisinä Pysty–Vaste–Vaaka–U–kiskot-blokkeina, ja vain aktiivisen blokin salot valmistellaan. Skeema 6 tallentaa plan-digestiin sidotun kuittaustapahtumien etuliitteen ja viimeisin kuittaus voidaan perua. Materiaaliplani, score ja finalisoinnin varastosemantiikka säilyvät.

Kiskojen yhteismäärä ja aukkokohtainen 1+1-sekanippu toteutettu 8.9.2026. Suuremmat määrät niputetaan profiileittain; saman aukon samaa mittaa suositaan peräkkäin. Skeema 5 säilyttää vanhojen töiden kysynnän skeeman 4 määrämuunnoksella.

Sovellus muodostaa nyt avoimista tilauksista diskreetin tuotantobatchin (8.9.2026). Kokonaiset tilaukset valitaan materiaalipisteen perusteella, nykyinen inventory-aware optimizer tekee materiaaliratkaisun ja erillinen scheduler muodostaa nippusahausoperaatiot. Tilaus-/aukkokohdistus säilyy kappaleissa. Toteutuksen auktoritatiiviset säännöt ja rajat: `BATCH_AND_BUNDLE_SAWING_PLANNING.md`.

Uusi checkpoint: puhdas tuotantokerros, batchin debug-näkymä, valinnainen aukon tunnus, dependency-aware nippusahaus sekä batchin finalisoinnissa säilyvä avoin tilausjono. Materiaalipisteytys ei sisällä tuotantoaikaa. Vanhojen kohtien rolling-/sekventiaalinen putkitus on myöhempää mahdollista työtä.

Saavutettujen DP-kapasiteettien optimointi siirrettiin aktiiviseen `findCandidatePatternsDP()`-funktioon 9.9.2026. Se säilyttää kapasiteettien laskevan käsittelyjärjestyksen, binääriset määrälohkot, kuviokiintiöt ja sahausfysiikan. Vertailussa 1 354 kuviota sekä 14 tallennettua kokonaista suunnitelmaa scoreineen ja operaatioineen pysyivät identtisinä. Pienet vertailut nopeutuivat noin 2,7–16,6 sekunnista 0,06–0,50 sekuntiin; vaikea A-varaston batch 3/9/21 kesti edelleen noin 37,8 sekuntia.

Pattern-listojen vakaa suora merge siirrettiin productioniin 9.9.2026. Se säilyttää comparatorin, vanhan listan etusijan, duplikaatit ja kuviokiintiön mutta poistaa kapasiteettipäivityksistä merkkijonoavaimet, Map-deduplikoinnin ja koko listan lajittelun. Vaikean A-varaston 3/9/21-batchin materiaalimediaani laski samalla koneella 34,69 sekunnista 20,23 sekuntiin; tulos, score, operaatiot ja beam-tilastot säilyivät.

Jatkuvan jäännösvirran replay-tutkimus suljettiin 9.9.2026. Samoissa batcheissa jäännökset vähensivät uuden materiaalin tarvetta 54 salkoa, mutta simulaatioon kertyi fyysiseen reality checkiin nähden liikaa pitkiä paloja. Nykyisiä romurajoja ei muutettu, scorea ei kalibroitu ja A/B/C-varastot säilyvät stressitesteinä. Raportti: `benchmarks/batch-search/flow-replay/RESULTS.md`.

Checkpointin tarkistus 8.9.2026: 35/35 Node-testiryhmää ja 17 ohjaus-/persistenssitarkistusta läpäisty. Käyttäjän selaintestit ja agentin täydentävä HTTP-selaintestaus läpäisty, mukaan lukien pienennettävät tilauskortit kappalemäärineen, palautus, profiilieristys, kiskoniput, batch-koot ja saman tangon jatkosahaus. Tarkat syötteet ja rajaukset ovat tuotantosuunnitteludokumentissa.

Valmiina ovat muun muassa:

- inventory-aware optimointipolku ja materiaalisiirtymän pisteytys;
- ryhmitelty uuden materiaalin ja jäännösten käyttöliittymä;
- materiaalivärien erottelu;
- tankokohtainen `TEHTY`-tila;
- järjestyksessä etenevä operaatioiden kuittaus ja viimeisimmän peruminen;
- työn finalisointi ja authoritative post-order-varasto;
- versioitu localStorage-työtila;
- finalisoinnin persistoi-ensin/commitoi-sitten-turva;
- tallennetun suunnitelman semanttinen ja fyysinen validointi;
- persistoidun raakalistan riviraja ja kanoninen varianttiduplikaattien tarkistus;
- profiiliryhmän yhden oletusrivin tarkistus myös legacy-tallenteille (B-001, testattu 2026-09-06);
- yhteinen neljän perustestin testipankki ja avointa työtä muuttamaton core-regressioajo (automaattitestit ja käyttäjän selaintarkistus läpäisty 2026-09-06);
- Node-testiajuri: 29/29 regressioryhmää ja paluukoodi 0 vahvistettu myös käyttäjän VS Coden terminaalissa (2026-09-06);
- B-003:n tallennettujen profiilinimien korjaus: 90/90 kohdistettua tapausta, laajentunut Node-paketti 30/30 sekä automaattiset selaintestit ja käyttäjän tarkistus läpäisty (commit `a8603b2` pushattu);
- ensimmäinen puhdas core-irrotus: `src/cutting-physics.js` ja yhteensopiva selain-/Node-lataus toteutettu; automaattitestit ja käyttäjän Node-/selaintarkistus läpäisty;
- tilauspohjainen Sahattavat-UI, yhteinen kiskosyöttö ja skeema 4 toteutettu; Node 33/33, automaattiset selaintestit ja käyttäjän tarkistus läpäisty.

### Tuotantomuistion vertailu nykytilaan (2026-09-06)

Muistion ”Tuleva tilaus-UI, varastonhallinta ja sahaustoleranssit” päällekkäisiä kohtia ei toteuteta uudelleen:

| Muistion asia | Nykytila |
| --- | --- |
| Tilauskortit, yksi väri, viisi accordionia, mitta/määrä ja yhteinen kiskosyöttö | Toteutettu; adapteri tuottaa erilliset fyysiset profiilirivit |
| `orderId` syötteessä | Toteutettu; kappalekohtainen tuloskohdistus ja `openingId` ovat myöhempää työtä |
| Rajalliset varastosaldot ja käytön vähentäminen finalisoinnissa | Toteutettu; tuotannon todellisiin alkusaldoihin siirtymisestä ei vielä ole päätöstä |
| Raakalistan accordionit, hälytysyhteenveto ja vastaanotto | Ei toteutettu; vaihe 1c |
| Mittatoleranssit ja erilliset kapasiteettivarat | Ei toteutettu; vaihe 1c:n tuotantokäytön edellytys |

Tuotantofaktat ja alustavat luvut ovat `DOMAIN_NOTES.md`:ssä. Tämä päivitys ei muuta kerfin 3 mm:n oletusta, täsmäsovituksen hyväksymistä, pisteytystä tai tallennusversioita.

## Seuraava työvaihe

Tuotannon suorituspolun seuraava rajattu vaihe on suunnitellun ja toteutuneen lähteen poikkeaman käsittely. Nykyinen tapahtumamalli varaa `actualSourceIds`-kentän, mutta skeeman 6 ensimmäinen versio hyväksyy vain suunnitelman lähteet. Ennen väärän salon korjausta pitää päättää lähteen valintakäyttöliittymä, vaikutus jäljellä oleviin operaatioihin ja se, milloin osittainen työ voidaan turvallisesti uudelleenoptimoida.

Batch-kuorman myöhempi arviointi ei saa nojata automaattisesti pelkkään kappalemäärään. Workload-aware batch sizing voidaan tutkia erillisenä vaiheena kokonaismetrien, profiilityypin, fyysisen tilantarpeen ja sahaamisen jälkeisen käsittelyn avulla. Nykyisiä 200/250/300-rajoja tai selectorin logiikkaa ei muuteta ennen erillistä mallia ja mittauksia.

Batch-/nippusahauspolun ja kiskosyötteen selaintarkistukset on tehty käyttäjän antamassa HTTP-osoitteessa. Seuraava tutkimuskohde on automaattisen batch-valinnan hakulaatu ajan funktiona. Erillinen Node-koeversio ja ensimmäinen 23 tilauksen / 10 minuutin mittaus ovat `benchmarks/batch-search/RESULTS.md`:ssä. Selain käyttää edelleen aiempaa exhaustive-selectoria.

Jatkotutkimus 8.–9.9.2026 kattoi kolme synteettistä 100 jäännöksen stressivarastoa, kaksi äärellistä uutta varastoa, viisi tilausjärjestystä, vaikean 3/9/21-batchin profiloinnin ja jatkuvan jäännösvirran replayn. Saavutettujen DP-tilojen käsittely ja järjestetty pattern-merge ovat productionissa. Materiaalihakijan sisäisen rivijärjestyksen hallinta sekä replayn pitkien loppujäännösten poikkeama jäävät myöhemmiksi laatututkimuksiksi; jäännösvarastotutkimusta ei jatketa nyt.

Käyttäjän uusi vaatimus erottaa kaksi tavoitetta: käsin valitun 2–5 tilauksen normaalin materiaaliratkaisun pitää valmistua sekuntien suuruusluokassa; automaattinen suuren jonon haku saa käyttää minuutteja tai pidempään, jos mitattu materiaalihyöty perustelee sen. Ensimmäinen koe tukee kaksivaiheista hakua, mutta eri jonot, varastot ja aloitukset pitää mitata ennen production-hakubudjetin päättämistä. Työaikaa tai schedulerin mittareita ei lisätä pisteytykseen.

Myöhemmät erilliset kehityskohteet ovat Vasteprofiilin nippukapasiteetin vahvistaminen, operaatiokohtainen kuittaus ja batch-historia. Tuotantoajan kustannukset vaativat erillisen päätöksen ja kalibroinnin.

## Aikaisempi vaiheistus (historia ja myöhemmät mahdollisuudet)

Alla olevat aiemmat suunnitelmat eivät korvaa 8.9.2026 toteutettua diskreettiä batch-pipelinea eivätkä anna lupaa tuleviin toteutuksiin.

## Vaihe 1: testattavuuden perusta

Tavoite on vähentää käsin syötettävien tilausten määrää ja tehdä regressioista toistettavia.

Ensimmäinen rajattu toteutus (2026-09-06): `createDevelopmentTestCases()` sisältää neljän perustestin syötteet ja odotukset. `runCoreRegressionTests()` ajaa ne ilman lomakkeen tai tallennuksen muuttamista; vanhat selainapurit säilyvät yhteisen testidatan käyttäjinä. Testipankki on tässä vaiheessa edelleen `app.js`:ssä.

Automaattinen varmistus: kaikkien neljän tapauksen tarkat sahaustulokset vastaavat ennen refaktorointia talletettua vertailuaineistoa. Node- ja eristetty Edge-ajo läpäisivät testit. Selainajossa myös lomake, suunnitelma, TEHTY-merkinnät ja localStorage säilyivät ennallaan. Uusi testiajo hylkäsi tarkoituksella rikotut kappale-/materiaalitaseet, lähdemäärät, sahausfysiikan, mutaatiot ja epädeterministisen tuloksen.

Node-ajuri (2026-09-06): `run-regressions.cjs` kokoaa 29 testiryhmää, eristää ne toisistaan ja palauttaa epäonnistumisesta paluukoodin 1. Normaali ajo läpäisi kaikki ryhmät myös toisesta työhakemistosta. Lisäksi 18 erillistä ajuritarkistusta kattoi paluuarvojen tulkinnan, virheestä jatkamisen, tuoreet testiympäristöt, aikakatkaisun sekä puuttuvan tai syntaksiltaan virheellisen lähteen. Aikakatkaisun virhepolku testattiin lyhennetyllä aikarajalla. Sovelluksen lähdekoodia tai selainpolkua ei muutettu tässä vaiheessa.

- Erota DOM:sta riippumattomat regressiot selkeäksi testipankiksi.
- Säilytä nykyiset selaimen dev-apurit, kunnes korvaava käyttöpolku on valmis.
- Lisää nimettyjen testitapausten lataus ilman optimizerin käyttäytymisen muutosta.
- Määritä yksi komento tai selkeä selainajo keskeisten regressioiden suorittamiseen.
- Pidä Testi A, Testi A jäännöksillä ja D1 pakollisina checkpoint-tapauksina.

Valmis, kun sama regressiopaketti voidaan ajaa toistettavasti ilman lomakerivien käsin syöttämistä ja tulos raportoi selvät PASS/FAIL-tiedot.

## Vaihe 1b: app.js:n vaiheittainen jakaminen vastuualueisiin

Tämä on etenemissuunnan luonnos, ei lupa koko projektirakenteen vaihtoon yhdellä kertaa. Jaa koodi sen mukaan, mitä se tekee ja mistä se saa riippua, älä tiedoston rivimäärän perusteella. Tärkein raja on puhdas core suhteessa selaimeen, käyttöliittymään ja tallennukseen.

### Etenemisjärjestys

1. **Node-testiajuri valmiiksi — tehty.** Yhteinen testipankki ja komentoriviajo toimivat nykyisessä rakenteessa.
2. **Korjaa B-003 erikseen — tehty ja hyväksytty.** Virheen osoittava regressio epäonnistui ennen korjausta ja läpäisee sen jälkeen; myös palautusraja on testattu selaimessa. Korjaus on käyttäytymismuutos, ei osa tiedostojen siirtoa.
3. **Irrota ensimmäinen pieni puhdas core-alue — toteutettu.** `src/cutting-physics.js` sisältää `cutPiece()`-funktion sekä 0,1 mm:n mittayksiköt ja muunnos-/tarkistusapurit. Materiaalidomainia, pisteytystä tai UI:ta ei siirretty samalla.
4. **Varmista ensimmäinen irrotus — tehty ja hyväksytty.** Node-paketti 31/31, alla kuvatut tarkat vertailut sekä selaimen laskenta-, dev-apuri- ja palautustarkistukset läpäisivät. Käyttäjä vahvisti myös omien testiensä läpäisyn ja pyysi commitia sekä pushia.
5. **Irrota inventory/material-logiikka pienissä osissa — ensimmäinen irrotus toteutettu 10.9.2026.** `src/material.js` sisältää `PROFILE_TYPES`-määrittelyn sekä `isSupportedProfileType()`, `validateMaterialAvailability()`, `createMaterialInventory()`, `getMaterialSourcesForProfile()`, `consumeMaterialSource()` ja `calculateMaterialUsage()` -funktiot. Toteutusten järjestys-, validointi- ja kulutussäännöt säilyvät. Jälkivaraston muodostus ja jäännösten arvotus jäävät vielä `app.js`:ään.
6. **Aja samat tarkistukset jokaisen irrotuksen jälkeen.** Älä niputa useita siirtoja yhdeksi testattavaksi loppuvaiheeksi.
7. **Irrota optimizer vasta domain-/materiaalirajojen selkiydyttyä.** Säilytä hakujärjestys, pisteytys, tasatilanteiden ratkaisu ja tulosrakenne. Legacy-polkuja ei poisteta eikä oteta aktiiviseksi varapoluksi tämän työn yhteydessä.
8. **Jätä UI ja persistenssin I/O viimeisiksi.** Sovelluksen käynnistys ja työnkulun koordinointi voivat lopulta jäädä pieneen `app.js`:ään. Tallenteiden puhdas validointi erotetaan DOM-palautuksesta ja localStorage-käsittelystä silloin, kun tätä rajaa käsitellään.

Ensimmäinen irrotus tehdään ennen vaiheen 2 laajempaa mittauskokonaisuutta. Loput irrotukset voidaan rytmittää vaiheen 2 rinnalle sen mukaan, mitä testaus ja kehitys tarvitsevat. UI:n ja persistenssin koko uudelleenjärjestely ei saa muodostua edellytykseksi oraclelle tai satunnaistestaukselle: aktiivinen optimizeri toimii jo nyt ilman DOM:ia.

Ensimmäisen materiaalirajan riippuvuudet: varaston validointi käyttää profiilimäärittelyä ja sahausmoduulin mittatarkkuustarkistusta; varaston muodostus ja kulutuksen laskenta käyttävät lisäksi mittayksikkömuunnosta. Variantin lähdehaku käyttää validointia, ja lähteen kulutus toimii vain syötteillään. `calculatePostOrderMaterialInventory()` kutsuu disposition-arvotusta ja `findMaterialSourceCandidates()` DP-hakua, joten kumpikin jää `app.js`:ään pisteytyksen ja optimizerin kanssa. Materiaalimoduulista ei ole riippuvuutta takaisin sovellukseen, UI:hin tai tallennukseen.

Nykyinen latausjärjestys on cutting-physics → material → production-planning → production-integration → app tavallisina skripteinä. Samat tiedostot ladataan Node-ajureissa ja tutkimustyökaluissa; historiallisia tutkimustuloksia ei muuteta. `MATERIAL` on jäädytetty rajapinta ja myös CommonJS-ladattava. Sovelluksen globaalit funktiot säilyvät `var`-aliasina ja profiilimäärittely `const`-aliasina. Skeema 6 ja moottoriversio `material-v0.3` säilyvät.

Materiaalirajan vertailu: ennen siirtoa tallennettiin commitin `54445d7` neljän perusfixturen täydet optimoinnit, suunnitelmat, varastot, piste-erittelyt ja operaatiot. `run-material-regressions.cjs` lukitsee niiden yhteisen digestin ja tarkistaa moduulin itsenäisen latauksen. Nykyinen 36 ryhmän core-paketti, 32 UI-/persistenssitarkistusta sekä 1 354 patternin ja 14 + 1 tallennetun suunnitelman vertailu läpäisivät ennen siirtoa ja sen jälkeen muuttumattomilla odotuksilla. Lisäksi tutkimusajurit läpäisivät 20 batch-haun ja 5 jäännösreplayn tarkistusta. Kaikkien kuuden siirretyn funktion rungot tarkistettiin alkuperäisiksi sisennystä lukuun ottamatta.

HTTP-selaintesti 10.9.2026 erillisessä tilapäisessä testiosoitteessa: musta Pysty 2200 mm × 2, vanha jäännös 3900 mm, rajaton uusi 6000 mm materiaali ja kerf 3 mm. Tuloksena yksi uusi salko, kaksi sahausta, 1594 mm jäännös, 6 mm sahahukka ja materiaalipiste 5758,2. Kuittaus säilyi reloadissa ja undo palautti ensimmäiseen sahaukseen. Finalisointi säilytti vanhan 3900 mm jäännöksen ja lisäsi 1594 mm jäännöksen. Käyttäjän avoimeen työhön ei koskettu.

### Riippuvuudet ja mahdollinen lopputulos

Mahdollinen tiedostojako, ei vielä lukittu hakemisto- tai moduulimuotopäätös:

- `src/domain.js`: puhtaat domain-määrittelyt, materiaalin identiteetti, mittayksiköt ja sahausfysiikka.
- `src/material.js`: varasto, saatavuus, lähteiden kulutus ja materiaalitilasiirtymät; pisteytyksen sijoitus tarkentuu irrotuksen yhteydessä.
- `src/optimizer.js`: haku ja ratkaisujen vertailu domain-/materiaalirajapintojen kautta.
- `src/persistence.js`: tallennus, versiointi ja palautuksen koordinointi; puhtaat tallennevalidoinnit pidetään erotettavina I/O:sta.
- `src/ui.js`: lomakkeet, tapahtumat ja renderöinti.
- `src/app.js`: käynnistys ja työnkulun koordinointi.
- `tests/cases.js` ja erillinen ajuri: testidata ja testien suoritus; nykyinen `run-regressions.cjs` säilyy toimivana käyttöpolkuna siirtymän ajan. Mahdollinen `run-tests.mjs` ei ole tässä vaiheessa päätetty tiedostomuoto.

Core ei saa riippua `document`-, `window`- tai `localStorage`-rajapinnoista, UI:sta, persistenssin I/O:sta eikä testidatasta. Materiaalikerros voi käyttää domainia, optimizer domainia ja materiaalikerrosta. Selainpuoli ja testit käyttävät näitä samoja toteutuksia; niitä ei kopioida erikseen Nodea varten. Syklisiä riippuvuuksia vältetään. Testidata voi siirtyä omaan tiedostoon pienessä erillisessä vaiheessa, mutta testit eivät ole coren riippuvuus.

Ensimmäisen irrotuksen latausratkaisu: `index.html` lataa tavallisina skripteinä ensin `src/cutting-physics.js`:n ja sitten `app.js`:n. Node-ajuri lataa samat tiedostot samassa järjestyksessä jokaiseen tuoreeseen `vm.Script`-ympäristöön. Sahausmoduuli sulkee toteutuksen `CUTTING_PHYSICS`-rajapinnan taakse ja tukee myös suoraa CommonJS-latausta. `app.js`:n aliasnimet säilyttävät konsoli-/window-kutsut; HTML:n inline-painikkeita tai dev-apureita ei tarvitse muuttaa. Tämä ei lukitse koko sovelluksen lopullista moduulimuotoa eikä lisää rakennusvaihetta, paketinhallintaa tai riippuvuuksia.

Irrotuksen varmistus (2026-09-06): lähtötaso oli 30/30 Node-ryhmää. Ennen siirtoa lisättiin 23 kohdistettua sahausfysiikan testiä; laajennettu 31/31 paketti läpäisi ennen siirtoa ja sen jälkeen. Neljän perustapauksen koko optimointitulos, UI-suunnitelma ja valmiiden töiden lopullinen varasto täsmäsivät commitin `a8603b2` lähteestä ajettuun vertailuun. Lisäksi 475 sahausfysiikan tulos-/virhevertailua täsmäsi. Moduuli testattiin yksin ilman selain- tai Node-isännän rajapintoja sekä suoralla `require()`-latauksella. Ajurin 21 tarkistusta kattoi myös uuden lähteen puuttumisen, syntaksivirheen ja alustusvirheen.

Eristetyssä Edgessä tarkistettiin oikeat laskenta- ja TEHTY-painikkeet sekä uudelleenlataus, neljä fixture-loaderia, core-ajon live-työn muuttamattomuus, aiempi selainregressioajo, värien käsittely ja finalisointi. Persistenssin palautusraja läpäisi 84 virheellistä ja 12 kelvollista nyky-/legacy-tallennetta TEHTY-tiloineen. Käyttäjän omaa Live Server -työtilaa ei käytetty automaattitesteissä. Kerf-semanttiikka, hakujärjestys, pisteytys ja tallennusversiot eivät muuttuneet.

### Hyväksymisportti jokaiselle irrotukselle

- Ota lähtötulokset talteen ennen muutosta ja lisää puuttuvat kohdistetut testit ennen siirtoa. Koko nykyinen regressiopaketti on lähtötaso, ei todistus kaiken käyttäytymisen kattavuudesta.
- Vertaa samoilla syötteillä myös sahausjakoja, materiaalilähteitä, määriä, hukkaa, jäännöksiä, kustannuserittelyä ja mahdottomien syötteiden raportointia, ei vain tankomäärää.
- Säilytä kerf- ja loppusovitussemantiikka, `stockLength`-syötteen käyttö, materiaalivarianttien yhteensopivuus, jäännösten arvo, mutatoimattomuus ja deterministisyys.
- Aja koko Node-paketti sekä relevantit selaimen UI-, persistenssi- ja dev-apuritestit. Pelkkä vihreä Node-ajo ei todista selainlatauksen toimivuutta.
- Tee yksi looginen, testattava siirto kerrallaan ja päivitä muuttuneet polut/ohjeet samassa työssä. Älä yhdistä algoritmiparannusta tai virhekorjausta rakenteen muutokseen. Commit ja push tehdään vain käyttäjän pyynnöstä.

Tavoite jokaiselle refaktoroinnille: arkkitehtuuri muuttui, optimizerin käyttäytyminen ei. Rivimäärille ei aseteta tavoitteita, eikä koko tiedostojakoa toteuteta ennen todellisten riippuvuuksien tarkistamista ja käyttäjän hyväksyntää.

## Vaihe 1c: varaston käytettävyys ja tuotantokapasiteetin varmistaminen

Tämä on tulevien töiden suunnitelma, ei valmis ominaisuuspaketti. Tarkat tuotantoperusteet, epävarmuudet ja luvut ovat `DOMAIN_NOTES.md`:ssä. Vaihe voidaan rytmittää 1b:n ja laatumittauksen rinnalle; refaktorointi ja laskennan käyttäytymismuutos pidetään eri töinä.

### Varastonhallinnan pienet toteutusvaiheet

1. **Sovi todellisten saldojen käyttöönotto.** Säilytä optimizerin jo toimiva rajallisten lähteiden tuki ja finalisointi. Määrittele alkusaldojen kirjaaminen sekä `unlimited`-/tuntemattoman saldon käsittely ennen automaattisia tuotantohälytyksiä; rajattomuutta ei muuteta keksityksi kappalemääräksi.
2. **Määrittele ja testaa puhdas saldon tilaluokittelu.** Alustavat yhteiset asetukset ovat `reorderThreshold = 50` ja `criticalStockThreshold = 10`: yli 50 normaali, 11–50 tilaa lisää, 1–10 kriittisen vähän, 0 loppu. Nämä ovat varastonhallinnan eivätkä optimizerin score-asetuksia.
3. **Tiivistä Raakalista profiiliaccordioneiksi.** Suljettu otsikko näyttää tilan ja oleelliset värikohtaiset poikkeukset, esimerkiksi ”Vaakaprofiili — Musta 47 kpl, tilaa lisää”. Avattuna näytetään värit ja todelliset määrät. Tuntematonta saldoa ei esitetä varmennettuna ”varasto OK” -tilana.
4. **Lisää erillinen tiivis hälytysyhteenveto.** Näytä poikkeusten määrät ja avattava, vakavuuden mukaan ryhmitelty lista: loppu, kriittisen vähän, tilaa lisää. Runsaan varaston kaikkia määräkenttiä ei tarvitse pitää esillä päivittäisessä käytössä.
5. **Lisää vastaanotto omana toimintona.** Saapunut määrä lisätään valitun profiili-/värivariantin saldoon, esimerkiksi 7 + 100 = 107. Määrittele tallennusvirheen käsittely ja avoimen suunnitelman mitätöinti samassa rajatussa työssä. Varastotapahtumien historia jää myöhemmäksi.

Hyväksymistestit: saldot 0, 1, 10, 11, 50 ja 51; varianttien eristys; rajaton/tuntematon saldo; 34 tangon saatavuus säilyy 34:nä hälytyksestä huolimatta; vastaanotto 7 + 100 sekä virheelliset määrät ja tallennusvirhe. UI-muutoksille tarkistetaan mobiiliasettelu, palautus ja ettei accordionin pelkkä avaus muuta laskentaa tai TEHTY-tilaa.

### Erillinen toleranssimalli ennen riskialttiiden täsmäsovitusten tuotantokäyttöä

1. **Määrittele kapasiteettimalli ja hyväksy parametrit.** Pidä nimellismitta, todellinen kerf, kappalekohtainen vara, mahdollinen kerf-marginaali sekä tangon pää-/turvallisuusvara erillään. Noin 1 mm/kappale on kokeiluehdotus, ei automaattisesti käyttöön otettava vakio. Noin 3,4 mm:n terähavainnon soveltaminen nykyiseen oletukseen päätetään erikseen.
2. **Lisää tapaukset ennen laskentamuutosta.** Testaa nolla- ja lähes nollajäännös, viiden kappaleen +0,5 mm:n virheen kumuloituminen 2,5 mm:iin, viimeinen katkaisu, rajalliset lähteet ja jäännöslähteet. Erottele laskennan vara fyysisestä sahahukasta, jäännöksestä ja materiaalitaseesta; kappaleen tilattua mittaa ei kasvateta.
3. **Toteuta yksi rajattu kapasiteettimuutos.** Optimizerin kelpoisuustarkistus, tulosvalidointi ja tallennetun suunnitelman tulkinta käyttävät samaa hyväksyttyä mallia. Arvioi skeema-/moottoriversion tarve. Säilytä nollavaroilla nykyiset vertailutulokset ja dokumentoi tarkoitukselliset muutokset varojen ollessa käytössä.
4. **Varmista tuotannossa ja kalibroi.** Pelkkä nimellismittojen täsmääminen tai regressioiden läpäisy ei todista fyysistä toleranssiturvaa. Riskialttiita täsmäsovituksia ei hyväksytä tuotantoon ennen mallin ja mittaushavaintojen varmistamista.

### Vastuurajat

- Tilaus-UI tuottaa normalisoidut cut-rivit; optimizer ei tunne accordioneja.
- Todellinen varastosaldo asettaa materiaalirajoitteen ja toimii erikseen hälytysten lähtötietona. Hälytys ei vähennä käytettävissä olevaa määrää.
- Toleranssi- ja kapasiteettivarat kuuluvat turvallisen kapasiteetin laskentaan, eivät piilotetuiksi kerf- tai score-muutoksiksi.
- Aukkokohtainen `Tilaus → Aukko → profiilit` -syöttö ja `openingId` arvioidaan vasta tuotantokohdistuksen tarpeesta vaiheessa 4. Valmista tilaus-UI:ta ei tehdä uudelleen tämän muistion perusteella.

## Vaihe 2: optimizerin laadun mittaaminen

Tavoite on mitata heuristiikan laatua eikä vain todeta tulosten näyttävän hyviltä.

- Laajenna kiinteitä regressioita realistisilla ja tarkoituksella hankalilla tapauksilla.
- Lisää seedattu satunnaistestaus.
- Lisää kohdistettuja generaattoreita kapasiteetti-, kerf- ja niukkuusrajojen lähelle.
- Lisää property-testit materiaalitaseelle, varianttien eristykselle, jäljitettävyydelle, determinismille ja syötteiden mutatoimattomuudelle.
- Rakenna pienille tapauksille hidas täsmäratkaisija tai muu oracle.
- Raportoi optimum-osumat, keskimääräinen poikkeama, 95./99. prosenttipiste ja pahin löydetty tapaus.

Score- tai hakuparametreja ei viritetä vain muutaman käsin valitun testin perusteella.

## Vaihe 3: materiaalivaihtoehdot

Kun testattavuus ja laatumittaus ovat riittäviä:

- laajenna single-order-optimizer palauttamaan pieni top-K/Pareto-joukko aidosti erilaisia materiaalivaraston tilasiirtymiä;
- vältä lähes identtisiä sahausjärjestysvariantteja;
- näytä vaihtoehtojen uuden materiaalin, jäännösarvon, hukan ja varaston pirstaloitumisen erot;
- kalibroi terminal inventory value tuotanto- ja kysyntähistorian avulla.

Nykyistä scorea tai hakua ei korvata kerralla.

## Vaihe 4: tuotanto-operaatiot ja useat tilaukset

Materiaaliratkaisun päälle rakennetaan erillinen tuotantonäkymä:

- yksi `cut operation` kuvaa sahausliikkeen, katkaisumitan ja siinä mukana olevat lähteet;
- sahausnippu saa muuttua leikkausten välillä;
- turvallisuusyhteensopivuus mallinnetaan sääntönä eikä kovakoodattuna profiilien identtisyysvertailuna;
- `maxStackSize` on profiilityyppikohtainen;
- nippusahaus ja tilausten putkitus ovat ensimmäiset tuotantokehityksen tavoitteet; mittavasteen siirrot tuottavat myöhemmin erillisen työaikakustannuksen;
- putkituksen vaatima työjärjestys ja tilauskohdistus rajataan ensimmäiseen toteutukseen; väri ja pakkaamisen muut preferenssit voidaan lisätä myöhemmin.
- valmistelun worker-numerot sekä operaatioiden järjestetty kuittaus ovat toteutettuja; seuraava vaihe käsittelee suunnitellun ja toteutuneen lähteen poikkeaman ja vasta sen jälkeen mahdollisen osittaisen uudelleenoptimoinnin.

Tilausten putkituksen tarkka merkitys rajataan ensin; 5–10 tilauksen rolling-horizon-yhteisoptimointi on mahdollinen myöhempi laajennus, ei putkituksen automaattinen määritelmä. Kappaleissa säilytetään `orderId` ja aukkokohtaisen mallin myötä `openingId`. Myöhemmin mukaan voidaan ottaa kiireellisyys, deadline, asentajien tarpeet ja materiaalin niukkuus.

## Vaihe 5: parametrien viritys ja tuotantodata

Kun testipankki ja laatumittarit ovat olemassa:

- kokeile grid/random searchia, Bayesian optimizationia tai evoluutioalgoritmeja score- ja hakuparametreille;
- vertaa tuloksia sekä oracleen että oikeisiin tuotantotilauksiin;
- arvioi jäännöksen tulevaa käyttökelpoisuutta profiilityypin, värin, pituuden, määrän, iän ja kausivaihtelun perusteella;
- harkitse koneoppimista vasta, kun oikeaa historiaa ja selkeä tavoitemuuttuja on riittävästi.

Neuroverkkoa ei käytetä cutting-stock-ratkaisijan korvaajana ilman mitattua perustetta.

## Vaihe 6: tilaustietojen tuonti

Mahdollinen välivaihe:

1. käyttäjä ottaa kuvan puhtaasta sahauslistasta;
2. backendissä toimiva vision-malli palauttaa rakenteisen tuloksen;
3. käyttäjä tarkistaa tiedot;
4. hyväksytty data siirtyy optimizerille.

API-avainta ei koskaan tallenneta selaimen `app.js`:ään. GitHub Pages ei tarjoa tarvittavaa salaista backend-ympäristöä.

Pidemmän aikavälin tavoite on Easoft- tai muun yritysjärjestelmän adapteri, jos rajapinta saadaan. Core-optimointi ei saa riippua kuvatulkinnasta, käyttöliittymästä tai Easoftin tietomuodosta.

## Roadmapin ylläpito

- Päivitä **Nykyinen checkpoint**, kun vaihe valmistuu ja on testattu.
- Pidä vain yksi selkeä **Seuraava päätös** tai **Seuraava työvaihe**.
- Siirrä irrallinen myöhempi havainto `BACKLOG.md`:hen.
- Siirrä tuotantofakta tai epävarma talousarvio `DOMAIN_NOTES.md`:hen.
- Älä merkitse heuristista tulosta todistetuksi optimiksi.
