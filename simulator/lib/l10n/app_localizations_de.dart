// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for German (`de`).
class AppLocalizationsDe extends AppLocalizations {
  AppLocalizationsDe([String locale = 'de']) : super(locale);

  @override
  String get appTitle => 'Delivery robot';

  @override
  String get language => 'Sprache';

  @override
  String get connectTitle => 'Dieses Handy wird ein Lieferroboter';

  @override
  String get connectIntro =>
      'Leg das Handy flach hin, mit dem Bildschirm nach oben: das ist der Roboter. Kippen, Schütteln und Hochheben werden zu Vorfällen auf der Plattform.';

  @override
  String get connectTitleDesktop => 'Dieser Computer spielt den Lieferroboter';

  @override
  String get connectIntroDesktop =>
      'Ein Computer hat keine Bewegungssensoren: Die Szenario-Knöpfe spielen Kippen, Schütteln und Hochheben nach. Auf einem Handy wird das Handy selbst zum Roboter.';

  @override
  String get modeDemo => 'Demo';

  @override
  String get modeDemoHint =>
      'Ohne Plattform: Die App spielt die API selbst nach, mit einer Fahrt rund um den Howest-Campus.';

  @override
  String get modeApi => 'Plattform';

  @override
  String get apiUrl => 'GraphQL-Endpunkt der API';

  @override
  String get apiKey => 'API-Schlüssel des Roboters';

  @override
  String get apiKeyHint =>
      'Den bekommst du vom Plattform-Admin, wenn er den Roboter anlegt.';

  @override
  String get robotName => 'Name des Roboters';

  @override
  String get robotNameRequired => 'Gib dem Roboter einen Namen.';

  @override
  String get apiUrlInvalid =>
      'Gib eine vollständige Adresse ein, z. B. http://localhost:3000/graphql.';

  @override
  String get apiKeyRequired => 'Gib den API-Schlüssel des Roboters ein.';

  @override
  String get start => 'Roboter starten';

  @override
  String get stopRobot => 'Roboter stoppen';

  @override
  String statusLabel(String status) {
    String _temp0 = intl.Intl.selectLogic(status, {
      'available': 'Verfügbar',
      'toPickup': 'Unterwegs zum Geschäft',
      'loading': 'Wartet auf das Beladen',
      'onRoute': 'Unterwegs zum Kunden',
      'atDropoff': 'Beim Kunden',
      'returning': 'Zurück zur Station',
      'charging': 'Wird geladen',
      'stuck': 'Steckengeblieben',
      'defect': 'Defekt',
      'alarm': 'Alarm',
      'offline': 'Offline',
      'manualOverride': 'Vom Techniker übernommen',
      'other': '$status',
    });
    return '$_temp0';
  }

  @override
  String get whatNow => 'Was jetzt?';

  @override
  String get unlockByCustomer => 'Der Kunde öffnet das Fach';

  @override
  String statusHint(String status) {
    String _temp0 = intl.Intl.selectLogic(status, {
      'available': 'Wartet auf eine Bestellung. In der Demo startest du unten eine Fahrt.',
      'toPickup': 'Der Roboter fährt zum Geschäft. Mit „Angekommen“ überspringst du die Fahrt.',
      'loading': 'Das Geschäft legt die Bestellung ins Fach. Drücke danach auf den Knopf.',
      'onRoute': 'Der Roboter fährt zum Kunden.',
      'atDropoff': 'Der Kunde öffnet das Fach in der App. Danach schließt sich der Deckel.',
      'returning': 'Der Roboter fährt zurück zur Station.',
      'stuck':
          'Es gibt ein Problem. Ein Techniker löst es: drücke auf Behoben.',
      'defect':
          'Es gibt ein Problem. Ein Techniker löst es: drücke auf Behoben.',
      'alarm':
          'Es gibt ein Problem. Ein Techniker löst es: drücke auf Behoben.',
      'manualOverride':
          'Es gibt ein Problem. Ein Techniker löst es: drücke auf Behoben.',
      'other': '',
    });
    return '$_temp0';
  }

  @override
  String battery(int percent) {
    return 'Akku $percent %';
  }

  @override
  String remaining(int metres) {
    return 'Noch $metres m';
  }

  @override
  String get noTrip => 'Keine Fahrt. Der Roboter wartet auf eine Bestellung.';

  @override
  String get compartments => 'Fach';

  @override
  String compartmentTitle(int number) {
    return 'Fach $number';
  }

  @override
  String temperature(String type) {
    String _temp0 = intl.Intl.selectLogic(type, {
      'warm': 'Warm',
      'cold': 'Kalt',
      'neutral': 'Neutral',
      'other': '$type',
    });
    return '$_temp0';
  }

  @override
  String get locked => 'Verriegelt';

  @override
  String get unlocked => 'Entriegelt';

  @override
  String get lidOpen => 'Deckel offen';

