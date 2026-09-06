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
- yhteinen neljän perustestin testipankki ja avointa työtä muuttamaton core-regressioajo (automaattitestit ja käyttäjän selaintarkistus läpäisty 2026-09-06).

## Seuraava työvaihe

Arkkitehtuurikatselmus ja ensimmäinen rajattu refaktorointi on tehty. Core-optimointi toimii jo ilman DOM:ia; ensimmäinen testattavuuden este oli perustestien kytkentä avointa työtä muuttaviin lomakelatauksiin. Yhteiset testitiedot ja `runCoreRegressionTests()`-ajo on hyväksytty myös käyttäjän selaintarkistuksessa.

Tämän jälkeen pienin jatkoaskel on erillinen Node-testiajuri, joka käyttää samaa testipankkia, kokoaa relevantit puhtaat regressiot ja palauttaa virhetilanteessa epäonnistuneen exit-koodin. Se ei vaadi paketinhallintaa, uusia riippuvuuksia tai koko `app.js`:n pilkkomista.

Katselmuksen myöhemmät rakennerajat säilyvät: materiaalivariantin identiteetti keskitetään ennen lisäattribuutteja, materiaaliratkaisu ja tuotanto-operaatiot pidetään erillään, ja monen tilauksen kappalekohdistus säilytetään ennen sahausmittojen ryhmittelyä. Samanlaiset varastojäännökset pysyvät määrällisinä ryhminä; pysyviä yksilö-ID:itä ei tarvita.

Persistenssiauditin default/additional-rivi-invariantti on korjattu ja testattu (B-001). Työssä havaittu erillinen profiilinimen jäsenyystarkistuksen virhe on kirjattu kohtaan `BACKLOG.md / B-003`; se käsitellään omana rajattuna korjauksenaan.

## Vaihe 1: testattavuuden perusta

Tavoite on vähentää käsin syötettävien tilausten määrää ja tehdä regressioista toistettavia.

Ensimmäinen rajattu toteutus (2026-09-06): `createDevelopmentTestCases()` sisältää neljän perustestin syötteet ja odotukset. `runCoreRegressionTests()` ajaa ne ilman lomakkeen tai tallennuksen muuttamista; vanhat selainapurit säilyvät yhteisen testidatan käyttäjinä. Testipankki on tässä vaiheessa edelleen `app.js`:ssä.

Automaattinen varmistus: kaikkien neljän tapauksen tarkat sahaustulokset vastaavat ennen refaktorointia talletettua vertailuaineistoa. Node- ja eristetty Edge-ajo läpäisivät testit. Selainajossa myös lomake, suunnitelma, TEHTY-merkinnät ja localStorage säilyivät ennallaan. Uusi testiajo hylkäsi tarkoituksella rikotut kappale-/materiaalitaseet, lähdemäärät, sahausfysiikan, mutaatiot ja epädeterministisen tuloksen.

- Erota DOM:sta riippumattomat regressiot selkeäksi testipankiksi.
- Säilytä nykyiset selaimen dev-apurit, kunnes korvaava käyttöpolku on valmis.
- Lisää nimettyjen testitapausten lataus ilman optimizerin käyttäytymisen muutosta.
- Määritä yksi komento tai selkeä selainajo keskeisten regressioiden suorittamiseen.
- Pidä Testi A, Testi A jäännöksillä ja D1 pakollisina checkpoint-tapauksina.

Valmis, kun sama regressiopaketti voidaan ajaa toistettavasti ilman lomakerivien käsin syöttämistä ja tulos raportoi selvät PASS/FAIL-tiedot.

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
