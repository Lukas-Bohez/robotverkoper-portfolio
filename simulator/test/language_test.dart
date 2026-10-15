import 'package:bot/src/app.dart';
import 'package:bot/src/language.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('resolveLocale', () {
    test('takes the language of the device when the app speaks it', () {
      expect(resolveLocale(const [Locale('fr', 'BE')]), const Locale('fr'));
      expect(resolveLocale(const [Locale('en', 'US')]), const Locale('en'));
    });

    test('takes the first language of the device that the app speaks', () {
      expect(
        resolveLocale(const [Locale('es'), Locale('de', 'DE')]),
        const Locale('de'),
      );
    });

    test('falls back to Dutch, not to the first of the list (German)', () {
      expect(resolveLocale(const [Locale('pl')]), const Locale('nl'));
      expect(resolveLocale(null), const Locale('nl'));
    });
  });

  group('LanguageController', () {
    test('follows the device until a language is chosen', () async {
      final language = LanguageController();
      await language.load();
      expect(language.locale, isNull);
    });

    test('keeps the chosen language for the next start', () async {
      await LanguageController().choose('fr');

      final next = LanguageController();
      await next.load();
      expect(next.locale, const Locale('fr'));
    });

    test('ignores a language the app does not speak', () async {
      SharedPreferences.setMockInitialValues({'language': 'xx'});
      final language = LanguageController();
      await language.load();
      expect(language.locale, isNull);

      await language.choose('xx');
      expect(language.locale, isNull);
    });
  });

  testWidgets('the language menu switches the whole app', (tester) async {
    tester.platformDispatcher.localesTestValue = const [Locale('en', 'US')];
    addTearDown(tester.platformDispatcher.clearLocalesTestValue);
    final language = LanguageController();
    await tester.pumpWidget(BotApp(language: language, pairingEnabled: false));
    await tester.pumpAndSettle();
    expect(find.text('Start the robot'), findsOneWidget);

    await tester.tap(find.byKey(const Key('language')));
    await tester.pumpAndSettle();
    // Each language in its own name
    for (final name in ['Nederlands', 'English', 'Français', 'Deutsch']) {
      expect(find.text(name), findsOneWidget);
    }
    await tester.tap(find.byKey(const Key('language-nl')));
    await tester.pumpAndSettle();

    expect(find.text('Start de robot'), findsOneWidget);
    expect(language.locale, const Locale('nl'));
    final saved = await SharedPreferences.getInstance();
    expect(saved.getString('language'), 'nl');
  });
}
