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

Sovellus on mobiiliystävällinen, selaimessa toimiva yhden laskentaerän prototyyppi. Sahattavat voidaan syöttää useana tilauskorttina; aktiivinen optimizeri käsittelee niiden yhteisen kysynnän ja huomioi profiilityypin ja värin materiaalivarianttina, rajallisen tai rajattoman uuden materiaalin sekä olemassa olevat jäännökset. Tämä ei vielä toteuta tilausten tuotantokohdistusta tai rolling-horizon-optimointia.

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

Käyttäjän pyynnöstä materiaalimoduulien irrotuksen edelle otettiin tilauspohjainen Sahattavat-UI. Käyttäjä vahvisti testien läpäisyn ja seitsemän cut-rivin oikean muodostumisen kahdesta erivärisestä tilauksesta omine tunnisteineen. Laajaa moduulirefaktorointia tai optimizerimuutoksia ei yhdistetty UI-työhön. Käyttäjän 2026-09-07 muistiinpanojen perusteella seuraava pieni toteutus on U-listojen ja yhteisten kiskorivien oletuskappalemäärän muuttaminen 2:ksi. Samalla varmistetaan tyhjien rivien tunnistus, kiskoparien määrät sekä tallennus ja palautus. Muutos on kirjattu, ei vielä toteutettu.

Syyskuun 6. päivän tuotantomuistion varasto- ja toleranssiominaisuudet on koottu vaiheeseen 1c: niitä voidaan tehdä materiaalirajojen selkiydyttyä pieninä erillisinä töinä ilman koko moduulijaon valmistumista. Toleranssimallia ei lykätä myöhempään score-viritykseen, jos sovellusta ollaan ottamassa oikeaan tuotantoon.

### Päivitetty kehitysjärjestys (2026-09-07)

Materiaalin ensisijaisuus säilyy. Nippusahaus ja tilausten putkitus nostetaan vaiheen 3 laajojen materiaalivaihtoehtojen ja pitkän aikavälin arvokalibroinnin edelle. Alla olevat vaihenumerot ovat aiheiden tunnisteita; toteutusjärjestys noudattaa tätä tarkennusta:

1. Toteuta yllä rajattu oletuskappalemäärän muutos omana työnään. Käyttäjän tarkennuksen mukaan kiskorivin määrä on yhteiskappalemäärä: 2 = 1 alakisko + 1 yläkisko. Tämä vaatii oletusarvon lisäksi adapterin määrän puolittamisen, parillisen määrän validoinnin, fixture-muunnoksen ja regressioiden päivityksen sekä tallennettujen vanhojen määrien yhteensopivuusratkaisun. Tarkennus on kirjattu, ei vielä toteutettu.
2. Rajaa tuotanto-operaatioiden ja kappaleiden tilauskohdistuksen pienin malli nykyisen materiaaliratkaisun päälle. Tarkenna tilausten putkituksen työnkulku ja tavoitemittari. Tee vain tämän edellyttämät materiaalirajojen selkeytykset; koko moduulijako tai laaja Pareto-haku ei ole aloitusehto.
3. Etene vaiheen 4 nippusahaukseen ja tilausten putkitukseen pieninä testattavina vaiheina. Turvallinen nippuyhteensopivuus, profiilikohtainen kapasiteetti ja tilauskohdistus ovat toteutuksen edellytyksiä. Vaiheen 2 oikeellisuus- ja laatutarkistukset kulkevat mukana.
4. Kun sahausjärjestys ja mittavasteen siirtojen määrä voidaan laskea, arvioi erillinen työaikakustannus käyttäjän luvuilla: noin 10 s/siirto, 12 €/h ja keskimäärin 7 €/m. Lähteet, epävarmuudet ja yksikkövertailu ovat `DOMAIN_NOTES.md`:ssä. Pisteytystä ei muutettu muistiinpanopäivityksessä.

Laajemman tuotanto-ominaisuuden toteutus aloitetaan rajatulla suunnitelmalla ja hyväksynnällä projektin toimintatapojen mukaisesti.

