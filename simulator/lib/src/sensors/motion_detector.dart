import 'dart:math' as math;

enum MotionEvent { tilted, shaken }

/// Turns accelerometer readings (m/s², gravity included) into robot events.
///
/// The phone lies flat, screen up, like the body of the robot:
/// - tilted: the phone leans more than [tiltDegrees] for [tiltHold] (fallen over)
/// - shaken: a jolt of more than [shakeThreshold] above gravity (lifted, kicked)
class MotionDetector {
  MotionDetector({
    this.tiltDegrees = 50,
    this.recoverDegrees = 30,
    this.tiltHold = const Duration(milliseconds: 600),
    this.shakeThreshold = 12,
    this.shakeCooldown = const Duration(seconds: 3),
  });

  final double tiltDegrees;
  final double recoverDegrees;
  final Duration tiltHold;
  final double shakeThreshold;
  final Duration shakeCooldown;

  static const double gravity = 9.81;

  DateTime? _tiltSince;
  bool _tilted = false;
  DateTime? _lastShake;

  /// The angle between the screen normal and gravity, in degrees (0 = flat)
  static double tiltAngle(double x, double y, double z) {
    final magnitude = math.sqrt(x * x + y * y + z * z);
    if (magnitude == 0) return 0;
    return math.acos((z / magnitude).clamp(-1.0, 1.0)) * 180 / math.pi;
  }

  /// Feed one reading; returns an event at most once per tilt or shake.
  MotionEvent? add(double x, double y, double z, DateTime at) {
    final magnitude = math.sqrt(x * x + y * y + z * z);
    if ((magnitude - gravity).abs() > shakeThreshold) {
      final last = _lastShake;
      if (last == null || at.difference(last) >= shakeCooldown) {
        _lastShake = at;
        return MotionEvent.shaken;
      }
      return null; // during a shake the angle means nothing
    }

    final angle = tiltAngle(x, y, z);
    if (_tilted) {
      if (angle < recoverDegrees) {
        _tilted = false;
        _tiltSince = null;
      }
      return null;
    }
    if (angle < tiltDegrees) {
      _tiltSince = null;
      return null;
    }
    final since = _tiltSince ??= at;
    if (at.difference(since) >= tiltHold) {
      _tilted = true;
      return MotionEvent.tilted;
    }
    return null;
  }
}
