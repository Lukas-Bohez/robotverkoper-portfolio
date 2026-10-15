import 'dart:async';

import 'dart:math';

import 'package:flutter/foundation.dart';

import '../api/robot_api.dart';
import '../models/geo.dart';
import '../models/robot.dart';

enum LogKind {
  tripReceived,
  arrivedPickup,
  arrivedDropoff,
  loaded,
  delivered,
  command,
  event,
  recovered,
  returnedHome,
  apiError,
  apiRestored,
  pinAccepted,
  pinRejected,
}

/// The weather the robot drives in: the colder, the faster the battery drains
enum Weather {
  mild(1, 18),
  cold(1.5, 3),
  frost(2.2, -7);

  const Weather(this.drainFactor, this.celsius);

  /// How many times more battery a metre costs than in mild weather
  final double drainFactor;

  /// The ambient temperature that the robot reports
  final int celsius;
}

/// The GPS signal that the robot reports: its real position, with noise, or a random one
enum GpsSpoof { off, noise, random }

class LogEntry {
  const LogEntry(this.at, this.kind, [this.detail]);
  final DateTime at;
  final LogKind kind;
  final String? detail;
}

/// The robot: drives its trip, executes commands, reports telemetry.
///
/// The UI calls [start] (real timers). Tests call [advance] and [sync] directly
/// to control the simulated time.
class RobotSimulator extends ChangeNotifier {
  RobotSimulator({
    required this.api,
    required this.name,
    this.home = const LatLng(50.82473, 3.24975),
    List<Compartment>? compartments,
    this.speed = 1.4,
    DateTime Function()? clock,
    Random? random,
  }) : position = home,
       _random = random ?? Random(),
       compartments =
           compartments ??
           // A robot has exactly one compartment (the contract keeps the list
           // shape, with one element)
           [Compartment(index: 0, temperature: TemperatureType.neutral)],
       _clock = clock ?? DateTime.now;

  final RobotApi api;
  final String name;

  /// The robot station, where the robot returns after a trip
  final LatLng home;

  /// Walking pace in metres per second (the robots drive on sidewalks)
  final double speed;
  final DateTime Function() _clock;
  final Random _random;

  /// Battery use in percent per metre
  static const double drainPerMetre = 0.01;

  Weather weather = Weather.mild;
  GpsSpoof gpsSpoof = GpsSpoof.off;

  /// Who this robot is (from the platform); null in demo mode until it is loaded
  RobotProfile? profile;
  bool _profileLoaded = false;

  /// The last answer to a PIN that was typed on the robot (null: nothing wrong)
  String? pinMessage;

  RobotStatus status = RobotStatus.available;
  LatLng position;
  double battery = 100;
  final List<Compartment> compartments;

  /// 1×, 5× or 10×: speeds up driving (not the network)
  int timeFactor = 1;

  Trip? trip;
  RoutePath? _path;
  double travelled = 0;
  List<double> _stopDistances = const [];
  int _nextStop = 0;
  RobotStatus? _beforeProblem;
  final Set<String> _finishedTrips = {};
  final List<TelemetryEvent> _pendingEvents = [];
  final List<LogEntry> log = [];
  String? lastError;
  bool _syncing = false;
  bool _syncAgain = false;

  /// Hooks for the phone: vibrate on an alert, play a sound on BEEP
  VoidCallback? onAlert;
  VoidCallback? onBeep;

  Timer? _tickTimer;
  Timer? _syncTimer;

  RoutePath? get path => _path;
  TripStop? get nextStop {
    final stops = trip?.stops ?? const <TripStop>[];
    return _nextStop < stops.length ? stops[_nextStop] : null;
  }

  double get remainingMetres =>
      _path == null ? 0 : (_path!.length - travelled).clamp(0, double.infinity);

  // ── lifecycle ───────────────────────────────────────────────────

  void start({
    Duration tick = const Duration(milliseconds: 200),
    Duration syncEvery = const Duration(seconds: 2),
  }) {
    stopTimers();
    _tickTimer = Timer.periodic(tick, (_) => advance(tick * timeFactor));
    _syncTimer = Timer.periodic(syncEvery, (_) => unawaited(sync()));
    unawaited(sync());
  }

  void stopTimers() {
    _tickTimer?.cancel();
    _syncTimer?.cancel();
    _tickTimer = null;
    _syncTimer = null;
  }

  @override
  void dispose() {
    stopTimers();
    super.dispose();
  }

  void setGpsSpoof(GpsSpoof value) {
    gpsSpoof = value;
    notifyListeners();
  }

  void setWeather(Weather value) {
    weather = value;
    notifyListeners();
  }

  void setTimeFactor(int factor) {
    timeFactor = factor;
    notifyListeners();
  }

  // ── driving ─────────────────────────────────────────────────────

