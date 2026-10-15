import 'package:bot/src/api/mock_robot_api.dart';
import 'package:bot/src/api/robot_api.dart';
import 'package:bot/src/models/geo.dart';
import 'package:bot/src/models/robot.dart';
import 'package:bot/src/simulation/robot_simulator.dart';
import 'package:bot/src/ui/fleet_screen.dart';
import 'package:flutter_test/flutter_test.dart';

/// Lets the syncs that the simulator starts by itself finish
Future<void> settle() => Future<void>.delayed(Duration.zero);

RobotSimulator newSimulator(RobotApi api) =>
    RobotSimulator(api: api, name: 'Test', clock: () => DateTime(2026, 9, 24));

/// Drives until the robot reaches its next stop
Future<void> driveToNextStop(RobotSimulator sim) async {
  sim.advance(const Duration(hours: 1));
  await settle();
}

Future<RobotSimulator> atCustomer(MockRobotApi api) async {
  final sim = newSimulator(api);
  await sim.sync();
  await driveToNextStop(sim);
  sim.markLoaded();
  await driveToNextStop(sim);
  return sim;
}

/// A demo API whose router bends every leg, and remembers what it was asked
class MockRouteApi extends MockRobotApi {
  MockRouteApi(List<List<LatLng>> asked)
    : super(
        router: (from, to) async {
          asked.add([from, to]);
          return [
            from,
            LatLng((from.lat + to.lat) / 2 + 0.0004, (from.lng + to.lng) / 2),
            to,
          ];
        },
      );
}

