# Jatkuvan jäännösvirran historiallinen replay — 9.9.2026

## Johtopäätös

Tyhjästä aloitettu, vähitellen saapuvien tilausten replay tuotti kuudessa batchissa **143 palan loppuvaraston (293,929 m)**. Metreinä varaston huippu oli 307,904 m. Jäännökset olivat aina seuraavan batchin käytettävissä. Noin 100 palaa on käyttäjän nykyisen fyysisen varastohavainnon perusteella realistinen kappalemäärä, mutta simulaation pituusjakauma ja kokonaismateriaalimäärä eivät vastaa havaittua varastoa.

Fyysisessä noin 100 palan varastossa suurin osa paloista on käyttäjän arvion mukaan noin 1300–1800 mm ja enintään noin kolme palaa ylittää 2000 mm. Replayn loppuvarastossa oli **34 vähintään 3000 mm palaa / 133,714 m**. Absoluuttista loppuvarastoa tai aiempien A/B/C-varastojen pituusjakaumia ei siksi pidä käyttää normaalin todellisen varaston mallina.

Jäännösten käyttö vähensi uusien 6 m salkojen määrää **54 salkoa / 324 m**, kun vertailussa pidettiin samat valitut batchit ja laskettiin ne ilman vanhoja jäännöksiä. Pitkien palojen käyttö oli selvästi yleisempää kuin 1–2 m palojen käyttö, mutta kaikki pitkätkään palat eivät poistuneet nopeasti.

Sallivampi säilytys lisäsi 66 lyhyttä palaa / 44,581 m varastoon eikä muuttanut yhtäkään toteutettua sahaussuunnitelmaa, scorea tai operaatiota. Tämän aineiston perusteella ei ole syytä laskea nykyisiä romurajoja eikä jatkaa laajaa simulointisarjaa. Production-koodia ei muutettu eikä commitia tehty.

## Aineisto ja toteutettu koe

- Sama `../orders-23.json`, joka on johdettu `Order_history_tarkistettu.xlsx`-aineistosta: 23 kelvollista tilausta, 79 aukkoa, 1 231 fyysistä kappaletta ja 2 129,785 m valmiita kappaleita. Tilaus 16 / RR32 on pois nykyisen värirajauksen vuoksi, ilman korvaavaa värimuunnosta.
- Käyttäjän ilmoittama historiallinen järjestys 24 → 1, vanhin 27.7.2026 ja uusin 7.9.2026. Käyttäjän arvio: otos vaikuttaa normaalilta tuotannolta. Väliin ei keksitty päivämääriä: käyttöikä mitataan batcheina, ei päivinä.
- Alkuremnantit 0. Kaikille kuudelle profiilille rajaton 6 000 mm uusi materiaali väreissä harmaa, musta ja valkoinen. Sahausvara 3 mm. Tämä saatavuusoletus tulee aiemmasta fixturesta; se ei ole todellinen saldo.
- `arrival200`: tilauksia lisätään järjestyksessä, kunnes avoin jono on vähintään 200 kappaletta. Toteutetut tilaukset poistetaan; mahdollinen jonoon jäänyt tilaus säilyy ennen seuraavia saapumisia. Viimeinen alle 200 kappaleen jono tehdään kokonaan.
- `all`: kaikki tilaukset ovat alusta lähtien näkyvissä samassa historiallisessa järjestyksessä. Vain tilausten saatavuus eroaa; sisäisiä mittarivejä ei järjestetä uudelleen.
- Herkkyydet: `arrival150`, `arrival250` sekä `permissive` (saapumisraja 200, alemmat säilytysrajat). Yksi valmis ajo per skenaario; ei Monte Carloa, bootstrapia eikä parametriverkkoa.

| Profiili | Kysyntä kpl | Lyhin kysytty mm | Baseline säilytys mm | Salliva säilytys mm |
| --- | --- | --- | --- | --- |
| U | 168 | 1185 | 1000 | 500 |
| Pysty | 422 | 1078 | 1000 | 500 |
| Vaste | 26 | 1758 | 1000 | 500 |
| Vaaka | 451 | 488 | 500 | 300 |
| Yläkisko | 82 | 896 | 800 | 400 |
| Alakisko | 82 | 896 | 800 | 400 |

