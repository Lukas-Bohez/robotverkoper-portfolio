import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_de.dart';
import 'app_localizations_en.dart';
import 'app_localizations_fr.dart';
import 'app_localizations_nl.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations)!;
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('de'),
    Locale('en'),
    Locale('fr'),
    Locale('nl'),
  ];

  /// No description provided for @appTitle.
  ///
  /// In nl, this message translates to:
  /// **'Delivery robot'**
  String get appTitle;

  /// No description provided for @language.
  ///
  /// In nl, this message translates to:
  /// **'Taal'**
  String get language;

  /// No description provided for @connectTitle.
  ///
  /// In nl, this message translates to:
  /// **'Deze gsm wordt een bezorgrobot'**
  String get connectTitle;

  /// No description provided for @connectIntro.
  ///
  /// In nl, this message translates to:
  /// **'Leg de gsm plat neer, met het scherm naar boven: dat is de robot. Kantelen, schudden en optillen worden incidenten op het platform.'**
  String get connectIntro;

  /// No description provided for @connectTitleDesktop.
  ///
  /// In nl, this message translates to:
  /// **'Deze computer speelt een bezorgrobot'**
  String get connectTitleDesktop;

  /// No description provided for @connectIntroDesktop.
  ///
  /// In nl, this message translates to:
  /// **'Een computer heeft geen bewegingssensoren: de scenarioknoppen spelen kantelen, schudden en optillen na. Op een gsm wordt de gsm zelf de robot.'**
  String get connectIntroDesktop;

  /// No description provided for @modeDemo.
  ///
  /// In nl, this message translates to:
  /// **'Demo'**
  String get modeDemo;

  /// No description provided for @modeDemoHint.
  ///
  /// In nl, this message translates to:
  /// **'Zonder platform: de app speelt zelf de API na, met een rit rond de Howest-campus.'**
  String get modeDemoHint;

  /// No description provided for @modeApi.
  ///
  /// In nl, this message translates to:
  /// **'Platform'**
  String get modeApi;

  /// No description provided for @apiUrl.
  ///
  /// In nl, this message translates to:
  /// **'GraphQL-endpoint van de API'**
  String get apiUrl;

  /// No description provided for @apiKey.
  ///
  /// In nl, this message translates to:
  /// **'API-key van de robot'**
  String get apiKey;

  /// No description provided for @apiKeyHint.
  ///
  /// In nl, this message translates to:
  /// **'Die krijg je van de platform-admin als hij de robot aanmaakt.'**
  String get apiKeyHint;

  /// No description provided for @robotName.
  ///
  /// In nl, this message translates to:
  /// **'Naam van de robot'**
  String get robotName;

  /// No description provided for @robotNameRequired.
  ///
  /// In nl, this message translates to:
  /// **'Geef de robot een naam.'**
  String get robotNameRequired;

  /// No description provided for @apiUrlInvalid.
  ///
  /// In nl, this message translates to:
  /// **'Vul een volledig adres in, bv. http://localhost:3000/graphql.'**
  String get apiUrlInvalid;

  /// No description provided for @apiKeyRequired.
  ///
  /// In nl, this message translates to:
  /// **'Vul de API-key van de robot in.'**
  String get apiKeyRequired;

  /// No description provided for @start.
  ///
  /// In nl, this message translates to:
  /// **'Start de robot'**
  String get start;

  /// No description provided for @stopRobot.
  ///
  /// In nl, this message translates to:
  /// **'Robot stoppen'**
  String get stopRobot;

  /// No description provided for @statusLabel.
  ///
  /// In nl, this message translates to:
  /// **'{status, select, available{Beschikbaar} toPickup{Onderweg naar de zaak} loading{Wacht tot de zaak laadt} onRoute{Onderweg naar de klant} atDropoff{Bij de klant} returning{Terug naar het station} charging{Aan het opladen} stuck{Vastgelopen} defect{Defect} alarm{Alarm} offline{Offline} manualOverride{Overgenomen door de technieker} other{{status}}}'**
  String statusLabel(String status);

  /// No description provided for @whatNow.
  ///
  /// In nl, this message translates to:
  /// **'Wat nu?'**
  String get whatNow;

  /// No description provided for @unlockByCustomer.
  ///
  /// In nl, this message translates to:
  /// **'De klant opent het vak'**
  String get unlockByCustomer;

  /// No description provided for @statusHint.
  ///
  /// In nl, this message translates to:
  /// **'{status, select, available{Wacht op een bestelling. In de demo start je hieronder een rit.} toPickup{De robot rijdt naar de zaak. Met \'Aangekomen\' sla je het rijden over.} loading{De zaak legt de bestelling in het vak. Druk daarna op de knop.} onRoute{De robot rijdt naar de klant.} atDropoff{De klant opent het vak in de app. Daarna gaat het deksel dicht.} returning{De robot rijdt terug naar het station.} stuck{Er is een probleem. Een technieker lost het op: druk op Hersteld.} defect{Er is een probleem. Een technieker lost het op: druk op Hersteld.} alarm{Er is een probleem. Een technieker lost het op: druk op Hersteld.} manualOverride{Er is een probleem. Een technieker lost het op: druk op Hersteld.} other{}}'**
  String statusHint(String status);

  /// No description provided for @battery.
  ///
  /// In nl, this message translates to:
  /// **'Batterij {percent}%'**
  String battery(int percent);

  /// No description provided for @remaining.
  ///
  /// In nl, this message translates to:
  /// **'Nog {metres} m'**
  String remaining(int metres);

  /// No description provided for @noTrip.
  ///
  /// In nl, this message translates to:
  /// **'Geen rit. De robot wacht op een bestelling.'**
  String get noTrip;

  /// No description provided for @compartments.
  ///
  /// In nl, this message translates to:
  /// **'Vak'**
  String get compartments;

  /// No description provided for @compartmentTitle.
  ///
  /// In nl, this message translates to:
  /// **'Vak {number}'**
  String compartmentTitle(int number);

  /// No description provided for @temperature.
  ///
  /// In nl, this message translates to:
  /// **'{type, select, warm{Warm} cold{Koud} neutral{Neutraal} other{{type}}}'**
  String temperature(String type);

  /// No description provided for @locked.
  ///
  /// In nl, this message translates to:
  /// **'Op slot'**
  String get locked;

  /// No description provided for @unlocked.
  ///
  /// In nl, this message translates to:
  /// **'Ontgrendeld'**
  String get unlocked;

  /// No description provided for @lidOpen.
  ///
  /// In nl, this message translates to:
  /// **'Deksel open'**
  String get lidOpen;

  /// No description provided for @filled.
  ///
  /// In nl, this message translates to:
  /// **'Gevuld'**
  String get filled;

  /// No description provided for @empty.
  ///
  /// In nl, this message translates to:
  /// **'Leeg'**
  String get empty;

  /// No description provided for @markLoaded.
  ///
  /// In nl, this message translates to:
  /// **'Geladen: deksel dicht en vertrekken'**
  String get markLoaded;

  /// No description provided for @closeLid.
  ///
  /// In nl, this message translates to:
  /// **'Deksel dicht'**
  String get closeLid;

  /// No description provided for @scenarios.
  ///
  /// In nl, this message translates to:
  /// **'Scenario\'s'**
  String get scenarios;

  /// No description provided for @scenarioArrived.
  ///
  /// In nl, this message translates to:
  /// **'Aangekomen'**
  String get scenarioArrived;

  /// No description provided for @scenarioTilted.
  ///
  /// In nl, this message translates to:
  /// **'Gekanteld'**
  String get scenarioTilted;

  /// No description provided for @scenarioStuck.
  ///
  /// In nl, this message translates to:
  /// **'Vastgelopen'**
  String get scenarioStuck;

  /// No description provided for @scenarioLifted.
  ///
  /// In nl, this message translates to:
  /// **'Opgetild (diefstal)'**
  String get scenarioLifted;

  /// No description provided for @scenarioPackageTaken.
  ///
  /// In nl, this message translates to:
  /// **'Pakketje genomen'**
  String get scenarioPackageTaken;

  /// No description provided for @recover.
  ///
  /// In nl, this message translates to:
  /// **'Hersteld'**
  String get recover;

  /// No description provided for @weather.
  ///
  /// In nl, this message translates to:
  /// **'Weer'**
  String get weather;

  /// No description provided for @weatherMild.
  ///
  /// In nl, this message translates to:
  /// **'Zacht'**
  String get weatherMild;

  /// No description provided for @weatherCold.
  ///
  /// In nl, this message translates to:
  /// **'Koud'**
  String get weatherCold;

  /// No description provided for @weatherFrost.
  ///
  /// In nl, this message translates to:
  /// **'Vorst'**
  String get weatherFrost;

  /// No description provided for @kindFood.
  ///
  /// In nl, this message translates to:
  /// **'Voedingsrobot'**
  String get kindFood;

  /// No description provided for @kindParcel.
  ///
  /// In nl, this message translates to:
  /// **'Pakketrobot'**
  String get kindParcel;

  /// No description provided for @gps.
  ///
  /// In nl, this message translates to:
  /// **'GPS'**
  String get gps;

  /// No description provided for @gpsOff.
  ///
  /// In nl, this message translates to:
  /// **'Echt'**
  String get gpsOff;

  /// No description provided for @gpsNoise.
  ///
  /// In nl, this message translates to:
  /// **'Ruis'**
  String get gpsNoise;

  /// No description provided for @gpsRandom.
  ///
  /// In nl, this message translates to:
  /// **'Willekeurig'**
  String get gpsRandom;

  /// No description provided for @pinLabel.
  ///
  /// In nl, this message translates to:
  /// **'Pincode van de klant'**
  String get pinLabel;

  /// No description provided for @pinOpen.
  ///
  /// In nl, this message translates to:
  /// **'Open het vak'**
  String get pinOpen;

  /// No description provided for @pinWrong.
  ///
  /// In nl, this message translates to:
  /// **'Foute pincode, of te veel pogingen.'**
  String get pinWrong;

  /// No description provided for @hintPin.
  ///
  /// In nl, this message translates to:
  /// **'De klant tikt zijn pincode hieronder in om het vak te openen.'**
  String get hintPin;

  /// No description provided for @addRobot.
  ///
  /// In nl, this message translates to:
  /// **'Robot toevoegen'**
  String get addRobot;

  /// No description provided for @addRobotTitle.
  ///
  /// In nl, this message translates to:
  /// **'Nog een robot'**
  String get addRobotTitle;

  /// No description provided for @demoKind.
  ///
  /// In nl, this message translates to:
  /// **'Soort robot'**
  String get demoKind;

  /// No description provided for @demoKindFood.
  ///
  /// In nl, this message translates to:
  /// **'Voeding'**
  String get demoKindFood;

  /// No description provided for @demoKindParcelSmall.
  ///
  /// In nl, this message translates to:
  /// **'Pakket klein'**
  String get demoKindParcelSmall;

  /// No description provided for @demoKindParcelLarge.
  ///
  /// In nl, this message translates to:
  /// **'Pakket groot'**
  String get demoKindParcelLarge;

  /// No description provided for @demoPin.
  ///
  /// In nl, this message translates to:
  /// **'Openen met pincode (1234)'**
  String get demoPin;

  /// No description provided for @cancel.
  ///
  /// In nl, this message translates to:
  /// **'Annuleren'**
  String get cancel;

  /// No description provided for @add.
  ///
  /// In nl, this message translates to:
  /// **'Toevoegen'**
  String get add;

  /// No description provided for @compartmentSize.
  ///
  /// In nl, this message translates to:
  /// **'{width} × {height} × {depth} mm'**
  String compartmentSize(int width, int height, int depth);

  /// No description provided for @timeFactor.
  ///
  /// In nl, this message translates to:
  /// **'Tijd'**
  String get timeFactor;

  /// No description provided for @sensors.
  ///
  /// In nl, this message translates to:
  /// **'Sensoren van de gsm gebruiken'**
  String get sensors;

  /// No description provided for @sensorsHint.
  ///
  /// In nl, this message translates to:
  /// **'Kantelen en schudden worden echte incidenten.'**
  String get sensorsHint;

  /// No description provided for @sensorsUnavailable.
  ///
  /// In nl, this message translates to:
  /// **'Dit toestel heeft geen bewegingssensoren.'**
  String get sensorsUnavailable;

  /// No description provided for @demoPanel.
  ///
  /// In nl, this message translates to:
  /// **'Demo: speel het platform'**
  String get demoPanel;

  /// No description provided for @sendUnlock.
  ///
  /// In nl, this message translates to:
  /// **'Open vak {number}'**
  String sendUnlock(int number);

  /// No description provided for @sendStop.
  ///
  /// In nl, this message translates to:
  /// **'Stop'**
  String get sendStop;

  /// No description provided for @sendReturn.
  ///
  /// In nl, this message translates to:
  /// **'Terugsturen'**
  String get sendReturn;

  /// No description provided for @sendBeep.
  ///
  /// In nl, this message translates to:
  /// **'Piep'**
  String get sendBeep;

  /// No description provided for @newTrip.
  ///
  /// In nl, this message translates to:
  /// **'Nieuwe rit'**
  String get newTrip;

  /// No description provided for @logTitle.
  ///
  /// In nl, this message translates to:
  /// **'Logboek'**
  String get logTitle;

  /// No description provided for @logEntry.
  ///
  /// In nl, this message translates to:
  /// **'{kind, select, tripReceived{Nieuwe rit ontvangen} arrivedPickup{Aangekomen bij de zaak} arrivedDropoff{Aangekomen bij de klant} loaded{Geladen in vak {detail}} delivered{Geleverd} command{Commando: {detail}} event{Gemeld: {detail}} recovered{Hersteld, de robot gaat verder} returnedHome{Terug in het station} apiError{Geen verbinding met het platform} apiRestored{Verbinding hersteld} pinAccepted{Pincode aanvaard} pinRejected{Foute pincode} other{{kind}}}'**
  String logEntry(String kind, String detail);

  /// No description provided for @apiErrorBanner.
  ///
  /// In nl, this message translates to:
  /// **'Geen verbinding met het platform. De robot blijft het proberen.'**
  String get apiErrorBanner;

  /// No description provided for @pairTitle.
  ///
  /// In nl, this message translates to:
  /// **'Automatisch koppelen'**
  String get pairTitle;

  /// No description provided for @pairSellerApi.
  ///
  /// In nl, this message translates to:
  /// **'Verkopers-API'**
  String get pairSellerApi;

  /// No description provided for @pairSellerApiHint.
  ///
  /// In nl, this message translates to:
  /// **'Het adres van de API van de verkopers-PWA. Een nieuwe robot daar komt hier vanzelf aan.'**
  String get pairSellerApiHint;

  /// No description provided for @pairWaiting.
  ///
  /// In nl, this message translates to:
  /// **'Wachten op een robot van de verkopers-PWA…'**
  String get pairWaiting;

  /// No description provided for @pairCode.
  ///
  /// In nl, this message translates to:
  /// **'Code: {code}'**
  String pairCode(String code);

  /// No description provided for @pairReceived.
  ///
  /// In nl, this message translates to:
  /// **'Sleutel van {name} ontvangen. Tik op Start.'**
  String pairReceived(String name);

  /// No description provided for @pairUnreachable.
  ///
  /// In nl, this message translates to:
  /// **'De verkopers-API is niet bereikbaar. Vul de sleutel zelf in.'**
  String get pairUnreachable;

  /// No description provided for @pairAdded.
  ///
  /// In nl, this message translates to:
  /// **'{name} is toegevoegd aan de robots.'**
  String pairAdded(String name);
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['de', 'en', 'fr', 'nl'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'de':
      return AppLocalizationsDe();
    case 'en':
      return AppLocalizationsEn();
    case 'fr':
      return AppLocalizationsFr();
    case 'nl':
      return AppLocalizationsNl();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
