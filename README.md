# Lukas

Alles wat Lukas Bohez zelfstandig bouwt en bezit, samen in één map. Deze map deelt met de rest van het project alleen **de API en de database**.

| Map | Wat |
| --- | --- |
| [`seller-pwa/`](seller-pwa/) | De PWA voor de verkopers van de robots: bedrijven en robots beheren |
| [`simulator/`](simulator/) | De robotsimulator in Flutter: de gsm is de robot |
| [`demo-launcher/`](demo-launcher/) | `Delivery Robot Demo.exe`: start de hele demo met één klik (bouw hem met `demo-launcher/build.ps1`) |

Wie wat schreef, staat in [`../docs/bijdragen.md`](../docs/bijdragen.md), in [`../docs/bijdragen-lukas-per-flow.md`](../docs/bijdragen-lukas-per-flow.md) en in de git-geschiedenis (`git log --follow`, `git blame`). De simulator en de launcher zijn met `git mv` verhuisd van `apps/`, dus hun geschiedenis is mee.

De code van Lukas in de gedeelde API en PWA (inloggen, bedrijven, personeel, rollen, het klantenmandje en Mijn bestellingen) staat nog in `../packages/`; zie [`../docs/flow-ownership-lukas.json`](../docs/flow-ownership-lukas.json).