Lyhimmät mitat on johdettu normalisoidusta fyysisestä kysynnästä, ei oletettu säilytysrajoista. Kerf ja värikohtainen yhteensopivuus tarkistetaan silti erikseen `cutPiece()`-säännöllä.

### Fyysinen säilytys ja score on erotettu

Käyttäjä vahvisti erikseen, että **pituus ≥ profiilin raja** säästetään seuraavaan batchiin myös score-dispositionin ollessa `scrap`. Jokainen suunnitelma tuotetaan ensin nykyisellä authoritative optimizerilla ja scorella. Sen normaali `calculatePostOrderMaterialInventory()`-tulos täsmäytetään ennen fyysisen säilytyspolitiikan eron kirjaamista. Raja ei muuta jo laskettua suunnitelmaa, scorea, sahausfysiikkaa tai operaatiota.

Baseline säästi 7 score-mallin romuksi luokittelemaa palaa (5,342 m). Niistä yksi, harmaa Vaakaprofiili **833 mm**, käytettiin batchissa 6: 762 mm kappale + 3 mm kerf + 68 mm romu. Sen tunniste on `r123`, syntymäbatch 3. Yhtään score-mallin säästettäväksi luokittelemaa palaa ei baseline romuttanut. Sallivassa ajossa score-romuksi luokiteltuja säästettyjä paloja oli 73 / 49,923 m.

Tämä on tarkoituksellinen tutkimuspolitiikka, ei väite productionin nykyisen finalisoinnin identtisyydestä fyysisen käytännön kanssa. Score hyvittää edelleen oman dispositioninsa mukaisesti; siksi tuloksesta ei lasketa uuden fyysisen politiikan toteutunutta eurokustannusta.

### Batch-haun rajaus

Rajat pysyvät 200 / 250 / 300:ssa. Enintään 12 sopivan yhdistelmän jonossa käytetään **nykyistä production-selectoria** ja normaalia materiaalihakua kaikille ehdokkaille, 60 s kokonaiskatolla. Kaikki saapumisskenaarioiden valinnat olivat tätä polkua.

Suuremmissa jonoissa käytetään olemassa olevaa `search.cjs`-two-stage-hakua: enintään **10 s tai 40 arviointia**, seed `230916`, kevyt beam/pattern 2/2 ja normaali 20/10, yksi normaali tarkennus neljää kevyttä arviota kohti. Käytössä on nykyinen täsmällinen varianttivälimuisti. Lopullisesta voittajasta otetaan vain tilausjoukko ja se lasketaan uudelleen normaalilla production-materiaalihakijalla, erillisellä 60 s katolla. Näin hakubudjetti ei tarkoita koko batch-vaiheen 10 sekunnin aikarajaa.

`all`-ajon ensimmäisten viiden jonon ehdokasmäärät olivat 85 030, 39 182, 4 487, 681 ja 110. Haku arvioi vastaavasti 16, 40, 40, 40 ja 40 ehdokas/tarkennus-kutsua; kaikki tallennetut voittajat olivat normaalisti arvioituja. Ensimmäinen pysähtyi aikarajaan, muut työmäärärajaan. Viimeisessä jonossa oli yksi ehdokas. Globaalia batch-optimia ei ole todistettu. Seinäkelloraja voi vaihtaa tutkittujen ehdokkaiden määrää uusinta-ajossa; talletetut suunnitelmat ovat tämän ajon tarkka evidenssi.

150-rajan kokeessa kaikki kahdeksan jonoa jäivät alle 200 kappaleen. Ne valittiin productionin nykyisen **koko avoin jono alle minimin** -poikkeuksen kautta. Tämä koe tarkoittaa aiempaa käynnistämistä; se ei ole kahdeksan normaalikokoisen 200–300 kappaleen batchin vertailu.

## Varaston koko ja materiaalikäyttö