  /// Moves the robot for [elapsed] of simulated time
  void advance(Duration elapsed) {
    final path = _path;
    if (path == null || !status.isMoving) return;
    final before = travelled;
    travelled = (travelled + speed * elapsed.inMicroseconds / 1e6).clamp(
      0,
      path.length,
    );
    position = path.pointAt(travelled);
    battery =
        (battery -
                (travelled - before) *
                    drainPerMetre *
                    weather.drainFactor *
                    (profile?.drainFactor ?? 1))
            .clamp(0, 100);
    _checkArrival();
    notifyListeners();
  }

  void _checkArrival() {
    final path = _path!;
    if (status == RobotStatus.returning) {
      if (travelled >= path.length) _arriveHome();
      return;
    }
    if (_nextStop >= _stopDistances.length ||
        travelled < _stopDistances[_nextStop]) {
      return;
    }

    travelled = _stopDistances[_nextStop];
    position = path.pointAt(travelled);
    _pendingEvents.add(TelemetryEvent.arrived);
    if (trip!.stops[_nextStop].kind == StopKind.pickup) {
      status = RobotStatus.loading;
      _log(LogKind.arrivedPickup);
    } else {
      status = RobotStatus.atDropoff;
      _log(LogKind.arrivedDropoff);
    }
    unawaited(sync()); // report the arrival right away
  }

  void _startTrip(Trip next) {
    trip = next;
    final stopPoints = [for (final stop in next.stops) stop.position];
    final route = next.route.length >= 2
        ? next.route
        : [position, ...stopPoints];
    final path = RoutePath(route.length >= 2 ? route : [position, position]);
    _path = path;
    travelled = 0;
    position = path.points.first;
    _nextStop = 0;
    _stopDistances = [
      for (final stop in next.stops)
        path.distanceAtPoint(path.closestPointIndex(stop.position)),
    ];
    status = next.stops.isNotEmpty && next.stops.first.kind == StopKind.pickup
        ? RobotStatus.toPickup
        : RobotStatus.onRoute;
    _log(LogKind.tripReceived, next.id);
    notifyListeners();
  }

  void _returnHome() {
    // Start at once on a straight line; the route along the streets replaces it
    // as soon as the platform has it (the robot must not drive through buildings)
    final from = position;
    final straight = RoutePath([from, home]);
    _path = straight;
    travelled = 0;
    _stopDistances = const [];
    _nextStop = 0;
    status = RobotStatus.returning;
    unawaited(_routeBack(from, straight));
  }

  Future<void> _routeBack(LatLng from, RoutePath straight) async {
    try {
      final route = await api.routeTo(from, home);
      // Only when the robot is still on that way back
      if (route == null ||
          route.length < 2 ||
          !identical(_path, straight) ||
          status != RobotStatus.returning) {
        return;
      }
      _path = RoutePath(route);
      travelled = 0;
      notifyListeners();
    } on Object {
      // No route: the straight line stays
    }
  }

  void _arriveHome() {
    final finished = trip;
    if (finished != null) _finishedTrips.add(finished.id);
    trip = null;
    _path = null;
    travelled = 0;
    position = home;
    status = RobotStatus.available;
    _log(LogKind.returnedHome);
  }

  // ── at the shop and the customer ────────────────────────────────

  /// The shop put the order in a compartment and closed the lid
  void markLoaded() {
    if (status != RobotStatus.loading) return;
    final compartment = compartments.firstWhere(
      (c) => !c.loaded,
      orElse: () => compartments.first,
    );
    compartment
      ..loaded = true
      ..lidOpen = false
      ..locked = true;
    _nextStop++;
    status = RobotStatus.onRoute;
    _log(LogKind.loaded, '${compartment.index + 1}');
    unawaited(sync());
    notifyListeners();
  }

  /// A lid is closed again (by the customer, the shop or a passer-by)
  void closeLids() {
    var delivered = false;
    for (final compartment in compartments.where((c) => c.lidOpen)) {
      compartment
        ..lidOpen = false
        ..locked = true;
      if (status == RobotStatus.atDropoff && compartment.loaded) {
        compartment.loaded = false;
        delivered = true;
      }
    }
    if (delivered) {
      _log(LogKind.delivered);
      _nextStop++;
      if (_nextStop >= (trip?.stops.length ?? 0)) {
        _returnHome();
      } else {
        status = RobotStatus.onRoute;
      }
    }
    unawaited(sync());
    notifyListeners();
  }

  // ── problems: sensors and scenario buttons ──────────────────────

  /// Something happened to the robot: report it right away
  void report(TelemetryEvent event) {
    switch (event) {
      case TelemetryEvent.arrived:
        // Scenario button: jump to the next stop
        if (!status.isMoving || _nextStop >= _stopDistances.length) return;
        travelled = _stopDistances[_nextStop];
        _checkArrival();
        notifyListeners();
        return;
      case TelemetryEvent.tilted:
      case TelemetryEvent.stuck:
        _enterProblem(RobotStatus.stuck);
      case TelemetryEvent.shaken:
        _enterProblem(RobotStatus.alarm);
      case TelemetryEvent.packageTaken:
        final taken =
            compartments.where((c) => c.loaded).firstOrNull ??
            compartments.first;
        taken
          ..loaded = false
          ..lidOpen = true;
        _enterProblem(RobotStatus.alarm);
    }
    _pendingEvents.add(event);
    _log(LogKind.event, event.apiName);
    onAlert?.call();
    unawaited(sync());
    notifyListeners();
  }

