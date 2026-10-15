import 'dart:async';

import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:flutter/services.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../../l10n/app_localizations.dart';
import '../api/mock_robot_api.dart';
import '../models/robot.dart';
import '../sensors/device.dart';
import '../sensors/motion_detector.dart';
import '../simulation/robot_simulator.dart';
import 'widgets/language_menu.dart';
import 'widgets/robot_face.dart';
import 'widgets/route_view.dart';

/// The phone is the robot: its face, trip, compartments and scenario buttons.
class RobotScreen extends StatefulWidget {
  const RobotScreen({
    super.key,
    required this.simulator,
    this.demoApi,
    this.autoStart = true,
    this.onAddRobot,
  });

  final RobotSimulator simulator;

  /// Set in demo mode: the demo panel plays the platform through it
  final MockRobotApi? demoApi;

  /// Tests drive the simulator themselves
  final bool autoStart;

  /// Several robots in one app: the button to add another one
  final VoidCallback? onAddRobot;

  @override
  State<RobotScreen> createState() => _RobotScreenState();
}

class _RobotScreenState extends State<RobotScreen> {
  RobotSimulator get sim => widget.simulator;
  final _detector = MotionDetector();
  StreamSubscription<AccelerometerEvent>? _motion;
  bool _sensorsOn = false;

  @override
  void initState() {
    super.initState();
    sim
      ..onAlert = HapticFeedback.heavyImpact
      ..onBeep = () => SystemSound.play(SystemSoundType.alert);
    if (widget.autoStart) sim.start();
  }

  @override
  void dispose() {
    _motion?.cancel();
    sim.dispose();
    super.dispose();
  }

