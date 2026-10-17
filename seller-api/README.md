# seller-api: de eigen API en database van de verkopers

De API achter de [`seller-pwa`](../seller-pwa/). Ze is gebouwd met **NestJS, GraphQL (code first) en MongoDB** en heeft een **eigen database** en praat met het platform van de bedrijven via één kleine poort (zie [`../CONTRACT.md`](../CONTRACT.md)). In de demo is dat platform de [`platform-simulator`](../platform-simulator/).

- NestJS 12, `@nestjs/graphql` + Apollo, TypeORM (MongoDB), DataLoader, subscriptions (graphql-ws), class-validator, migraties, vitest en supertest. `npm run db:memory` start een MongoDB zonder Docker; `npm test` (unit) en `npm run test:e2e`.
- Eén pakket: `jose` (om Firebase-logins te controleren). Geen framework.
- Staat buiten de npm-workspaces van de rest van het project.

## Starten

```bash
cd Lukas/seller-api
npm install
cp .env.example .env     # past de instellingen aan; zonder .env gelden de standaardwaarden
npm run dev              # http://127.0.0.1:4200
```

Gemakkelijker: `npm run dev` in `Lukas/` start deze API samen met de simulator en de website.

| Instelling | Standaard | Wat |
| --- | --- | --- |
| `AUTH_MODE` | `firebase` | `firebase` controleert echte Firebase-logins (vraagt `FIREBASE_PROJECT_ID`, geen service account). `dev` accepteert tokens `dev:<e-mail>` voor een lokale demo en **weigert te starten in productie** |
| `SELLER_ADMIN_EMAILS` | | wie beheerder (superadmin) is vanaf het begin, komma's ertussen. In de demo (`npm run dev` in `Lukas/`, Docker) zijn dat `docent@howest.be` en `lukasbohez@gmail.com` |
| `PLATFORM_URL`, `PLATFORM_TOKEN` | `http://127.0.0.1:4100`, `dev-platform-token` | het platform (de simulator) |
| `ROBOT_API_URL` | `PLATFORM_URL` + `/graphql` | waar een robot verbindt, gaat mee met de sleutel naar de simulator |
| `DB_PATH` | `data/seller.db` | het databasebestand |
| `CORS_ORIGINS` | `http://localhost:5174,http://127.0.0.1:5174` | welke websites de API mogen aanroepen |
| `BIND_HOST` | `127.0.0.1` | enkel deze pc. `0.0.0.0` laat een gsm op het netwerk erbij |
| `SEED_DEMO` | `false` | vult een lege database met demorobots en één defect (nooit in productie) |
| `REQUIRE_VERIFIED_EMAIL` | in productie `true` | alleen bevestigde Firebase-adressen |

## Wat ze doet

| Oproep | Wie mag | Wat |
| --- | --- | --- |
| `GET /me` | elke ingelogde | rol en rechten |
| `GET/POST /companies`, `GET /companies/:id` | `companies:read`, `companies:create` | bedrijven (kopie van het platform), nieuw bedrijf |
| `GET/POST /companies/:id/robots` | `robots:read`, `robots:create` | robots met live status; robot toekennen (de sleutel komt **één keer** terug) |
| `GET/POST/DELETE /companies/:id/roles` | `company-roles:manage` | rollen van een bedrijf |
| `GET /defects`, `POST /robots/:id/defects`, `POST /defects/:id/close` | `defects:read`, `defects:manage` | defecten |
| `POST /defects/:id/replace` | `robots:create` | oude robot stopzetten, nieuwe met nieuwe sleutel |
| `GET/POST/DELETE /accounts` | `accounts:manage` | eigen medewerkers |
| `GET /audit` | `audit:read` | logboek |
| `POST /pairings`, `GET/DELETE /pairings/:id` | iedereen met het `secret` | de simulator wacht op een sleutel |
| `GET /pairings`, `POST /pairings/:id/deliver` | `robots:create` | de PWA geeft de sleutel aan de simulator |

Fouten komen als `{ code, message }`. De website vertaalt de `code`.

## Code

| Bestand | Inhoud |
| --- | --- |
| `src/main.ts`, `config.ts` | opstarten, instellingen en wat niet samen mag (bv. dev-logins in productie) |
| `src/app.ts`, `http.ts` | routes, controle van login en recht, CORS |
| `src/auth.ts` | Firebase-token (RS256 tegen de publieke sleutels van Google) of dev-token |
| `src/service.ts` | wat er gebeurt: bedrijven, robots, defecten, vervangen, rollen, team |
| `src/store.ts`, `db.ts` | alle SQL en het schema met migraties |
| `src/platform.ts` | `PlatformGateway` en de HTTP-versie |
| `src/pairings.ts` | de sleutel van de PWA naar de simulator, enkel in het geheugen |
| `src/seed.ts` | de robotmodellen, en de demorobots |

## Controleren

```bash
npm test             # 57 tests (node --test)
npm run type-check
```

De tests starten de echte server met een database in het geheugen en een nagemaakt platform. De sleutel van een robot komt in geen enkele tabel (er wordt getest dat hij nergens in de database of het logboek staat).
