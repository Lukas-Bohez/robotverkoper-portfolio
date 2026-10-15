import 'dart:math' as math;

/// A point on the map (WGS84 degrees).
class LatLng {
  const LatLng(this.lat, this.lng);

  /// GeoJSON and Mapbox order: [lng, lat]
  factory LatLng.fromLngLat(List<dynamic> pair) =>
      LatLng((pair[1] as num).toDouble(), (pair[0] as num).toDouble());

  final double lat;
  final double lng;

  @override
  String toString() => 'LatLng($lat, $lng)';
}

const double _earthRadius = 6371000;

double _radians(double degrees) => degrees * math.pi / 180;

/// The distance between two points in metres (haversine).
double distanceBetween(LatLng a, LatLng b) {
  final dLat = _radians(b.lat - a.lat);
  final dLng = _radians(b.lng - a.lng);
  final h =
      math.pow(math.sin(dLat / 2), 2) +
      math.cos(_radians(a.lat)) *
          math.cos(_radians(b.lat)) *
          math.pow(math.sin(dLng / 2), 2);
  return 2 * _earthRadius * math.asin(math.sqrt(h));
}

/// A walking route: a polyline that knows where you are after [distance] metres.
class RoutePath {
  RoutePath(this.points) : assert(points.length >= 2) {
    var total = 0.0;
    _cumulative.add(0);
    for (var i = 1; i < points.length; i++) {
      total += distanceBetween(points[i - 1], points[i]);
      _cumulative.add(total);
    }
  }

  final List<LatLng> points;
  final List<double> _cumulative = [];

  /// Total length in metres
  double get length => _cumulative.last;

  /// How far along the route point [index] is, in metres
  double distanceAtPoint(int index) => _cumulative[index];

  /// The position after [distance] metres, clamped to the route
  LatLng pointAt(double distance) {
    if (distance <= 0) return points.first;
    if (distance >= length) return points.last;
    var i = 1;
    while (_cumulative[i] < distance) {
      i++;
    }
    final start = _cumulative[i - 1];
    final segment = _cumulative[i] - start;
    final t = segment == 0 ? 0.0 : (distance - start) / segment;
    final a = points[i - 1];
    final b = points[i];
    return LatLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t);
  }

  /// The index of the route point closest to [position]
  int closestPointIndex(LatLng position) {
    var best = 0;
    var bestDistance = double.infinity;
    for (var i = 0; i < points.length; i++) {
      final d = distanceBetween(points[i], position);
      if (d < bestDistance) {
        best = i;
        bestDistance = d;
      }
    }
    return best;
  }
}
