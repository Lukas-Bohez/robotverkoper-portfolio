import 'dart:async';

import 'package:flutter/foundation.dart';

import 'pairing_client.dart';

enum PairingState { idle, waiting, unreachable }

typedef PairingClientFactory = PairingClient Function(Uri sellerApi);

PairingClient defaultPairingClient(Uri sellerApi) =>
    PairingClient(sellerApi: sellerApi);

/// Waits for the seller's panel to give this simulator a robot, and says so through [onDelivery].
/// It keeps trying when the seller API is not there (yet): the demo may start in any order.
class PairingWatcher extends ChangeNotifier {
  PairingWatcher({
    this.clientFactory = defaultPairingClient,
    this.interval = const Duration(seconds: 2),
    this.retry = const Duration(seconds: 5),
    this.onDelivery,
  });

  final PairingClientFactory clientFactory;
  final Duration interval;
  final Duration retry;

  /// Called once for every key that arrives
  final void Function(PairingDelivery delivery)? onDelivery;

  PairingState _state = PairingState.idle;
  PairingState get state => _state;

  /// The code the seller sees next to this device, while we wait
  String? get code => _ticket?.code;

  PairingClient? _client;
  PairingTicket? _ticket;
  Timer? _timer;
  bool _keepWaiting = false;
  bool _disposed = false;
  int _generation = 0;

  /// Start (or restart at another address). With [keepWaiting] a new pairing follows every key.
  void start(Uri sellerApi, {bool keepWaiting = false}) {
    stop();
    _keepWaiting = keepWaiting;
    _client = clientFactory(sellerApi);
    final generation = ++_generation;
    _timer = Timer(Duration.zero, () => _tick(generation));
  }

  /// Stop waiting and tell the seller API we are gone
  void stop() {
    _generation++;
    _timer?.cancel();
    _timer = null;
    final client = _client;
    final ticket = _ticket;
    _client = null;
    _ticket = null;
    if (client != null && ticket != null) unawaited(client.cancel(ticket));
    _set(PairingState.idle);
  }

  void _set(PairingState state) {
    if (_state == state || _disposed) return;
    _state = state;
    notifyListeners();
  }

  Future<void> _tick(int generation) async {
    final client = _client;
    if (client == null || generation != _generation) return;
    var next = interval;
    try {
      var ticket = _ticket;
      if (ticket == null) {
        ticket = await client.start();
        if (generation != _generation) return;
        _ticket = ticket;
        _set(PairingState.waiting);
        if (!_disposed) notifyListeners(); // the code is new
      }
      final delivery = await client.check(ticket);
      if (generation != _generation) return;
      if (delivery != null) {
        _ticket = null;
        onDelivery?.call(delivery);
        if (!_keepWaiting) {
          _client = null;
          _set(PairingState.idle);
          return;
        }
      }
    } on PairingExpired {
      if (generation != _generation) return;
      _ticket = null;
    } on Object {
      if (generation != _generation) return;
      _ticket = null;
      _set(PairingState.unreachable);
      next = retry;
    }
    if (generation != _generation || _disposed) return;
    _timer = Timer(next, () => _tick(generation));
  }

  @override
  void dispose() {
    _disposed = true;
    stop();
    super.dispose();
  }
}
