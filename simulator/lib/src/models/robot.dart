import 'geo.dart';

/// The states of a robot (contract #9: RobotStatus)
enum RobotStatus {
  available('AVAILABLE'),
  toPickup('TO_PICKUP'),
  loading('LOADING'),
  onRoute('ON_ROUTE'),
  atDropoff('AT_DROPOFF'),
  returning('RETURNING'),
  charging('CHARGING'),
  stuck('STUCK'),
  defect('DEFECT'),
  alarm('ALARM'),
  offline('OFFLINE'),
  manualOverride('MANUAL_OVERRIDE');

  const RobotStatus(this.apiName);
  final String apiName;

  /// Statuses in which the robot drives along its path
  bool get isMoving =>
      this == RobotStatus.toPickup ||
      this == RobotStatus.onRoute ||
      this == RobotStatus.returning;

  /// Statuses a technician has to look at
  bool get isProblem =>
      this == RobotStatus.stuck ||
      this == RobotStatus.defect ||
      this == RobotStatus.alarm;
}

/// The type of a compartment (contract #9: TemperatureType)
enum TemperatureType {
  warm('WARM'),
  cold('COLD'),
  neutral('NEUTRAL');

  const TemperatureType(this.apiName);
  final String apiName;

  static TemperatureType? fromApiName(String? name) {
    for (final type in values) {
      if (type.apiName == name) return type;
    }
    return null;
  }
}

/// Events the robot reports with its telemetry (contract #9)
enum TelemetryEvent {
  arrived('ARRIVED'),
  tilted('TILTED'),
  shaken('SHAKEN'),
  stuck('STUCK'),
  packageTaken('PACKAGE_TAKEN');

  const TelemetryEvent(this.apiName);
  final String apiName;
}

/// Commands the platform sends to the robot (contract #9: RobotCommand.type)
enum CommandType {
  unlock('UNLOCK'),
  lock('LOCK'),
  stop('STOP'),
  returnHome('RETURN'),
  beep('BEEP');

  const CommandType(this.apiName);
  final String apiName;

  static CommandType? fromApiName(String name) {
    for (final type in values) {
      if (type.apiName == name) return type;
    }
    return null;
  }
}

/// A robot carries food or parcels, never both
enum RobotKind {
  food('FOOD'),
  parcel('PARCEL');

  const RobotKind(this.apiName);
  final String apiName;

  static RobotKind fromApiName(String name) =>
      values.firstWhere((k) => k.apiName == name, orElse: () => food);
}

/// What the robot knows about itself, from the platform (query myRobot)
class RobotProfile {
  const RobotProfile({
    required this.name,
    required this.kind,
    this.companyName = '',
    this.modelName = '',
    this.widthMm = 350,
    this.heightMm = 250,
    this.depthMm = 300,
    this.temperatureType,
    this.unlockOnDevice = false,
  });

  factory RobotProfile.fromJson(Map<String, dynamic> json) => RobotProfile(
    name: json['name'] as String,
    kind: RobotKind.fromApiName(json['kind'] as String? ?? ''),
    companyName: json['companyName'] as String? ?? '',
    modelName: json['modelName'] as String? ?? '',
    widthMm: (json['widthMm'] as num?)?.toInt() ?? 350,
    heightMm: (json['heightMm'] as num?)?.toInt() ?? 250,
    depthMm: (json['depthMm'] as num?)?.toInt() ?? 300,
    temperatureType: TemperatureType.fromApiName(
      json['temperatureType'] as String?,
    ),
    unlockOnDevice: json['unlockMethod'] == 'ON_DEVICE',
  );

  final String name;
  final RobotKind kind;
  final String companyName;
  final String modelName;
  final int widthMm;
  final int heightMm;
  final int depthMm;
  final TemperatureType? temperatureType;

  /// The customer opens the compartment on the robot, with a PIN
  final bool unlockOnDevice;

  /// A food robot has a small battery, a big parcel robot a large one
  double get drainFactor => switch (kind) {
    RobotKind.food => 1.3,
    RobotKind.parcel => widthMm * depthMm >= 250000 ? 0.8 : 1.0,
  };
}

class Compartment {
  Compartment({
    required this.index,
    required this.temperature,
    this.locked = true,
    this.lidOpen = false,
    this.loaded = false,
  });

  final int index;
  final TemperatureType temperature;
  bool locked;
  bool lidOpen;
  bool loaded;

  Map<String, Object> toTelemetry() => {
    'index': index,
    'lidOpen': lidOpen,
    'locked': locked,
  };
}

class RobotCommand {
  const RobotCommand({
    required this.id,
    required this.type,
    this.compartmentIndex,
  });

  /// Unknown command types are ignored (null) instead of crashing the robot.
  static RobotCommand? fromJson(Map<String, dynamic> json) {
    final type = CommandType.fromApiName(json['type'] as String? ?? '');
    if (type == null) return null;
    return RobotCommand(
      id: json['id'].toString(),
      type: type,
      compartmentIndex: (json['compartmentIndex'] as num?)?.toInt(),
    );
  }

  final String id;
  final CommandType type;
  final int? compartmentIndex;
}

enum StopKind { pickup, dropoff }

class TripStop {
  const TripStop({required this.kind, required this.position, this.orderId});

  factory TripStop.fromJson(Map<String, dynamic> json) => TripStop(
    kind: json['kind'] == 'PICKUP' ? StopKind.pickup : StopKind.dropoff,
    position: LatLng(
      (json['lat'] as num).toDouble(),
      (json['lng'] as num).toDouble(),
    ),
    orderId: json['orderId'] as String?,
  );

  final StopKind kind;
  final LatLng position;
  final String? orderId;
}

/// The active trip of the robot (contract #9: myActiveTrip)
class Trip {
  const Trip({required this.id, required this.stops, required this.route});

  factory Trip.fromJson(Map<String, dynamic> json) => Trip(
    id: json['id'].toString(),
    stops: [
      for (final stop in json['stops'] as List<dynamic>)
        TripStop.fromJson(stop as Map<String, dynamic>),
    ],
    route: [
      for (final pair in json['route'] as List<dynamic>)
        LatLng.fromLngLat(pair as List<dynamic>),
    ],
  );

  final String id;
  final List<TripStop> stops;

  /// The walking route from the robot to the last stop
  final List<LatLng> route;
}

/// What the robot reports (contract #9: TelemetryInput)
class Telemetry {
  const Telemetry({
    required this.position,
    required this.battery,
    required this.compartments,
    this.temperature,
    this.event,
  });

  final LatLng position;
  final double battery;
  final List<Map<String, Object>> compartments;

  /// Ambient temperature in degrees Celsius (optional in contract #9)
  final double? temperature;
  final TelemetryEvent? event;

  Map<String, Object?> toJson() => {
    'lat': position.lat,
    'lng': position.lng,
    'battery': battery.round(),
    'compartments': compartments,
    if (temperature != null) 'temperature': temperature,
    if (event != null) 'event': event!.apiName,
  };
}
