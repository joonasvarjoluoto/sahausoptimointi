# Batch-, nippusahaus- ja sahausjärjestyksen suunnittelumuistio

> **Tila: suunnitteluvaiheen ideat, ei valmis arkkitehtuuripäätös.**
>
> Tämä muistio kokoaa 7.9.2026 käytyä suunnittelua tilausjonosta, tuotantoeristä, nippusahauksesta, jäännöksistä ja sahaussuunnitelman suoritusjärjestyksestä. Näitä kohtia ei pidä tulkita toteutusvaatimuksiksi ennen erillistä päätöstä ja testausta.

## 1. Lähtötilanne tuotannossa

Työnjohtaja voisi syöttää tilausten mitat ohjelmaan käsin ja lisätä tilaukset avoimeen tilausjonoon.

Sahaajan näkökulmasta samaan tuotantoerään valitut tilaukset voidaan käsitellä yhtenä isona kappalepoolina:

- eri tilausten kappaleita saa tehdä samasta raaka-ainetangosta;
- eri tilausten kappaleita saa sahata samassa nipussa;
- alkuperäisellä tilausjärjestyksellä ei ole sahausvaiheessa merkitystä;
- sahaajan ei tarvitse sahausvaiheessa tietää, kuuluuko kappale yhteen vai toiseen tilaukseen;
- kun kaikki kappaleet on sahattu, ne erotellaan alkuperäisten tilausten mukaan ja pakataan/varastoidaan lomakkeiden perusteella.

Tilaus- ja aukkotieto pitää silti säilyttää kappaleiden metadatassa jäljitettävyyttä ja pakkaamista varten.

## 2. Miksi ensimmäinen versio kannattaa todennäköisesti tehdä tuotantoerinä

Keskustelussa harkittiin koko avoimen jonon continuous/rolling-horizon-planneria.

Nykyinen jäännösvarasto tekee siitä kuitenkin hankalan:

- vanhoista jäännöksistä ei ole tarkkaa digitaalista varastotietoa;
- sahaaja nostaa syntyvät jäännökset fyysisiin lokeroihin profiilityypin ja värin mukaan;
- pidemmät palat ovat lokerossa vasemmalla ja lyhyemmät oikealla;
- seinällä on noin 1000–2000 mm kohdalla 100 mm välein tussiviivoja pituuden silmämääräiseen arviointiin;
- jäännöksiä ei mitata, tunnisteella merkitä tai kirjata järjestelmään millimetrin tarkkuudella.

Tästä syystä tarkka continuous planner vaatisi digitaalisen varastototuuden, jota nykyisessä tuotantotavassa ei ole.

Ensimmäisen käyttöversion kannattaa siksi todennäköisesti toimia **itsenäisinä optimointierinä**. Vanhaa fyysistä jäännösvarastoa ei tarvitse mallintaa.

Sahaaja voi silti käytännössä käyttää nurkasta löytyvää sopivaa vanhaa jäännöstä uuden tangon sijasta. Tällöin todellinen materiaalinkulutus voi olla optimizerin ennustetta parempi.

## 3. Tuotantoerän koko

Alkuperäinen ajatus oli esimerkiksi viisi tilausta kerrallaan.

24 tilauksen testiaineistosta kuitenkin nähtiin, että tilausten koko vaihtelee voimakkaasti. Siksi kiinteä tilausten lukumäärä ei vaikuta hyvältä eräkoon mittarilta.

Parempi lähtökohta on **kappalemäärään tai myöhemmin arvioituun sahaustyömäärään perustuva erä**.

Esimerkiksi:

- viisi pientä tilausta voi muodostaa hyvän erän;
- kaksi tai kolme suurta tilausta voi jo muodostaa saman kokoisen erän.

### Alustava tavoite: noin 250 kappaletta

Ensimmäiseen versioon voisi tulla käyttäjän muokattava:

`Tavoite-eräkoko ≈ 250 sahattavaa kappaletta`

250 ei olisi kova vaatimus vaan pehmeä tavoite.

