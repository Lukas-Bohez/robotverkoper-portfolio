import { renderSVG } from 'uqr'

/** What the QR code on a robot says: `rbt:` and its number (the API's `qrCode` field says the same) */
export function qrPayload(serial: string): string {
  return `rbt:${serial}`
}

/** The picture of a QR code as SVG text (it is drawn by us: no image to load, so it also works offline) */
export function qrSvg(text: string): string {
  return renderSVG(text, { ecc: 'M', border: 1 })
}

const SERIAL = /^RBT-\d{6}$/

/**
 * What a scanner (or a person who types it) gives, as the number: `rbt:RBT-000417`, `RBT-000417`, in any case and with
 * spaces. Null for anything else, so a QR code of another thing is refused before the API is asked.
 */
export function parseRobotCode(raw: string): string | null {
  const cleaned = raw.trim().replace(/^rbt:/i, '').trim().toUpperCase()
  return SERIAL.test(cleaned) ? cleaned : null
}