  void _setSensors(bool on) {
    _motion?.cancel();
    _motion = null;
    setState(() => _sensorsOn = on);
    if (!on) return;
    _motion = accelerometerEventStream().listen(
      (reading) {
        final event = _detector.add(
          reading.x,
          reading.y,
          reading.z,
          DateTime.now(),
        );
        if (event == MotionEvent.tilted) sim.report(TelemetryEvent.tilted);
        if (event == MotionEvent.shaken) sim.report(TelemetryEvent.shaken);
      },
      onError: (Object _) {
        if (!mounted) return;
        setState(() => _sensorsOn = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(AppLocalizations.of(context).sensorsUnavailable),
          ),
        );
      },
      cancelOnError: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListenableBuilder(
      listenable: sim,
      builder: (context, _) => Scaffold(
        appBar: AppBar(
          title: Text(sim.profile?.name ?? sim.name),
          actions: [
            const LanguageMenu(),
            if (widget.onAddRobot != null)
              IconButton(
                key: const Key('add-robot'),
                tooltip: l10n.addRobot,
                icon: const Icon(LucideIcons.plus),
                onPressed: widget.onAddRobot,
              ),
            if (sim.profile != null)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Chip(
                  key: const Key('robot-kind'),
                  avatar: Icon(
                    sim.profile!.kind == RobotKind.food
                        ? LucideIcons.utensils
                        : LucideIcons.package,
                    size: 18,
                  ),
                  label: Text(
                    sim.profile!.kind == RobotKind.food
                        ? l10n.kindFood
                        : l10n.kindParcel,
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: Chip(
                avatar: Icon(_batteryIcon(sim.battery), size: 18),
                label: Text(l10n.battery(sim.battery.round())),
              ),
            ),
          ],
        ),
        body: LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 860;
            final status = [
              if (sim.lastError != null)
                _ErrorBanner(text: l10n.apiErrorBanner),
              _StatusCard(sim: sim),
              ..._actionCard(l10n),
              _CompartmentCard(
                compartment: sim.compartments.first,
                profile: sim.profile,
              ),
            ];
            final tools = [_TripCard(sim: sim), _tools(l10n)];
            return Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: wide ? 1100 : 560),
                child: wide
                    ? Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(child: _column(status)),
                          Expanded(child: _column(tools)),
                        ],
                      )
                    : _column([...status, ...tools]),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _column(List<Widget> children) => ListView.separated(
    padding: const EdgeInsets.all(16),
    itemCount: children.length,
    separatorBuilder: (_, _) => const SizedBox(height: 12),
    itemBuilder: (_, i) => children[i],
  );

  /// The one thing that is useful to do right now, as a big button
  List<Widget> _actionCard(AppLocalizations l10n) {
    final scheme = Theme.of(context).colorScheme;
    final lidOpen = sim.compartments.any((c) => c.lidOpen);
    final problem =
        sim.status.isProblem || sim.status == RobotStatus.manualOverride;
    final demo = widget.demoApi;

    Widget? button;
    if (problem) {
      button = _BigButton(
        key: const Key('recover'),
        icon: LucideIcons.heartPulse,
        label: l10n.recover,
        onPressed: sim.recover,
      );
    } else if (sim.status == RobotStatus.loading) {
      button = _BigButton(
        key: const Key('mark-loaded'),
        icon: LucideIcons.package,
        label: l10n.markLoaded,
        onPressed: sim.markLoaded,
      );
    } else if (lidOpen) {
      button = _BigButton(
        key: const Key('close-lid'),
        icon: LucideIcons.lock,
        label: l10n.closeLid,
        onPressed: sim.closeLids,
      );
    } else if (sim.status == RobotStatus.atDropoff &&
        sim.profile?.unlockOnDevice == true) {
      button = _PinPad(sim: sim);
    } else if (sim.status == RobotStatus.atDropoff && demo != null) {
      final target = sim.compartments.first;
      button = _BigButton(
        key: const Key('demo-unlock'),
        icon: LucideIcons.lockOpen,
        label: l10n.unlockByCustomer,
        onPressed: () {
          demo.send(CommandType.unlock, compartmentIndex: target.index);
          sim.sync();
        },
      );
    } else if (sim.status == RobotStatus.available &&
        sim.trip == null &&
        demo != null) {
      button = _BigButton(
        key: const Key('demo-new-trip'),
        icon: LucideIcons.route,
        label: l10n.newTrip,
        onPressed: () {
          demo.trip = Trip(
            id: 'demo-trip-${DateTime.now().millisecondsSinceEpoch}',
            stops: demoTrip.stops,
            route: demoTrip.route,
          );
          sim.sync();
        },
      );
    }
    if (button == null) return const [];
    return [
      Card(
        color: scheme.primaryContainer,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.whatNow,
                style: Theme.of(context).textTheme.titleMedium
                    ?.copyWith(color: scheme.onPrimaryContainer),
              ),
              const SizedBox(height: 12),
              button,
            ],
          ),
        ),
      ),
    ];
  }

  Widget _tools(AppLocalizations l10n) {
    final moving = sim.status.isMoving && sim.nextStop != null;
    final active =
        sim.trip != null &&
        !sim.status.isProblem &&
        sim.status != RobotStatus.manualOverride;
    final anythingLoaded = sim.compartments.any((c) => c.loaded);

    Widget scenario(
      String key,
      String label,
      IconData icon,
      bool enabled,
      TelemetryEvent event,
    ) => OutlinedButton.icon(
      key: Key(key),
      onPressed: enabled ? () => sim.report(event) : null,
      icon: Icon(icon),
      label: Text(label),
    );

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          ExpansionTile(
            initiallyExpanded: true,
            title: Text(l10n.scenarios),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  scenario(
                    'scenario-arrived',
                    l10n.scenarioArrived,
                    LucideIcons.flag,
                    moving && sim.status != RobotStatus.returning,
                    TelemetryEvent.arrived,
                  ),
                  scenario(
                    'scenario-tilted',
                    l10n.scenarioTilted,
                    LucideIcons.rotateCw,
                    active,
                    TelemetryEvent.tilted,
                  ),
                  scenario(
                    'scenario-stuck',
                    l10n.scenarioStuck,
                    LucideIcons.ban,
                    active,
                    TelemetryEvent.stuck,
                  ),
                  scenario(
                    'scenario-lifted',
                    l10n.scenarioLifted,
                    LucideIcons.grab,
                    active,
                    TelemetryEvent.shaken,
                  ),
                  scenario(
                    'scenario-package-taken',
                    l10n.scenarioPackageTaken,
                    LucideIcons.packageX,
                    active && anythingLoaded,
                    TelemetryEvent.packageTaken,
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _Setting(
                label: l10n.timeFactor,
                child: SegmentedButton<int>(
                  segments: const [
                    ButtonSegment(value: 1, label: Text('1×')),
                    ButtonSegment(value: 5, label: Text('5×')),
                    ButtonSegment(value: 10, label: Text('10×')),
                  ],
                  selected: {sim.timeFactor},
                  onSelectionChanged: (s) => sim.setTimeFactor(s.first),
                ),
              ),
              const SizedBox(height: 8),
              _Setting(
                label: l10n.weather,
                child: SegmentedButton<Weather>(
                  segments: [
                    ButtonSegment(
                      value: Weather.mild,
                      label: Text(l10n.weatherMild),
                    ),
                    ButtonSegment(
                      value: Weather.cold,
                      label: Text(l10n.weatherCold),
                    ),
                    ButtonSegment(
                      value: Weather.frost,
                      label: Text(l10n.weatherFrost),
                    ),
                  ],
                  selected: {sim.weather},
                  onSelectionChanged: (s) => sim.setWeather(s.first),
                ),
              ),
              const SizedBox(height: 8),
              _Setting(
                label: l10n.gps,
                child: SegmentedButton<GpsSpoof>(
                  key: const Key('gps-spoof'),
                  segments: [
                    ButtonSegment(
                      value: GpsSpoof.off,
                      label: Text(l10n.gpsOff),
                    ),
                    ButtonSegment(
                      value: GpsSpoof.noise,
                      label: Text(l10n.gpsNoise),
                    ),
                    ButtonSegment(
                      value: GpsSpoof.random,
                      label: Text(l10n.gpsRandom),
                    ),
                  ],
                  selected: {sim.gpsSpoof},
                  onSelectionChanged: (s) => sim.setGpsSpoof(s.first),
                ),
              ),
              // A computer has no motion sensors: the scenario buttons above play them
              if (hasMotionSensors)
                SwitchListTile(
                  key: const Key('sensors'),
                  contentPadding: EdgeInsets.zero,
                  title: Text(l10n.sensors),
                  subtitle: Text(l10n.sensorsHint),
                  value: _sensorsOn,
                  onChanged: _setSensors,
                ),
            ],
          ),
          if (widget.demoApi != null) ...[
            const Divider(height: 1),
            _DemoPanel(api: widget.demoApi!, sim: sim),
          ],
          const Divider(height: 1),
          ExpansionTile(
            initiallyExpanded: true,
            title: Text(l10n.logTitle),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            children: [
              for (final entry in sim.log.take(8))
                ListTile(
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  leading: Text(_time(entry.at)),
                  title: Text(
                    l10n.logEntry(entry.kind.name, entry.detail ?? ''),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  static IconData _batteryIcon(double battery) {
    if (battery > 80) return LucideIcons.batteryFull;
    if (battery > 50) return LucideIcons.batteryMedium;
    if (battery > 20) return LucideIcons.batteryLow;
    return LucideIcons.batteryWarning;
  }

  static String _time(DateTime at) =>
      '${at.hour.toString().padLeft(2, '0')}:${at.minute.toString().padLeft(2, '0')}:${at.second.toString().padLeft(2, '0')}';
}

/// The face, the status and one sentence of what is going on
class _StatusCard extends StatelessWidget {
  const _StatusCard({required this.sim});
  final RobotSimulator sim;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final text = Theme.of(context).textTheme;
    final hint =
        sim.status == RobotStatus.atDropoff &&
            sim.profile?.unlockOnDevice == true
        ? l10n.hintPin
        : l10n.statusHint(sim.status.name);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            RobotFace(status: sim.status),
            const SizedBox(height: 12),
            Text(
              l10n.statusLabel(sim.status.name),
              key: const Key('status'),
              style: text.titleLarge,
              textAlign: TextAlign.center,
            ),
            if (hint.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                hint,
                textAlign: TextAlign.center,
                style: text.bodyMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The customer opens the compartment on the robot: a PIN, checked by the platform
class _PinPad extends StatefulWidget {
  const _PinPad({required this.sim});
  final RobotSimulator sim;

  @override
  State<_PinPad> createState() => _PinPadState();
}

class _PinPadState extends State<_PinPad> {
  final _pin = TextEditingController();

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final ok = await widget.sim.submitPin(_pin.text);
    if (ok) _pin.clear();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final scheme = Theme.of(context).colorScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          key: const Key('pin-field'),
          controller: _pin,
          keyboardType: TextInputType.number,
          obscureText: true,
          maxLength: 6,
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: 28, letterSpacing: 8),
          decoration: InputDecoration(
            labelText: l10n.pinLabel,
            filled: true,
            fillColor: scheme.surface,
            counterText: '',
          ),
          onSubmitted: (_) => _submit(),
        ),
        if (widget.sim.pinMessage != null)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              l10n.pinWrong,
              key: const Key('pin-error'),
              style: TextStyle(color: scheme.error),
            ),
          ),
        const SizedBox(height: 12),
        _BigButton(
          key: const Key('pin-submit'),
          icon: LucideIcons.lockOpen,
          label: l10n.pinOpen,
          onPressed: _submit,
        ),
      ],
    );
  }
}