| Skenaario | Batchit | Uudet salot / m | Loppuvarasto kpl / m | Varaston huippu kpl / m | Varaston mediaani kpl / m |
| --- | --- | --- | --- | --- | --- |
| Saapuminen 200 | 6 | 417 / 2502 | 143 / 293,929 | 143 / 307,904 | 123,5 / 293,068 |
| Kaikki näkyvissä | 6 | 419 / 2514 | 151 / 312,790 | 151 / 312,790 | 84,5 / 198,907 |
| Saapuminen 150 | 8 | 424 / 2544 | 164 / 341,263 | 165 / 366,773 | 151 / 342,800 |
| Saapuminen 250 | 6 | 428 / 2568 | 180 / 371,565 | 180 / 371,565 | 146,5 / 340,739 |
| Salliva säilytys | 6 | 417 / 2502 | 209 / 338,510 | 209 / 338,510 | 162 / 325,455 |

Mediaanit ovat batchien jälkeisistä varastosaldoista ilman alun nollaa. Kappale- ja metrihuippu voivat osua eri batcheihin. Pääajon varastopalojen pituusmediaani oli lopussa **1568 mm**, kaikkien syntyneiden palojen mediaani 1868 mm ja kaikkien varastosnapshotien palojen mediaani 1844 mm (jälkimmäisessä pitkään odottava pala lasketaan jokaisessa snapshotissa).

Kaikki näkyvissä -malli käytti vain kaksi uutta salkoa enemmän (+0,48 %), mutta varaston kehitys erosi: se oli alku- ja keskivaiheessa pienempi, loppuvarasto 8 palaa / 18,861 m suurempi. Eroa ei voi tulkita puhtaaksi tulevien tilausten tuntemisen vaikutukseksi, koska laaja haku on rajattu heuristiikka ja pienet saapumisjonot tutkitaan exhaustive-menetelmällä. Aineisto ei osoita toista tapaa yleisesti paremmaksi.

Vertailu ilman jäännöksiä laski **samat valitut tilaukset samalla rivijärjestyksellä** jokaiselle batchille normaalilla optimizerilla. Pääajossa uusia salkoja tarvittiin ilman vanhoja paloja 471, jäännöksillä 417: ero 54 / 324 m (11,46 %). Kaikki näkyvissä -ajossa vastaava ero oli 459 → 419 eli 40 / 240 m. Tämä ei ole koko jonon uusi optimointi ilman jäännöksiä. Säästetyt uuden materiaalin metrit voivat ylittää kulutettujen jäännöslähteiden metrit, koska myös loppuvarasto ja pakkausratkaisut muuttuvat.

Pääajossa käytettiin 63 vanhaa lähdepalaa, yhteispituus 211,294 m; niistä tuli 168,755 m valmiita kappaleita ja 0,276 m kerfiä. Koko ajon materiaalitase: **2502 = 2129,785 + 3,624 + 74,662 + 293,929 m** (uusi materiaali = kappaleet + kerf + fyysinen romu + loppuvarasto).

Kaikkien viiden skenaarion batch-kohtaiset tilaukset, kappaleet, lähteet, syntymät, saldot sekä profiili-/väri- ja pituusjakaumat voidaan tuottaa uudelleen `summarize.cjs`-apurilla paikallisista skenaarioajoista. Checkpoint säilyttää olennaiset tulokset tässä raportissa, mutta ei suuria uudelleen generoitavia raakatuloksia.

## Palojen kierto ja varastoon jääminen

Jokainen säästetty loppupala saa pysyvän tutkimustunnisteen. Käyttö sulkee sen elinkaaren; lyhentyneelle säästettävälle lapsipalalle syntyy uusi tunniste, jonka `parentId` ja `rootId` säilyttävät yhteyden. Saman variantin ja pituuden anonyymit materiaalilähteet kohdistetaan vanhimpaan elävään tunnisteeseen. Production ei tunne tutkimustunnisteita. Käyttöikä kuvaa näin FIFO-kohdistusta identtisille lähteille, ei havaittua fyysistä hyllyvalintaa.

Pääajossa syntyi **206 palatietuetta / 180 juuriketjua**. Palatietueista 63 käytettiin ja 143 jäi loppuun (69,4 %). Uudelleen lyhentyvä pala voi esiintyä eri-ikäisinä tietueina saman juuriketjun alla; lähdemetrejä ei pidä tulkita ainutkertaiseksi ostetuksi materiaaliksi.