Esimerkiksi materiaaliltaan ja nippusahaukseltaan erinomainen 225 tai 280 kappaleen erä voi olla parempi kuin väkisin koottu 250 kappaleen erä.

Mahdollinen kova maksimieräkoko on vielä avoin kysymys.

Myöhemmin pelkän kappalemäärän rinnalle voidaan arvioida `estimatedSawWork`-mittaria, koska 100 kappaletta eri profiilityyppejä ei välttämättä tarkoita samaa työmäärää.

## 4. Tilausjonon mittakaava ja laskenta-aika

Käytettävissä ollut 24 tilauksen aineisto syntyi aikavälillä **27.7.–7.9.2026**.

Tämänhetkinen arvio käytännön jonosta:

- normaalisti ehkä noin 5–10 avointa tilausta;
- noin 20 tilauksen yhtäaikainen jono olisi todennäköisesti harvinainen.

Tämän vuoksi ensimmäisessä versiossa ei tarvitse optimoida laskenta-aikaa liian aggressiivisesti.

Optimizer voisi:

1. nähdä kaikki avoimet tilaukset;
2. muodostaa niistä kaikki järkevän kokoiset erävaihtoehdot;
3. ajaa oikean cutting optimizerin erävaihtoehdoille;
4. valita materiaalin ja tuotannon kannalta parhaan erän.

Laskennan ei tarvitse olla reaaliaikainen. Työnjohtaja voi käynnistää optimoinnin esimerkiksi illalla, viikonloppuna tai aamulla samalla kun sahaaja tekee edellistä suunnitelmaa.

Kymmenien minuuttien tai jopa noin tunnin laskenta-aika voi olla hyväksyttävä, jos sillä saavutetaan selvästi parempi lopputulos.

Heuristinen esikarsinta kannattaa lisätä vasta, jos kaikkien järkevien vaihtoehtojen oikea optimointi osoittautuu liian hitaaksi.

## 5. Tilausten odotusaika / starvation

Jos optimizer optimoi pelkästään materiaalitehokkuutta, jokin muiden kanssa huonosti sopiva tilaus voisi jäädä jatkuvasti seuraavan erän ulkopuolelle.

Yksi alustava ratkaisu:

- joka toinen tuotantoerä valitaan täysin vapaasti;
- joka toiseen erään vanhin avoin tilaus on pakollinen;
- optimizer saa valita sen ympärille parhaat muut tilaukset.

Tämä on kokeiltava idea, ei lopullinen sääntö.

Myöhemmin vaihtoehtoja ovat esimerkiksi määräpäivät, odotusaika tai käyttäjän määrittelemä prioriteetti.

## 6. Nippusahaus

Eri värit saa yhdistää samaan nippuun.

Esimerkiksi:

- 2 × harmaa Pysty
- 2 × musta Pysty

voidaan sahata neljän salon nippuna yhdellä sahausliikkeellä, jos sahausmitta on sama.

Väri erottaa materiaalivaraston, mutta ei itsessään estä yhteistä nippusahausta.

### Alustavat, käyttäjän muokattavat nippukapasiteetit

| Profiilityyppi | Oletus |
| --- | ---: |
| U-profiili | 4 |
| Pysty | 4 |
| Vaaka | 4 |
| Ala- ja yläkisko | 2 |

Näitä ei pidä kovakoodata pysyviksi tuotantofaktoiksi.

Nippusahauksen optimoinnissa voidaan myöhemmin huomioida muun muassa:

- sahausliikkeiden määrä;
- mittavasteen muutokset;
- nipun muodostamiset ja purkamiset;
- mahdollisuus tehdä samalla nipulla useita peräkkäisiä mittoja.

Materiaalitehokkuus säilyy kuitenkin ensisijaisena tavoitteena, ellei myöhemmin päätetä muuta.

## 7. Optimizerin ja schedulerin vastuunjako

Tässä keskustelussa tarkentui tärkeä jako.

### Cutting optimizer

Optimizer päättää **täydellisen materiaaliratkaisun**:

