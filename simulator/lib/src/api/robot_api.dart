import '../models/geo.dart';
import '../models/robot.dart';

/// What the robot needs from the platform (contract #9, robot and simulator).
abstract class RobotApi {
  /// mutation reportTelemetry(input: TelemetryInput!)
  Future<void> reportTelemetry(Telemetry telemetry);

  /// query pendingRobotCommands (polling in Demo 1, a subscription in Demo 2)
  Future<List<RobotCommand>> pendingCommands();

  /// mutation ackRobotCommand(id: ID!)
  Future<void> acknowledge(String commandId);

  /// query myActiveTrip, null when the robot has nothing to do
  Future<Trip?> activeTrip();

  /// query walkingRoute: the way to a place along footpaths, null for a straight line
  Future<List<LatLng>?> routeTo(LatLng from, LatLng to) async => null;

  /// query myRobot: the kind, the compartment and how customers open it
  Future<RobotProfile?> profile() async => null;

  /// mutation unlockWithPin(pin): the customer typed a PIN on the robot.
  /// Throws [RobotApiException] for a wrong PIN.
  Future<void> unlockWithPin(String pin) async =>
      throw const RobotApiException('This platform cannot check a PIN');
}

class RobotApiException implements Exception {
  const RobotApiException(this.message);
  final String message;

  @override
  String toString() => 'RobotApiException: $message';
}
