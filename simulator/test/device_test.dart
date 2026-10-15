import 'package:bot/src/sensors/device.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

/// Which platforms use the motion sensors, and which the scenario buttons (#94: macOS).
void main() {
  tearDown(() => debugDefaultTargetPlatformOverride = null);

  for (final platform in [TargetPlatform.android, TargetPlatform.iOS]) {
    test('a phone ($platform) uses its motion sensors', () {
      debugDefaultTargetPlatformOverride = platform;
      expect(hasMotionSensors, isTrue);
    });
  }

  for (final platform in [
    TargetPlatform.macOS,
    TargetPlatform.windows,
    TargetPlatform.linux,
  ]) {
    test('a computer ($platform) plays them with the scenario buttons', () {
      debugDefaultTargetPlatformOverride = platform;
      expect(hasMotionSensors, isFalse);
    });
  }
}