| Käyttö syntymästä | Käytettiin / kaikki 206 syntynyttä | Osuus | Täyden seuranta-ajan saaneen kohortin käyttö |
| --- | --- | --- | --- |
| Seuraavassa batchissa | 24 / 206 | 11,7 % | 24 / 182 = 13,2 % |
| Enintään 2 batchia | 39 / 206 | 18,9 % | 32 / 150 = 21,3 % |
| Enintään 3 batchia | 45 / 206 | 21,8 % | 34 / 132 = 25,8 % |
| Enintään 5 batchia | 63 / 206 | 30,6 % | 18 / 41 = 43,9 % |

Kohortin nimittäjä sisältää vain viimeistään `viimeinenBatch − k` syntyneet palat. Viimeisen batchin syntymillä ei ole lainkaan seuraamismahdollisuutta. Käytettyjen palojen havaittu käyttöikämediaani oli 2 batchia; se ei ole kaikkien palojen arvioitu elinikä. Otantajakson loppuun jääminen ei tarkoita pysyvää hyödyttömyyttä. `summary.json` sisältää käyttämättömien palojen `finalAudit.observedAgeBatches`-kentän: viimeinen batch miinus syntymäbatch. Niiden todellinen käyttöikä on vielä avoin (`ageCensored: true`).

**Pitkä = vähintään 3000 mm** tässä raportissa (tutkimuksen kuvaileva luokka, ei uusi säilytysraja). Pääajossa näitä syntyi 79, joista 45 käytettiin. Käytetyillä mediaani oli 2 batchia. Seuraavassa batchissa käytettiin 16/79; seuraavan batchin ehtineessä kohortissa 16/69 = 23,2 %. Kahden batchin täyden seurannan kohortissa 25/64 = 39,1 % käytettiin kahdessa batchissa. Ensimmäisessä batchissa syntyneistä 15 pitkästä palasta 13 käytettiin viiden seuraavan batchin aikana. Loppuun jäi silti 34 pitkää palaa / 133,714 m; niistä 10 syntyi vasta viimeisessä batchissa. Kaikki näkyvissä -ajossa pitkien palojen käytön mediaani oli 1,5 batchia, ja kahden batchin täysin seuratussa kohortissa käytettiin 34/50 = 68 %.

Profiileittain kummankin kiskon 20 syntyneestä palasta käytettiin 13 (65 %), Vaaka 6/14, Vaste 7/19, U 11/54 ja Pysty 13/79. Kaikkien näiden käytettyjen palojen mediaani oli 2 batchia. Pituusluokassa 2000–<3000 käytettiin 11/15 ja käytön mediaani oli 1 batch; luokassa 1000–<2000 vain 6/106, käytön mediaani 4 batchia. Näitä pieniä, eri aikaan syntyneitä ryhmiä ei pidä tulkita vakioiksi käyttöasteiksi.

Loppuvarastoon jäi erityisesti **Pysty 66 palaa / 116,585 m ja U 43 palaa / 100,699 m**. Yhteensä 100 loppupalaa oli 1000–<2000 mm. Loppuvaraston 143 palasta 44 ei sopinut yhteenkään koko aineiston saman profiilin ja värin kappaleeseen edes ennen syntymäänsä tarkasteltuna. Jäljelle jääneistä 99 sopi johonkin historialliseen kysyntään, mutta vain 59:lle oli sopivaa kysyntää sen syntymän jälkeisissä toteutetuissa batcheissa.

Optimizeria ei pakotettu käyttämään tarjolla ollutta palaa: 83 eri tunnisteelle löytyi yhteensä 128 batch-kohtaista tilannetta, jossa pala olisi sopinut ainakin yhteen kysyttyyn kappaleeseen mutta jäi valitussa ratkaisussa käyttämättä. Esimerkiksi batchissa 2 mustat U-palat `r5`–`r8`, 1854 mm, jäivät varastoon. Tiedostoissa `ignored` kertoo nämä tilanteet erikseen. Pelkkä yhden kappaleen mahtuminen ei todista, että koko batchin materiaalipiste paranisi palan pakotetulla käytöllä. Tässä ei tehty pakotettuja vastahakuja eikä eroteltu pisteytyksen ja beam-rajausten vaikutuksia.

## Romurajat, stressivarasto ja score

