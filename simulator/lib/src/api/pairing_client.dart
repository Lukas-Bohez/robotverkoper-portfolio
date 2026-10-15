import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

/// A simulator that announced itself at the seller API and waits for the key of a robot
class PairingTicket {
  const PairingTicket({
    required this.id,
    required this.secret,
    required this.code,
  });

  final String id;

  /// Proves that we are the one who asked: only we may collect the key
  final String secret;

  /// Short code that the seller sees next to the name of this device
  final String code;
}

/// The robot the seller gave to this simulator: its key and where it connects
class PairingDelivery {
  const PairingDelivery({
    required this.apiKey,
    required this.robotName,
    required this.platformUrl,
  });

  final String apiKey;
  final String robotName;
  final String platformUrl;
}

class PairingException implements Exception {
  const PairingException(this.message);
  final String message;

  @override
  String toString() => 'PairingException: $message';
}

/// The pairing is gone at the seller API (too old): ask for a new one
class PairingExpired extends PairingException {
  const PairingExpired() : super('The pairing expired');
}

/// What this device calls itself in the seller's panel
String defaultDeviceName() {
  if (kIsWeb) return 'Browser-simulator';
  return switch (defaultTargetPlatform) {
    TargetPlatform.windows => 'Windows-simulator',
    TargetPlatform.android => 'Android-simulator',
    TargetPlatform.macOS => 'Mac-simulator',
    TargetPlatform.iOS => 'iPhone-simulator',
    _ => 'Simulator',
  };
}

/// Talks to the seller API (Lukas/seller-api) so that the API key of a new robot arrives
/// by itself, instead of being copied by hand. The key is handed over once.
class PairingClient {
  PairingClient({required this.sellerApi, String? device, http.Client? client})
    : device = device ?? defaultDeviceName(),
      _client = client ?? http.Client();

  final Uri sellerApi;
  final String device;
  final http.Client _client;

  Uri _uri(String path) => Uri(
    scheme: sellerApi.scheme,
    host: sellerApi.host,
    port: sellerApi.hasPort ? sellerApi.port : null,
    path: path,
  );

  Future<Map<String, dynamic>> _decode(http.Response response) async {
    final Object? body;
    try {
      body = jsonDecode(response.body);
    } on FormatException {
      throw PairingException('Unexpected answer (HTTP ${response.statusCode})');
    }
    if (body is! Map<String, dynamic>) {
      throw PairingException('Unexpected answer (HTTP ${response.statusCode})');
    }
    return body;
  }

  /// Announce this simulator and wait for a robot
  Future<PairingTicket> start() async {
    final http.Response response;
    try {
      response = await _client.post(
        _uri('/pairings'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({'device': device}),
      );
    } catch (error) {
      throw PairingException('The seller API is unreachable: $error');
    }
    if (response.statusCode != 201) {
      throw PairingException('The seller API said ${response.statusCode}');
    }
    final json = await _decode(response);
    return PairingTicket(
      id: json['id'] as String,
      secret: json['secret'] as String,
      code: json['code'] as String,
    );
  }

  /// The key that the seller gave us, or null while nobody did
  Future<PairingDelivery?> check(PairingTicket ticket) async {
    final http.Response response;
    try {
      response = await _client.get(
        _uri('/pairings/${Uri.encodeComponent(ticket.id)}'),
        headers: {'x-pairing-secret': ticket.secret},
      );
    } catch (error) {
      throw PairingException('The seller API is unreachable: $error');
    }
    if (response.statusCode == 404) throw const PairingExpired();
    if (response.statusCode != 200) {
      throw PairingException('The seller API said ${response.statusCode}');
    }
    final json = await _decode(response);
    if (json['status'] != 'delivered') return null;
    return PairingDelivery(
      apiKey: json['apiKey'] as String,
      robotName: json['robotName'] as String? ?? '',
      platformUrl: json['platformUrl'] as String? ?? '',
    );
  }

  /// Stop waiting (best effort: the seller API forgets us after a while anyway)
  Future<void> cancel(PairingTicket ticket) async {
    try {
      await _client.delete(
        _uri('/pairings/${Uri.encodeComponent(ticket.id)}'),
        headers: {'x-pairing-secret': ticket.secret},
      );
    } on Object {
      // Nothing to undo
    }
  }
}
