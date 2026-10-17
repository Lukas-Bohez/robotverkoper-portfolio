# Het contract van de verkopers-kant met het platform

De verkopers-kant (`Lukas/`) en het platform van de bedrijven (Maciej) kennen elkaar alleen via de afspraken hieronder. Alles wat niet in dit bestand staat, is niet gedeeld.

```
 Verkopers-PWA ──REST──► seller-api ──REST (gateway)──► platform
 (poort 5174)            (4200, GraphQL, eigen MongoDB)           (in de demo: platform-simulator, 4100)
                              ▲                                ▲
 Robot-app (simulator) ──pairing──┘                            │
        └────────────── GraphQL, robotcontract #9, x-api-key ──┘
```

## 1. Wat gedeeld wordt

| Gegeven | Richting | Wat precies |
| --- | --- | --- |
| Bedrijf | platform → verkoper | `id`, `name`, `subdomain`, `createdAt`. Een kleine **kopie** in de eigen database, ververst bij elke lijst |
| Nieuw bedrijf | verkoper → platform | `name`, `subdomain`, `adminEmail`. Het e-mailadres gaat naar het platform voor de uitnodiging en wordt **niet bewaard** |
| Rol van een bedrijf | verkoper ↔ platform | `name` en een lijst permissie-sleutels. Het platform bewaart ze, de verkoper leest ze er telkens uit |
| Robot | verkoper → platform | `companyId`, `modelKind` (FOOD of PARCEL), `name`. **Geen temperatuur**: de klant wil één geïsoleerde etenrobot ([#129](https://github.com/afsd-mct/26-ratty-raccoon/issues/129)). Het platform maakt de **sleutel** en geeft hem één keer terug |
| Robot intrekken | verkoper → platform | de sleutel werkt niet meer en de robot is offline |
| Live status | platform → verkoper | per robot `online` en `battery` |
| Permissie-sleutels | **kopie** | de 17 sleutels van `packages/api/src/roles/permissions.ts`, nagemaakt in `seller-api/src/permissions.ts` |

**Niet gedeeld:** personeel, klanten, e-mailadressen van personeel of klanten, menu, bestellingen, adressen, routes. De verkoper ziet ze niet en bewaart ze niet.

## 2. De gateway: wat het platform moet bieden

De seller-api praat met het platform via `PlatformGateway` (`seller-api/src/platform.ts`). `HttpPlatformGateway` doet dat over HTTP en JSON, met `Authorization: Bearer <PLATFORM_TOKEN>`. De platform-simulator is de implementatie voor de demo. Een echt platform sluit aan met een adapter die deze zeven oproepen vertaalt (bv. naar zijn GraphQL).

| Oproep | HTTP | Antwoord |
| --- | --- | --- |
| Bedrijven | `GET /companies` | lijst van `{ id, name, subdomain, createdAt }` |
| Bedrijf maken | `POST /companies` `{ name, subdomain, adminEmail }` | `201` het bedrijf, of `409 subdomain_taken` |
| Rollen | `GET /companies/:id/roles` | lijst van `{ id, name, permissions, locked }` |
| Rol maken | `POST /companies/:id/roles` `{ name, permissions }` | `201` de rol, of `400 unknown_permission`, `409 role_exists` |
| Rol verwijderen | `DELETE /companies/:id/roles/:roleId` | `204`, of `409 role_locked` voor de beheerder |
| Robot toekennen | `POST /robots` `{ companyId, modelKind, name }` | `201 { id, apiKey, apiKeyPrefix }` |
| Robot intrekken | `POST /robots/:id/retire` | `200`, mag twee keer |
| Live status | `GET /robots/live?ids=a,b` | lijst van `{ id, online, battery }` |

Fouten van het platform met een 4xx gaan met hun `code` en `message` door naar de gebruiker. Antwoordt het platform niet (netwerkfout, 5xx, 401 of 403), dan toont de seller-api de **laatst bekende gegevens** en markeert de lijst met `source: "cache"`. Iets aanmaken lukt dan niet (`502 platform_unavailable`).

## 3. Het robotcontract (#9)

De robot-app praat met het platform over GraphQL, met de sleutel van de robot in de header `x-api-key`: `reportTelemetry`, `pendingRobotCommands`, `ackRobotCommand`, `myRobot`, `myActiveTrip`, `walkingRoute`, `unlockWithPin`. Maciej's API implementeert alles. De platform-simulator (`POST /graphql`) antwoordt wat nodig is om te verbinden:

- `myRobot`: naam, bedrijf, soort, model en afmetingen;
- `reportTelemetry`: de robot staat **online** met zijn batterij (20 seconden lang; daarna offline tot hij weer meldt);
- de rest: niets te doen (geen commando's, geen rit).

## 4. De sleutel gaat vanzelf naar de simulator

Een sleutel wordt maar één keer getoond. In plaats van hem te kopiëren, gaat hij via de seller-api naar de simulator (een "pairing", zoals een tv die je koppelt):

| Stap | Oproep | Wie |
| --- | --- | --- |
| 1 | `POST /pairings` `{ device }` zonder login, antwoord `{ id, secret, code }` | de simulator meldt zich en wacht |
| 2 | `GET /pairings` (login) → `[{ id, device, code, loopback }]` | de PWA ziet wie wacht |
| 3 | `POST /pairings/:id/deliver` `{ robotId, apiKey }` (login) → `204` | de PWA geeft de sleutel |
| 4 | `GET /pairings/:id` met header `x-pairing-secret` → `{ status: "delivered", apiKey, robotName, platformUrl }` | de simulator haalt hem één keer op, daarna bestaat de pairing niet meer |

Veiligheid:

- De sleutel staat **alleen in het geheugen** van de seller-api, hoogstens 2 minuten en tot de simulator hem ophaalt. Hij komt niet in de database, niet in het logboek (alleen het begin van de sleutel) en niet in een bestand.
- Alleen een **ingelogde verkoper** met het recht om robots te maken kan een sleutel geven, en alleen de sleutel van een robot die de seller-api kent (het begin moet overeenkomen).
- De simulator bewijst wie hij is met het `secret` uit stap 1. Zonder dat geeft de API niets terug (`403`).
- Een simulator **op dezelfde pc** (`loopback`) krijgt de sleutel zonder vragen. Eén elders (een gsm) komt als keuze in beeld, met zijn code, en de verkoper klikt erop. De API luistert standaard alleen op `127.0.0.1`.
- Hoogstens 20 pairings tegelijk, 10 minuten wachttijd.

## 5. De eigen database

Een eigen **MongoDB** (`MONGODB_URI`, standaard poort 27028; in Docker een eigen container). Collecties: `robot_models`, `companies` (de kleine kopie, met `platformId`), `robots` (met `serial`, `apiKeyPrefix` en laatst bekende status, **zonder sleutel of hash**; een robot in het magazijn heeft nog geen bedrijf), `defects` (levenscyclus, toestand van de robot, plaats, veiligheidscontrole), `accounts`, `seller_roles` (rollen zijn data), `role_presets`, `audit` (logboek) en `_migrations`. **Niets wordt echt verwijderd**: overal soft delete (`deletedAt`), met een archief om uit te herstellen, en koude opslag (`coldAt`) voor oude defecten en logregels.

## Wat het platform er voor de feedback van 16/10 (#137) bij moet kunnen

De seller-API vraagt het platform (HTTP + JSON, `Authorization: Bearer <token>`) ook om:

| Methode en pad | Wat |
| --- | --- |
| `GET /companies/:id/roles?withArchived=true` | Rollen van een bedrijf, met `names` per taal (nl, en, fr, de) en `archivedAt` |
| `PATCH /companies/:id/roles/:roleId` | Naam, namen per taal en rechten wijzigen (de vergrendelde beheerdersrol niet) |
| `POST /companies/:id/roles/:roleId/archive` en `/restore` | Soft delete van een rol (vervangt `DELETE`) |
| `POST /robots/:id/reinstate` | Een robot weer in dienst nemen (de sleutel werkt weer) |
| `GET /robots/conditions?ids=a,b` | De toestand van robots: gekanteld, eten aan boord, klep, temperatuur, foutcode, plaats |
| `PUT /robots/:id/condition` | Alleen voor de simulator: de toestand met de hand zetten |

De robot-app meldt zijn toestand met de GraphQL-mutation `reportCondition(input)` (zelfde `x-api-key` als `reportTelemetry`). Ondersteunt een platform dit (nog) niet, dan toont de verkopers-PWA de toestand als onbekend: alles blijft werken.
