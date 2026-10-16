# Lukas

Alles wat Lukas Bohez zelfstandig bouwt en bezit, in één map. **Deze map draait zonder de rest van het project**: ze heeft een eigen API, een eigen database en een eigen start. Van het platform van Maciej (de bedrijven, hun personeel en klanten, het menu, de bestellingen) staat hier niets, en ze gebruikt er niets van. Het platform wordt in de demo gespeeld door een **simulator**.

Wat Maciej bouwt, staat apart: zie [`../Mitura/README.md`](../Mitura/README.md).

**Gebouwd naar de wensen van de klant** ([#129](https://github.com/afsd-mct/26-ratty-raccoon/issues/129)): een eigen PWA voor de robotverkoper, zonder personeel of klantgegevens, met defecten en vervangen, rollen van bedrijven, bekijken als rol, één geïsoleerde etenrobot en geen Google-login. Per wens staat in [`../docs/klantfeedback-129.md`](../docs/klantfeedback-129.md) wat er gedaan is en waar je het ziet.

## Wat staat waar

| Map | Wat | Techniek |
| --- | --- | --- |
| [`seller-pwa/`](seller-pwa/) | De PWA voor de **verkopers van de robots**: bedrijven aanmaken, robots toekennen, defecten en vervangen, rollen van een bedrijf, bekijken als rol, team en logboek | Vue 3, Nuxt UI, Pinia |
| [`seller-api/`](seller-api/) | De **eigen API en database** van de verkopers: robotmodellen, robots (alleen het begin van de sleutel), defecten, eigen medewerkers, logboek | Node 24, TypeScript, **SQLite** (eigen bestand) |
| [`platform-simulator/`](platform-simulator/) | Speelt het **platform van de bedrijven** na met verzonnen bedrijven, rollen en robots, en spreekt het robotcontract | Node 24, TypeScript, zonder pakketten |
| [`simulator/`](simulator/) | De robotsimulator: de gsm (of pc) is de robot. De sleutel van een nieuwe robot komt vanzelf uit de PWA | Flutter |
| [`demo-launcher/`](demo-launcher/) | `Delivery Robot Demo.exe`: start alles hierboven met één klik | C# |
| [`scripts/`](scripts/) | `npm run dev` en `npm run setup` van deze map | Node |
| [`Advanced Fullstack Development.fig`](<Advanced Fullstack Development.fig>) en [`design/`](design/) | Het **ontwerp in Figma**: Inspiratie, Components (7 componenten met varianten) en Design (designsysteem, flow, 10 schermen voor desktop en telefoon, donkere modus). `design/` toont alles als afbeeldingen, met uitleg | Figma |

Het contract met het platform (wat er gedeeld wordt en hoe) staat in [`CONTRACT.md`](CONTRACT.md).

## Starten

Met één klik (Windows): bouw de exe eenmalig met `powershell -ExecutionPolicy Bypass -File Lukas\demo-launcher\build.ps1` en dubbelklik op **Delivery Robot Demo**. Of in een terminal:

```bash
cd Lukas
npm run dev          # installeert de pakketten als dat nodig is en start alles
```

| Wat | Adres |
| --- | --- |
| Website van de verkoper | <http://localhost:5174> |
| Verkopers-API | <http://localhost:4200> (`/health`) |
| Platform-simulator | <http://localhost:4100> (`/health`) |

**Inloggen.** Staan de Firebase-waarden in `seller-pwa/.env`, dan log je in met je echte account. Zonder die waarden start de demo met **lokale logins** (geen internet nodig): log in met `docent@howest.be` en een willekeurig wachtwoord. Die logins bestaan alleen in de dev-server en de API weigert ze in productie.

**Een robot aan de simulator geven, zonder iets te kopiëren:**

1. Open de robot-app en kies **Platform**. De app meldt zich bij de verkopers-API en toont een code ("Wachten op een robot van de verkopers-PWA").
2. In de website: **Bedrijven → Robots openen → Robot aanmaken en toekennen**.
3. De sleutel gaat vanzelf naar de simulator. In het tabblad Platform staan de sleutel, de naam en het adres al ingevuld. Tik op **Start de robot**: de robot staat online in de website, met zijn batterij.

Een gsm elders op het netwerk krijgt de sleutel niet vanzelf: de verkoper kiest hem met één klik en ziet dezelfde code als op de gsm. Zie [`CONTRACT.md`](CONTRACT.md#4-de-sleutel-gaat-vanzelf-naar-de-simulator).

## Hoe gescheiden is dit van Maciej

| | Lukas (deze map) | Maciej |
| --- | --- | --- |
| Database | Eigen SQLite-bestand `seller-api/data/seller.db` | MongoDB (Docker) |
| API | `seller-api` (REST, poort 4200) | NestJS GraphQL (`packages/api`, poort 3000) |
| PWA | `seller-pwa` (poort 5174) | `packages/platform` (poort 5173) |
| Bedrijven, rollen, robots | Komen uit de **platform-simulator**: verzonnen gegevens | Echte gegevens in zijn database |
| Start | `npm run dev` in `Lukas/`, of de launcher | `npm run dev` in de root |
| Pakketten | Eigen `package.json` en lockfile per onderdeel, buiten de workspaces | Workspaces `packages/*` |
| CI | [`.github/workflows/lukas.yml`](../.github/workflows/lukas.yml) | `ci.yml` |

Gedeeld is alleen: de lijst met **17 permissie-sleutels** (een kopie) en het **robotcontract** ([#9](https://github.com/afsd-mct/26-ratty-raccoon/issues/9)), dat de robot-app spreekt en dat Maciej's API echt implementeert.

De code van Lukas die nog in de gedeelde pakketten staat (inloggen, bedrijven, personeel, rollen, thema, vertalingen: de flows H tot en met M), staat in [`../docs/flow-ownership-lukas.json`](../docs/flow-ownership-lukas.json) en [`../COLLABORATORS.md`](../COLLABORATORS.md). Die kan niet zomaar naar deze map: ze deelt de API en de PWA met het platform van Maciej.

## Controleren

```bash
cd Lukas
npm test             # platform-simulator + seller-api + seller-pwa
npm run type-check
```

Per onderdeel: `platform-simulator` 20 tests, `seller-api` 56 tests, `seller-pwa` 105 tests (Vitest) en de Flutter-app 93 tests (`flutter test` in `simulator/`).

Wie wat schreef, staat in [`../docs/bijdragen.md`](../docs/bijdragen.md), in [`../docs/bijdragen-lukas-per-flow.md`](../docs/bijdragen-lukas-per-flow.md) en in de git-geschiedenis (`git log --follow`, `git blame`). De simulator en de launcher zijn met `git mv` verhuisd van `apps/`, dus hun geschiedenis is mee.
