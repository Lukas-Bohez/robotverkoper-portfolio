import 'package:flutter/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Belgium: Dutch, English, French and German, as in the platform. Dutch is the base language.
const supportedLanguages = ['nl', 'en', 'fr', 'de'];

/// How a language is shown in the menu: always in its own language
const languageNames = {
  'nl': 'Nederlands',
  'en': 'English',
  'fr': 'Français',
  'de': 'Deutsch',
};

/// The first language of the device that the app speaks, else Dutch.
/// (Flutter itself would take the first of its list, which is German.)
Locale resolveLocale(List<Locale>? device) {
  for (final locale in device ?? const <Locale>[]) {
    if (supportedLanguages.contains(locale.languageCode)) {
      return Locale(locale.languageCode);
    }
  }
  return const Locale('nl');
}

/// The language chosen in the app, kept between starts. Null: follow the device.
class LanguageController extends ChangeNotifier {
  static const _key = 'language';

  Locale? _locale;
  Locale? get locale => _locale;

  /// Reads the saved choice; without one (or without storage) the app follows the device
  Future<void> load() async {
    try {
      final saved = (await SharedPreferences.getInstance()).getString(_key);
      if (saved != null && supportedLanguages.contains(saved)) {
        _locale = Locale(saved);
        notifyListeners();
      }
    } on Object {
      // No storage: follow the device
    }
  }

  Future<void> choose(String code) async {
    if (!supportedLanguages.contains(code)) return;
    _locale = Locale(code);
    notifyListeners();
    try {
      await (await SharedPreferences.getInstance()).setString(_key, code);
    } on Object {
      // Not kept, the choice still applies until the app closes
    }
  }
}

/// Gives the screens below it the [LanguageController]
class LanguageScope extends InheritedNotifier<LanguageController> {
  const LanguageScope({
    super.key,
    required LanguageController controller,
    required super.child,
  }) : super(notifier: controller);

  /// Null in tests that show a screen without the app around it
  static LanguageController? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<LanguageScope>()?.notifier;
}
