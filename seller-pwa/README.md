# seller-pwa: de PWA voor de verkopers van de robots

De **tweede PWA** van het project, naast `packages/platform` (de PWA van de bedrijven die robots **kopen**). Deze is voor de mensen die de robots **verkopen**: de robotfabrikant, "superadmin" genoemd in de klantfeedback ([#129](https://github.com/afsd-mct/26-ratty-raccoon/issues/129), zie [`docs/klantfeedback-129.md`](../../docs/klantfeedback-129.md)).

Eigenaar: **Lukas** (zie [`../README.md`](../README.md)). De app staat buiten de npm-workspaces (eigen `package.json` en lockfile) en praat **alleen met de [`seller-api`](../seller-api/)**, niet met de API van het platform. Het ontwerp staat eerst in Figma (pagina's Inspiratie, Components en Design).

## Wat het doet

- **Inloggen** met e-mail en wachtwoord (Firebase). Geen Google-login: dat vertrouwt de klant niet. Zonder Firebase-waarden: lokale demo-logins in de dev-server.
- **Bedrijven:** lijst met aantal robots en defecten, nieuw bedrijf maken, en per bedrijf twee knoppen: **Robots openen** en **Rollen openen** (zo is het rollenscherm bereikbaar, zoals in het Figma-ontwerp). Geen personeel, klanten of e-mailadressen in beeld.
- **Robots per bedrijf:** lijst met een duidelijke statusbadge (online, offline, defect) en batterij, en een robot aanmaken en toekennen. Eén soort etenrobot: geïsoleerd, dus geen warm, koud of neutraal. De **API-sleutel wordt één keer getoond** en gaat vanzelf naar de robot-app die wacht; kopiëren kan ook.
- **Defecten:** een defect melden, een robot **vervangen** (nieuwe sleutel, oude stopt) of het defect sluiten.
- **Accounts en rollen** van een bedrijf: rollen maken uit blokken permissies. **Bekijken als rol**: zien wat een rol ziet, zonder iets te kunnen wijzigen.
- **Team:** eigen medewerkers met rol Beheerder of Technicus, en een logboek. Een technicus ziet alleen robots, defecten en technische gegevens.
- Nederlands en Engels, mobiel en desktop, donkere modus via de tokens. Installeerbaar als app (PWA), werkt offline als schil.

## Starten

```bash
cd Lukas
npm run dev              # platform-simulator + seller-api + deze PWA op http://localhost:5174
```

Of alleen deze app, met de seller-api al aan het draaien op `http://localhost:4200`:

```bash
cd Lukas/seller-pwa
cp .env.example .env     # Firebase-waarden: dezelfde als packages/platform/.env. Zonder: lokale demo-logins via npm run dev van Lukas/
npm install
npm run dev
```

`VITE_API_URL` wijst naar de seller-api (standaard `http://localhost:4200`). Nodig voor echte logins: `VITE_FIREBASE_*` in `.env` en de seller-api met `AUTH_MODE=firebase`.

## Code

| Map | Inhoud |
| --- | --- |
| `src/api/types.ts`, `src/lib/api.ts` | de vorm van de API en een kleine `fetch`-laag met het login-token en vertaalde fouten |
| `src/lib/handoff.ts` | de sleutel van een nieuwe robot naar een wachtende simulator |
| `src/stores/` | `auth` (Firebase of lokale login) en `me` (rol en rechten) |
| `src/router/` | de routes en de bewaker: eerst inloggen, dan de rol, dan het recht van de pagina |
| `src/views/`, `src/components/` | de schermen van de Figma-flow |
| `src/i18n/` | Nederlands en Engels |

## Controleren

```bash
npm run test:unit        # Vitest, 111 tests
npm run type-check       # vue-tsc
npm run build            # productiebuild + typecheck
```

## Kanttekeningen

- **Firebase-adressen:** de app draait op `localhost:5174`; `localhost` staat standaard bij de toegestane domeinen van Firebase. Staat de app op een eigen adres, voeg dat dan toe bij *Authentication → Settings → Authorized domains*.
- **Rechten:** de knoppen volgen de rol, maar de **API beslist** bij elke oproep. Een schermfilter is geen beveiliging.
- **CI:** [`.github/workflows/lukas.yml`](../../.github/workflows/lukas.yml) controleert type-check, tests en build.
