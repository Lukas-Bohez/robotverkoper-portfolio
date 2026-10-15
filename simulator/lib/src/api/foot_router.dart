import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/geo.dart';

/// A way between two places: the points of the route, or null when there is none
typedef RouteFinder = Future<List<LatLng>?> Function(LatLng from, LatLng to);

/// Walking routes along footpaths from the public OpenStreetMap foot router (no key),
/// for demo mode. The platform does the same for a real robot (query walkingRoute).
/// Any failure gives null: the robot then drives a straight line.
RouteFinder footRouter({http.Client? client}) {
  final httpClient = client ?? http.Client();
  return (from, to) async {
    final url = Uri.parse(
      'https://routing.openstreetmap.de/routed-foot/route/v1/foot/'
      '${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson',
    );
    try {
      final response = await httpClient
          .get(url)
          .timeout(const Duration(seconds: 6));
      if (response.statusCode != 200) return null;
      final body = jsonDecode(response.body) as Map<String, dynamic>;
      final routes = body['routes'] as List<dynamic>?;
      final coordinates =
          ((routes?.firstOrNull as Map<String, dynamic>?)?['geometry']
                  as Map<String, dynamic>?)?['coordinates']
              as List<dynamic>?;
      if (coordinates == null || coordinates.length < 2) return null;
      return [for (final pair in coordinates) LatLng.fromLngLat(pair as List)];
    } on Object {
      return null;
    }
  };
}
