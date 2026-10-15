import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../l10n/app_localizations.dart';
import '../api/foot_router.dart';
import '../api/pairing_client.dart';
import '../api/pairing_watcher.dart';
import '../api/graphql_robot_api.dart';
import '../api/mock_robot_api.dart';
import '../models/robot.dart';
import '../simulation/robot_simulator.dart';
import 'robot_screen.dart';

/// The kinds of robots that demo mode can play
enum DemoKind {
  food(RobotKind.food, 350, 250, 300),
  parcelSmall(RobotKind.parcel, 300, 200, 300),
  parcelLarge(RobotKind.parcel, 500, 400, 500);

  const DemoKind(this.kind, this.widthMm, this.heightMm, this.depthMm);
  final RobotKind kind;
  final int widthMm;
  final int heightMm;
  final int depthMm;

  /// A demo robot of this kind (a food robot carries warm food)
  RobotProfile profile(String name, {bool unlockOnDevice = false}) =>
      RobotProfile(
        name: name,
        kind: kind,
        widthMm: widthMm,
        heightMm: heightMm,
        depthMm: depthMm,
        temperatureType: kind == RobotKind.food ? TemperatureType.warm : null,
        unlockOnDevice: unlockOnDevice,
      );
}

/// One robot with the API it talks to
class FleetEntry {
  FleetEntry(this.simulator, this.demoApi);

  final RobotSimulator simulator;
  final MockRobotApi? demoApi;

  /// A robot of demo mode: the app plays the platform itself
  factory FleetEntry.demo(
    String name,
    DemoKind kind, {
    bool unlockOnDevice = false,
  }) {
    final api = MockRobotApi(
      profile: kind.profile(name, unlockOnDevice: unlockOnDevice),
      router: footRouter(),
    );
    return FleetEntry(RobotSimulator(api: api, name: name), api);
  }

  /// A robot of the platform: its API key says who it is
  factory FleetEntry.platform(String name, Uri endpoint, String apiKey) =>
      FleetEntry(
        RobotSimulator(
          api: GraphqlRobotApi(endpoint: endpoint, apiKey: apiKey),
          name: name,
        ),
        null,
      );
}

/// Whether this is an http(s) address with a host
bool isHttpAddress(Uri uri) =>
    (uri.scheme == 'http' || uri.scheme == 'https') && uri.host.isNotEmpty;

/// Several virtual robots in one app: they all keep driving, you look at one at a time.
class FleetScreen extends StatefulWidget {
  const FleetScreen({
    super.key,
    required this.first,
    this.endpoint,
    this.unlockOnDevice = false,
    this.sellerApi,
    this.pairingClientFactory = defaultPairingClient,
  });

  final FleetEntry first;

  /// Platform mode with a seller API: the robots that the seller makes join by themselves
  final Uri? sellerApi;
  final PairingClientFactory pairingClientFactory;

  /// Set for platform mode: more robots join with their own API key
  final Uri? endpoint;

  /// Demo mode: do more robots also open with a PIN?
  final bool unlockOnDevice;

  @override
  State<FleetScreen> createState() => _FleetScreenState();
}

class _FleetScreenState extends State<FleetScreen> {
  late final List<FleetEntry> _entries = [widget.first];
  int _selected = 0;
  PairingWatcher? _pairing;

  @override
  void initState() {
    super.initState();
    final sellerApi = widget.sellerApi;
    if (widget.endpoint != null && sellerApi != null) {
      _pairing = PairingWatcher(
        clientFactory: widget.pairingClientFactory,
        onDelivery: _joined,
      )..start(sellerApi, keepWaiting: true);
    }
  }

  @override
  void dispose() {
    _pairing?.dispose();
    super.dispose();
  }

