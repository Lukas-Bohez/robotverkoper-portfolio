import '../models/geo.dart';
import '../models/robot.dart';
import 'foot_router.dart';
import 'robot_api.dart';

/// A demo trip around the Howest campus in Kortrijk: station → shop → customer.
const Trip demoTrip = Trip(
  id: 'demo-trip',
  route: [
    LatLng(50.82473, 3.24975), // the robot station on campus
    LatLng(50.82530, 3.25200),
    LatLng(50.82610, 3.25480),
    LatLng(50.82680, 3.25720), // the shop
    LatLng(50.82760, 3.25910),
    LatLng(50.82820, 3.26080), // the customer
  ],
  stops: [
    TripStop(
      kind: StopKind.pickup,
      position: LatLng(50.82680, 3.25720),
      orderId: 'demo-order',
    ),
    TripStop(
      kind: StopKind.dropoff,
      position: LatLng(50.82820, 3.26080),
      orderId: 'demo-order',
    ),
  ],
);

/// Demo mode: an API in memory, until the robot API of the platform exists.
/// The demo panel of the app sends commands here like the platform would.
class MockRobotApi implements RobotApi {
  MockRobotApi({
    Trip? trip,
    RobotProfile? profile,
    this.pin = '1234',
    this.router,
  }) : _trip = trip ?? demoTrip,
       _profile =
           profile ??
           const RobotProfile(
             name: 'Demo',
             kind: RobotKind.food,
             temperatureType: TemperatureType.warm,
           );

  final RobotProfile _profile;

  /// How demo mode finds the way back along footpaths (null: a straight line)
  final RouteFinder? router;

  /// The PIN that opens the compartment in demo mode (when the profile says so)
  final String pin;

  Trip? _trip;
  final List<Telemetry> reported = [];
  final List<String> acknowledged = [];
  final List<RobotCommand> _queue = [];
  int _nextId = 1;

  /// Plays the platform: puts a command in the queue of the robot
  void send(CommandType type, {int? compartmentIndex}) {
    _queue.add(
      RobotCommand(
        id: 'demo-${_nextId++}',
        type: type,
        compartmentIndex: compartmentIndex,
      ),
    );
  }

  /// Gives the robot a new trip (or none)
  set trip(Trip? trip) {
    _trip = trip;
    _onStreets = false;
  }

  /// The trip's route has been replaced by one along the streets (or there is no router)
  bool _onStreets = false;

  @override
  Future<void> reportTelemetry(Telemetry telemetry) async =>
      reported.add(telemetry);

  @override
  Future<List<RobotCommand>> pendingCommands() async => List.of(_queue);

  @override
  Future<void> acknowledge(String commandId) async {
    _queue.removeWhere((command) => command.id == commandId);
    acknowledged.add(commandId);
  }

  @override
  Future<Trip?> activeTrip() async {
    final trip = _trip;
    if (trip == null || _onStreets || router == null) return trip;
    _onStreets = true;
    // Station → shop → customer along footpaths, like the platform does
    final stops = [
      trip.route.first,
      ...[for (final s in trip.stops) s.position],
    ];
    final route = <LatLng>[];
    for (var i = 1; i < stops.length; i++) {
      final leg = await router!(stops[i - 1], stops[i]);
      if (leg == null) return trip; // no router: the hand-made route stays
      route.addAll(route.isEmpty ? leg : leg.skip(1));
    }
    return _trip = Trip(id: trip.id, stops: trip.stops, route: route);
  }

  @override
  Future<RobotProfile?> profile() async => _profile;

  @override
  Future<List<LatLng>?> routeTo(LatLng from, LatLng to) async =>
      router?.call(from, to);

  @override
  Future<void> unlockWithPin(String entered) async {
    if (entered.trim() != pin) throw const RobotApiException('Wrong PIN');
    send(CommandType.unlock, compartmentIndex: 0);
  }
}
