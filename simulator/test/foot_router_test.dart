import 'dart:convert';

import 'package:bot/src/api/foot_router.dart';
import 'package:bot/src/models/geo.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  const from = LatLng(50.8282, 3.2608);
  const to = LatLng(50.82473, 3.24975);

  test('asks the foot router, longitude first, and reads the route', () async {
    late Uri asked;
    final route = footRouter(
      client: MockClient((request) async {
        asked = request.url;
        return http.Response(
          jsonEncode({
            'code': 'Ok',
            'routes': [
              {
                'geometry': {
                  'coordinates': [
                    [3.2608, 50.8282],
                    [3.255, 50.8265],
                    [3.24975, 50.82473],
                  ],
                },
              },
            ],
          }),
          200,
        );
      }),
    );

    final points = await route(from, to);
    expect(asked.path, contains('routed-foot'));
    expect(asked.path, contains('3.2608,50.8282;3.24975,50.82473'));
    expect(points, hasLength(3));
    expect(points!.first.lat, 50.8282); // the answer is [lng, lat]
    expect(points.last.lng, 3.24975);
  });

  test(
    'gives null (a straight line) when the router fails or finds nothing',
    () async {
      for (final response in [
        http.Response('oops', 500),
        http.Response(jsonEncode({'code': 'NoRoute', 'routes': []}), 200),
        http.Response('not json', 200),
      ]) {
        final route = footRouter(client: MockClient((_) async => response));
        expect(await route(from, to), isNull);
      }
      final offline = footRouter(
        client: MockClient((_) async => throw http.ClientException('offline')),
      );
      expect(await offline(from, to), isNull);
    },
  );
}
