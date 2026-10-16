import { describe, expect, it } from 'vitest'
import { PairingBook } from './pairing-book.js'

describe('PairingBook', () => {
  it('a simulator waits, gets the key once, and then the pairing is gone', () => {
    const book = new PairingBook()
    const { id, secret, code } = book.create('Windows-simulator', true)
    expect(code).toMatch(/^[A-HJKMNP-Z2-9]{4}$/)
    expect(book.waiting()).toHaveLength(1)
    expect(book.collect(id, secret)).toEqual({ status: 'waiting' })

    book.deliver(id, { apiKey: 'rb_abc', robotName: 'Food Robot 2', platformUrl: 'http://x/graphql' })
    expect(book.waiting(), 'a simulator that got its key no longer waits').toHaveLength(0)
    expect(book.collect(id, secret)).toEqual({
      status: 'delivered',
      apiKey: 'rb_abc',
      robotName: 'Food Robot 2',
      platformUrl: 'http://x/graphql',
    })
    expect(() => book.collect(id, secret)).toThrow(expect.objectContaining({ code: 'pairing_not_found' }))
  })

  it('only the simulator with the secret can collect, and nobody delivers twice', () => {
    const book = new PairingBook()
    const { id, secret } = book.create('Pixel', false)
    expect(() => book.collect(id, 'fout')).toThrow(expect.objectContaining({ code: 'forbidden' }))
    book.deliver(id, { apiKey: 'rb_abc', robotName: 'A', platformUrl: 'u' })
    expect(() => book.deliver(id, { apiKey: 'rb_other', robotName: 'B', platformUrl: 'u' })).toThrow(
      expect.objectContaining({ code: 'pairing_taken' }),
    )
    expect((book.collect(id, secret) as { apiKey: string }).apiKey).toBe('rb_abc')
    expect(() => book.deliver('nope', { apiKey: 'x', robotName: 'x', platformUrl: 'u' })).toThrow(
      expect.objectContaining({ code: 'pairing_not_found' }),
    )
  })

  it('forgets a simulator that stopped waiting and a key that nobody collected', () => {
    let clock = 0
    const book = new PairingBook({ now: () => clock, waitingMs: 1000, deliveredMs: 500 })
    const a = book.create('A', true)
    const b = book.create('B', true)
    book.deliver(b.id, { apiKey: 'rb_b', robotName: 'B', platformUrl: 'u' })
    clock = 600
    expect(() => book.collect(b.id, b.secret), 'the key is not kept for long').toThrow(
      expect.objectContaining({ code: 'pairing_not_found' }),
    )
    expect(book.waiting()).toHaveLength(1)
    clock = 1100
    expect(book.waiting()).toHaveLength(0)
    expect(() => book.collect(a.id, a.secret)).toThrow(expect.objectContaining({ code: 'pairing_not_found' }))
  })

  it('stops a simulator that keeps asking for pairings', () => {
    const book = new PairingBook({ max: 2 })
    book.create('A', true)
    book.create('B', true)
    expect(() => book.create('C', true)).toThrow(expect.objectContaining({ code: 'too_many_pairings' }))
  })

  it('cancelling needs the secret', () => {
    const book = new PairingBook()
    const { id, secret } = book.create('A', true)
    book.cancel(id, 'fout')
    expect(book.waiting()).toHaveLength(1)
    book.cancel(id, secret)
    expect(book.waiting()).toHaveLength(0)
  })
})
