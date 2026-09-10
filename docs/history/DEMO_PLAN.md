> Historiallinen dokumentti, arkistoitu 10.9.2026. Kuvaa eri ajankohtien suunnitelmia ja testituloksia; ei nykyisen toiminnan ohje. Nykytila: [arkkitehtuuri](../ARCHITECTURE.md), [tuotantomalli](../domain/PRODUCTION.md) ja [roadmap](../../ROADMAP.md). Alla olevien vanhojen väitteiden aikamuotoja ei ole muutettu.

# DEMO_PLAN.md

## Tarkoitus

Tämä tiedosto kokoaa lähiajan prioriteetit, joiden tavoitteena on saada sahausoptimoinnista uskottava ja helposti esiteltävä kokonaisuus esimiesdemoa varten. Tämä ei tarkoita, että sovellus olisi vielä valmis oikeaan tuotantosahaukseen.

Tekninen pitkän aikavälin eteneminen säilyy `ROADMAP.md`:ssä, yksittäiset virheet `BACKLOG.md`:ssä ja tuotantofaktat `DOMAIN_NOTES.md`:ssä. Tämän tiedoston tarkoitus on kuvata nimenomaan demoon johtava työjärjestys.

## Nykyinen demo 8.9.2026

Käyttäjän uusi päätös korvaa alla olevan aiemman järjestyksen batchien ja nippusahauksen osalta: aktiivinen demo on kokonaisten tilausten batch-valinta → nykyinen materiaalihaku → dependency-aware nippusahaus. Materiaali on ainoa pisteytyskriteeri. Mittariveillä voi antaa aukon tunnuksen. Finalisointi poistaa vain batchin tilaukset ja säilyttää jonon.

Testattu kolmen tilauksen ei-FIFO-esimerkki, nippudemo ja selaintarkistuksen tulokset ovat [nykyinen tuotantomalli](../domain/PRODUCTION.md) (aiempi tuotantosuunnitteludokumentti):ssä. Käyttäjän testejä täydentävä todellinen HTTP-selaintesti läpäistiin 8.9.2026; myös Node- ja ohjaustestit läpäisevät.

## Aiempi demo-prioriteettijärjestys (historia / myöhemmät kohteet)

1. **Korjaa B-004 — virheellisten profiilinimien hyväksyminen core-rajapinnoissa.**
   - Rajattu correctness-korjaus tehdään omana työnään ennen näkyvämpiä demo-ominaisuuksia.

2. **Tiivistä sahaussuunnitelma accordion-rakenteeseen ja ryhmittele identtiset sahauskuviot.**
   - Ylin taso profiilityypeittäin.
   - Profiilin alla identtiset sahauskuviot yhdeksi ryhmäksi, esimerkiksi `6 salkoa — 1772 + 1778 × 2`.
   - Yksittäiset salot/tarkemmat tiedot avataan vasta tarvittaessa.
   - Tavoite on, ettei kymmenien yksittäisten salkojen suunnitelma muodosta valtavaa pitkää sivua.

3. **Toteuta noin viiden tilauksen sekventiaalinen putkitus ja baseline-vertailu.**
   - Tilaus 1 optimoidaan nykyisellä optimizerilla.
   - Sen post-order-varasto ja jäännökset siirtyvät Tilaus 2:n lähtövarastoksi jne.
   - Ensimmäinen versio ei ole varsinainen rolling-horizon-yhteisoptimointi, koska ensimmäisen tilauksen ratkaisu ei vielä huomioi tulevien tilausten kysyntää.
   - Demossa näytetään vertailu esimerkiksi:
     - tilaukset erikseen ilman jäännösten siirtymistä;
     - samat tilaukset putkitettuna;
     - uusien salkojen määrän erotus;
     - käytettyjen ja jäljelle jäävien jäännösten määrä/pituus.
   - Tavoite on tehdä näkyväksi, että pitkä jäännös ei ole automaattisesti hukkaa, jos se voidaan hyödyntää seuraavissa tilauksissa.

