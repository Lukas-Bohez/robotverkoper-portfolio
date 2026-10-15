// ignore: unused_import
import 'package:intl/intl.dart' as intl;

import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for French (`fr`).
class AppLocalizationsFr extends AppLocalizations {
  AppLocalizationsFr([String locale = 'fr']) : super(locale);

  @override
  String get appTitle => 'Delivery robot';

  @override
  String get language => 'Langue';

  @override
  String get connectTitle => 'Ce téléphone devient un robot de livraison';

  @override
  String get connectIntro =>
      'Pose le téléphone à plat, écran vers le haut : c\'est le robot. Basculer, secouer ou soulever le téléphone devient un incident sur la plateforme.';

  @override
  String get connectTitleDesktop =>
      'Cet ordinateur joue le rôle d\'un robot de livraison';

  @override
  String get connectIntroDesktop =>
      'Un ordinateur n\'a pas de capteurs de mouvement : les boutons de scénario simulent le basculement, les secousses et le soulèvement. Sur un téléphone, c\'est le téléphone lui-même qui devient le robot.';

  @override
  String get modeDemo => 'Démo';

  @override
  String get modeDemoHint =>
      'Sans plateforme : l\'application simule elle-même l\'API, avec un trajet autour du campus Howest.';

  @override
  String get modeApi => 'Plateforme';

  @override
  String get apiUrl => 'Point d\'accès GraphQL de l\'API';

  @override
  String get apiKey => 'Clé API du robot';

  @override
  String get apiKeyHint =>
      'Tu la reçois de l\'administrateur de la plateforme lorsqu\'il crée le robot.';

  @override
  String get robotName => 'Nom du robot';

  @override
  String get robotNameRequired => 'Donne un nom au robot.';

  @override
  String get apiUrlInvalid =>
      'Saisis une adresse complète, p. ex. http://localhost:3000/graphql.';

  @override
  String get apiKeyRequired => 'Saisis la clé API du robot.';

  @override
  String get start => 'Démarrer le robot';

  @override
  String get stopRobot => 'Arrêter le robot';

  @override
  String statusLabel(String status) {
    String _temp0 = intl.Intl.selectLogic(status, {
      'available': 'Disponible',
      'toPickup': 'En route vers le commerce',
      'loading': 'Attend le chargement au commerce',
      'onRoute': 'En route vers le client',
      'atDropoff': 'Chez le client',
      'returning': 'Retour à la station',
      'charging': 'En charge',
      'stuck': 'Bloqué',
      'defect': 'En panne',
      'alarm': 'Alarme',
      'offline': 'Hors ligne',
      'manualOverride': 'Repris par le technicien',
      'other': '$status',
    });
    return '$_temp0';
  }

  @override
  String get whatNow => 'Et maintenant ?';

  @override
  String get unlockByCustomer => 'Le client ouvre le compartiment';

  @override
  String statusHint(String status) {
    String _temp0 = intl.Intl.selectLogic(status, {
      'available': 'En attente d\'une commande. Dans la démo, tu lances un trajet ci-dessous.',
      'toPickup':
          'Le robot roule vers le commerce. « Arrivé » saute le trajet.',
      'loading': 'Le commerce met la commande dans le compartiment. Appuie ensuite sur le bouton.',
      'onRoute': 'Le robot roule vers le client.',
      'atDropoff': 'Le client ouvre le compartiment dans l\'appli. Ensuite le couvercle se ferme.',
      'returning': 'Le robot retourne à la station.',
      'stuck':
          'Il y a un problème. Un technicien le résout : appuie sur Réparé.',
      'defect':
          'Il y a un problème. Un technicien le résout : appuie sur Réparé.',
      'alarm':
          'Il y a un problème. Un technicien le résout : appuie sur Réparé.',
      'manualOverride':
          'Il y a un problème. Un technicien le résout : appuie sur Réparé.',
      'other': '',
    });
    return '$_temp0';
  }

  @override
  String battery(int percent) {
    return 'Batterie $percent %';
  }

  @override
  String remaining(int metres) {
    return 'Encore $metres m';
  }

  @override
  String get noTrip => 'Pas de trajet. Le robot attend une commande.';

  @override
  String get compartments => 'Compartiment';

  @override
  String compartmentTitle(int number) {
    return 'Compartiment $number';
  }

