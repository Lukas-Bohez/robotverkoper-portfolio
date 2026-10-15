// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Dutch Flemish (`nl`).
class AppLocalizationsNl extends AppLocalizations {
  AppLocalizationsNl([String locale = 'nl']) : super(locale);

  @override
  String get appTitle => 'Delivery robot';

  @override
  String get language => 'Taal';

  @override
  String get connectTitle => 'Deze gsm wordt een bezorgrobot';

  @override
  String get connectIntro =>
      'Leg de gsm plat neer, met het scherm naar boven: dat is de robot. Kantelen, schudden en optillen worden incidenten op het platform.';

  @override
  String get connectTitleDesktop => 'Deze computer speelt een bezorgrobot';

  @override
  String get connectIntroDesktop =>
      'Een computer heeft geen bewegingssensoren: de scenarioknoppen spelen kantelen, schudden en optillen na. Op een gsm wordt de gsm zelf de robot.';

  @override
  String get modeDemo => 'Demo';

  @override
  String get modeDemoHint =>
      'Zonder platform: de app speelt zelf de API na, met een rit rond de Howest-campus.';

  @override
  String get modeApi => 'Platform';

  @override
  String get apiUrl => 'GraphQL-endpoint van de API';

  @override
  String get apiKey => 'API-key van de robot';

  @override
  String get apiKeyHint =>
      'Die krijg je van de platform-admin als hij de robot aanmaakt.';

  @override
  String get robotName => 'Naam van de robot';

  @override
  String get robotNameRequired => 'Geef de robot een naam.';

  @override
  String get apiUrlInvalid =>
      'Vul een volledig adres in, bv. http://localhost:3000/graphql.';

  @override
  String get apiKeyRequired => 'Vul de API-key van de robot in.';

  @override
  String get start => 'Start de robot';

  @override
  String get stopRobot => 'Robot stoppen';

  @override
  String statusLabel(String status) {
    String _temp0 = intl.Intl.selectLogic(status, {
      'available': 'Beschikbaar',
      'toPickup': 'Onderweg naar de zaak',
      'loading': 'Wacht tot de zaak laadt',
      'onRoute': 'Onderweg naar de klant',
      'atDropoff': 'Bij de klant',
      'returning': 'Terug naar het station',
      'charging': 'Aan het opladen',
      'stuck': 'Vastgelopen',
      'defect': 'Defect',
      'alarm': 'Alarm',
      'offline': 'Offline',
      'manualOverride': 'Overgenomen door de technieker',
      'other': '$status',
    });
    return '$_temp0';
  }

  @override
  String get whatNow => 'Wat nu?';

  @override
  String get unlockByCustomer => 'De klant opent het vak';

  @override
  String statusHint(String status) {
    String _temp0 = intl.Intl.selectLogic(status, {
      'available':
          'Wacht op een bestelling. In de demo start je hieronder een rit.',
      'toPickup': 'De robot rijdt naar de zaak. Met \'Aangekomen\' sla je het rijden over.',
      'loading':
          'De zaak legt de bestelling in het vak. Druk daarna op de knop.',
      'onRoute': 'De robot rijdt naar de klant.',
      'atDropoff':
          'De klant opent het vak in de app. Daarna gaat het deksel dicht.',
      'returning': 'De robot rijdt terug naar het station.',
      'stuck':
          'Er is een probleem. Een technieker lost het op: druk op Hersteld.',
      'defect':
          'Er is een probleem. Een technieker lost het op: druk op Hersteld.',
      'alarm':
          'Er is een probleem. Een technieker lost het op: druk op Hersteld.',
      'manualOverride':
          'Er is een probleem. Een technieker lost het op: druk op Hersteld.',
      'other': '',
    });
    return '$_temp0';
  }

  @override
  String battery(int percent) {
    return 'Batterij $percent%';
  }

  @override
  String remaining(int metres) {
    return 'Nog $metres m';
  }

  @override
  String get noTrip => 'Geen rit. De robot wacht op een bestelling.';

  @override
  String get compartments => 'Vak';

  @override
  String compartmentTitle(int number) {
    return 'Vak $number';
  }

