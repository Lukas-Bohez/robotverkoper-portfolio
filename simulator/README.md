# Delivery robot: de robotsimulator

Flutter-app (`com.DeliveryBot.bot`, op Play Console als "Delivery robot"): **de gsm is de robot**. Eigenaar: Lukas (zie [`COLLABORATORS.md`](https://github.com/afsd-mct/26-ratty-raccoon/blob/develop/COLLABORATORS.md)).

- Leg de gsm plat neer, met het scherm naar boven. Kantelen (> 50° gedurende 0,6 s) en schudden (een schok van meer dan 12 m/s² boven de zwaartekracht) worden incidenten.
- De robot rijdt zijn rit op wandeltempo (1,4 m/s), met een tijdsfactor van 1×, 5× of 10×. Hij stopt bij de zaak (laden) en bij de klant (vak openen, deksel dicht → geleverd), en keert daarna terug naar het station.
- Scenarioknoppen: aangekomen, gekanteld, vastgelopen, opgetild (diefstal), pakketje genomen, hersteld. Op een computer (zonder bewegingssensoren) zijn die knoppen de enige manier, en verdwijnt de schakelaar voor de sensoren.
- Vier talen, zoals het platform: Nederlands, Engels, Frans en Duits. Zie [Talen](#talen).

## Waarom Flutter en geen PWA?

Het platform is een PWA, zoals de klant liefst wil (_"PWA maken, web-app liefst"_). De simulator is bewust een **aparte Flutter-app**. De klant liet dat toe (_"flutter kan en mag ook"_, zie [`docs/blueprint.md`](https://github.com/afsd-mct/26-ratty-raccoon/blob/develop/docs/blueprint.md) §8).

**Waarom:**

- **De robot is een toestel, geen gebruiker.** De simulator meldt zich aan met de API-key van een robot (`x-api-key`), niet met een Firebase-account. In een aparte app zitten de robotcode (rijden, timers, sensoren) en de robotsleutel niet in de app van klanten en personeel.
- **De sensoren van de gsm werken zonder https.** In een browser zijn bewegingssensoren (`DeviceMotionEvent`) enkel beschikbaar in een _secure context_ (https of `localhost`). Een gsm die de dev-server op de laptop opent via `http://192.168.x.x:5173` krijgt ze dus niet. Op een iPhone moet de gebruiker bovendien bij elk bezoek toestemming geven. Een Android-app leest de versnellingsmeter rechtstreeks (`sensors_plus`).
- **Trillen als feedback.** De Vibration API van de browser bestaat niet in Safari. Flutter gebruikt de haptische feedback van het toestel (`HapticFeedback`).
- **Eén codebase, drie doelen.** Dezelfde code draait als Android-app (de gsm is de robot), als Windows-app (naast het platform op dezelfde laptop, gestart door de demo-launcher) en in de browser.
- **Eigen inbreng.** Flutter zit niet in de cursus. Omdat de cursus Vue verplicht maakt voor de frontend, maakt Lukas ook het bedrijfsbeheer in de Vue-PWA (zie [`docs/blueprint.md`](https://github.com/afsd-mct/26-ratty-raccoon/blob/develop/docs/blueprint.md) §10).

**Wat het kost:**

- Een tweede toolchain: de Flutter SDK, en Visual Studio voor de Windows-build.
- Geen app voor iOS, en de macOS-app is nog niet op een Mac gebouwd (zie [Platformen](#platformen)). Een PWA zou daar gewoon in de browser draaien.
- De robot moet geïnstalleerd worden, een PWA opent met een link.

## Platformen

| Platform    | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Android** | ✅ De gsm is de robot, met bewegingssensoren. `flutter build appbundle`, op Play Console als "Delivery robot"                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Windows** | ✅ `flutter build windows`. Gebruikt door de demo-launcher (`Lukas/demo-launcher`). Zonder bewegingssensoren: de scenarioknoppen spelen kantelen en optillen na                                                                                                                                                                                                                                                                                                                                                                                             |
| **Web**     | ✅ `flutter run -d chrome` of `flutter build web`. De API laat elke `http://localhost:<poort>` toe (CORS). Bewegingssensoren enkel via https (zie hierboven)                                                                                                                                                                                                                                                                                                                                                                                               |
| **macOS**   | 🟡 **Voorbereid, nog niet op een Mac gebouwd** (feedback week 3, #94). De map `macos/` staat klaar: de app heet "Delivery robot" (`com.DeliveryBot.bot`) en mag het internet op (`com.apple.security.network.client`, anders blokkeert de sandbox de API). Zonder bewegingssensoren: de scenarioknoppen spelen kantelen en optillen na, zoals op Windows (`test/device_test.dart`). Bouwen vraagt een Mac met Xcode: `flutter build macos`. **Tot dat getest is, gebruik je op een Mac de webversie** (`flutter run -d chrome`), in demo- en platformmodus |
| **iOS**     | ❌ Geen iOS-app (geen map `ios/`, vraagt een Mac). Op een iPhone kan de webversie, maar de sensoren vragen dan https en toestemming                                                                                                                                                                                                                                                                                                                                                                                                                        |

## Talen

- **Nederlands, Engels, Frans en Duits**, zoals het platform. `lib/l10n/app_nl.arb` is de basis, `flutter gen-l10n` maakt er `AppLocalizations` van.
- Bij de eerste start: de taal van het toestel als de app die spreekt, anders **Nederlands** (`resolveLocale` in `lib/src/language.dart`). Zonder die regel nam Flutter de eerste taal van zijn lijst: Duits.
- Met de **taalknop** rechtsboven kies je zelf. De keuze blijft bewaard tussen twee starts (`shared_preferences`, het equivalent van `localStorage` in het platform).
- `test/l10n_test.dart` faalt als een taal een tekst mist, een tekst heeft die het Nederlands niet heeft, of een `{placeholder}` verliest, zoals `src/i18n/__tests__/languages.spec.ts` in het platform.

## Twee modi

| Modus        | Wat                                                                                                                                                                                                                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Demo**     | Zonder platform. `MockRobotApi` speelt de API na, met een rit rond de Howest-campus in Kortrijk. Het demopaneel speelt het platform: open een vak, stop, terugsturen, piep, nieuwe rit.                                                                                                       |
| **Platform** | `GraphqlRobotApi` praat met de API (`packages/api`) met de API-key van de robot (header `x-api-key`), volgens het contract in [#9](https://github.com/afsd-mct/26-ratty-raccoon/issues/9): `reportTelemetry`, `pendingRobotCommands` + `ackRobotCommand` (polling om de 2 s), `myActiveTrip`. |

De robot-API is het deel van Maciej. Het contract staat in [#9](https://github.com/afsd-mct/26-ratty-raccoon/issues/9).

## Code

| Map                                       | Inhoud                                                                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/src/models/`                         | `geo.dart` (afstand, positie langs een route), `robot.dart` (statussen, vakken, commando's, rit, telemetrie, zoals in het contract)                     |
| `lib/src/api/`                            | `RobotApi` (interface), `GraphqlRobotApi`, `MockRobotApi`                                                                                               |
| `lib/src/simulation/robot_simulator.dart` | De robot: rijden, stops, commando's, incidenten, synchroniseren met de API. Events die niet verstuurd raken, blijven bewaard tot de verbinding terug is |
| `lib/src/sensors/motion_detector.dart`    | Kantelen en schudden uit de versnellingsmeter (pure logica, getest)                                                                                     |
| `lib/src/sensors/device.dart`             | `hasMotionSensors`: een gsm (en de webversie) wel, Windows en andere computers niet                                                                     |
| `lib/src/language.dart`                   | De vier talen, `resolveLocale` (taal van het toestel, anders Nederlands) en de bewaarde keuze (`LanguageController`)                                    |
| `lib/src/ui/`                             | Startscherm, robotscherm (gezicht, route, vakken, scenario's, logboek), `widgets/language_menu.dart` (de taalknop)                                      |
| `lib/l10n/`                               | Vertalingen (`app_nl.arb` is de basis)                                                                                                                  |

## Commando's

Flutter staat niet in het PATH op de pc van Lukas: gebruik `C:\Users\lukas\flutter\bin\flutter.bat`.

```bash
flutter pub get
flutter analyze             # lint
flutter test                # geo, sensoren, simulator, GraphQL-client, schermen, talen
flutter run -d chrome       # in de browser (ook op een Mac)
flutter build windows       # de Windows-app (vraagt Visual Studio met C++), gebruikt door de demo-launcher
flutter build web           # web-build, ook bruikbaar op een gsm (sensoren vragen https)
flutter build appbundle     # voor Play Console (vraagt de Android SDK)
```

## De app delen zonder Play Console (APK)

Een Play-release is nu niet mogelijk. Om de app toch te delen kun je een APK bouwen:

```bash
flutter build apk --release      # vraagt de Android SDK, die niet op elke pc staat
```

- **Onderteken met de upload-sleutel** (zie hieronder): `android/key.properties` bestaat dan en de release-build gebruikt `signingConfigs.release`. Zonder dat valt de build terug op de debug-sleutel, en dan hebben updates een andere handtekening.
- **Gebruik bij elke versie dezelfde sleutel**, zodat een nieuwe APK de oude kan vervangen.
- Een APK die niet uit Play Store komt, kan bij het downloaden of installeren altijd een melding van Android of Chrome tonen (bv. van Play Protect: de app is niet herkend). Dat is **niet te vermijden zonder Play-distributie**. Je kunt het wel beperken: deel de APK via HTTPS, laat de testers weten dat ze "Meer details, dan Toch installeren" kiezen, en bouw op de recente `targetSdk` die Flutter standaard instelt.
- Heb je geen Android SDK, dan kan een andere pc (of de CI) de APK bouwen; die moet de upload-sleutel buiten git krijgen.

## Ondertekenen voor Play Console

Het pakket `com.DeliveryBot.bot` is in Play Console geregistreerd met de **upload-sleutel** van Lukas. Die staat **buiten de repo**, en `android/key.properties` (gitignored) wijst ernaar:

```properties
storePassword=…
keyPassword=…
keyAlias=upload
storeFile=C:\\pad\\naar\\delivery-robot-upload.jks
```

- Met `key.properties` ondertekent `flutter build appbundle` met de upload-sleutel (`android/app/build.gradle.kts`, `signingConfigs.release`).
- Zonder (een andere pc, de CI) valt de release-build terug op de debug-sleutel: bouwen lukt, maar **zo'n build kan niet naar Play Console**.
- De sleutel en het wachtwoord **nooit** in git. Verlies je ze, dan kan je geen updates meer publiceren onder deze sleutel.
