# AGENTS.md

## Tarkoitus ja pysyvät periaatteet

Lue tämä tiedosto ennen projektityötä. Tämä on projektin pysyvä työohje ja dokumenttikartta. Tehtäväkohtaiset säännöt ovat alla linkitetyissä dokumenteissa; koko historiaa ei tarvitse lukea.

Rakennamme selaimessa toimivaa alumiiniprofiilien sahausoptimointia. Oikeellisuus, materiaalitalous ja tuotantokelpoisuus ovat tärkeämpiä kuin näyttävä tekninen ratkaisu. Projekti on myös oppimisprojekti: perustele olennaiset ratkaisut ja vaikeat ehdot selkeällä suomella.

- Tee vain pyydetty työ. Tarkista nykyinen lähdekoodi ja Git-tila ensin; säilytä käyttäjän keskeneräiset ja tehtävään liittymättömät muutokset.
- Erota rakenteellinen refaktorointi tarkoituksellisesta käyttäytymismuutoksesta. Refaktorissa tulosten, järjestyksen, tasatilanteiden, virheiden ja tallennuksen merkityksen pitää säilyä. Ota vertailut talteen ennen muutosta.
- Älä muuta materiaalin yhteensopivuutta, sahausfysiikkaa, kapasiteettia, pisteytystä, tuotantotyönkulkua tai persistenssin merkitystä sivuvaikutuksena. Älä yhdistä turvallisuusvaraa kerfiin tai tuotantomittareita materiaalipisteisiin ilman erillistä päätöstä ja regressioita.
- Pidä oikeellisuus ensisijaisena, materiaalitalous ennen tuotantotehokkuutta. Jäännöksen käyttö ei ole ehdoton greedy-valinta. Älä piilota kustannuskomponentteja selittämättömään pisteeseen.
- Yhdellä tiedolla on yksi auktoritatiivinen lähde. Johda esitystila siitä; älä luo rinnakkaista tallennettua totuutta ilman perusteltua tarvetta. Säilytä tunnisteet, materiaalitase ja syötteiden sekä rinnakkaisten hakutilojen mutatoimattomuus.
- Säilytä deterministisyys ja tuloksen selitettävyys. Beam-heuristiikan tulos on paras tutkituista vaihtoehdoista, ei todistettu globaali optimi ilman oraclea tai käsin tehtyä todistusta.
- Tuotantohavainto, arvio tai tutkimustulos ei yksin muutu koodisäännöksi. Puuttuvaa domain-päätöstä ei saa keksiä.
- Säilytä nykyinen tekninen perusratkaisu. Älä vaihda kieltä, kehystä, moduulimuotoa tai projektirakennetta äläkä lisää backendia, tietokantaa, pilvipalvelua, rakennusvaihetta, paketinhallintaa tai riippuvuuksia omin päin.
- Älä korvaa koko algoritmia, poista legacy-polkuja tai muuta UI:n toimintaa, termejä tai ulkoasua tehtävän ulkopuolella. Suuri ominaisuus tai arkkitehtuurimuutos vaatii siihen kohdistuvan tehtävän; muuten esitä pienin vaihe ja pyydä hyväksyntä ennen toteutusta.
- Tee yksi looginen ja testattava vaihe kerrallaan. Oikeellisuus- ja turvallisuusregressiot menevät kosmeettisen siivouksen edelle. Vältä abstraktioita ennen kahta todellista käyttötapaa.

## Dokumenttien valinta tehtävän perusteella

Käyttäjän ei tarvitse nimetä tiedostoja tai kirjoittaa muodollista teknistä spesifikaatiota. Tunnista tavallisesta pyynnöstä sen vastuualueet. Lue **aina tämä tiedosto**, ja valitse sitten vain tarvittavat lisädokumentit. Usean alueen työ tarvitsee niiden yhdistelmän; pieni paikallinen tehtävä ei tarvitse koko tietopankkia.

| Tehtävän aihe | Lue lisäksi |
| --- | --- |
| Nykyinen rakenne, moduulirajat, riippuvuudet, refaktorointi, selainlataus | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Materiaali, varasto, jäännökset, kapasiteetti, kerf, disposition, score, optimizerin tulos | [docs/domain/MATERIAL.md](docs/domain/MATERIAL.md); tuotantohavaintoihin tarvittaessa [DOMAIN_NOTES.md](DOMAIN_NOTES.md) |
| Batch, scheduler, nippusahaus, worker-salot, execution-logi, sahausjärjestys, tuotanto-UI, finalisointi | [docs/domain/PRODUCTION.md](docs/domain/PRODUCTION.md); integraatiorajoihin myös arkkitehtuuri |
| Lomake-UI, luonnokset, tallennus, palautus, skeema | Arkkitehtuuri ja muutoksen koskettama domain-dokumentti |
| Testien muuttaminen tai sopivien regressioiden valinta | [docs/TESTING.md](docs/TESTING.md) |
| Seuraava vaihe, priorisointi, laajempi kehityssuunta | [ROADMAP.md](ROADMAP.md) |
| Tunnettu virhe tai rajoite, uusi konkreettinen ongelma | [BACKLOG.md](BACKLOG.md) |
| Todellinen työprosessi, mittaus, hinta-arvio tai kalibroimaton oletus | [DOMAIN_NOTES.md](DOMAIN_NOTES.md) |
| Tutkimus, benchmark, suorituskyky tai hakulaatu | Materiaalidokumentti ja vain aiheen [benchmark-raportti](benchmarks/batch-search/README.md); selectorissa myös tuotantomalli |

