import 'package:bot/l10n/app_localizations.dart';
import 'package:bot/src/api/mock_robot_api.dart';
import 'package:bot/src/simulation/robot_simulator.dart';
import 'package:bot/src/ui/connect_screen.dart';
import 'package:bot/src/ui/fleet_screen.dart';
import 'package:bot/src/ui/robot_screen.dart';
import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter_test/flutter_test.dart';

Widget inApp(Widget child, {Locale locale = const Locale('nl')}) => MaterialApp(
  locale: locale,
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: child,
);

/// A phone-sized but tall screen, so the whole robot screen is built at once
void tallScreen(WidgetTester tester) {
  tester.view.physicalSize = const Size(800, 3000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Future<RobotSimulator> showRobot(
  WidgetTester tester, {
  Locale locale = const Locale('nl'),
}) async {
  tallScreen(tester);
  final api = MockRobotApi();
  final sim = RobotSimulator(api: api, name: 'Robot #1');
  await tester.pumpWidget(
    inApp(
      RobotScreen(simulator: sim, demoApi: api, autoStart: false),
      locale: locale,
    ),
  );
  return sim;
}

void main() {
  testWidgets('shows the robot and follows its status', (tester) async {
    final sim = await showRobot(tester);

    expect(find.text('Robot #1'), findsOneWidget);
    expect(find.byKey(const Key('status')), findsOneWidget);
    expect(find.text('Beschikbaar'), findsOneWidget);
    expect(
      find.text('Geen rit. De robot wacht op een bestelling.'),
      findsOneWidget,
    );

    await sim.sync();
    await tester.pump();
    expect(find.text('Onderweg naar de zaak'), findsOneWidget);
    expect(find.byKey(const Key('remaining')), findsOneWidget);
  });

  testWidgets('a scenario button reports an incident, recover continues', (
    tester,
  ) async {
    final sim = await showRobot(tester);
    await sim.sync();
    await tester.pump();

    await tester.tap(find.byKey(const Key('scenario-tilted')));
    await tester.pump();
    final status = find.byKey(const Key('status'));
    expect(tester.widget<Text>(status).data, 'Vastgelopen');

    await tester.tap(find.byKey(const Key('recover')));
    await tester.pump();
    expect(tester.widget<Text>(status).data, 'Onderweg naar de zaak');
  });

  testWidgets('the loaded button appears at the shop', (tester) async {
    final sim = await showRobot(tester);
    await sim.sync();
    sim.advance(const Duration(hours: 1));
    await tester.pump();

    expect(find.text('Wacht tot de zaak laadt'), findsOneWidget);
    await tester.tap(find.byKey(const Key('mark-loaded')));
    await tester.pump();
    expect(find.text('Onderweg naar de klant'), findsOneWidget);
  });

  testWidgets('the demo panel plays the platform: UNLOCK opens a compartment', (
    tester,
  ) async {
    final sim = await showRobot(tester);
    await sim.sync();
    sim.advance(const Duration(hours: 1));
    sim.markLoaded();
    sim.advance(const Duration(hours: 1));
    await tester.pump();

    await tester.tap(find.byKey(const Key('demo-unlock')));
    await tester.pump();
    expect(sim.compartments.first.lidOpen, isTrue);
    expect(find.byKey(const Key('close-lid')), findsOneWidget);

    await tester.tap(find.byKey(const Key('close-lid')));
    await tester.pump();
    expect(find.text('Terug naar het station'), findsOneWidget);
  });

  testWidgets('shows one compartment and tells what to do now', (tester) async {
    await showRobot(tester);
    expect(find.byKey(const Key('compartment-0')), findsOneWidget);
    expect(find.byKey(const Key('compartment-1')), findsNothing);
    expect(find.text('Vakken'), findsNothing);
    expect(find.textContaining('start je hieronder een rit'), findsOneWidget);
    expect(find.byKey(const Key('demo-new-trip')), findsOneWidget);
  });

  testWidgets('scenario buttons are off when they make no sense', (
    tester,
  ) async {
    final sim = await showRobot(tester);
    bool enabled(String key) =>
        tester.widget<OutlinedButton>(find.byKey(Key(key))).onPressed != null;

    expect(enabled('scenario-tilted'), isFalse);
    expect(enabled('scenario-arrived'), isFalse);

    await sim.sync();
    await tester.pump();
    expect(enabled('scenario-tilted'), isTrue);
    expect(enabled('scenario-arrived'), isTrue);
    expect(enabled('scenario-package-taken'), isFalse); // nothing loaded yet
  });

  testWidgets('the new-trip button starts a trip', (tester) async {
    final sim = await showRobot(tester);
    await tester.tap(find.byKey(const Key('demo-new-trip')));
    await tester.pump();
    await tester.pump();
    expect(find.text('Onderweg naar de zaak'), findsOneWidget);
    expect(sim.trip, isNotNull);
  });

  testWidgets('shows what kind of robot it is and how big its compartment is', (
    tester,
  ) async {
    tallScreen(tester);
    final entry = FleetEntry.demo('P1', DemoKind.parcelLarge);
    await tester.pumpWidget(
      inApp(
        RobotScreen(
          simulator: entry.simulator,
          demoApi: entry.demoApi,
          autoStart: false,
        ),
      ),
    );
    await entry.simulator.sync();
    await tester.pump();
    expect(
      find.descendant(
        of: find.byKey(const Key('robot-kind')),
        matching: find.text('Pakketrobot'),
      ),
      findsOneWidget,
    );
    expect(find.textContaining('500 × 400 × 500 mm'), findsOneWidget);
  });

  testWidgets(
    'a company that opens on the robot gets a PIN pad at the customer',
    (tester) async {
      tallScreen(tester);
      final entry = FleetEntry.demo('F1', DemoKind.food, unlockOnDevice: true);
      final sim = entry.simulator;
      await tester.pumpWidget(
        inApp(
          RobotScreen(simulator: sim, demoApi: entry.demoApi, autoStart: false),
        ),
      );
      await sim.sync();
      sim.advance(const Duration(hours: 1));
      sim.markLoaded();
      sim.advance(const Duration(hours: 1));
      await tester.pump();

      expect(find.byKey(const Key('pin-field')), findsOneWidget);
      expect(find.byKey(const Key('demo-unlock')), findsNothing);

      await tester.enterText(find.byKey(const Key('pin-field')), '0000');
      await tester.tap(find.byKey(const Key('pin-submit')));
      await tester.pump();
      await tester.pump();
      expect(find.byKey(const Key('pin-error')), findsOneWidget);
      expect(sim.compartments.first.lidOpen, isFalse);

      await tester.enterText(find.byKey(const Key('pin-field')), '1234');
      await tester.tap(find.byKey(const Key('pin-submit')));
      await tester.pump();
      await tester.pump();
      await tester.pump();
      expect(sim.compartments.first.lidOpen, isTrue);
      expect(find.byKey(const Key('close-lid')), findsOneWidget);
    },
  );

  testWidgets('several robots in one app: add one, switch between them', (
    tester,
  ) async {
    tallScreen(tester);
    final first = FleetEntry.demo('Robot #1', DemoKind.food);
    await tester.pumpWidget(inApp(FleetScreen(first: first)));
    expect(find.byType(NavigationBar), findsNothing);

    await tester.tap(find.byKey(const Key('add-robot')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('add-robot-submit')));
    await tester.pumpAndSettle();

    expect(find.byType(NavigationBar), findsOneWidget);
    expect(find.text('Robot #2'), findsWidgets);

    // Both robots live on: the second one is the visible one now
    await tester.tap(find.byType(NavigationDestination).first);
    await tester.pumpAndSettle();
    expect(find.text('Robot #1'), findsWidgets);
  });

  testWidgets('speaks English too', (tester) async {
    await showRobot(tester, locale: const Locale('en'));
    expect(find.text('Available'), findsOneWidget);
  });

  testWidgets('the connect screen starts a demo robot', (tester) async {
    tallScreen(tester);
    await tester.pumpWidget(inApp(const ConnectScreen(pairingEnabled: false)));
    expect(find.text('Deze gsm wordt een bezorgrobot'), findsOneWidget);

    // The platform is the default; demo mode plays the platform itself
    expect(find.byKey(const Key('platform-key')), findsOneWidget);
    await tester.tap(find.byIcon(LucideIcons.flaskConical));
    await tester.pump();
    await tester.tap(find.byKey(const Key('start')));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1)); // page transition
    expect(find.text('Robot #1'), findsOneWidget);

    // Leaving the robot screen stops the simulator and its timers
    await tester.tap(find.byType(BackButton));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    expect(find.text('Deze gsm wordt een bezorgrobot'), findsOneWidget);
  });

  testWidgets('the connect screen says what is wrong in a field', (
    tester,
  ) async {
    tallScreen(tester);
    await tester.pumpWidget(inApp(const ConnectScreen(pairingEnabled: false)));

    await tester.enterText(find.byKey(const Key('robot-name')), ' ');
    await tester.enterText(find.byKey(const Key('platform-url')), 'localhost');
    await tester.enterText(find.byKey(const Key('platform-key')), '');
    await tester.tap(find.byKey(const Key('start')));
    await tester.pump();

    expect(find.text('Geef de robot een naam.'), findsOneWidget);
    expect(
      find.text(
        'Vul een volledig adres in, bv. http://localhost:3000/graphql.',
      ),
      findsOneWidget,
    );
    expect(find.text('Vul de API-key van de robot in.'), findsOneWidget);
    expect(find.text('Robot #1'), findsNothing); // did not start
  });

  test('an API address needs http(s) and a host', () {
    expect(isHttpUrl('http://localhost:3000/graphql'), isTrue);
    expect(isHttpUrl(' https://api.example.com/graphql '), isTrue);
    expect(isHttpUrl('localhost:3000'), isFalse);
    expect(isHttpUrl('ftp://localhost/graphql'), isFalse);
    expect(isHttpUrl('http://'), isFalse);
  });

  testWidgets('adding a platform robot without its API key says so', (
    tester,
  ) async {
    tallScreen(tester);
    final first = FleetEntry.demo('Robot #1', DemoKind.food);
    await tester.pumpWidget(
      inApp(FleetScreen(first: first, endpoint: Uri.parse('http://localhost'))),
    );

    await tester.tap(find.byKey(const Key('add-robot')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('add-robot-submit')));
    await tester.pump();

    expect(find.text('Vul de API-key van de robot in.'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing); // no second robot
  });

  group('on a computer (Windows)', () {
    final windows = TargetPlatformVariant.only(TargetPlatform.windows);

    testWidgets('the connect screen does not talk about a phone', (
      tester,
    ) async {
      tallScreen(tester);
      await tester.pumpWidget(
        inApp(const ConnectScreen(pairingEnabled: false)),
      );
      expect(find.text('Deze computer speelt een bezorgrobot'), findsOneWidget);
      expect(find.text('Deze gsm wordt een bezorgrobot'), findsNothing);
    }, variant: windows);

    testWidgets('there is no switch for sensors it does not have', (
      tester,
    ) async {
      await showRobot(tester);
      expect(find.byKey(const Key('sensors')), findsNothing);
      expect(find.byKey(const Key('scenario-tilted')), findsOneWidget);
    }, variant: windows);
  });

  testWidgets('a phone can use its sensors', (tester) async {
    await showRobot(tester);
    expect(find.byKey(const Key('sensors')), findsOneWidget);
  }, variant: TargetPlatformVariant.only(TargetPlatform.android));
}
