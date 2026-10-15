import 'dart:convert';
import 'dart:io';

import 'package:bot/src/language.dart';
import 'package:flutter_test/flutter_test.dart';

/// The texts of one language: lib/l10n/app_<code>.arb (keys with @ are metadata)
Map<String, dynamic> arb(String code) =>
    jsonDecode(File('lib/l10n/app_$code.arb').readAsStringSync())
        as Map<String, dynamic>;

Map<String, String> texts(String code) => {
  for (final entry in arb(code).entries)
    if (!entry.key.startsWith('@')) entry.key: entry.value as String,
};

/// How often a placeholder is used: `{name}` as a value, `{name,` as the subject of a select
int uses(String text, String name) =>
    RegExp('\\{$name[},]').allMatches(text).length;

/// Like the platform's src/i18n/__tests__/languages.spec.ts: Dutch is the base,
/// every other language has exactly its texts and keeps every placeholder.
void main() {
  final dutch = texts('nl');
  final placeholders = {
    for (final entry in arb('nl').entries)
      if (entry.key.startsWith('@') && entry.value is Map)
        entry.key.substring(1): [
          ...((entry.value as Map)['placeholders'] as Map? ?? {}).keys
              .cast<String>(),
        ],
  };

  test('has the four languages of Belgium, Dutch first', () {
    expect(supportedLanguages, ['nl', 'en', 'fr', 'de']);
    for (final code in supportedLanguages) {
      expect(arb(code)['@@locale'], code);
      expect(languageNames[code], isNotEmpty);
    }
  });

  for (final code in supportedLanguages.where((code) => code != 'nl')) {
    test('$code has exactly the texts of the Dutch version', () {
      final other = texts(code);
      expect(other.keys.where((key) => !dutch.containsKey(key)), isEmpty);
      expect(dutch.keys.where((key) => !other.containsKey(key)), isEmpty);
    });

    test('$code keeps every {placeholder} of the Dutch text', () {
      final other = texts(code);
      final wrong = [
        for (final MapEntry(key: key, value: names) in placeholders.entries)
          for (final name in names)
            if (uses(other[key] ?? '', name) != uses(dutch[key]!, name))
              '$key.$name',
      ];
      expect(wrong, isEmpty);
    });
  }

  test('has no empty texts', () {
    for (final code in supportedLanguages) {
      expect(
        texts(code).entries.where((entry) => entry.value.trim().isEmpty),
        isEmpty,
        reason: code,
      );
    }
  });
}
