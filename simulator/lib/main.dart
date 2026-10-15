import 'package:flutter/material.dart';

import 'src/app.dart';
import 'src/language.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // The language chosen last time, before the first frame (no flash of another language)
  final language = LanguageController();
  await language.load();
  runApp(BotApp(language: language));
}
