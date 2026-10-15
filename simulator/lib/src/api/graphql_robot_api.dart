import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/geo.dart';
import '../models/robot.dart';
import 'robot_api.dart';

/// The robot API of the platform over GraphQL, authenticated with the API key
/// of the robot (header x-api-key). The operations follow contract #9.
class GraphqlRobotApi implements RobotApi {
  GraphqlRobotApi({
    required this.endpoint,
    required this.apiKey,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final Uri endpoint;
  final String apiKey;
  final http.Client _client;

  Future<Map<String, dynamic>> _execute(
    String document, [
    Map<String, Object?> variables = const {},
  ]) async {
    final http.Response response;
    try {
      response = await _client.post(
        endpoint,
        headers: {'content-type': 'application/json', 'x-api-key': apiKey},
        body: jsonEncode({'query': document, 'variables': variables}),
      );
    } catch (error) {
      throw RobotApiException('The platform is unreachable: $error');
    }

    final Object? body;
    try {
      body = jsonDecode(response.body);
    } on FormatException {
      throw RobotApiException(
        'Unexpected answer (HTTP ${response.statusCode})',
      );
    }
    if (body is! Map<String, dynamic>) {
      throw RobotApiException(
        'Unexpected answer (HTTP ${response.statusCode})',
      );
    }
    final errors = body['errors'];
    if (errors is List && errors.isNotEmpty) {
      final first = errors.first;
      throw RobotApiException(
        first is Map ? '${first['message']}' : 'Unknown error',
      );
    }
    return (body['data'] as Map<String, dynamic>?) ?? const {};
  }

  @override
  Future<void> reportTelemetry(Telemetry telemetry) => _execute(
    r'mutation ReportTelemetry($input: TelemetryInput!) { reportTelemetry(input: $input) }',
    {'input': telemetry.toJson()},
  );

  @override
  Future<List<RobotCommand>> pendingCommands() async {
    final data = await _execute(
      'query PendingRobotCommands { pendingRobotCommands { id type compartmentIndex } }',
    );
    return [
      for (final json
          in data['pendingRobotCommands'] as List<dynamic>? ?? const [])
        ?RobotCommand.fromJson(json as Map<String, dynamic>),
    ];
  }

  @override
  Future<void> acknowledge(String commandId) => _execute(
    r'mutation AckRobotCommand($id: ID!) { ackRobotCommand(id: $id) }',
    {'id': commandId},
  );

  @override
  Future<RobotProfile?> profile() async {
    final data = await _execute(
      'query MyRobot { myRobot { name companyName kind modelName widthMm heightMm depthMm temperatureType unlockMethod } }',
    );
    final robot = data['myRobot'];
    return robot == null
        ? null
        : RobotProfile.fromJson(robot as Map<String, dynamic>);
  }

  @override
  Future<List<LatLng>?> routeTo(LatLng from, LatLng to) async {
    final data = await _execute(
      r'query WalkingRoute($a: Float!, $b: Float!, $c: Float!, $d: Float!) { walkingRoute(fromLat: $a, fromLng: $b, toLat: $c, toLng: $d) }',
      {'a': from.lat, 'b': from.lng, 'c': to.lat, 'd': to.lng},
    );
    final route = data['walkingRoute'] as List<dynamic>?;
    if (route == null || route.length < 2) return null;
    return [for (final pair in route) LatLng.fromLngLat(pair as List)];
  }

  @override
  Future<void> unlockWithPin(String pin) => _execute(
    r'mutation UnlockWithPin($pin: String!) { unlockWithPin(pin: $pin) }',
    {'pin': pin},
  );

  @override
  Future<Trip?> activeTrip() async {
    final data = await _execute(
      'query MyActiveTrip { myActiveTrip { id route stops { kind orderId lat lng } } }',
    );
    final trip = data['myActiveTrip'];
    return trip == null ? null : Trip.fromJson(trip as Map<String, dynamic>);
  }
}