  /// The seller made another robot: it joins the fleet with its own key
  void _joined(PairingDelivery delivery) {
    if (!mounted) return;
    final endpoint = Uri.tryParse(delivery.platformUrl);
    final name = delivery.robotName.isEmpty
        ? 'Robot #${_entries.length + 1}'
        : delivery.robotName;
    setState(() {
      _entries.add(
        FleetEntry.platform(
          name,
          endpoint != null && isHttpAddress(endpoint)
              ? endpoint
              : widget.endpoint!,
          delivery.apiKey,
        ),
      );
      _selected = _entries.length - 1;
    });
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(content: Text(AppLocalizations.of(context).pairAdded(name))),
    );
  }

  Future<void> _add() async {
    final entry = await showDialog<FleetEntry>(
      context: context,
      builder: (_) => _AddRobotDialog(
        number: _entries.length + 1,
        endpoint: widget.endpoint,
        unlockOnDevice: widget.unlockOnDevice,
      ),
    );
    if (entry == null || !mounted) return;
    setState(() {
      _entries.add(entry);
      _selected = _entries.length - 1;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _selected,
        children: [
          for (final entry in _entries)
            RobotScreen(
              key: ObjectKey(entry),
              simulator: entry.simulator,
              demoApi: entry.demoApi,
              onAddRobot: _add,
            ),
        ],
      ),
      bottomNavigationBar: _entries.length > 1
          ? NavigationBar(
              selectedIndex: _selected,
              onDestinationSelected: (i) => setState(() => _selected = i),
              destinations: [
                for (final entry in _entries)
                  NavigationDestination(
                    icon: const Icon(LucideIcons.bot),
                    label:
                        entry.simulator.profile?.name ?? entry.simulator.name,
                  ),
              ],
            )
          : null,
    );
  }
}

class _AddRobotDialog extends StatefulWidget {
  const _AddRobotDialog({
    required this.number,
    required this.endpoint,
    required this.unlockOnDevice,
  });

  final int number;
  final Uri? endpoint;
  final bool unlockOnDevice;

  @override
  State<_AddRobotDialog> createState() => _AddRobotDialogState();
}

class _AddRobotDialogState extends State<_AddRobotDialog> {
  late final _name = TextEditingController(text: 'Robot #${widget.number}');
  final _key = TextEditingController();
  DemoKind _kind = DemoKind.parcelSmall;
  bool _keyMissing = false;

  bool get _platform => widget.endpoint != null;

  @override
  void dispose() {
    _name.dispose();
    _key.dispose();
    super.dispose();
  }

  void _submit() {
    final name = _name.text.trim().isEmpty ? 'Robot' : _name.text.trim();
    if (_platform) {
      if (_key.text.trim().isEmpty) {
        setState(() => _keyMissing = true);
        return;
      }
      Navigator.pop(
        context,
        FleetEntry.platform(name, widget.endpoint!, _key.text.trim()),
      );
    } else {
      Navigator.pop(
        context,
        FleetEntry.demo(name, _kind, unlockOnDevice: widget.unlockOnDevice),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.addRobotTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_platform)
            TextField(
              key: const Key('add-robot-key'),
              controller: _key,
              decoration: InputDecoration(
                labelText: l10n.apiKey,
                errorText: _keyMissing ? l10n.apiKeyRequired : null,
              ),
              onChanged: (_) {
                if (_keyMissing) setState(() => _keyMissing = false);
              },
            )
          else ...[
            TextField(
              key: const Key('add-robot-name'),
              controller: _name,
              decoration: InputDecoration(labelText: l10n.robotName),
            ),
            const SizedBox(height: 12),
            DemoKindPicker(
              value: _kind,
              onChanged: (kind) => setState(() => _kind = kind),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l10n.cancel),
        ),
        FilledButton(
          key: const Key('add-robot-submit'),
          onPressed: _submit,
          child: Text(l10n.add),
        ),
      ],
    );
  }
}

/// Food, a small parcel robot or a large one (never both food and parcels)
class DemoKindPicker extends StatelessWidget {
  const DemoKindPicker({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final DemoKind value;
  final ValueChanged<DemoKind> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.demoKind, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 4),
        SegmentedButton<DemoKind>(
          key: const Key('demo-kind'),
          segments: [
            ButtonSegment(
              value: DemoKind.food,
              label: Text(l10n.demoKindFood),
              icon: const Icon(LucideIcons.utensils),
            ),
            ButtonSegment(
              value: DemoKind.parcelSmall,
              label: Text(l10n.demoKindParcelSmall),
            ),
            ButtonSegment(
              value: DemoKind.parcelLarge,
              label: Text(l10n.demoKindParcelLarge),
            ),
          ],
          selected: {value},
          onSelectionChanged: (s) => onChanged(s.first),
        ),
      ],
    );
  }
}