4. **Tiivistä Raakalista ja lisää varastohälytykset.**
   - Profiilityyppikohtaiset accordionit.
   - Todelliset värikohtaiset saldot silloin kun ne otetaan käyttöön.
   - Alustava tilausraja 50 salkoa: logistinen ennakkovaroitus, ei optimizerin rajoite.
   - Alustava kriittinen raja 10 salkoa.
   - Raja-arvojen alustava luokittelu:
     - yli 50 = normaali;
     - 11–50 = tilaa lisää;
     - 1–10 = kriittisen vähän;
     - 0 = loppu.
   - Hälytyksen tulee kertoa profiilityyppi, väri ja saldo.

5. **Lisää yksinkertainen, erillinen sahaustoleranssiturva.**
   - Kerfiä ei kasvateta keinotekoisesti mittatoleranssin peittämiseksi.
   - Todellinen/nimellinen kerf, kappalekohtainen kapasiteettivara ja mahdollinen päävara pidetään erillisinä käsitteinä.
   - Lisää täsmäsovitus- ja kumuloitumistestit ennen varsinaista laskentamuutosta.
   - Noin 1 mm/kappale on vasta konservatiivinen lähtöarvio, ei lopullinen tuotantoasetus.

6. **Esimiesdemo.**
   - Näytetään toimiva kokonaisuus prototyyppinä, ei valmiina tuotantojärjestelmänä.
   - Demossa korostetaan erityisesti:
     - helppoa tilauspohjaista syöttöä;
     - materiaalin ja jäännösten käyttöä;
     - usean tilauksen putkituksen tuomaa hyötyä;
     - varastotilanteen näkyvyyttä;
     - selkeää tiivistettyä sahaussuunnitelmaa.

7. **Nippusahaus / tuotanto-optimointi.**
   - Materiaaliratkaisun päälle muodostetaan erillisiä `cut operation` -operaatioita.
   - Ensimmäisessä konservatiivisessa versiossa yhdistetään vain selvästi yhteensopivia saman profiilityypin/sahausmitan salkoja.
   - `maxStackSize` pidetään profiilityyppikohtaisena.
   - Myöhemmin minimoidaan sahausliikkeitä, stopparin siirtoja ja nipun muutoksia.

8. **Varsinainen 5–10 tilauksen rolling-horizon-yhteisoptimointi.**
   - Optimizeri saa nähdä useita tulevia tilauksia jo ensimmäisen tilauksen materiaalipäätöksissä.
   - Tällöin voidaan hyväksyä ensimmäisessä tilauksessa hieman erilainen materiaaliratkaisu, jos siitä syntyvä jäännös tuottaa suuremman kokonaisedun seuraavissa tilauksissa.
   - Tämä on eri asia kuin kohdan 3 sekventiaalinen putkitus.

## UI-sanasto: “salko”, ei “tanko”

Tuotannossa uuden profiilimateriaalin kappaleesta käytetään termiä **salko**. Käyttäjälle näkyvässä käyttöliittymässä ja demo-teksteissä käytetään jatkossa tätä termiä sanan “tanko” sijaan.

Esimerkkejä:

- `42 tankoa` → `42 salkoa`
- `uusi tanko` → `uusi salko`
- `tangon jäännös` → `salon jäännös`
- `50 tangon tilausraja` → `50 salon tilausraja`
- `10 tankoa jäljellä` → `10 salkoa jäljellä`
- sahaussuunnitelmassa `6 × tanko` → esimerkiksi `6 salkoa`

Tämä on ensisijaisesti **UI- ja domain-sanaston muutos**. Sisäisiä teknisiä nimiä kuten `bar`, `bars`, `barCount` tai tallennusskeeman kenttiä ei tarvitse nimetä uudelleen pelkän käyttöliittymätermin vuoksi, ellei niille ole myöhemmin erillistä teknistä syytä. Näin vältetään turha migraatio- ja regressioriski.

## Aiemman demon rajaus (korvattu batchien ja nippusahauksen osalta 8.9.2026)

Ennen ensimmäistä esimiesdemoa ei tarvitse toteuttaa täydellistä nippusahausta eikä todellista rolling-horizon-yhteisoptimointia. Tavoite on näyttää ehjä käyttöpolku ja materiaalitalouden potentiaali. Tekniset refaktoroinnit voivat jatkua pieninä turvallisina töinä, mutta ne eivät saa syrjäyttää demoon selvästi arvoa tuovia ominaisuuksia ilman erityistä syytä.
