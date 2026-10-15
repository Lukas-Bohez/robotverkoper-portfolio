import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../l10n/app_localizations.dart';
import '../../language.dart';

/// The language button in the app bar: Nederlands, English, Français, Deutsch
class LanguageMenu extends StatelessWidget {
  const LanguageMenu({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = LanguageScope.maybeOf(context);
    if (controller == null) return const SizedBox.shrink();
    final current = Localizations.localeOf(context).languageCode;
    return PopupMenuButton<String>(
      key: const Key('language'),
      tooltip: AppLocalizations.of(context).language,
      icon: const Icon(LucideIcons.languages),
      initialValue: current,
      onSelected: controller.choose,
      itemBuilder: (context) => [
        for (final code in supportedLanguages)
          CheckedPopupMenuItem(
            key: Key('language-$code'),
            value: code,
            checked: code == current,
            // A screen reader reads each name in its own language
            child: Text(languageNames[code]!, locale: Locale(code)),
          ),
      ],
    );
  }
}