Sallivampi koe tuotti **täsmälleen samat kuusi batchia, kokonaiset suunnitelmat, scoret ja operaatiot** kuin baseline. Lisänä säästyi 66 palaa / 44,581 m, kaikki loppuun käyttämättä. Yksikään lisäpala ei sopinut yhteenkään tämän aineiston saman profiilin ja värin kappaleeseen. Uusia salkoja kului edelleen 417. Loppuvarasto kasvoi 143 → 209 palaa. Tässä otoksessa nykyiset rajat ovat siten ainakin järkevän suuntaiset suhteessa rajojen laskemiseen. Vaakaprofiiilin lyhin kysyntä 488 mm on kuitenkin alle sen 500 mm baseline-rajan; oikeankokoinen tällainen pala voisi toisessa aineistossa olla hyödyllinen. Optimaalisia rajoja tämä ei todista.

Aiempien A/B/C-varastojen 100 palaa on edelleen perusteltu stressikokoluokka ja vastaa käyttäjän havaintoa fyysisen varaston kappalemäärästä. A-varastossa oli 267,781 m, mediaanipituus 2087,4 mm ja lyhin 1085,3 mm. Pääreplayn loppuvarastossa oli 293,929 m ja mediaanipituus 1568 mm. Fyysisessä varastossa vain enintään noin kolme palaa ylittää 2000 mm, kun replayhin jäi 34 vähintään 3000 mm palaa. Synteettisten A/B/C-varastojen pituus-, profiili- ja värijakaumaa ei ole validoitu fyysistä varastoa vasten. Niitä käsitellään edelleen stressi- ja algoritmitesteinä, ei normaalin varaston malleina.

Melko vahvat havainnot tästä nimenomaisesta ajosta ovat materiaalitaseen pitävyys, saman värin/profiilin rajat, 54 salkoa pienempi uuden materiaalin käyttö samalla batch-jaolla ja 66 lisälyhytpalan nollakäyttö identtisillä suunnitelmilla. Pieni aineisto antaa vihjeen siitä, että pitkät palat kiertävät lyhyitä paremmin, U/Pysty-varasto kertyy ja säilytysrajojen laskeminen voisi lisätä käsiteltävää varastoa ilman hyötyä.

Nykyinen optimizer, nykyinen score ja tutkimuksen fyysinen säilytyspolitiikka tuottivat yhdessä selvästi enemmän pitkiä jäännöksiä kuin fyysisessä varastossa havaitaan. Mahdollisia syitä ovat aiemmin havaittu score-ilmiö, jossa pitkiksi arvotetut loppujäännökset voivat suosia uusien salkojen avaamista, scoresta erillinen fyysinen säilytyssääntö, simulaation kysyntä- ja batch-virta tai näiden yhdistelmä. Tätä tutkimusta ei suunniteltu erottamaan syitä toisistaan, joten scorea ei ole osoitettu väärin kalibroiduksi.

Score mahdollisti mitattavan jäännöskäytön mutta ei tyhjentänyt kaikkia sopivia pitkiä paloja. Lisäksi fyysinen käytäntö säilytti yhden myöhemmin käytetyn 833 mm palan, jonka score olisi romuttanut. Tämä on havainto säilytyksen ja arvokäyrän erilaisuudesta, ei todistus kyseisen palan erillisestä salkosäästöstä eikä peruste kaikkien lyhyiden palojen arvon nostamiseen. Pitkien palojen ylikertymä säilytetään myöhempänä optimizerin laatutestinä.

Tämän noin kuuden viikon aineiston perusteella **ei kalibroida** jäännöskäyrän eksponenttia, 20/50 käsittely- ja luontikuluja, vapaan romun rajaa, romuarvoa, profiilikohtaisia romurajoja tai batchin käynnistysrajaa. Ei tunneta todellista alkusaldoa, fyysistä valintajärjestystä, hyllytilaa, tulevaa kysyntää eikä käsittelyminuutteja. Vähitellen saapuminenkin on kappalemäärään perustuva malli, ei tallennettu todellinen työjärjestys.

Jäännösvarastotutkimus suljetaan tässä vaiheessa. Uuden laajan simulointi- tai score-kalibrointikierroksen hyöty samalla 23 tilauksen otoksella on pienempi kuin projektin muiden kehityskohteiden. Fyysisen varaston reality check ja suurempi tilausaineisto voidaan ottaa myöhemmin käyttöön, jos scorea ryhdytään kalibroimaan tarkasti. Silloin olennaisia vertailuja ovat erityisesti pitkien palojen osuus sekä 1–2 m U/Pysty-palojen todellinen kierto.