class _BigButton extends StatelessWidget {
  const _BigButton({
    super.key,
    required this.icon,
    required this.label,
    required this.onPressed,
  });
  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => FilledButton.icon(
    onPressed: onPressed,
    icon: Icon(icon),
    label: Text(label),
    style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
  );
}

class _Setting extends StatelessWidget {
  const _Setting({required this.label, required this.child});
  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) => Row(
    children: [
      SizedBox(width: 64, child: Text(label)),
      Expanded(
        child: Align(alignment: Alignment.centerLeft, child: child),
      ),
    ],
  );
}

class _TripCard extends StatelessWidget {
  const _TripCard({required this.sim});
  final RobotSimulator sim;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final path = sim.path;
    if (path == null) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              const Icon(LucideIcons.route),
              const SizedBox(width: 12),
              Expanded(child: Text(l10n.noTrip)),
            ],
          ),
        ),
      );
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            RouteView(
              route: path.points,
              stops: sim.trip?.stops ?? const [],
              robot: sim.position,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.remaining(sim.remainingMetres.round()),
              key: const Key('remaining'),
            ),
          ],
        ),
      ),
    );
  }
}

/// A robot has exactly one compartment
class _CompartmentCard extends StatelessWidget {
  const _CompartmentCard({required this.compartment, this.profile});
  final Compartment compartment;
  final RobotProfile? profile;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final c = compartment;
    return Card(
      key: Key('compartment-${c.index}'),
      child: ListTile(
        leading: Icon(
          c.lidOpen ? LucideIcons.packageOpen : LucideIcons.package,
          size: 32,
        ),
        title: Text(l10n.compartments),
        subtitle: Text(
          [
            c.loaded ? l10n.filled : l10n.empty,
            if (c.lidOpen) l10n.lidOpen,
            c.locked ? l10n.locked : l10n.unlocked,
            if (profile != null)
              l10n.compartmentSize(
                profile!.widthMm,
                profile!.heightMm,
                profile!.depthMm,
              ),
            if (profile?.temperatureType != null)
              l10n.temperature(profile!.temperatureType!.name),
          ].join(' · '),
        ),
        trailing: Icon(c.locked ? LucideIcons.lock : LucideIcons.lockOpen),
      ),
    );
  }
}

/// Plays the platform: commands the robot would get from the company
class _DemoPanel extends StatelessWidget {
  const _DemoPanel({required this.api, required this.sim});
  final MockRobotApi api;
  final RobotSimulator sim;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    OutlinedButton chip(IconData icon, String label, CommandType type) =>
        OutlinedButton.icon(
          icon: Icon(icon),
          label: Text(label),
          onPressed: () {
            api.send(type);
            sim.sync();
          },
        );

    return ExpansionTile(
      initiallyExpanded: true,
      title: Text(l10n.demoPanel),
      childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      expandedCrossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            chip(LucideIcons.hand, l10n.sendStop, CommandType.stop),
            chip(LucideIcons.house, l10n.sendReturn, CommandType.returnHome),
            chip(LucideIcons.volume2, l10n.sendBeep, CommandType.beep),
          ],
        ),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      color: scheme.errorContainer,
      child: ListTile(
        leading: Icon(LucideIcons.cloudOff, color: scheme.onErrorContainer),
        title: Text(text, style: TextStyle(color: scheme.onErrorContainer)),
      ),
    );
  }
}
