import 'dart:convert';

import 'package:bot/l10n/app_localizations.dart';
import 'package:bot/src/api/pairing_client.dart';
import 'package:bot/src/api/pairing_watcher.dart';
import 'package:bot/src/ui/connect_screen.dart';
import 'package:bot/src/ui/fleet_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget inApp(Widget child) => MaterialApp(
  locale: const Locale('nl'),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  home: child,
);

http.Response json(int status, Object body) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json'},
);

/// A seller API that answers from a script: no network
class FakePairingClient extends PairingClient {
  FakePairingClient({this.steps = const [], this.failStart = false})
    : super(
        sellerApi: Uri.parse('http://seller.test'),
        device: 'Test-simulator',
      );

  /// What each check answers: null (nobody yet), a delivery, or an exception
  final List<Object?> steps;
  final bool failStart;
  int started = 0;
  int checks = 0;
  int cancelled = 0;

  @override
  Future<PairingTicket> start() async {
    if (failStart) throw const PairingException('down');
    started++;
    return PairingTicket(
      id: 'p$started',
      secret: 's$started',
      code:
          'AB$started'
          'XY',
    );
  }

  @override
  Future<PairingDelivery?> check(PairingTicket ticket) async {
    final step = checks < steps.length ? steps[checks] : null;
    checks++;
    if (step is Exception) throw step;
    return step as PairingDelivery?;
  }

  @override
  Future<void> cancel(PairingTicket ticket) async => cancelled++;
}

const delivery = PairingDelivery(
  apiKey: 'rb_secret-key-123',
  robotName: 'Food Robot 2',
  platformUrl: 'http://localhost:4100/graphql',
);