void main() {
  test('picks up the active trip and drives at walking pace', () async {
    final api = MockRobotApi();
    final sim = newSimulator(api);

    await sim.sync();
    expect(sim.status, RobotStatus.toPickup);
    expect(sim.trip?.id, 'demo-trip');

    final before = sim.remainingMetres;
    sim.advance(const Duration(seconds: 10));
    expect(sim.remainingMetres, closeTo(before - 14, 0.001)); // 1.4 m/s
    // The demo robot is a food robot: its small battery drains 1.3 times faster
    final drain = RobotSimulator.drainPerMetre * 1.3;
    expect(sim.battery, closeTo(100 - 14 * drain, 1e-9));
  });

  test('drains the battery faster in the cold', () async {
    Future<double> usedIn(Weather weather) async {
      final sim = newSimulator(MockRobotApi());
      await sim.sync();
      sim.setWeather(weather);
      sim.advance(const Duration(seconds: 100));
      return 100 - sim.battery;
    }

    final mild = await usedIn(Weather.mild);
    expect(mild, closeTo(140 * RobotSimulator.drainPerMetre * 1.3, 1e-9));
    expect(await usedIn(Weather.cold), closeTo(mild * 1.5, 1e-9));
    expect(await usedIn(Weather.frost), closeTo(mild * 2.2, 1e-9));
  });

  test(
    'a sync asked for during a running sync is repeated, not lost',
    () async {
      final api = MockRobotApi();
      final sim = newSimulator(api);
      final first = sim.sync();
      final second = sim.sync(); // e.g. a demo button pressed during the sync
      await Future.wait([first, second]);
      await settle();
      await settle();
      expect(api.reported.length, greaterThanOrEqualTo(2));
    },
  );

  test('a LOCK command at the shop means: loaded, drive on', () async {
    final api = MockRobotApi();
    final sim = newSimulator(api);
    await sim.sync();
    await driveToNextStop(sim);
    expect(sim.status, RobotStatus.loading);

    api.send(CommandType.lock, compartmentIndex: 0);
    await sim.sync();
    expect(sim.status, RobotStatus.onRoute);
    expect(sim.compartments.first.loaded, isTrue);
  });

  test('a parcel robot with a large compartment drains the least', () async {
    Future<double> usedBy(DemoKind kind) async {
      final api = MockRobotApi(profile: kind.profile('Test'));
      final sim = newSimulator(api);
      await sim.sync();
      sim.advance(const Duration(seconds: 100));
      return 100 - sim.battery;
    }

    final food = await usedBy(DemoKind.food);
    final small = await usedBy(DemoKind.parcelSmall);
    final large = await usedBy(DemoKind.parcelLarge);
    expect(food, greaterThan(small));
    expect(small, greaterThan(large));
  });

  test(
    'knows what it is: kind, compartment and how customers open it',
    () async {
      final sim = newSimulator(
        MockRobotApi(
          profile: DemoKind.parcelLarge.profile('P', unlockOnDevice: true),
        ),
      );
      expect(sim.profile, isNull);
      await sim.sync();
      expect(sim.profile?.kind, RobotKind.parcel);
      expect(sim.profile?.widthMm, 500);
      expect(sim.profile?.temperatureType, isNull);
      expect(sim.profile?.unlockOnDevice, isTrue);
    },
  );

  test('reports the temperature of the weather, and spoofs the GPS', () async {
    final api = MockRobotApi();
    final sim = newSimulator(api);
    await sim.sync();
    expect(api.reported.last.toJson()['temperature'], 18.0);
    sim.setWeather(Weather.frost);
    await sim.sync();
    expect(api.reported.last.toJson()['temperature'], -7.0);

    // Without spoofing: the real position
    expect(sim.reportedPosition.lat, sim.position.lat);
    // Noise: close to it, but not equal
    sim.setGpsSpoof(GpsSpoof.noise);
    final noisy = sim.reportedPosition;
    expect((noisy.lat - sim.position.lat).abs(), lessThan(0.0002));
    expect(
      noisy.lat == sim.position.lat && noisy.lng == sim.position.lng,
      isFalse,
    );
    // Random: somewhere near the station, not on the robot
    sim.setGpsSpoof(GpsSpoof.random);
    expect((sim.reportedPosition.lat - sim.home.lat).abs(), lessThan(0.005));
  });

  test('a PIN typed on the robot is checked by the platform', () async {
    final api = MockRobotApi(
      profile: DemoKind.food.profile('F', unlockOnDevice: true),
    );
    final sim = newSimulator(api);
    await sim.sync();
    await driveToNextStop(sim);
    sim.markLoaded();
    await driveToNextStop(sim);
    expect(sim.status, RobotStatus.atDropoff);

    expect(await sim.submitPin('0000'), isFalse);
    expect(sim.pinMessage, isNotNull);
    expect(sim.compartments.first.lidOpen, isFalse);

    expect(await sim.submitPin('1234'), isTrue);
    expect(sim.pinMessage, isNull);
    await settle();
    expect(sim.compartments.first.lidOpen, isTrue);
  });

  test('the way back follows the streets, not a straight line', () async {
    // The route home that the router found: it bends around a building
    const around = [
      LatLng(50.8282, 3.2608),
      LatLng(50.8290, 3.2570),
      LatLng(50.8260, 3.2530),
      LatLng(50.82473, 3.24975),
    ];
    final api = MockRobotApi(router: (from, to) async => around);
    final sim = newSimulator(api);
    await sim.sync();
    await driveToNextStop(sim);
    sim.markLoaded();
    await driveToNextStop(sim);
    api.send(CommandType.unlock, compartmentIndex: 0);
    await sim.sync();
    sim.closeLids();
    expect(sim.status, RobotStatus.returning);
    // At once on a straight line, so the robot never waits for the router
    expect(sim.path!.points, hasLength(2));

    await settle();
    expect(sim.status, RobotStatus.returning);
    expect(sim.path!.points, around);

    await driveToNextStop(sim);
    expect(sim.status, RobotStatus.available);
  });

  test('in demo mode the trip also follows the streets', () async {
    final asked = <List<LatLng>>[];
    final api = MockRouteApi(asked);
    final sim = newSimulator(api);
    await sim.sync();
    // station → shop and shop → customer, each along the streets
    expect(asked, hasLength(2));
    // two legs of 3 points, joined where the shop is
    expect(sim.path!.points, hasLength(5));
    expect(sim.path!.points.first.lat, closeTo(demoTrip.route.first.lat, 1e-9));
  });

  test('without a route the way back stays a straight line', () async {
    final api = MockRobotApi(router: (from, to) async => null);
    final sim = newSimulator(api);
    await sim.sync();
    await driveToNextStop(sim);
    sim.markLoaded();
    await driveToNextStop(sim);
    api.send(CommandType.returnHome);
    await sim.sync();
    await settle();
    expect(sim.status, RobotStatus.returning);
    expect(sim.path!.points, hasLength(2));
  });

  test(
    'a late route does not replace a way back that is already over',
    () async {
      final api = MockRobotApi(
        router: (from, to) async {
          await Future<void>.delayed(const Duration(milliseconds: 50));
          return [from, const LatLng(50.83, 3.26), to];
        },
      );
      final sim = newSimulator(api);
      await sim.sync();
      await driveToNextStop(sim);
      sim.markLoaded();
      await driveToNextStop(sim);
      api.send(CommandType.returnHome);
      await sim.sync();
      sim.advance(const Duration(hours: 1)); // already home
      expect(sim.status, RobotStatus.available);
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(sim.status, RobotStatus.available);
      expect(sim.path, isNull);
    },
  );

  test('reports telemetry in the format of the contract', () async {
    final api = MockRobotApi();
    final sim = newSimulator(api);
    await sim.sync();

    final json = api.reported.first.toJson();
    expect(json.keys, containsAll(['lat', 'lng', 'battery', 'compartments']));
    // One robot, one compartment
    expect(json['compartments'], [
      {'index': 0, 'lidOpen': false, 'locked': true},
    ]);
  });

  test('stops at the shop, gets loaded, drives on to the customer', () async {
    final api = MockRobotApi();
    final sim = newSimulator(api);
    await sim.sync();

    await driveToNextStop(sim);
    expect(sim.status, RobotStatus.loading);
    expect(sim.position.lat, closeTo(50.82680, 1e-9)); // the shop
    expect(api.reported.map((t) => t.event), contains(TelemetryEvent.arrived));

    sim.markLoaded();
    expect(sim.status, RobotStatus.onRoute);
    expect(sim.compartments.first.loaded, isTrue);
    expect(sim.compartments.first.locked, isTrue);

    await driveToNextStop(sim);
    expect(sim.status, RobotStatus.atDropoff);
    expect(sim.remainingMetres, closeTo(0, 0.001));
  });

  test(
    'the customer opens the compartment with UNLOCK, closing the lid delivers',
    () async {
      final api = MockRobotApi();
      final sim = await atCustomer(api);

      api.send(CommandType.unlock, compartmentIndex: 0);
      await sim.sync();
      expect(sim.compartments.first.locked, isFalse);
      expect(sim.compartments.first.lidOpen, isTrue);
      expect(api.acknowledged, hasLength(1));

      sim.closeLids();
      expect(sim.compartments.first.loaded, isFalse);
      expect(sim.compartments.first.locked, isTrue);
      expect(sim.status, RobotStatus.returning);

      sim.advance(const Duration(hours: 1));
      expect(sim.status, RobotStatus.available);
      expect(sim.trip, isNull);
      expect(sim.position.lat, sim.home.lat);

      // The same trip is not driven twice
      await sim.sync();
      expect(sim.status, RobotStatus.available);
    },
  );

  test('tilting stops the robot until a technician recovers it', () async {
    final api = MockRobotApi();
    final sim = newSimulator(api);
    await sim.sync();
    sim.advance(const Duration(seconds: 10));

    sim.report(TelemetryEvent.tilted);
    await settle();
    expect(sim.status, RobotStatus.stuck);
    expect(api.reported.last.event, TelemetryEvent.tilted);

    final remaining = sim.remainingMetres;
    sim.advance(const Duration(seconds: 10));
    expect(sim.remainingMetres, remaining); // a stuck robot does not move

    sim.recover();
    expect(sim.status, RobotStatus.toPickup);
  });

  test('a taken package raises an alarm and opens the compartment', () async {
    final api = MockRobotApi();
    final sim = newSimulator(api);
    await sim.sync();
    await driveToNextStop(sim);
    sim.markLoaded();

    sim.report(TelemetryEvent.packageTaken);
    await settle();
    expect(sim.status, RobotStatus.alarm);
    expect(sim.compartments.first.loaded, isFalse);
    expect(sim.compartments.first.lidOpen, isTrue);
    expect(api.reported.last.event, TelemetryEvent.packageTaken);
  });

  test(
    'STOP hands the robot to the technician, RETURN sends it home',
    () async {
      final api = MockRobotApi();
      final sim = newSimulator(api);
      await sim.sync();
      sim.advance(const Duration(seconds: 30));

      api.send(CommandType.stop);
      await sim.sync();
      expect(sim.status, RobotStatus.manualOverride);

      api.send(CommandType.returnHome);
      await sim.sync();
      expect(sim.status, RobotStatus.returning);
      sim.advance(const Duration(hours: 1));
      expect(sim.status, RobotStatus.available);
      expect(sim.position.lng, sim.home.lng);
    },
  );

  test('BEEP plays a sound and ignores unknown command types', () async {
    final api = MockRobotApi();
    final sim = newSimulator(api);
    var beeps = 0;
    sim.onBeep = () => beeps++;

    api.send(CommandType.beep);
    await sim.sync();
    expect(beeps, 1);
    expect(RobotCommand.fromJson({'id': '1', 'type': 'DANCE'}), isNull);
  });

  test(
    'keeps events while the platform is unreachable and sends them later',
    () async {
      final api = _FlakyApi();
      final sim = newSimulator(api);

      sim.report(TelemetryEvent.stuck);
      await settle();
      expect(sim.lastError, isNotNull);
      expect(sim.log.first.kind, LogKind.apiError);

      api.online = true;
      await sim.sync();
      expect(sim.lastError, isNull);
      expect(api.reported.map((t) => t.event), [TelemetryEvent.stuck]);
    },
  );
}

class _FlakyApi extends MockRobotApi {
  _FlakyApi() : super(trip: null);
  bool online = false;

  @override
  Future<void> reportTelemetry(Telemetry telemetry) async {
    if (!online) throw const RobotApiException('offline');
    await super.reportTelemetry(telemetry);
  }
}