Projektin tavoite ei ole mallintaa automaattisesti koko tehtaan pitkän aikavälin tuotantorytmiä. Profiilituotanto on nuorta ja muun tuotannon, konevikojen, materiaalisaatavuuden sekä tilaustilanteen vaihtelu on suurta. Sovelluksen tavoite on olla helppokäyttöinen ja joustava sahaus- ja päätöksentekotyökalu, jota kokenut työnjohtaja tai työntekijä käyttää senhetkisen tilanteen mukaan. Nykyiset tuotantokäytännöt ovat lähtökohtia, eivät oletusarvoisesti optimaalisia sääntöjä.

## Toisto, tarkistukset ja tiedostot

Lähtöcommit `ec5cab56997db96afc4ca9d8035508f57b2b8817`, Node v24.19.0. Ajojen konekohtaiset kokonaisajat (sisältävät haut, normaalit materiaaliratkaisut, paritetut vertailut ja tarkistukset): arrival200 16,148 s; all 51,689 s; arrival150 7,500 s; arrival250 68,552 s; permissive 15,779 s. Ne eivät ole puhtaita materiaalifunktion benchmark-aikoja. Arrival250:n batch 4 arvioi 10 yhdistelmää ja vei 56,158 s; tätä ei optimoitu lisää. Sallivan kokeen ensimmäinen yritys keskeytyi paikallisen välitulostiedoston kirjoitusvirheeseen; kokonainen uusinta valmistui. Ajuri kirjoittaa nyt tuloksen vasta valmiista skenaariosta.

Toista repon juuresta yksi ajo kerrallaan:

```powershell
node benchmarks/batch-search/flow-replay/run.cjs arrival200
node benchmarks/batch-search/flow-replay/run.cjs all
node benchmarks/batch-search/flow-replay/run.cjs arrival150
node benchmarks/batch-search/flow-replay/run.cjs arrival250
node benchmarks/batch-search/flow-replay/run.cjs permissive
node benchmarks/batch-search/flow-replay/tests.cjs
node benchmarks/batch-search/flow-replay/summarize.cjs
```

Ajo tuottaa oman skenaarionsa paikallisen JSON-tulostiedoston. `model.cjs` on fyysisen varastopolitiikan ja tunnisteseurannan sovitin; `run.cjs` hoitaa saapumisen ja toistot; `tests.cjs` validoi työkalun perussäännöt ja valinnaisesti olemassa olevat ajot; `summarize.cjs` tuottaa `summary.json`- ja `TABLES.md`-yhteenvedot, kun kaikki viisi ajoa ovat paikallisesti olemassa. Suuret, uudelleen generoitavat ajo- ja yhteenvetotiedostot eivät kuulu checkpoint-committiin.

Tarkistukset:

- 36/36 nykyistä core-/production-regressioryhmää läpäisi.
- 18/18 ohjaus-/persistenssitarkistusta läpäisi.
- 1354 järjestettyä DP-kuviotapausta, 14 tallennettua kokonaista suunnitelmaa ja yksi aiempi aikakatkaisutapaus valmiiseen referenssiin verrattuna läpäisivät; scoret ja operaatiot identtiset.
- 10/10 tutkimustarkistusta läpäisi: kaikkien viiden ajon 32 varastosiirtymää ja 64 kokonaista materiaaliratkaisua, määrät, värit, fysiikka, scoret, lähderajat, kohdistukset ja tunnisteketjut sekä baseline/sallivan suunnitelmaidenttisyys.
- Kaikkien neljän uuden JavaScript-apurin syntaksitarkistukset ja `git diff --check` läpäisivät. Kuuden production-tiedoston SHA-256-hashit vastaavat lähtötilaa ja Git-diff on niille tyhjä; mitään production-instrumentointia ei lisätty. Myös uusien tutkimustiedostojen rivien loppuvälit tarkistettiin erikseen, koska Git ei sisällytä untracked-tiedostoja tavalliseen diff-tarkistukseen.
- Todellista selaintestiä ei tehty: kyse on erillisestä Node-replaysta, production- ja selainlataustiedostot säilyivät muuttumattomina.
