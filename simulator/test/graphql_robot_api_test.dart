import 'dart:convert';

import 'package:bot/src/api/graphql_robot_api.dart';
import 'package:bot/src/api/robot_api.dart';
import 'package:bot/src/models/geo.dart';
import 'package:bot/src/models/robot.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  final endpoint = Uri.parse('http://localhost:3000/graphql');
  late List<http.Request> requests;

  GraphqlRobotApi apiAnswering(Object body, {int status = 200}) {
    requests = [];
    return GraphqlRobotApi(
      endpoint: endpoint,
      apiKey: 'robot-key',
      client: MockClient((request) async {
        requests.add(request);
        return http.Response(jsonEncode(body), status);
      }),
    );
  }

  Map<String, dynamic> sent() =>
      jsonDecode(requests.single.body) as Map<String, dynamic>;

  test('authenticates with the API key of the robot', () async {
    final api = apiAnswering({
      'data': {'reportTelemetry': true},
    });
    await api.reportTelemetry(
      const Telemetry(
        position: LatLng(50.8, 3.2),
        battery: 81.6,
        compartments: [],
      ),
    );

    expect(requests.single.headers['x-api-key'], 'robot-key');
    expect(requests.single.url, endpoint);
  });

  test('sends telemetry as TelemetryInput (contract #9)', () async {
    final api = apiAnswering({
      'data': {'reportTelemetry': true},
    });
    await api.reportTelemetry(
      const Telemetry(
        position: LatLng(50.8, 3.2),
        battery: 81.6,
        compartments: [
          {'index': 0, 'lidOpen': true, 'locked': false},
        ],
        event: TelemetryEvent.tilted,
      ),
    );

    expect(sent()['query'], contains('reportTelemetry(input: \$input)'));
    expect(sent()['variables'], {
      'input': {
        'lat': 50.8,
        'lng': 3.2,
        'battery': 82,
        'compartments': [
          {'index': 0, 'lidOpen': true, 'locked': false},
        ],
        'event': 'TILTED',
      },
    });
  });

  test('reads pending commands and skips unknown types', () async {
    final api = apiAnswering({
      'data': {
        'pendingRobotCommands': [
          {'id': 'c1', 'type': 'UNLOCK', 'compartmentIndex': 1},
          {'id': 'c2', 'type': 'DANCE'},
          {'id': 'c3', 'type': 'RETURN'},
        ],
      },
    });

    final commands = await api.pendingCommands();
    expect(commands.map((c) => c.type), [
      CommandType.unlock,
      CommandType.returnHome,
    ]);
    expect(commands.first.compartmentIndex, 1);
  });

  test('reads the active trip with its route in [lng, lat] order', () async {
    final api = apiAnswering({
      'data': {
        'myActiveTrip': {
          'id': 't1',
          'route': [
            [3.25, 50.82],
            [3.26, 50.83],
          ],
          'stops': [
            {'kind': 'PICKUP', 'orderId': 'o1', 'lat': 50.82, 'lng': 3.25},
            {'kind': 'DROPOFF', 'orderId': 'o1', 'lat': 50.83, 'lng': 3.26},
          ],
        },
      },
    });

    final trip = await api.activeTrip();
    expect(trip!.id, 't1');
    expect(trip.route.first.lat, 50.82);
    expect(trip.route.first.lng, 3.25);
    expect(trip.stops.map((s) => s.kind), [StopKind.pickup, StopKind.dropoff]);
  });

  test('no trip is null', () async {
    final api = apiAnswering({
      'data': {'myActiveTrip': null},
    });
    expect(await api.activeTrip(), isNull);
  });

  test('turns GraphQL errors into a RobotApiException', () async {
    final api = apiAnswering({
      'errors': [
        {'message': 'Invalid API key'},
      ],
    });
    expect(
      api.pendingCommands(),
      throwsA(
        isA<RobotApiException>().having(
          (e) => e.message,
          'message',
          'Invalid API key',
        ),
      ),
    );
  });

  test('turns a non-JSON answer into a RobotApiException', () async {
    final api = GraphqlRobotApi(
      endpoint: endpoint,
      apiKey: 'robot-key',
      client: MockClient((_) async => http.Response('<html>502</html>', 502)),
    );
    expect(api.activeTrip(), throwsA(isA<RobotApiException>()));
  });
}
