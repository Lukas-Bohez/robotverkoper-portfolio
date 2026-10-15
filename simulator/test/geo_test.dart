import 'package:bot/src/models/geo.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('distanceBetween', () {
    test('is zero for the same point', () {
      const a = LatLng(50.8247, 3.2497);
      expect(distanceBetween(a, a), 0);
    });

    test('measures about 111 km per degree of latitude', () {
      final d = distanceBetween(const LatLng(50, 3), const LatLng(51, 3));
      expect(d, closeTo(111195, 50));
    });
  });

  group('RoutePath', () {
    // Two segments of about 111 m each, north then east
    final path = RoutePath(const [
      LatLng(50, 3),
      LatLng(50.001, 3),
      LatLng(50.001, 3.00156),
    ]);

    test('knows its total length', () {
      expect(path.length, closeTo(222, 2));
    });

    test('interpolates along a segment', () {
      final half = path.pointAt(path.distanceAtPoint(1) / 2);
      expect(half.lat, closeTo(50.0005, 1e-6));
      expect(half.lng, closeTo(3, 1e-9));
    });

    test('clamps before the start and after the end', () {
      expect(path.pointAt(-10).lat, 50);
      expect(path.pointAt(10000).lng, closeTo(3.00156, 1e-9));
    });

    test('finds the closest route point', () {
      expect(path.closestPointIndex(const LatLng(50.00101, 3.0001)), 1);
    });

    test('reads GeoJSON order [lng, lat]', () {
      final point = LatLng.fromLngLat(const [3.25, 50.82]);
      expect(point.lat, 50.82);
      expect(point.lng, 3.25);
    });
  });
}
