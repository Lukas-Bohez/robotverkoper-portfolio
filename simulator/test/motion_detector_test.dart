import 'package:bot/src/sensors/motion_detector.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  final t0 = DateTime(2026, 9, 24, 12);
  DateTime at(int ms) => t0.add(Duration(milliseconds: ms));

  test('a phone lying flat is not tilted', () {
    expect(MotionDetector.tiltAngle(0, 0, 9.81), closeTo(0, 1e-9));
    final detector = MotionDetector();
    for (var ms = 0; ms < 2000; ms += 100) {
      expect(detector.add(0.2, -0.1, 9.8, at(ms)), isNull);
    }
  });

  test('a phone on its side for long enough is tilted, once', () {
    final detector = MotionDetector();
    expect(MotionDetector.tiltAngle(9.81, 0, 0), closeTo(90, 1e-9));
    expect(detector.add(9.81, 0, 0, at(0)), isNull);
    expect(detector.add(9.81, 0, 0, at(300)), isNull);
    expect(detector.add(9.81, 0, 0, at(700)), MotionEvent.tilted);
    expect(
      detector.add(9.81, 0, 0, at(1500)),
      isNull,
    ); // no repeat while tilted
  });

  test('a short wobble is not a tilt', () {
    final detector = MotionDetector();
    expect(detector.add(9.81, 0, 0, at(0)), isNull);
    expect(detector.add(0, 0, 9.81, at(200)), isNull); // back flat
    expect(detector.add(9.81, 0, 0, at(700)), isNull);
  });

  test('it can tilt again after lying flat again', () {
    final detector = MotionDetector();
    detector.add(9.81, 0, 0, at(0));
    expect(detector.add(9.81, 0, 0, at(700)), MotionEvent.tilted);
    detector.add(0, 0, 9.81, at(1000));
    detector.add(9.81, 0, 0, at(1100));
    expect(detector.add(9.81, 0, 0, at(1800)), MotionEvent.tilted);
  });

  test('a gentle bump is not a shake', () {
    // |a| = 20.5 m/s², only 10.7 above gravity
    expect(MotionDetector().add(15, 10, 9.81, at(0)), isNull);
  });

  test('a strong jolt is a shake, with a cooldown', () {
    final detector = MotionDetector();
    expect(detector.add(20, 15, 9.81, at(0)), MotionEvent.shaken);
    expect(detector.add(20, 15, 9.81, at(500)), isNull);
    expect(detector.add(20, 15, 9.81, at(3500)), MotionEvent.shaken);
  });
}
