import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../models/geo.dart';
import '../../models/robot.dart';

/// A small map without tiles: the route, the stops and the robot.
class RouteView extends StatelessWidget {
  const RouteView({
    super.key,
    required this.route,
    required this.stops,
    required this.robot,
  });

  final List<LatLng> route;
  final List<TripStop> stops;
  final LatLng robot;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return AspectRatio(
      aspectRatio: 16 / 9,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: scheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: CustomPaint(
          painter: _RoutePainter(
            route: route,
            stops: stops,
            robot: robot,
            line: scheme.outline,
            robotColor: scheme.primary,
            pickupColor: scheme.tertiary,
            dropoffColor: scheme.secondary,
          ),
        ),
      ),
    );
  }
}

class _RoutePainter extends CustomPainter {
  _RoutePainter({
    required this.route,
    required this.stops,
    required this.robot,
    required this.line,
    required this.robotColor,
    required this.pickupColor,
    required this.dropoffColor,
  });

  final List<LatLng> route;
  final List<TripStop> stops;
  final LatLng robot;
  final Color line;
  final Color robotColor;
  final Color pickupColor;
  final Color dropoffColor;

  @override
  void paint(Canvas canvas, Size size) {
    final all = [...route, robot, for (final stop in stops) stop.position];
    if (all.isEmpty) return;

    // Equirectangular projection, good enough for a few kilometres
    final cosLat = math.cos(all.first.lat * math.pi / 180);
    double x(LatLng p) => p.lng * cosLat;
    double y(LatLng p) => -p.lat;
    final minX = all.map(x).reduce(math.min);
    final maxX = all.map(x).reduce(math.max);
    final minY = all.map(y).reduce(math.min);
    final maxY = all.map(y).reduce(math.max);
    const padding = 24.0;
    final spanX = math.max(maxX - minX, 1e-9);
    final spanY = math.max(maxY - minY, 1e-9);
    final scale = math.min(
      (size.width - 2 * padding) / spanX,
      (size.height - 2 * padding) / spanY,
    );
    final offsetX = (size.width - spanX * scale) / 2;
    final offsetY = (size.height - spanY * scale) / 2;
    Offset project(LatLng p) => Offset(
      offsetX + (x(p) - minX) * scale,
      offsetY + (y(p) - minY) * scale,
    );

    if (route.length >= 2) {
      final path = Path()
        ..moveTo(project(route.first).dx, project(route.first).dy);
      for (final point in route.skip(1)) {
        final o = project(point);
        path.lineTo(o.dx, o.dy);
      }
      canvas.drawPath(
        path,
        Paint()
          ..color = line
          ..strokeWidth = 4
          ..style = PaintingStyle.stroke
          ..strokeJoin = StrokeJoin.round,
      );
    }

    for (final stop in stops) {
      canvas.drawCircle(
        project(stop.position),
        9,
        Paint()
          ..color = stop.kind == StopKind.pickup ? pickupColor : dropoffColor,
      );
    }

    final robotOffset = project(robot);
    canvas.drawCircle(
      robotOffset,
      12,
      Paint()..color = robotColor.withValues(alpha: 0.25),
    );
    canvas.drawCircle(robotOffset, 7, Paint()..color = robotColor);
  }

  @override
  bool shouldRepaint(_RoutePainter old) =>
      old.robot != robot || old.route != route || old.stops != stops;
}
