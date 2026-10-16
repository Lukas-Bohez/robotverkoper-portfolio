import { DomainException } from '../common/domain-exception.js'

/** The number printed on a robot and in its QR code: RBT- and six digits */
const SERIAL = /^RBT-(\d{6})$/

export function formatSerial(number: number): string {
  return `RBT-${String(number).padStart(6, '0')}`
}

/** The next free serial: one more than the highest that exists (so a gap is never filled twice) */
export function nextSerial(existing: readonly string[]): string {
  const highest = existing.reduce((max, serial) => {
    const match = SERIAL.exec(serial)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return formatSerial(highest + 1)
}

/** What the QR code on a robot says: `rbt:` and the serial. */
export function qrPayload(serial: string): string {
  return `rbt:${serial}`
}

/**
 * Reads what a scanner (or a person who types the code in) gives: `rbt:RBT-000417`, `RBT-000417`, in any case and
 * with spaces around. Anything else is a bad request, so a QR code of something else is refused with a clear
 * answer.
 */
export function parseRobotCode(code: string): string {
  const cleaned = code.trim().replace(/^rbt:/i, '').trim().toUpperCase()
  if (!SERIAL.test(cleaned)) {
    throw new DomainException(
      400,
      'invalid_robot_code',
      'This is not the code of one of our robots',
    )
  }
  return cleaned
}