Skeema nostettiin 3 → 4: tallennetaan tilausten tunnisteet, nimet, värit ja accordionien mittarivit/avaustilat. Käyttäjä vahvisti vanhojen töiden olevan kuvitteellista testidataa ja hyväksyi tyhjästä aloittamisen; migraatiota tai vanhan UI:n rinnakkaistukea ei toteuteta. Vanha tallenne poistuu uuden sivun palautuksessa ilmoituksen kanssa. Moottoriversio `material-v0.3` säilyy.

Varmistus: 14 adapteritapausta (mukana neljän perustapauksen koko optimointituloksen vertailu), 33 uuden tallenteen validointitapausta ja koko Node-ajuri 33/33. Eristetyssä Edgessä testattiin todellinen monivärinen tilaus- ja kiskosyöttö, laskenta, TEHTY, accordionin tilan tallennus, uudelleenlataus, poistojen vahvistus/peruminen, virheelliset syötteet, korruptit tallenteet, skeemavaihdos sekä finalisoinnin epäonnistuminen ja onnistunut uusintayritys. Mobiiliasettelu tarkistettiin leveyksillä 320/375/760 px ja myös tumma teema katsottiin. Käyttäjän omaa selainprofiilia ei käytetty.

Arkkitehtuurikatselmus ja ensimmäinen rajattu refaktorointi on tehty. Core-optimointi toimii jo ilman DOM:ia; ensimmäinen testattavuuden este oli perustestien kytkentä avointa työtä muuttaviin lomakelatauksiin. Yhteiset testitiedot ja `runCoreRegressionTests()`-ajo on hyväksytty myös käyttäjän selaintarkistuksessa.

Node-testiajuri on hyväksytty: `run-regressions.cjs` ajaa saman testipankin ja valitut puhtaat regressiot. Käyttäjä vahvisti VS Coden terminaalissa tuloksen `Regressioryhmät: 29/29 läpäisty` ja paluukoodin 0. Paketinhallintaa, uusia riippuvuuksia tai `app.js`:n pilkkomista ei tarvittu.

`BACKLOG.md / B-003` on korjattu ja hyväksytty myös käyttäjän tarkistuksessa. Tallennusskeema ja optimizerin käyttäytyminen säilyvät ennallaan; korjaus koskee virheellisten profiilinimien hylkäämistä.

Vaiheen 1b ensimmäinen irrotus on toteutettu ja hyväksytty käyttäjän testeissä: `cutPiece()` ja sen mitta-apurit sijaitsevat nyt omassa puhtaassa moduulissaan. Tilaus-UI:n hyväksymisen jälkeen rakennekehityksen luonteva jatko on materiaalivariantin identiteetin ja varaston muodostuksen riippuvuuksien rajaus seuraavaa pientä siirtoa varten. Vaiheen 2 kohdistetut testit (materiaalin niukkuus, varianttieristys ja kerfin rajat) säilyvät suunnitelmassa, ja laajempaa laatumittausta voidaan jatkaa irrotusten rinnalla. Koko sovelluksen pilkkominen ei ole laatumittauksen aloitusehto.

Katselmuksen myöhemmät rakennerajat säilyvät: materiaalivariantin identiteetti keskitetään ennen lisäattribuutteja, materiaaliratkaisu ja tuotanto-operaatiot pidetään erillään, ja monen tilauksen kappalekohdistus säilytetään ennen sahausmittojen ryhmittelyä. Samanlaiset varastojäännökset pysyvät määrällisinä ryhminä; pysyviä yksilö-ID:itä ei tarvita.

Persistenssiauditin default/additional-rivi-invariantti on korjattu ja testattu (B-001). Suorien core-kutsujen profiilivalidointihavainto on kirjattu erikseen kohtaan `BACKLOG.md / B-004`; sitä ei korjata tilaus-UI:n tai moduulien siirron sivussa.

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
