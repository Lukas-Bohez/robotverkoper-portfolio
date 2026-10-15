# platform-simulator: het platform van de bedrijven, nagespeeld

Een klein programma dat de rol van het platform van Maciej speelt, zodat het deel van Lukas **geen echte bedrijfsgegevens** nodig heeft. Het kent drie verzonnen bedrijven (Demozaak, Gelato Bar, Pizzeria Test), hun rollen en de robots die de verkoper toekent.

- Node 24, TypeScript zonder build, geen pakketten (alleen `typescript` en `@types/node` om te controleren).
- De toestand blijft bewaard in `data/state.json` (niet in git), zodat de website en de simulator na een herstart hetzelfde verhaal vertellen.
- Draait nooit in productie: het weigert te starten met `NODE_ENV=production`.

## Starten

```bash
cd Lukas/platform-simulator
npm install
npm start            # http://127.0.0.1:4100
```

Of met de rest: `npm run dev` in `Lukas/`.

| Instelling | Standaard | |
| --- | --- | --- |
| `PORT` | `4100` | |
| `PLATFORM_TOKEN` | `dev-platform-token` | het geheim dat de seller-api meestuurt (`Authorization: Bearer`) |
| `BIND_HOST` | `127.0.0.1` | `0.0.0.0` laat de robot-app op een gsm erbij |
| `STATE_FILE` | `data/state.json` | |

## Wat het kan

De kant van de verkoper (met het token): bedrijven, rollen, robots toekennen en intrekken, live status. De kant van de robot (`POST /graphql` met `x-api-key`): het robotcontract van [#9](https://github.com/afsd-mct/26-ratty-raccoon/issues/9), net genoeg om te verbinden. Een robot die zijn telemetrie meldt, staat **online** met zijn batterij, en na 20 seconden zonder melding weer offline. Alle oproepen staan in [`../CONTRACT.md`](../CONTRACT.md).

Een robot "offline laten gaan" of een batterij instellen voor een demo kan zonder robot-app:

```bash
curl -X POST http://127.0.0.1:4100/robots/<id>/telemetry -H "Authorization: Bearer dev-platform-token" \
  -H "content-type: application/json" -d '{"online": false, "battery": 12}'
```

Zodra de robot zelf meldt, wint wat hij zegt.

## Controleren

```bash
npm test             # 20 tests (node --test)
npm run type-check
```