  void _enterProblem(RobotStatus problem) {
    if (!status.isProblem && status != RobotStatus.manualOverride) {
      _beforeProblem = status;
    }
    status = problem;
  }

  /// A technician solved the problem: continue where the robot was
  void recover() {
    if (!status.isProblem && status != RobotStatus.manualOverride) return;
    status = _beforeProblem ?? RobotStatus.available;
    _beforeProblem = null;
    _log(LogKind.recovered);
    notifyListeners();
  }

  // ── commands from the platform ──────────────────────────────────

  void _execute(RobotCommand command) {
    switch (command.type) {
      case CommandType.unlock:
        final compartment =
            _compartment(command.compartmentIndex) ??
            compartments.where((c) => c.loaded).firstOrNull ??
            compartments.first;
        compartment
          ..locked = false
          ..lidOpen = true;
        onAlert?.call();
      case CommandType.lock:
        // At the shop, LOCK means: the order is in, close up and leave
        if (status == RobotStatus.loading) markLoaded();
        for (final compartment in compartments) {
          compartment
            ..lidOpen = false
            ..locked = true;
        }
      case CommandType.stop:
        _enterProblem(RobotStatus.manualOverride);
      case CommandType.returnHome:
        _beforeProblem = null;
        _returnHome();
      case CommandType.beep:
        onBeep?.call();
    }
    _log(LogKind.command, command.type.apiName);
  }

  Compartment? _compartment(int? index) => index == null
      ? null
      : compartments.where((c) => c.index == index).firstOrNull;

  // ── talking to the platform ─────────────────────────────────────

  /// The position that goes to the platform: the real one, with noise, or a random one near the station
  LatLng get reportedPosition {
    double jitter(double metres) =>
        (_random.nextDouble() - 0.5) * 2 * metres / 111000;
    return switch (gpsSpoof) {
      GpsSpoof.off => position,
      GpsSpoof.noise => LatLng(
        position.lat + jitter(8),
        position.lng + jitter(8),
      ),
      GpsSpoof.random => LatLng(home.lat + jitter(400), home.lng + jitter(400)),
    };
  }

  Telemetry telemetry([TelemetryEvent? event]) => Telemetry(
    position: reportedPosition,
    battery: battery,
    compartments: [for (final c in compartments) c.toTelemetry()],
    temperature: weather.celsius.toDouble(),
    event: event,
  );

  /// The customer typed a PIN on the robot: the platform checks it
  Future<bool> submitPin(String pin) async {
    pinMessage = null;
    try {
      await api.unlockWithPin(pin);
      _log(LogKind.pinAccepted);
      notifyListeners();
      await sync();
      return true;
    } on RobotApiException catch (error) {
      pinMessage = error.message;
      _log(LogKind.pinRejected);
      notifyListeners();
      return false;
    }
  }

  /// Report telemetry, execute pending commands and pick up a new trip.
  Future<void> sync() async {
    if (_syncing) {
      // A button was pressed while a sync was running: run once more right after
      _syncAgain = true;
      return;
    }
    _syncing = true;
    final events = List.of(_pendingEvents);
    _pendingEvents.clear();
    var sent = 0;
    try {
      if (!_profileLoaded) {
        profile = await api.profile();
        _profileLoaded = true;
      }
      if (events.isEmpty) {
        await api.reportTelemetry(telemetry());
      } else {
        for (final event in events) {
          await api.reportTelemetry(telemetry(event));
          sent++;
        }
      }

      for (final command in await api.pendingCommands()) {
        _execute(command);
        await api.acknowledge(command.id);
      }

      if (status == RobotStatus.available && trip == null) {
        final next = await api.activeTrip();
        if (next != null && !_finishedTrips.contains(next.id)) _startTrip(next);
      }

      if (lastError != null) {
        lastError = null;
        _log(LogKind.apiRestored);
      }
    } on Object catch (error) {
      // Keep the events that were not sent for the next try
      _pendingEvents.insertAll(0, events.skip(sent));
      if (lastError == null) _log(LogKind.apiError, '$error');
      lastError = '$error';
    } finally {
      _syncing = false;
      notifyListeners();
    }
    // Events and button presses that came in during this sync go out right away, not 2 s later
    final again = _syncAgain || _pendingEvents.isNotEmpty;
    _syncAgain = false;
    if (again && lastError == null) unawaited(sync());
  }

  void _log(LogKind kind, [String? detail]) {
    log.insert(0, LogEntry(_clock(), kind, detail));
    if (log.length > 50) log.removeLast();
  }
}