- mistä tangosta mikäkin kappale tehdään;
- käytetäänkö uutta tankoa vai saman optimointierän aikana syntyvää jäännöstä;
- mikä jäännös syntyy mistäkin tangosta;
- mihin myöhempään sahaukseen kyseinen jäännös käytetään;
- mitkä eri lähteistä syntyneet jäännökset voidaan myöhemmin niputtaa yhteen.

Optimizerin ei kuitenkaan tarvitse välittää lopullisesta sahausten suoritusjärjestyksestä.

### Saw-plan scheduler

Scheduler ei muuta optimizerin materiaaliratkaisua.

Sen tehtävänä on järjestää jo päätetyt sahaukset fyysisesti mahdolliseen ja sahaajan kannalta järkevään suoritusjärjestykseen.

## 8. Jäännösten riippuvuudet

Esimerkiksi optimizer voi päättää:

```text
A: uusi tanko -> kappaleet -> jäännös J1
B: uusi tanko -> kappaleet -> jäännös J2
C: uusi tanko -> kappaleet -> romu
D: uusi tanko -> kappaleet -> romu
E: J1 + J2 -> kappaleet -> romu
```

Operaatiota E ei voi tehdä ennen A:ta ja B:tä.

Riippuvuus voidaan ajatella graafina:

```text
A --\
     -> E
B --/

C
D
```

Scheduler muodostaa tästä topologisesti validin suoritusjärjestyksen.

## 9. Jäännökset käytetään heti kun niiden suunniteltu käyttö on mahdollista

Tämä ei ole optimizerin pisteytykseen lisättävä `remnantHoldingPenalty`.

Se on **schedulerin suoritusjärjestyksen prioriteettisääntö**.

Edellisen esimerkin huono järjestys olisi:

```text
1. A
2. B
3. C
4. D
5. E
```

Koska J1 ja J2 ovat jo olemassa vaiheen 2 jälkeen, parempi järjestys on:

```text
1. A
2. B
3. E
4. C
5. D
```

Yleistetty suunnitteluidea:

1. suorita operaatio;
2. lisää siitä syntyvät jäännökset saataville;
3. tarkista, vapautuiko niiden ansiosta optimizerin jo ennalta suunnittelema jäännösoperaatio;
4. jos vapautui, tee se ennen riippumattomia uusia tankoja käyttäviä operaatioita;
5. tarkista tämän jälkeen uudelleen, vapautuiko seuraava jäännösoperaatio;
6. jatka näin, kunnes valmista jäännösoperaatiota ei ole;
7. palaa vasta sitten uusiin tankoihin.

Näin saman optimointierän aikana syntyvät jäännökset eivät jää tarpeettomasti sahausaseman viereen odottamaan.

## 10. Vanha jäännösvarasto ja uuden erän aikana syntyvät jäännökset ovat eri asia

### Vanha fyysinen jäännösvarasto

- optimizer ei välttämättä tunne sitä lainkaan;
- sitä ei tarvitse inventoida MVP:tä varten;
- sahaaja voi käyttää sopivaa jäännöstä manuaalisesti.

### Nykyisen optimointierän jäännökset

- optimizer tuntee niiden pituuden, profiilin ja värin täsmällisesti;
- optimizer on jo päättänyt niiden myöhemmän käyttökohteen;
- ne ovat osa varsinaista materiaaliratkaisua;
- scheduler varmistaa, että ne syntyvät ennen käyttöä ja käytetään heti kun niiden suunniteltu käyttö muuttuu mahdolliseksi.

## 11. Sahaussuunnitelman UI / tuloste

Nykyinen tankokohtainen näkymä kannattaa säilyttää ainakin tarkistus- ja debug-näkymänä.

Esimerkiksi nykyisen kaltainen:

```text
Tanko 1
Lähtömateriaali: uusi 6000 mm

2500 mm × 1
1800 mm × 2
...

Jäännös: 900 mm
```

on hyvä tapa tarkistaa optimizerin materiaaliratkaisua.

Nippusahausta varten tarvitaan lisäksi sahaajalle tarkoitettu **suoritusjärjestysnäkymä**.

Esimerkiksi:

