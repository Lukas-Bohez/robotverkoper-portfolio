import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import 'language.dart';
import 'ui/connect_screen.dart';

class BotApp extends StatelessWidget {
  const BotApp({super.key, required this.language});

  /// The language chosen in the app (menu in the app bar); none: the language of the device
  final LanguageController language;

  @override
  Widget build(BuildContext context) {
    return LanguageScope(
      controller: language,
      child: ListenableBuilder(
        listenable: language,
        builder: (context, _) => MaterialApp(
          onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
          debugShowCheckedModeBanner: false,
          theme: ThemeData(
            colorSchemeSeed: const Color(0xFF00C16A),
            useMaterial3: true,
          ),
          darkTheme: ThemeData(
            colorSchemeSeed: const Color(0xFF00C16A),
            brightness: Brightness.dark,
            useMaterial3: true,
          ),
          locale: language.locale,
          localeListResolutionCallback: (device, _) => resolveLocale(device),
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: const ConnectScreen(),
        ),
      ),
    );
  }
}
