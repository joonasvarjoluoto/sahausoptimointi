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

### B-002 — Osittaisten inventory-beam-tilojen heuristinen järjestys

- **Tila:** havaittu ja dokumentoitu
- **Prioriteetti:** matala ennen systemaattista laatumittausta
- **Alue:** optimizerin hakulaatu
- **Havainto:** valmiit ratkaisut käyttävät `scoreCompleteMaterialTransitionPlan()`-pisteytystä, mutta osittaiset beam-tilat järjestetään kevyemmällä heuristiikalla.
- **Vaikutus:** beam voi karsia haaran, joka olisi päätynyt parempaan valmiiseen materiaaliratkaisuun.
- **Ennen toteutusta:** rakenna mittaus ja pienien tapausten oracle; älä muuta heuristiikkaa yksittäisen esimerkin perusteella.
- **Hyväksymiskriteeri:** uusi ranking parantaa mitattua laatua edustavassa testipankissa ilman kohtuutonta suorituskykyhaittaa.

### B-003 — Persistoidun profiilinimen tarkistus hyväksyy perityn ominaisuuden

- **Tila:** vahvistettu Node-ajolla 2026-09-06
- **Prioriteetti:** keskitaso
- **Alue:** localStorage / profiilityypin validointi ja palautus
- **Havainto:** `isValidStoredStockProfileRows()` käyttää tarkistusta `PROFILE_TYPES[row.profileType] !== undefined`, joka hyväksyy myös olion perityn ominaisuuden, kuten `constructor`.
- **Toisto tai näyttö:** lisää kuuden normaalin oletusrivin rinnalle `{ profileType: "constructor", color: "gray", quantity: "1", unlimited: true, additional: false }`. Rivivalidointi palauttaa `true`, mutta `createStockProfileGroupsFromRows()` heittää virheen, koska profiilia ei löydy palautuksen Mapista.
- **Vaikutus:** korruptoitunut tai käsin muokattu tallenne voi keskeyttää palautuksen poikkeukseen. Tavallinen profiilivalikko ei tuota tällaista arvoa.
- **Ennen toteutusta:** tarkista saman jäsenyystarkistuksen käyttö myös muissa tallennetuissa profiilikentissä ja rajaa korjaus validointiin.
- **Hyväksymiskriteeri:** vain projektin omat kuusi profiiliavainta hyväksytään; perityn ominaisuuden sisältävä työtila hylätään ennen tallennetun DOM-tilan palautusta ja nykyiset regressiot säilyvät.

## Valmistuneet

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