Esimerkiksi ”tee jäännöslistasta helpompi käyttää” ohjaa UI:n ja materiaalin dokumentteihin sekä testauksen valintaan. Selvitä nykyinen toteutus, rajaa pienin turvallinen toteutus ja säilytä siihen liittyvät invariantit. Älä vaadi käyttäjältä pitkää teknistä promptia, jos tarkoitus on selvä. Aidosti ratkaisevan domain-päätöksen puuttuessa tee riippumaton turvallinen osa ja nosta puuttuva päätös esiin.

Analyysi-, katselmus-, diagnoosi- ja suunnittelupyynnössä tutki ja raportoi muuttamatta tiedostoja, ellei tehtävä pyydä myös muutoksia. Toteutus-, jatko- ja korjauspyynnössä tee rajatut paikalliset muutokset ja relevantit tarkistukset. Jos käyttäjä haluaa tehdä itse, näytä todelliset ympäröivät rivit ja tarkka muutoskohta muokkaamatta tiedostoja.

## Auktoriteetti ja ristiriidat

Projektitiedon tulkintajärjestys on:

1. Käyttäjän nykyinen eksplisiittinen tehtävänanto ja hyväksytyt rajaukset.
2. Nykyinen lähdekoodi ja testattu aktiivinen käyttäytyminen nykytilan todisteena.
3. Aktiiviset domain- ja arkkitehtuuridokumentit.
4. Roadmap ja backlog; merkintä ei itsessään anna toteutuslupaa.
5. Tuotantomuistiinpanojen arviot ja avoimet kysymykset.
6. Historialliset suunnitelmat ja mittauscheckpointit.

Jos koodi ja aktiivinen dokumentaatio ovat ristiriidassa, älä arvaa: tutki toteutus ja relevantit testit, raportoi ristiriita ja korjaa dokumentaatio tehtävän rajoissa, kun nykyinen totuus on selvä. Nykyinen koodi ei tee havaitusta virheestä hyväksyttyä domain-päätöstä. Historia ei ohita aktiivista spesifikaatiota. Vanhan raportin luvut ja ”nykyinen”-ilmaukset kuuluvat sen lähtöversioon.

## Dokumentoinnin ylläpito

Arvioi **jokaisen tehtävän lopussa: muuttuiko jokin dokumentoitava totuus?** Jos muuttui, päivitä saman työn yhteydessä vain oikea kanoninen dokumentti:

- Moduulivastuu, riippuvuus, tilan omistajuus tai versiointikäytäntö → arkkitehtuuri.
- Aktiivinen materiaalin invariantti, kapasiteetti tai pisteytys → materiaalimalli.
- Schedulerin, toteuman tai tuotantotyönkulun semantiikka → tuotantomalli.
- Testiajuri, testien rooli tai testauskäytäntö → testaus.
- Kehitysvaihe tai seuraava prioriteetti → roadmap.
- Todellinen ongelma, jota ei korjata tässä työssä → backlog, konkreettinen havainto ja vaikutus; älä korjaa sitä ilman lupaa.
- Uusi tuotantofakta, arvio tai avoin kysymys → tuotantomuistiinpanot, lähde, päivämäärä, varmuus ja avoin vaikutus koodiin.
- Tutkimustulos → aiheen benchmark-raportti; arvokas vanha checkpoint tarvittaessa `docs/history/`-hakemistoon.

**Älä päivitä jokaista dokumenttia jokaisessa tehtävässä.** Pelkkä korjaus, joka palauttaa jo kuvatun toiminnan, ei vaadi kaikkien ohjeiden muuttamista. Dokumentaatio ei ole automaattinen changelog. Yksi asia kuvataan kokonaan yhdessä paikassa; muut dokumentit linkittävät siihen. Säilytä edelleen voimassa olevat käyttäjäpäätökset ja avoimet rajoitteet myös historiaa siivotessa.

## Testaus, yhteistyö ja Git

Valitse tarkistukset [testausohjeesta](docs/TESTING.md) muutoksen riskin ja vastuualueen mukaan. Lisää oikeellisuusvirheelle sen osoittava tapaus ennen korjausta. Pelkkä sama salkomäärä tai vihreä Node-ajo ei todista koko suunnitelman tai selainpolun säilymistä. Älä muuta fixture-odotuksia vain saadaksesi testin vihreäksi. Aja muuttuneiden JavaScript-tiedostojen `node --check` ja `git diff --check`. Dokumentaatiotyössä tarkista linkit ja polut; raskaita optimizer-ajoja ei tarvita.

Jos seuraava vaihe riippuu käyttäjän selaintestistä, anna tarkat vaiheet ja odota havainto. Älä tulkitse yhden testikohdan vastausta koko testilistan hyväksynnäksi. Älä väitä selaintestiä tehdyksi, jos sitä ei ajettu.

Säilytä nimeämistapa ja UTF-8. Kommentoi syytä tai vaikeaa sääntöä. Käytä sanaa **korvaa** vain, kun vanha koodi todella poistetaan; muuten sano **lisää**. Älä nimeä teknisiä kenttiä uudelleen pelkän kieliasun vuoksi. Poista korvattava vanha polku vasta, kun uusi on käytössä, testattu ja poistaminen kuuluu hyväksyttyyn tehtävään.

Tee yksi ymmärrettävä ja testattu idea per commit. Viesti on englanniksi, alkaa isolla imperatiiviverbillä, ei käytä `feat:`-etuliitettä eikä pääty pisteeseen. Commit, push, julkaisu tai muu ulkoinen kirjoitus tarvitsee tehtävässä annetun nimenomaisen luvan; pelkkä muokkauspyyntö ei riitä.

Raportoi lopuksi mitä muuttui, miksi, miten ja millä syötteillä testattiin, mitä jätettiin tarkoituksella tekemättä ja pienin luonteva seuraava askel. Mainitse suoraan tarkistukset, joita ei voitu tehdä.
