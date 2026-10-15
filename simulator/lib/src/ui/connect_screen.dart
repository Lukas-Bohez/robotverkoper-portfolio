import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../l10n/app_localizations.dart';
import '../api/pairing_client.dart';
import '../api/pairing_watcher.dart';
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

/// The address of the seller API that hands this simulator the key of a new robot
const defaultSellerApi = 'http://localhost:4200';
const _sellerApiKey = 'sellerApi';

/// Choose demo mode or connect to the platform with the API key of a robot.
/// In platform mode the key of a robot that the seller makes arrives by itself ([pairingEnabled]).
class ConnectScreen extends StatefulWidget {
  const ConnectScreen({
    super.key,
    this.pairingEnabled = true,
    this.pairingClientFactory = defaultPairingClient,
  });

  final bool pairingEnabled;
  final PairingClientFactory pairingClientFactory;

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
  final _sellerApi = TextEditingController(text: defaultSellerApi);
  final _form = GlobalKey<FormState>();

  late final PairingWatcher _pairing = PairingWatcher(
    clientFactory: widget.pairingClientFactory,
    onDelivery: _received,
  );
  Timer? _restart;

  /// The robot of the last key that arrived by itself
  String? _receivedFrom;

  @override
  void initState() {
    super.initState();
    if (widget.pairingEnabled) unawaited(_loadSellerApi());
  }

  @override
  void dispose() {
    _restart?.cancel();
    _pairing.dispose();
    _name.dispose();
    _url.dispose();
    _key.dispose();
    _sellerApi.dispose();
    super.dispose();
  }

  Future<void> _loadSellerApi() async {
    try {
      final saved = (await SharedPreferences.getInstance()).getString(
        _sellerApiKey,
      );
      if (saved != null && isHttpUrl(saved) && mounted) {
        _sellerApi.text = saved;
      }
    } on Object {
      // No storage: the default address
    }
    _startPairing();
  }

  void _startPairing() {
    if (!mounted || !widget.pairingEnabled) return;
    if (_mode != ConnectMode.platform || !isHttpUrl(_sellerApi.text)) {
      _pairing.stop();
      return;
    }
    _pairing.start(Uri.parse(_sellerApi.text.trim()));
  }

  /// The seller gave this simulator a robot: fill in what the platform tab asks for
  void _received(PairingDelivery delivery) {
    if (!mounted) return;
    setState(() {
      if (delivery.platformUrl.isNotEmpty && isHttpUrl(delivery.platformUrl)) {
        _url.text = delivery.platformUrl;
      }
      _key.text = delivery.apiKey;
      if (delivery.robotName.isNotEmpty) _name.text = delivery.robotName;
      _receivedFrom = delivery.robotName.isEmpty ? '?' : delivery.robotName;
    });
  }

  void _sellerApiChanged(String value) {
    _restart?.cancel();
    _restart = Timer(const Duration(milliseconds: 700), () async {
      if (isHttpUrl(value)) {
        try {
          await (await SharedPreferences.getInstance()).setString(
            _sellerApiKey,
            value.trim(),
          );
        } on Object {
          // Not kept: it applies until the app closes
        }
      }
      _startPairing();
    });
  }

  void _start() {
    if (!_form.currentState!.validate()) return;
    final name = _name.text.trim();
    final endpoint = Uri.parse(_url.text.trim());
    final entry = _mode == ConnectMode.demo
        ? FleetEntry.demo(name, _demoKind, unlockOnDevice: _demoPin)
        : FleetEntry.platform(name, endpoint, _key.text.trim());
    final platform = _mode == ConnectMode.platform;
    // The fleet screen takes over the waiting: more robots from the seller join by themselves
    _pairing.stop();
    Navigator.of(context)
        .push(
          MaterialPageRoute<void>(
            builder: (_) => FleetScreen(
              first: entry,
              endpoint: platform ? endpoint : null,
              unlockOnDevice: _demoPin,
              sellerApi: platform && widget.pairingEnabled
                  ? Uri.tryParse(_sellerApi.text.trim())
                  : null,
              pairingClientFactory: widget.pairingClientFactory,
            ),
          ),
        )
        .then((_) {
          _receivedFrom = null;
          _startPairing();
        });
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
                  onSelectionChanged: (selection) {
                    setState(() => _mode = selection.first);
                    _startPairing();
                  },
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
                  if (widget.pairingEnabled) ...[
                    const SizedBox(height: 16),
                    _PairingCard(
                      watcher: _pairing,
                      controller: _sellerApi,
                      receivedFrom: _receivedFrom,
                      onChanged: _sellerApiChanged,
                    ),
                  ],
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

/// "Pair automatically": shows that this simulator waits for the PWA of the seller, with its code,
/// and the address of the seller API that can be changed (a phone needs the address of the laptop).
class _PairingCard extends StatelessWidget {
  const _PairingCard({
    required this.watcher,
    required this.controller,
    required this.receivedFrom,
    required this.onChanged,
  });

  final PairingWatcher watcher;
  final TextEditingController controller;
  final String? receivedFrom;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final colors = Theme.of(context).colorScheme;
    return Card(
      key: const Key('pairing'),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: ListenableBuilder(
          listenable: watcher,
          builder: (context, _) {
            final received = receivedFrom != null;
            final (IconData icon, Color color, String status) = received
                ? (
                    LucideIcons.circleCheck,
                    colors.primary,
                    l10n.pairReceived(receivedFrom!),
                  )
                : switch (watcher.state) {
                    PairingState.unreachable => (
                      LucideIcons.unplug,
                      colors.error,
                      l10n.pairUnreachable,
                    ),
                    PairingState.waiting => (
                      LucideIcons.link,
                      colors.primary,
                      l10n.pairWaiting,
                    ),
                    PairingState.idle => (
                      LucideIcons.link,
                      colors.outline,
                      l10n.pairWaiting,
                    ),
                  };
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(l10n.pairTitle, style: text.titleSmall),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Icon(icon, color: color, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(status, key: const Key('pairing-status')),
                    ),
                  ],
                ),
                if (!received && watcher.code != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    l10n.pairCode(watcher.code!),
                    key: const Key('pairing-code'),
                    style: text.bodySmall,
                  ),
                ],
                const SizedBox(height: 12),
                TextFormField(
                  key: const Key('seller-api'),
                  controller: controller,
                  decoration: InputDecoration(
                    labelText: l10n.pairSellerApi,
                    helperText: l10n.pairSellerApiHint,
                    helperMaxLines: 2,
                  ),
                  keyboardType: TextInputType.url,
                  onChanged: onChanged,
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
