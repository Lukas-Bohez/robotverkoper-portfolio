import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../l10n/app_localizations.dart';
import '../sensors/device.dart';
import 'fleet_screen.dart';
import 'widgets/language_menu.dart';

enum ConnectMode { demo, platform }

/// A full http(s) address with a host, e.g. http://localhost:3000/graphql
bool isHttpUrl(String value) {
  final uri = Uri.tryParse(value.trim());
  return uri != null &&
      (uri.scheme == 'http' || uri.scheme == 'https') &&
      uri.host.isNotEmpty;
}

/// Choose demo mode or connect to the platform with the API key of a robot.
class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  ConnectMode _mode = ConnectMode.platform;
  DemoKind _demoKind = DemoKind.food;
  bool _demoPin = false;
  final _name = TextEditingController(text: 'Robot #1');
  final _url = TextEditingController(text: 'http://localhost:3000/graphql');
  // The API key of the demo robot that the seed creates (see the Robots page of the platform)
  final _key = TextEditingController(text: 'demo-robot-key-0001');
  final _form = GlobalKey<FormState>();

  @override
  void dispose() {
    _name.dispose();
    _url.dispose();
    _key.dispose();
    super.dispose();
  }

  void _start() {
    if (!_form.currentState!.validate()) return;
    final name = _name.text.trim();
    final endpoint = Uri.parse(_url.text.trim());
    final entry = _mode == ConnectMode.demo
        ? FleetEntry.demo(name, _demoKind, unlockOnDevice: _demoPin)
        : FleetEntry.platform(name, endpoint, _key.text.trim());
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => FleetScreen(
          first: entry,
          endpoint: _mode == ConnectMode.platform ? endpoint : null,
          unlockOnDevice: _demoPin,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.appTitle),
        actions: const [LanguageMenu(), SizedBox(width: 8)],
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Form(
            key: _form,
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  hasMotionSensors
                      ? l10n.connectTitle
                      : l10n.connectTitleDesktop,
                  style: text.headlineSmall,
                ),
                const SizedBox(height: 8),
                Text(
                  hasMotionSensors
                      ? l10n.connectIntro
                      : l10n.connectIntroDesktop,
                ),
                const SizedBox(height: 24),
                SegmentedButton<ConnectMode>(
                  segments: [
                    ButtonSegment(
                      value: ConnectMode.demo,
                      label: Text(l10n.modeDemo),
                      icon: const Icon(LucideIcons.flaskConical),
                    ),
                    ButtonSegment(
                      value: ConnectMode.platform,
                      label: Text(l10n.modeApi),
                      icon: const Icon(LucideIcons.cloud),
                    ),
                  ],
                  selected: {_mode},
                  onSelectionChanged: (selection) =>
                      setState(() => _mode = selection.first),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  key: const Key('robot-name'),
                  controller: _name,
                  decoration: InputDecoration(labelText: l10n.robotName),
                  validator: (value) => (value ?? '').trim().isEmpty
                      ? l10n.robotNameRequired
                      : null,
                ),
                if (_mode == ConnectMode.demo)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(l10n.modeDemoHint, style: text.bodySmall),
                        const SizedBox(height: 12),
                        DemoKindPicker(
                          value: _demoKind,
                          onChanged: (kind) => setState(() => _demoKind = kind),
                        ),
                        SwitchListTile(
                          key: const Key('demo-pin'),
                          contentPadding: EdgeInsets.zero,
                          title: Text(l10n.demoPin),
                          value: _demoPin,
                          onChanged: (on) => setState(() => _demoPin = on),
                        ),
                      ],
                    ),
                  )
                else ...[
                  const SizedBox(height: 12),
                  TextFormField(
                    key: const Key('platform-url'),
                    controller: _url,
                    decoration: InputDecoration(labelText: l10n.apiUrl),
                    keyboardType: TextInputType.url,
                    validator: (value) =>
                        isHttpUrl(value ?? '') ? null : l10n.apiUrlInvalid,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    key: const Key('platform-key'),
                    controller: _key,
                    decoration: InputDecoration(
                      labelText: l10n.apiKey,
                      helperText: l10n.apiKeyHint,
                    ),
                    validator: (value) => (value ?? '').trim().isEmpty
                        ? l10n.apiKeyRequired
                        : null,
                  ),
                ],
                const SizedBox(height: 24),
                FilledButton.icon(
                  key: const Key('start'),
                  onPressed: _start,
                  icon: const Icon(LucideIcons.play),
                  label: Text(l10n.start),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
