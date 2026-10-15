# Seller PWA: voor de verkopers van de robots

De **tweede PWA** van het project, naast `packages/platform` (de PWA van de bedrijven die robots **kopen**). Deze is voor de mensen die de robots **verkopen**: de robotfabrikant, "superadmin" genoemd in de klantfeedback ([#129](https://github.com/afsd-mct/26-ratty-raccoon/issues/129)).

Eigenaar: **Lukas** (zie [`../README.md`](../README.md)). De app staat buiten de npm-workspaces (eigen `package.json` en lockfile), raakt geen bestand van `packages/*` en deelt met de rest alleen **de API en de database**.

## Wat het doet (v1)

- **Inloggen** met e-mail en wachtwoord (Firebase). Geen Google-login: dat vertrouwt de klant niet.
- **Alleen voor een platformadmin.** Wie die rol niet heeft, ziet "Geen toegang".
- **Bedrijven:** lijst en aanmaken (naam, adres, e-mailadres van de eerste beheerder, die een uitnodiging krijgt). Geen personeel, klanten of e-mailadressen in beeld.
- **Robots per bedrijf:** lijst en een robot aanmaken en toekennen (model, naam, temperatuur voor eten). De **API-sleutel wordt één keer getoond** met een kopieerknop; het platform bewaart enkel een hash.
- Nederlands en Engels. Installeerbaar als app (PWA), werkt offline als schil.

Bewust niet in v1 (staat in #129 of volgt): een eigen API-rol die alleen robots en technische gegevens toont, accounts en rollen per bedrijf aanmaken, robotdefecten en vervangen, Frans en Duits, en het ontwerp in Figma.

## Gebruikte API

Alleen bestaande GraphQL-bewerkingen, zie `src/graphql/operations.ts`: `me`, `tenants`, `createTenant`, `robotModels`, `robots(tenantId)`, `createRobot`. De API is niet gewijzigd.

## Starten

```bash
cd Lukas/seller-pwa
cp .env.example .env     # vul de Firebase-waarden in (dezelfde als packages/platform/.env)
npm install
npm run dev              # http://localhost:5174, de API moet draaien op http://localhost:3000
```

Log in met een platformadmin (`docent@howest.be`, of je eigen account in `PLATFORM_ADMIN_EMAILS`).

## Controleren

```bash
npm run test:unit        # Vitest
npm run type-check       # vue-tsc
npm run build            # productiebuild + typecheck
```

## Kanttekeningen

- **Firebase-adressen:** de app draait op `localhost:5174`; `localhost` staat standaard bij de toegestane domeinen van Firebase. Staat de app op een eigen adres, voeg dat dan toe bij *Authentication → Settings → Authorized domains*.
- **Rechten:** een platformadmin heeft in de API alle rechten. Het scherm toont wel alleen wat een robotverkoper nodig heeft, maar de API beperkt dat nog niet. Een aparte rol komt later (in `users/` en `authentication/`).
- **Niet in de CI:** de app staat buiten de workspaces en wordt niet door `.github/workflows/ci.yml` gebouwd.