  @override
  String temperature(String type) {
    String _temp0 = intl.Intl.selectLogic(type, {
      'warm': 'Chaud',
      'cold': 'Froid',
      'neutral': 'Neutre',
      'other': '$type',
    });
    return '$_temp0';
  }

  @override
  String get locked => 'Verrouillé';

  @override
  String get unlocked => 'Déverrouillé';

  @override
  String get lidOpen => 'Couvercle ouvert';

  @override
  String get filled => 'Rempli';

  @override
  String get empty => 'Vide';

  @override
  String get markLoaded => 'Chargé : fermer le couvercle et partir';

  @override
  String get closeLid => 'Fermer le couvercle';

  @override
  String get scenarios => 'Scénarios';

  @override
  String get scenarioArrived => 'Arrivé';

  @override
  String get scenarioTilted => 'Basculé';

  @override
  String get scenarioStuck => 'Bloqué';

  @override
  String get scenarioLifted => 'Soulevé (vol)';

  @override
  String get scenarioPackageTaken => 'Colis retiré';

  @override
  String get recover => 'Rétabli';

  @override
  String get weather => 'Météo';

  @override
  String get weatherMild => 'Doux';

  @override
  String get weatherCold => 'Froid';

  @override
  String get weatherFrost => 'Gel';

  @override
  String get kindFood => 'Robot alimentaire';

  @override
  String get kindParcel => 'Robot colis';

  @override
  String get gps => 'GPS';

  @override
  String get gpsOff => 'Réel';

  @override
  String get gpsNoise => 'Bruit';

  @override
  String get gpsRandom => 'Aléatoire';

  @override
  String get pinLabel => 'Code PIN du client';

  @override
  String get pinOpen => 'Ouvrir le compartiment';

  @override
  String get pinWrong => 'Mauvais code PIN, ou trop d\'essais.';

  @override
  String get hintPin =>
      'Le client tape son code PIN ci-dessous pour ouvrir le compartiment.';

  @override
  String get addRobot => 'Ajouter un robot';

  @override
  String get addRobotTitle => 'Un autre robot';

  @override
  String get demoKind => 'Type de robot';

  @override
  String get demoKindFood => 'Alimentaire';

  @override
  String get demoKindParcelSmall => 'Colis petit';

  @override
  String get demoKindParcelLarge => 'Colis grand';

  @override
  String get demoPin => 'Ouvrir avec un code PIN (1234)';

  @override
  String get cancel => 'Annuler';

  @override
  String get add => 'Ajouter';

  @override
  String compartmentSize(int width, int height, int depth) {
    return '$width × $height × $depth mm';
  }

  @override
  String get timeFactor => 'Temps';

  @override
  String get sensors => 'Utiliser les capteurs du téléphone';

  @override
  String get sensorsHint =>
      'Basculer et secouer deviennent de vrais incidents.';

  @override
  String get sensorsUnavailable =>
      'Cet appareil n\'a pas de capteurs de mouvement.';

  @override
  String get demoPanel => 'Démo : jouer la plateforme';

  @override
  String sendUnlock(int number) {
    return 'Ouvrir le compartiment $number';
  }

  @override
  String get sendStop => 'Stop';

  @override
  String get sendReturn => 'Renvoyer';

  @override
  String get sendBeep => 'Bip';

  @override
  String get newTrip => 'Nouveau trajet';

  @override
  String get logTitle => 'Journal';

  @override
  String logEntry(String kind, String detail) {
    String _temp0 = intl.Intl.selectLogic(kind, {
      'tripReceived': 'Nouveau trajet reçu',
      'arrivedPickup': 'Arrivé au commerce',
      'arrivedDropoff': 'Arrivé chez le client',
      'loaded': 'Chargé dans le compartiment $detail',
      'delivered': 'Livré',
      'command': 'Commande : $detail',
      'event': 'Signalé : $detail',
      'recovered': 'Rétabli, le robot repart',
      'returnedHome': 'De retour à la station',
      'apiError': 'Pas de connexion à la plateforme',
      'apiRestored': 'Connexion rétablie',
      'pinAccepted': 'Code PIN accepté',
      'pinRejected': 'Mauvais code PIN',
      'other': '$kind',
    });
    return '$_temp0';
  }

  @override
  String get apiErrorBanner =>
      'Pas de connexion à la plateforme. Le robot continue d\'essayer.';
}
