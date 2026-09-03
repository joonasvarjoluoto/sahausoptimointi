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

### B-001 — Persistoidun stock-ryhmän default/additional-invariantti

- **Tila:** vahvistettu aiemmassa B7-auditissa
- **Prioriteetti:** matala
- **Alue:** localStorage / uuden materiaalin rivit
- **Havainto:** `isValidStoredStockProfileRows()` tarkistaa `additional`-kentän tyypin mutta ei varmista, että jokaisella profiilityypillä on palautuksen jälkeen täsmälleen yksi ei-poistettava oletusrivi. Esimerkiksi kaikki rivit voivat olla `additional: true`.
- **Vaikutus:** korruptoitunut tai käsin muokattu tallennustila voi palauttaa ryhmän, jonka kaikki varianttirivit ovat poistettavia. Tunnettu materiaalitaseen rikkoutuminen ei ole osoitettu.
- **Ennen toteutusta:** päätä legacy-tilojen yhteensopivuus, koska vanhoista riveistä `additional` voi puuttua.
- **Hyväksymiskriteeri:** jokaisella profiilityypillä on palautuksen jälkeen yksi oletusrivi, lisärivien poistettavuus on johdonmukainen ja nykyiset legacy-/väriregressiot säilyvät.

### B-002 — Osittaisten inventory-beam-tilojen heuristinen järjestys

- **Tila:** havaittu ja dokumentoitu
- **Prioriteetti:** matala ennen systemaattista laatumittausta
- **Alue:** optimizerin hakulaatu
- **Havainto:** valmiit ratkaisut käyttävät `scoreCompleteMaterialTransitionPlan()`-pisteytystä, mutta osittaiset beam-tilat järjestetään kevyemmällä heuristiikalla.
- **Vaikutus:** beam voi karsia haaran, joka olisi päätynyt parempaan valmiiseen materiaaliratkaisuun.
- **Ennen toteutusta:** rakenna mittaus ja pienien tapausten oracle; älä muuta heuristiikkaa yksittäisen esimerkin perusteella.
- **Hyväksymiskriteeri:** uusi ranking parantaa mitattua laatua edustavassa testipankissa ilman kohtuutonta suorituskykyhaittaa.

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