  @override
  String temperature(String type) {
    String _temp0 = intl.Intl.selectLogic(type, {
      'warm': 'Warm',
      'cold': 'Koud',
      'neutral': 'Neutraal',
      'other': '$type',
    });
    return '$_temp0';
  }

  @override
  String get locked => 'Op slot';

  @override
  String get unlocked => 'Ontgrendeld';

  @override
  String get lidOpen => 'Deksel open';

  @override
  String get filled => 'Gevuld';

  @override
  String get empty => 'Leeg';

  @override
  String get markLoaded => 'Geladen: deksel dicht en vertrekken';

  @override
  String get closeLid => 'Deksel dicht';

  @override
  String get scenarios => 'Scenario\'s';

  @override
  String get scenarioArrived => 'Aangekomen';

  @override
  String get scenarioTilted => 'Gekanteld';

  @override
  String get scenarioStuck => 'Vastgelopen';

  @override
  String get scenarioLifted => 'Opgetild (diefstal)';

  @override
  String get scenarioPackageTaken => 'Pakketje genomen';

  @override
  String get recover => 'Hersteld';

  @override
  String get weather => 'Weer';

  @override
  String get weatherMild => 'Zacht';

  @override
  String get weatherCold => 'Koud';

  @override
  String get weatherFrost => 'Vorst';

  @override
  String get kindFood => 'Voedingsrobot';

  @override
  String get kindParcel => 'Pakketrobot';

  @override
  String get gps => 'GPS';

  @override
  String get gpsOff => 'Echt';

  @override
  String get gpsNoise => 'Ruis';

  @override
  String get gpsRandom => 'Willekeurig';

  @override
  String get pinLabel => 'Pincode van de klant';

  @override
  String get pinOpen => 'Open het vak';

  @override
  String get pinWrong => 'Foute pincode, of te veel pogingen.';

  @override
  String get hintPin =>
      'De klant tikt zijn pincode hieronder in om het vak te openen.';

  @override
  String get addRobot => 'Robot toevoegen';

  @override
  String get addRobotTitle => 'Nog een robot';

  @override
  String get demoKind => 'Soort robot';

  @override
  String get demoKindFood => 'Voeding';

  @override
  String get demoKindParcelSmall => 'Pakket klein';

  @override
  String get demoKindParcelLarge => 'Pakket groot';

  @override
  String get demoPin => 'Openen met pincode (1234)';

  @override
  String get cancel => 'Annuleren';

  @override
  String get add => 'Toevoegen';

  @override
  String compartmentSize(int width, int height, int depth) {
    return '$width × $height × $depth mm';
  }

  @override
  String get timeFactor => 'Tijd';

  @override
  String get sensors => 'Sensoren van de gsm gebruiken';

  @override
  String get sensorsHint => 'Kantelen en schudden worden echte incidenten.';

  @override
  String get sensorsUnavailable => 'Dit toestel heeft geen bewegingssensoren.';

  @override
  String get demoPanel => 'Demo: speel het platform';

  @override
  String sendUnlock(int number) {
    return 'Open vak $number';
  }

  @override
  String get sendStop => 'Stop';

  @override
  String get sendReturn => 'Terugsturen';

  @override
  String get sendBeep => 'Piep';

  @override
  String get newTrip => 'Nieuwe rit';

  @override
  String get logTitle => 'Logboek';

  @override
  String logEntry(String kind, String detail) {
    String _temp0 = intl.Intl.selectLogic(kind, {
      'tripReceived': 'Nieuwe rit ontvangen',
      'arrivedPickup': 'Aangekomen bij de zaak',
      'arrivedDropoff': 'Aangekomen bij de klant',
      'loaded': 'Geladen in vak $detail',
      'delivered': 'Geleverd',
      'command': 'Commando: $detail',
      'event': 'Gemeld: $detail',
      'recovered': 'Hersteld, de robot gaat verder',
      'returnedHome': 'Terug in het station',
      'apiError': 'Geen verbinding met het platform',
      'apiRestored': 'Verbinding hersteld',
      'pinAccepted': 'Pincode aanvaard',
      'pinRejected': 'Foute pincode',
      'other': '$kind',
    });
    return '$_temp0';
  }

  @override
  String get apiErrorBanner =>
      'Geen verbinding met het platform. De robot blijft het proberen.';
}
