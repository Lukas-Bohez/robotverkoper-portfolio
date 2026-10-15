import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { HttpError } from './http.ts'

/** What a waiting simulator looks like to the seller (never its secret) */
export interface WaitingPairing {
  id: string
  device: string
  code: string
  /** It runs on this very computer */
  loopback: boolean
  createdAt: string
}

export interface Delivery {
  apiKey: string
  robotName: string
  platformUrl: string
}

interface Entry extends WaitingPairing {
  secret: string
  createdMs: number
  delivery: (Delivery & { at: number }) | null
}

/** Letters and digits that cannot be mixed up on a phone screen (no O/0, I/1/L) */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * Hands the API key of a new robot from the seller's PWA to the simulator, so nobody copies it.
 *
 * A simulator asks for a pairing and waits. The PWA sees who waits, and delivers the key. The
 * simulator then collects it once. Everything lives in memory and nothing is written to the
 * database: a key sits here for at most two minutes, and only until it has been collected.
 */
export class PairingBook {
  private readonly entries = new Map<string, Entry>()
  private readonly now: () => number
  private readonly waitingMs: number
  private readonly deliveredMs: number
  private readonly max: number

  constructor(options: { now?: () => number; waitingMs?: number; deliveredMs?: number; max?: number } = {}) {
    this.now = options.now ?? Date.now
    this.waitingMs = options.waitingMs ?? 10 * 60_000
    this.deliveredMs = options.deliveredMs ?? 2 * 60_000
    this.max = options.max ?? 20
  }

  /** Forgets what is old: a simulator that stopped waiting, a key that nobody collected */
  private purge(): void {
    const now = this.now()
    for (const [id, entry] of this.entries) {
      const expired = entry.delivery ? now - entry.delivery.at > this.deliveredMs : now - entry.createdMs > this.waitingMs
      if (expired) this.entries.delete(id)
    }
  }

  create(device: string, loopback: boolean): { id: string; secret: string; code: string } {
    this.purge()
    if (this.entries.size >= this.max) {
      throw new HttpError(429, 'too_many_pairings', 'Too many simulators are waiting. Try again in a minute.')
    }
    const id = randomUUID()
    const secret = randomBytes(24).toString('base64url')
    let code = ''
    do {
      code = Array.from(randomBytes(4), (byte) => ALPHABET[byte % ALPHABET.length]).join('')
    } while ([...this.entries.values()].some((entry) => entry.code === code))
    const createdMs = this.now()
    this.entries.set(id, {
      id,
      secret,
      device,
      code,
      loopback,
      createdMs,
      createdAt: new Date(createdMs).toISOString(),
      delivery: null,
    })
    return { id, secret, code }
  }

  waiting(): WaitingPairing[] {
    this.purge()
    return [...this.entries.values()]
      .filter((entry) => entry.delivery === null)
      .map(({ id, device, code, loopback, createdAt }) => ({ id, device, code, loopback, createdAt }))
  }

  /** The seller's PWA puts the key of a robot in the pairing of a simulator */
  deliver(id: string, delivery: Delivery): WaitingPairing {
    this.purge()
    const entry = this.entries.get(id)
    if (!entry) throw new HttpError(404, 'pairing_not_found', 'This simulator is not waiting any more')
    if (entry.delivery) throw new HttpError(409, 'pairing_taken', 'This simulator already got a key')
    entry.delivery = { ...delivery, at: this.now() }
    const { device, code, loopback, createdAt } = entry
    return { id, device, code, loopback, createdAt }
  }

  /** The simulator asks if there is a key. It gets it once, then the pairing is gone. */
  collect(id: string, secret: string): { status: 'waiting' } | ({ status: 'delivered' } & Delivery) {
    this.purge()
    const entry = this.entries.get(id)
    if (!entry) throw new HttpError(404, 'pairing_not_found', 'This pairing does not exist (any more)')
    if (!sameSecret(secret, entry.secret)) throw new HttpError(403, 'forbidden', 'Wrong pairing secret')
    if (!entry.delivery) return { status: 'waiting' }
    this.entries.delete(id)
    const { apiKey, robotName, platformUrl } = entry.delivery
    return { status: 'delivered', apiKey, robotName, platformUrl }
  }

  /** The simulator stops waiting */
  cancel(id: string, secret: string): void {
    const entry = this.entries.get(id)
    if (entry && sameSecret(secret, entry.secret)) this.entries.delete(id)
  }
}
