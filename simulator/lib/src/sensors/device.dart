import 'package:flutter/foundation.dart';

/// A phone has motion sensors (also the web version on a phone). Windows and other
/// computers do not: there the scenario buttons play tilting, shaking and lifting.
bool get hasMotionSensors =>
    kIsWeb ||
    defaultTargetPlatform == TargetPlatform.android ||
    defaultTargetPlatform == TargetPlatform.iOS;