  @override
  String get filled => 'Gefüllt';

  @override
  String get empty => 'Leer';

  @override
  String get markLoaded => 'Beladen: Deckel schließen und losfahren';

  @override
  String get closeLid => 'Deckel schließen';

  @override
  String get scenarios => 'Szenarien';

  @override
  String get scenarioArrived => 'Angekommen';

  @override
  String get scenarioTilted => 'Gekippt';

  @override
  String get scenarioStuck => 'Steckengeblieben';

  @override
  String get scenarioLifted => 'Hochgehoben (Diebstahl)';

  @override
  String get scenarioPackageTaken => 'Paket entnommen';

  @override
  String get recover => 'Behoben';

  @override
  String get weather => 'Wetter';

  @override
  String get weatherMild => 'Mild';

  @override
  String get weatherCold => 'Kalt';

  @override
  String get weatherFrost => 'Frost';

  @override
  String get kindFood => 'Essensroboter';

  @override
  String get kindParcel => 'Paketroboter';

  @override
  String get gps => 'GPS';

  @override
  String get gpsOff => 'Echt';

  @override
  String get gpsNoise => 'Rauschen';

  @override
  String get gpsRandom => 'Zufällig';

  @override
  String get pinLabel => 'PIN des Kunden';

  @override
  String get pinOpen => 'Fach öffnen';

  @override
  String get pinWrong => 'Falsche PIN, oder zu viele Versuche.';

  @override
  String get hintPin =>
      'Der Kunde gibt unten seine PIN ein, um das Fach zu öffnen.';

  @override
  String get addRobot => 'Roboter hinzufügen';

  @override
  String get addRobotTitle => 'Noch ein Roboter';

  @override
  String get demoKind => 'Art des Roboters';

  @override
  String get demoKindFood => 'Essen';

  @override
  String get demoKindParcelSmall => 'Paket klein';

  @override
  String get demoKindParcelLarge => 'Paket groß';

  @override
  String get demoPin => 'Mit PIN öffnen (1234)';

  @override
  String get cancel => 'Abbrechen';

  @override
  String get add => 'Hinzufügen';

  @override
  String compartmentSize(int width, int height, int depth) {
    return '$width × $height × $depth mm';
  }

  @override
  String get timeFactor => 'Zeit';

  @override
  String get sensors => 'Sensoren des Handys verwenden';

  @override
  String get sensorsHint => 'Kippen und Schütteln werden zu echten Vorfällen.';

  @override
  String get sensorsUnavailable => 'Dieses Gerät hat keine Bewegungssensoren.';

  @override
  String get demoPanel => 'Demo: die Plattform spielen';

  @override
  String sendUnlock(int number) {
    return 'Fach $number öffnen';
  }

  @override
  String get sendStop => 'Stopp';

  @override
  String get sendReturn => 'Zurückschicken';

  @override
  String get sendBeep => 'Piepton';

  @override
  String get newTrip => 'Neue Fahrt';

  @override
  String get logTitle => 'Protokoll';

  @override
  String logEntry(String kind, String detail) {
    String _temp0 = intl.Intl.selectLogic(kind, {
      'tripReceived': 'Neue Fahrt erhalten',
      'arrivedPickup': 'Beim Geschäft angekommen',
      'arrivedDropoff': 'Beim Kunden angekommen',
      'loaded': 'In Fach $detail geladen',
      'delivered': 'Geliefert',
      'command': 'Befehl: $detail',
      'event': 'Gemeldet: $detail',
      'recovered': 'Behoben, der Roboter fährt weiter',
      'returnedHome': 'Zurück in der Station',
      'apiError': 'Keine Verbindung zur Plattform',
      'apiRestored': 'Verbindung wiederhergestellt',
      'pinAccepted': 'PIN akzeptiert',
      'pinRejected': 'Falsche PIN',
      'other': '$kind',
    });
    return '$_temp0';
  }

  @override
  String get apiErrorBanner =>
      'Keine Verbindung zur Plattform. Der Roboter versucht es weiter.';

  @override
  String get pairTitle => 'Automatisch koppeln';

  @override
  String get pairSellerApi => 'Verkäufer-API';

  @override
  String get pairSellerApiHint =>
      'Die Adresse der API der Verkäufer-PWA. Ein dort angelegter neuer Roboter kommt hier von selbst an.';

  @override
  String get pairWaiting => 'Warten auf einen Roboter aus der Verkäufer-PWA…';

  @override
  String pairCode(String code) {
    return 'Code: $code';
  }

  @override
  String pairReceived(String name) {
    return 'Schlüssel von $name erhalten. Tippe auf Start.';
  }

  @override
  String get pairUnreachable =>
      'Die Verkäufer-API ist nicht erreichbar. Gib den Schlüssel selbst ein.';

  @override
  String pairAdded(String name) {
    return '$name wurde zu den Robotern hinzugefügt.';
  }
}
