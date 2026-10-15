// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'Delivery robot';

  @override
  String get language => 'Language';

  @override
  String get connectTitle => 'This phone becomes a delivery robot';

  @override
  String get connectIntro =>
      'Lay the phone flat, screen up: that is the robot. Tilting, shaking and lifting it become incidents on the platform.';

  @override
  String get connectTitleDesktop => 'This computer plays a delivery robot';

  @override
  String get connectIntroDesktop =>
      'A computer has no motion sensors: the scenario buttons play tilting, shaking and lifting. On a phone, the phone itself becomes the robot.';

  @override
  String get modeDemo => 'Demo';

  @override
  String get modeDemoHint =>
      'Without the platform: the app plays the API itself, with a trip around the Howest campus.';

  @override
  String get modeApi => 'Platform';

  @override
  String get apiUrl => 'GraphQL endpoint of the API';

  @override
  String get apiKey => 'API key of the robot';

  @override
  String get apiKeyHint =>
      'You get it from the platform admin when the robot is created.';

  @override
  String get robotName => 'Robot name';

  @override
  String get robotNameRequired => 'Give the robot a name.';

  @override
  String get apiUrlInvalid =>
      'Enter a full address, e.g. http://localhost:3000/graphql.';

  @override
  String get apiKeyRequired => 'Enter the API key of the robot.';

  @override
  String get start => 'Start the robot';

  @override
  String get stopRobot => 'Stop the robot';

  @override
  String statusLabel(String status) {
    String _temp0 = intl.Intl.selectLogic(status, {
      'available': 'Available',
      'toPickup': 'On the way to the shop',
      'loading': 'Waiting for the shop to load',
      'onRoute': 'On the way to the customer',
      'atDropoff': 'At the customer',
      'returning': 'Back to the station',
      'charging': 'Charging',
      'stuck': 'Stuck',
      'defect': 'Defect',
      'alarm': 'Alarm',
      'offline': 'Offline',
      'manualOverride': 'Taken over by the technician',
      'other': '$status',
    });
    return '$_temp0';
  }

  @override
  String get whatNow => 'What now?';

  @override
  String get unlockByCustomer => 'The customer opens the compartment';

  @override
  String statusHint(String status) {
    String _temp0 = intl.Intl.selectLogic(status, {
      'available': 'Waiting for an order. In the demo you start a trip below.',
      'toPickup':
          'The robot drives to the shop. \'Arrived\' skips the driving.',
      'loading':
          'The shop puts the order in the compartment. Then press the button.',
      'onRoute': 'The robot drives to the customer.',
      'atDropoff':
          'The customer opens the compartment in the app. Then the lid closes.',
      'returning': 'The robot drives back to the station.',
      'stuck': 'There is a problem. A technician solves it: press Recovered.',
      'defect': 'There is a problem. A technician solves it: press Recovered.',
      'alarm': 'There is a problem. A technician solves it: press Recovered.',
      'manualOverride':
          'There is a problem. A technician solves it: press Recovered.',
      'other': '',
    });
    return '$_temp0';
  }

  @override
  String battery(int percent) {
    return 'Battery $percent%';
  }

  @override
  String remaining(int metres) {
    return '$metres m to go';
  }

  @override
  String get noTrip => 'No trip. The robot is waiting for an order.';

  @override
  String get compartments => 'Compartment';

  @override
  String compartmentTitle(int number) {
    return 'Compartment $number';
  }

  @override
  String temperature(String type) {
    String _temp0 = intl.Intl.selectLogic(type, {
      'warm': 'Warm',
      'cold': 'Cold',
      'neutral': 'Neutral',
      'other': '$type',
    });
    return '$_temp0';
  }

  @override
  String get locked => 'Locked';

  @override
  String get unlocked => 'Unlocked';

  @override
  String get lidOpen => 'Lid open';

  @override
  String get filled => 'Filled';

  @override
  String get empty => 'Empty';

  @override
  String get markLoaded => 'Loaded: close the lid and go';

  @override
  String get closeLid => 'Close the lid';

  @override
  String get scenarios => 'Scenarios';

  @override
  String get scenarioArrived => 'Arrived';

  @override
  String get scenarioTilted => 'Tilted';

  @override
  String get scenarioStuck => 'Stuck';

  @override
  String get scenarioLifted => 'Lifted (theft)';

  @override
  String get scenarioPackageTaken => 'Package taken';

  @override
  String get recover => 'Recovered';

  @override
  String get weather => 'Weather';

  @override
  String get weatherMild => 'Mild';

  @override
  String get weatherCold => 'Cold';

  @override
  String get weatherFrost => 'Frost';

  @override
  String get kindFood => 'Food robot';

  @override
  String get kindParcel => 'Parcel robot';

  @override
  String get gps => 'GPS';

  @override
  String get gpsOff => 'Real';

  @override
  String get gpsNoise => 'Noise';

  @override
  String get gpsRandom => 'Random';

  @override
  String get pinLabel => 'The customer\'s PIN';

  @override
  String get pinOpen => 'Open the compartment';

  @override
  String get pinWrong => 'Wrong PIN, or too many tries.';

  @override
  String get hintPin =>
      'The customer types their PIN below to open the compartment.';

  @override
  String get addRobot => 'Add a robot';

  @override
  String get addRobotTitle => 'Another robot';

  @override
  String get demoKind => 'Kind of robot';

  @override
  String get demoKindFood => 'Food';

  @override
  String get demoKindParcelSmall => 'Parcel small';

  @override
  String get demoKindParcelLarge => 'Parcel large';

  @override
  String get demoPin => 'Open with a PIN (1234)';

  @override
  String get cancel => 'Cancel';

  @override
  String get add => 'Add';

  @override
  String compartmentSize(int width, int height, int depth) {
    return '$width × $height × $depth mm';
  }

  @override
  String get timeFactor => 'Time';

  @override
  String get sensors => 'Use the phone\'s sensors';

  @override
  String get sensorsHint => 'Tilting and shaking become real incidents.';

  @override
  String get sensorsUnavailable => 'This device has no motion sensors.';

  @override
  String get demoPanel => 'Demo: play the platform';

  @override
  String sendUnlock(int number) {
    return 'Open compartment $number';
  }

  @override
  String get sendStop => 'Stop';

  @override
  String get sendReturn => 'Send back';

  @override
  String get sendBeep => 'Beep';

  @override
  String get newTrip => 'New trip';

  @override
  String get logTitle => 'Log';

  @override
  String logEntry(String kind, String detail) {
    String _temp0 = intl.Intl.selectLogic(kind, {
      'tripReceived': 'New trip received',
      'arrivedPickup': 'Arrived at the shop',
      'arrivedDropoff': 'Arrived at the customer',
      'loaded': 'Loaded in compartment $detail',
      'delivered': 'Delivered',
      'command': 'Command: $detail',
      'event': 'Reported: $detail',
      'recovered': 'Recovered, the robot continues',
      'returnedHome': 'Back at the station',
      'apiError': 'No connection with the platform',
      'apiRestored': 'Connection restored',
      'pinAccepted': 'PIN accepted',
      'pinRejected': 'Wrong PIN',
      'other': '$kind',
    });
    return '$_temp0';
  }

  @override
  String get apiErrorBanner =>
      'No connection with the platform. The robot keeps trying.';
}
