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

Sovellus on mobiiliystävällinen, selaimessa toimiva single-order-prototyyppi. Aktiivinen optimizeri huomioi profiilityypin ja värin materiaalivarianttina, rajallisen tai rajattoman uuden materiaalin sekä olemassa olevat jäännökset.

Valmiina ovat muun muassa:

- inventory-aware optimointipolku ja materiaalisiirtymän pisteytys;
- ryhmitelty uuden materiaalin ja jäännösten käyttöliittymä;
- materiaalivärien erottelu;
- tankokohtainen `TEHTY`-tila;
- työn finalisointi ja authoritative post-order-varasto;
- versioitu localStorage-työtila;
- finalisoinnin persistoi-ensin/commitoi-sitten-turva;
- tallennetun suunnitelman semanttinen ja fyysinen validointi;
- persistoidun raakalistan riviraja ja kanoninen varianttiduplikaattien tarkistus;
- profiiliryhmän yhden oletusrivin tarkistus myös legacy-tallenteille (B-001, testattu 2026-09-06);
- yhteinen neljän perustestin testipankki ja avointa työtä muuttamaton core-regressioajo (automaattitestit ja käyttäjän selaintarkistus läpäisty 2026-09-06);
- Node-testiajuri: 29/29 regressioryhmää ja paluukoodi 0 vahvistettu myös käyttäjän VS Coden terminaalissa (2026-09-06);
- B-003:n tallennettujen profiilinimien korjaus: 90/90 kohdistettua tapausta, laajentunut Node-paketti 30/30 sekä automaattiset selaintestit ja käyttäjän tarkistus läpäisty (commit `a8603b2` pushattu);
- ensimmäinen puhdas core-irrotus: `src/cutting-physics.js` ja yhteensopiva selain-/Node-lataus toteutettu; automaattitestit ja käyttäjän Node-/selaintarkistus läpäisty.

## Seuraava työvaihe

Arkkitehtuurikatselmus ja ensimmäinen rajattu refaktorointi on tehty. Core-optimointi toimii jo ilman DOM:ia; ensimmäinen testattavuuden este oli perustestien kytkentä avointa työtä muuttaviin lomakelatauksiin. Yhteiset testitiedot ja `runCoreRegressionTests()`-ajo on hyväksytty myös käyttäjän selaintarkistuksessa.

Node-testiajuri on hyväksytty: `run-regressions.cjs` ajaa saman testipankin ja valitut puhtaat regressiot. Käyttäjä vahvisti VS Coden terminaalissa tuloksen `Regressioryhmät: 29/29 läpäisty` ja paluukoodin 0. Paketinhallintaa, uusia riippuvuuksia tai `app.js`:n pilkkomista ei tarvittu.

`BACKLOG.md / B-003` on korjattu ja hyväksytty myös käyttäjän tarkistuksessa. Tallennusskeema ja optimizerin käyttäytyminen säilyvät ennallaan; korjaus koskee virheellisten profiilinimien hylkäämistä.

Vaiheen 1b ensimmäinen irrotus on toteutettu ja hyväksytty käyttäjän testeissä: `cutPiece()` ja sen mitta-apurit sijaitsevat nyt omassa puhtaassa moduulissaan. Seuraava vaihe on materiaalivariantin identiteetin ja varaston muodostuksen riippuvuuksien rajaus seuraavaa pientä siirtoa varten. Vaiheen 2 kohdistetut testit (materiaalin niukkuus, varianttieristys ja kerfin rajat) säilyvät suunnitelmassa, ja laajempaa laatumittausta voidaan nyt jatkaa ensimmäisen irrotuksen rinnalla. Koko sovelluksen pilkkominen ei ole laatumittauksen aloitusehto.

Katselmuksen myöhemmät rakennerajat säilyvät: materiaalivariantin identiteetti keskitetään ennen lisäattribuutteja, materiaaliratkaisu ja tuotanto-operaatiot pidetään erillään, ja monen tilauksen kappalekohdistus säilytetään ennen sahausmittojen ryhmittelyä. Samanlaiset varastojäännökset pysyvät määrällisinä ryhminä; pysyviä yksilö-ID:itä ei tarvita.

Persistenssiauditin default/additional-rivi-invariantti on korjattu ja testattu (B-001). Ensimmäisen core-irrotuksen hyväksymisen jälkeen pienin luonteva jatko on materiaalivariantin identiteetin ja varaston muodostuksen riippuvuuksien rajaus seuraavaa pientä siirtoa varten. Suorien core-kutsujen profiilivalidointihavainto on kirjattu erikseen kohtaan `BACKLOG.md / B-004`; sitä ei korjata moduulien siirron sivussa.

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
5. **Irrota inventory/material-logiikka pienissä osissa.** Erota varaston muodostus, materiaalilähteet, lähteiden kulutus ja materiaalitilasiirtymät. Jäännösten arvotus ja kustannuskomponentit säilyvät nimettyinä ja selitettävinä; pisteytyksen tiedostorajasta päätetään todellisten riippuvuuksien perusteella.
6. **Aja samat tarkistukset jokaisen irrotuksen jälkeen.** Älä niputa useita siirtoja yhdeksi testattavaksi loppuvaiheeksi.
7. **Irrota optimizer vasta domain-/materiaalirajojen selkiydyttyä.** Säilytä hakujärjestys, pisteytys, tasatilanteiden ratkaisu ja tulosrakenne. Legacy-polkuja ei poisteta eikä oteta aktiiviseksi varapoluksi tämän työn yhteydessä.
8. **Jätä UI ja persistenssin I/O viimeisiksi.** Sovelluksen käynnistys ja työnkulun koordinointi voivat lopulta jäädä pieneen `app.js`:ään. Tallenteiden puhdas validointi erotetaan DOM-palautuksesta ja localStorage-käsittelystä silloin, kun tätä rajaa käsitellään.

Ensimmäinen irrotus tehdään ennen vaiheen 2 laajempaa mittauskokonaisuutta. Loput irrotukset voidaan rytmittää vaiheen 2 rinnalle sen mukaan, mitä testaus ja kehitys tarvitsevat. UI:n ja persistenssin koko uudelleenjärjestely ei saa muodostua edellytykseksi oraclelle tai satunnaistestaukselle: aktiivinen optimizeri toimii jo nyt ilman DOM:ia.

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
- stopparin siirrot ja samanaikainen sahaus ovat ensimmäiset tuotantokriteerit;
- väri, WIP, pakkaaminen ja työjärjestys ovat myöhempiä pehmeitä kriteereitä.

Tämän jälkeen voidaan lisätä 5–10 tilauksen rolling-horizon-yhteisoptimointi. Kappaleissa säilytetään `orderId` ja `openingId`. Myöhemmin mukaan voidaan ottaa kiireellisyys, deadline, asentajien tarpeet ja materiaalin niukkuus.

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