void main() {
  group('PairingClient', () {
    test('announces the device and gets a ticket', () async {
      late http.Request seen;
      final client = PairingClient(
        sellerApi: Uri.parse('http://localhost:4200'),
        device: 'Windows-simulator',
        client: MockClient((request) async {
          seen = request;
          return json(201, {'id': 'p1', 'secret': 's1', 'code': '4K7Q'});
        }),
      );
      final ticket = await client.start();
      expect(seen.method, 'POST');
      expect(seen.url.toString(), 'http://localhost:4200/pairings');
      expect(jsonDecode(seen.body), {'device': 'Windows-simulator'});
      expect((ticket.id, ticket.secret, ticket.code), ('p1', 's1', '4K7Q'));
    });

    test('keeps waiting while nobody gave a key, then gets it', () async {
      var answers = 0;
      final client = PairingClient(
        sellerApi: Uri.parse('http://localhost:4200'),
        client: MockClient((request) async {
          expect(request.headers['x-pairing-secret'], 's1');
          expect(request.url.path, '/pairings/p1');
          answers++;
          return answers == 1
              ? json(200, {'status': 'waiting'})
              : json(200, {
                  'status': 'delivered',
                  'apiKey': 'rb_abc',
                  'robotName': 'Food Robot 2',
                  'platformUrl': 'http://localhost:4100/graphql',
                });
        }),
      );
      const ticket = PairingTicket(id: 'p1', secret: 's1', code: '4K7Q');
      expect(await client.check(ticket), isNull);
      final got = await client.check(ticket);
      expect(got!.apiKey, 'rb_abc');
      expect(got.robotName, 'Food Robot 2');
      expect(got.platformUrl, 'http://localhost:4100/graphql');
    });

    test(
      'says when the pairing expired and when the API is not there',
      () async {
        const ticket = PairingTicket(id: 'p1', secret: 's1', code: 'X');
        final gone = PairingClient(
          sellerApi: Uri.parse('http://localhost:4200'),
          client: MockClient(
            (_) async => json(404, {'code': 'pairing_not_found'}),
          ),
        );
        await expectLater(gone.check(ticket), throwsA(isA<PairingExpired>()));

        final down = PairingClient(
          sellerApi: Uri.parse('http://localhost:4200'),
          client: MockClient(
            (_) async => throw http.ClientException('refused'),
          ),
        );
        await expectLater(down.start(), throwsA(isA<PairingException>()));
        await expectLater(down.check(ticket), throwsA(isA<PairingException>()));
        await down.cancel(ticket); // never throws
      },
    );

    test('names the device after the platform it runs on', () {
      expect(defaultDeviceName(), isNotEmpty);
    });
  });

  group('PairingWatcher', () {
    PairingWatcher watcherFor(
      FakePairingClient client, {
      void Function(PairingDelivery)? onDelivery,
    }) => PairingWatcher(
      clientFactory: (_) => client,
      interval: const Duration(milliseconds: 5),
      retry: const Duration(milliseconds: 5),
      onDelivery: onDelivery,
    );

    Future<void> until(bool Function() condition) async {
      for (var i = 0; i < 400 && !condition(); i++) {
        await Future<void>.delayed(const Duration(milliseconds: 5));
      }
      expect(condition(), isTrue, reason: 'it did not happen in time');
    }

    test('waits with a code, reports the key once and stops', () async {
      final got = <PairingDelivery>[];
      final client = FakePairingClient(steps: [null, null, delivery]);
      final watcher = watcherFor(client, onDelivery: got.add);
      addTearDown(watcher.dispose);
      watcher.start(Uri.parse('http://seller.test'));
      await until(() => watcher.state == PairingState.waiting);
      expect(watcher.code, 'AB1XY');
      await until(() => got.isNotEmpty);
      expect(got.single.apiKey, 'rb_secret-key-123');
      await until(() => watcher.state == PairingState.idle);
      final checks = client.checks;
      await Future<void>.delayed(const Duration(milliseconds: 40));
      expect(client.checks, checks, reason: 'it stopped asking');
    });

    test('keeps waiting for the next robot when asked to', () async {
      final got = <PairingDelivery>[];
      final second = PairingDelivery(
        apiKey: 'rb_two',
        robotName: 'Robot 3',
        platformUrl: delivery.platformUrl,
      );
      final client = FakePairingClient(steps: [delivery, null, second]);
      final watcher = watcherFor(client, onDelivery: got.add);
      addTearDown(watcher.dispose);
      watcher.start(Uri.parse('http://seller.test'), keepWaiting: true);
      await until(() => got.length == 2);
      expect(got.map((d) => d.apiKey), ['rb_secret-key-123', 'rb_two']);
      expect(
        client.started,
        greaterThanOrEqualTo(2),
        reason: 'a new pairing after every key',
      );
    });

    test('says it cannot reach the seller API, and tries again', () async {
      final client = FakePairingClient(failStart: true);
      final watcher = watcherFor(client);
      addTearDown(watcher.dispose);
      watcher.start(Uri.parse('http://seller.test'));
      await until(() => watcher.state == PairingState.unreachable);
      expect(watcher.code, isNull);
    });

    test('asks for a new pairing when the old one expired', () async {
      final client = FakePairingClient(steps: [const PairingExpired(), null]);
      final watcher = watcherFor(client);
      addTearDown(watcher.dispose);
      watcher.start(Uri.parse('http://seller.test'));
      await until(() => client.started >= 2);
      expect(watcher.state, PairingState.waiting);
    });

    test('tells the seller API when it stops', () async {
      final client = FakePairingClient();
      final watcher = watcherFor(client);
      watcher.start(Uri.parse('http://seller.test'));
      await until(() => watcher.state == PairingState.waiting);
      watcher.stop();
      expect(client.cancelled, 1);
      expect(watcher.state, PairingState.idle);
      watcher.dispose();
    });
  });

  group('the platform tab', () {
    setUp(() => SharedPreferences.setMockInitialValues({}));

    testWidgets(
      'shows the code while it waits, and fills in the key when the seller gives it',
      (tester) async {
        tester.view.physicalSize = const Size(800, 3000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        final client = FakePairingClient(steps: [null, delivery]);
        await tester.pumpWidget(
          inApp(ConnectScreen(pairingClientFactory: (_) => client)),
        );
        await tester.pump(const Duration(milliseconds: 50));
        await tester.pump(const Duration(milliseconds: 50));
        expect(find.byKey(const Key('pairing')), findsOneWidget);
        expect(find.byKey(const Key('pairing-status')), findsOneWidget);
        expect(
          find.text('Wachten op een robot van de verkopers-PWA…'),
          findsOneWidget,
        );
        expect(find.text('Code: AB1XY'), findsOneWidget);

        // The seller makes a robot: its key and address are in the form, nothing was copied
        await tester.pump(const Duration(seconds: 2));
        await tester.pump(const Duration(seconds: 2));
        expect(
          find.text('Sleutel van Food Robot 2 ontvangen. Tik op Start.'),
          findsOneWidget,
        );
        expect(
          tester
              .widget<TextFormField>(find.byKey(const Key('platform-key')))
              .controller!
              .text,
          'rb_secret-key-123',
        );
        expect(
          tester
              .widget<TextFormField>(find.byKey(const Key('platform-url')))
              .controller!
              .text,
          'http://localhost:4100/graphql',
        );
        expect(
          tester
              .widget<TextFormField>(find.byKey(const Key('robot-name')))
              .controller!
              .text,
          'Food Robot 2',
        );
        expect(client.cancelled, 0);
        await tester.pumpWidget(const SizedBox());
      },
    );

    testWidgets(
      'says the seller API is not reachable, and the key can still be typed',
      (tester) async {
        tester.view.physicalSize = const Size(800, 3000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(
          inApp(
            ConnectScreen(
              pairingClientFactory: (_) => FakePairingClient(failStart: true),
            ),
          ),
        );
        await tester.pump(const Duration(milliseconds: 50));
        await tester.pump(const Duration(milliseconds: 50));
        expect(
          find.text(
            'De verkopers-API is niet bereikbaar. Vul de sleutel zelf in.',
          ),
          findsOneWidget,
        );
        expect(find.byKey(const Key('platform-key')), findsOneWidget);
        await tester.pumpWidget(const SizedBox());
      },
    );

    testWidgets('demo mode does not wait for anything', (tester) async {
      tester.view.physicalSize = const Size(800, 3000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final client = FakePairingClient();
      await tester.pumpWidget(
        inApp(ConnectScreen(pairingClientFactory: (_) => client)),
      );
      await tester.pump(const Duration(milliseconds: 50));
      await tester.tap(find.byIcon(LucideIcons.flaskConical));
      await tester.pump(const Duration(milliseconds: 50));
      expect(find.byKey(const Key('pairing')), findsNothing);
      expect(client.cancelled, 1, reason: 'it told the seller API it left');
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets(
      'a robot that the seller makes later joins the running fleet by itself',
      (tester) async {
        tester.view.physicalSize = const Size(800, 3000);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        final client = FakePairingClient(steps: [null, null, delivery]);
        final first = FleetEntry.demo('Robot #1', DemoKind.food);
        await tester.pumpWidget(
          inApp(
            FleetScreen(
              first: first,
              endpoint: Uri.parse('http://localhost:4100/graphql'),
              sellerApi: Uri.parse('http://seller.test'),
              pairingClientFactory: (_) => client,
            ),
          ),
        );
        expect(find.byType(NavigationBar), findsNothing);
        for (var i = 0; i < 4; i++) {
          await tester.pump(const Duration(seconds: 2));
        }
        expect(find.byType(NavigationBar), findsOneWidget);
        expect(
          find.text('Food Robot 2 is toegevoegd aan de robots.'),
          findsOneWidget,
        );
        await tester.pumpWidget(const SizedBox());
        expect(client.cancelled, greaterThanOrEqualTo(1));
      },
    );
  });
}