```text
PYSTY - VAIHE 1

Nippu:
- 2 × RAL7024, uusi 6000 mm
- 2 × RAL9005, uusi 6000 mm

Mittavaste: 2500 mm
Sahausliikkeitä: 2

Tuloksena:
- RAL7024 2500 mm × 4
- RAL9005 2500 mm × 4

Jäljelle:
- ...
```

Tulosteessa pitää erottaa yksiselitteisesti:

- mitä profiilia sahataan;
- montako salkoa nipussa on;
- minkä värisiä salot ovat;
- ovatko ne uusia vai optimizerin saman erän aikana tuottamia jäännöksiä;
- mihin mittavaste asetetaan;
- montako sahausliikettä tehdään;
- montako valmista kappaletta syntyy;
- mitä jäännöksiä tai romua vaiheesta syntyy.

`2500 mm × 2` ei yksin riitä, koska nippusahauksessa se voi tarkoittaa joko kappalemäärää tai sahausliikkeiden määrää.

Työnjohtajan pitäisi lopulta voida tarkistaa ja tulostaa valmis sahaajan työjärjestys.

## 12. Tällä hetkellä lupaava kokonaisvirta

```text
TYÖNJOHTAJA SYÖTTÄÄ TILAUKSET
        |
        v
AVOIN TILAUSJONO
normaalisti ehkä 5–10 tilausta
        |
        v
TUOTANTOERÄN VALINTA
pehmeä target esim. ~250 kappaletta
        |
        v
CUTTING OPTIMIZER
kaikki erän kappaleet yhtenä poolina
materiaalin alkuperä + jäännösten käyttö ratkaistaan
        |
        v
BUNDLE-SAW PLANNING
alustavat kapasiteetit 4 / 4 / 4 / 2
värit saa sekoittaa
        |
        v
SAW-PLAN SCHEDULER
materiaaliriippuvuuksien topologinen järjestys
valmis jäännösoperaatio ennen uusia tankoja
        |
        v
TULOSTETTAVA SAHAAJAN TYÖJÄRJESTYS
        |
        v
SAHAUS + TILAUSTEN EROTTELU JA PAKKAUS
```

## 13. Avoimet asiat

Ainakin seuraavat ovat vielä suunnitteluvaiheessa:

- onko noin 250 kappaletta hyvä oletuseräkoko;
- tarvitaanko kova maksimieräkoko;
- käytetäänkö eräkoon mittarina kappalemäärää vai arvioitua sahaustyömäärää;
- jääkö joka toisen erän vanhimman tilauksen pakotus käyttöön;
- batch-vaihtoehtojen lopullinen pisteytys;
- tarvitseeko batch selector heuristisen esikarsinnan;
- kuinka cutting optimizer ja bundle-saw optimizer lopulta kytketään toisiinsa;
- saako nipusta poistaa tankoja kesken sahaussekvenssin ja jatkaa lopuilla;
- sahaustulosteen tarkka rakenne ja jäännösten merkintätapa;
- miten sahaajan manuaalisesti käyttämät vanhat jäännökset vaikuttavat raportointiin;
- milloin tulevaisuudessa olisi järkevää siirtyä tarkkaan continuous/rolling-horizon-planneriin.

## 14. Ensimmäisen käyttöversion tavoite

Ensimmäisen version ei tarvitse mallintaa koko tehtaan materiaalivirtaa täydellisesti.

Tavoitteena olisi työkalu, joka:

- sopii nykyiseen manuaaliseen varastonhallintaan;
- ei vaadi vanhojen jäännösten täydellistä inventointia;
- yhdistää useiden tilausten kappaleita yhteiseen optimointiin;
- hyödyntää nippusahausta;
- tuottaa sahaajalle selkeän tulostettavan työjärjestyksen;
- käyttää saman optimointierän aikana syntyneet ja optimizerin jo ennalta kohdistamat jäännökset mahdollisimman pian;
- säilyttää tankokohtaisen näkymän ratkaisun tarkistamiseen;
- jättää mahdollisuuden kehittää myöhemmin tarkempi digitaalinen varasto ja continuous planner.