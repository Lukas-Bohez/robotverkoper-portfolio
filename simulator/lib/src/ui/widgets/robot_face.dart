import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../models/robot.dart';

enum Mood { sleepy, happy, worried }

Mood moodFor(RobotStatus status) {
  if (status.isProblem || status == RobotStatus.manualOverride) {
    return Mood.worried;
  }
  if (status == RobotStatus.available || status == RobotStatus.charging) {
    return Mood.sleepy;
  }
  return Mood.happy;
}

/// The friendly face of the robot: the client wants robots that are "not scary".
class RobotFace extends StatelessWidget {
  const RobotFace({super.key, required this.status, this.size = 160});

  final RobotStatus status;
  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final mood = moodFor(status);
    return Semantics(
      label: mood.name,
      child: CustomPaint(
        size: Size(size, size * 0.75),
        painter: _FacePainter(
          mood: mood,
          face: mood == Mood.worried
              ? scheme.errorContainer
              : scheme.primaryContainer,
          ink: mood == Mood.worried
              ? scheme.onErrorContainer
              : scheme.onPrimaryContainer,
        ),
      ),
    );
  }
}

class _FacePainter extends CustomPainter {
  _FacePainter({required this.mood, required this.face, required this.ink});

  final Mood mood;
  final Color face;
  final Color ink;

  @override
  void paint(Canvas canvas, Size size) {
    final body = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(size.height * 0.3),
    );
    canvas.drawRRect(body, Paint()..color = face);

    final stroke = Paint()
      ..color = ink
      ..strokeWidth = size.width * 0.04
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;
    final fill = Paint()..color = ink;
    final eyeY = size.height * 0.4;
    final eyes = [
      Offset(size.width * 0.33, eyeY),
      Offset(size.width * 0.67, eyeY),
    ];
    final eyeRadius = size.width * 0.06;

    for (final eye in eyes) {
      if (mood == Mood.sleepy) {
        canvas.drawLine(
          eye.translate(-eyeRadius, 0),
          eye.translate(eyeRadius, 0),
          stroke,
        );
      } else {
        canvas.drawCircle(eye, eyeRadius, fill);
      }
    }

    final mouth = Rect.fromCenter(
      center: Offset(size.width / 2, size.height * 0.68),
      width: size.width * 0.3,
      height: size.height * 0.2,
    );
    switch (mood) {
      case Mood.happy:
        canvas.drawArc(mouth, 0.15 * math.pi, 0.7 * math.pi, false, stroke);
      case Mood.sleepy:
        canvas.drawLine(mouth.centerLeft, mouth.centerRight, stroke);
      case Mood.worried:
        canvas.drawArc(
          mouth.translate(0, mouth.height / 2),
          1.15 * math.pi,
          0.7 * math.pi,
          false,
          stroke,
        );
    }
  }

  @override
  bool shouldRepaint(_FacePainter old) =>
      old.mood != mood || old.face != face || old.ink != ink;
}
