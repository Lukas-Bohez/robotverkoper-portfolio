import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { PairingBook } from '../src/pairings.ts'
import { seedDemo } from '../src/seed.ts'
import { startApp, type TestApp } from './helpers.ts'

describe('PairingBook', () => {
  test('a simulator waits, gets the key once, and then the pairing is gone', () => {
    const book = new PairingBook()
    const { id, secret, code } = book.create('Windows-simulator', true)
    assert.match(code, /^[A-HJKMNP-Z2-9]{4}$/)
    assert.equal(book.waiting().length, 1)
    assert.deepEqual(book.collect(id, secret), { status: 'waiting' })

    book.deliver(id, { apiKey: 'rb_abc', robotName: 'Food Robot 2', platformUrl: 'http://x/graphql' })
    assert.equal(book.waiting().length, 0, 'a simulator that got its key no longer waits')
    assert.deepEqual(book.collect(id, secret), {
      status: 'delivered',
      apiKey: 'rb_abc',
      robotName: 'Food Robot 2',
      platformUrl: 'http://x/graphql',
    })
    assert.throws(() => book.collect(id, secret), { code: 'pairing_not_found' })
  })

  test('only the simulator with the secret can collect, and nobody delivers twice', () => {
    const book = new PairingBook()
    const { id, secret } = book.create('Pixel', false)
    assert.throws(() => book.collect(id, 'fout'), { code: 'forbidden' })
    book.deliver(id, { apiKey: 'rb_abc', robotName: 'A', platformUrl: 'u' })
    assert.throws(() => book.deliver(id, { apiKey: 'rb_other', robotName: 'B', platformUrl: 'u' }), { code: 'pairing_taken' })
    assert.equal((book.collect(id, secret) as { apiKey: string }).apiKey, 'rb_abc')
    assert.throws(() => book.deliver('nope', { apiKey: 'x', robotName: 'x', platformUrl: 'u' }), { code: 'pairing_not_found' })
  })

  test('forgets a simulator that stopped waiting and a key that nobody collected', () => {
    let clock = 0
    const book = new PairingBook({ now: () => clock, waitingMs: 1000, deliveredMs: 500 })
    const a = book.create('A', true)
    const b = book.create('B', true)
    book.deliver(b.id, { apiKey: 'rb_b', robotName: 'B', platformUrl: 'u' })
    clock = 600
    assert.throws(() => book.collect(b.id, b.secret), { code: 'pairing_not_found' }, 'the key is not kept for long')
    assert.equal(book.waiting().length, 1)
    clock = 1100
    assert.equal(book.waiting().length, 0)
    assert.throws(() => book.collect(a.id, a.secret), { code: 'pairing_not_found' })
  })

  test('stops a simulator that keeps asking for pairings', () => {
    const book = new PairingBook({ max: 2 })
    book.create('A', true)
    book.create('B', true)
    assert.throws(() => book.create('C', true), { code: 'too_many_pairings' })
  })

  test('cancelling needs the secret', () => {
    const book = new PairingBook()
    const { id, secret } = book.create('A', true)
    book.cancel(id, 'fout')
    assert.equal(book.waiting().length, 1)
    book.cancel(id, secret)
    assert.equal(book.waiting().length, 0)
  })
})

describe('the key goes from the PWA to the simulator', () => {
  let app: TestApp
  beforeEach(async () => {
    app = await startApp()
  })
  afterEach(() => app.close())

  async function device(method: string, path: string, options: { body?: unknown; secret?: string; origin?: string } = {}) {
    const response = await fetch(app.base + path, {
      method,
      headers: {
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.secret ? { 'x-pairing-secret': options.secret } : {}),
        ...(options.origin ? { origin: options.origin } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
    const raw = await response.text()
    return { status: response.status, json: raw ? JSON.parse(raw) : null, headers: response.headers }
  }

  async function robot() {
    const created = await app.call('POST', '/companies/c-demo/robots', {
      body: { name: 'Food Robot 2', modelId: 'model-food', temperatureType: 'COLD' },
    })
    return created.json as { robot: { id: string }; apiKey: string }
  }

  test('a simulator announces itself without a login, and the seller sees it', async () => {
    const created = await device('POST', '/pairings', { body: { device: 'Windows-simulator' } })
    assert.equal(created.status, 201)
    assert.ok(created.json.secret.length >= 20)

    const list = await app.call('GET', '/pairings')
    assert.equal(list.status, 200)
    assert.equal(list.json.items.length, 1)
    assert.equal(list.json.items[0].device, 'Windows-simulator')
    assert.equal(list.json.items[0].code, created.json.code)
    assert.equal(list.json.items[0].loopback, true, 'it runs on this computer')
    assert.ok(!JSON.stringify(list.json).includes(created.json.secret), 'the seller never sees the secret')
  })

  test('only a logged-in seller sees the waiting simulators or hands out a key', async () => {
    assert.equal((await app.call('GET', '/pairings', { as: null })).status, 401)
    assert.equal((await app.call('GET', '/pairings', { as: 'vreemde@example.com' })).status, 403)
    const { id } = (await device('POST', '/pairings', { body: {} })).json
    assert.equal((await app.call('POST', `/pairings/${id}/deliver`, { as: null, body: {} })).status, 401)
  })

  test('delivers the key of a robot: the simulator collects it once, with the robot name and address', async () => {
    const { robot: made, apiKey } = await robot()
    const { id, secret } = (await device('POST', '/pairings', { body: { device: 'Windows-simulator' } })).json
    assert.deepEqual((await device('GET', `/pairings/${id}`, { secret })).json, { status: 'waiting' })

    const delivered = await app.call('POST', `/pairings/${id}/deliver`, { body: { robotId: made.id, apiKey } })
    assert.equal(delivered.status, 204)

    const collected = await device('GET', `/pairings/${id}`, { secret })
    assert.deepEqual(collected.json, {
      status: 'delivered',
      apiKey,
      robotName: 'Food Robot 2',
      platformUrl: 'http://platform.test/graphql',
    })
    assert.equal((await device('GET', `/pairings/${id}`, { secret })).status, 404, 'the key is handed over once')
  })

  test('never writes the key down: not in the database, not in the audit trail', async () => {
    const { robot: made, apiKey } = await robot()
    const { id } = (await device('POST', '/pairings', { body: {} })).json
    await app.call('POST', `/pairings/${id}/deliver`, { body: { robotId: made.id, apiKey } })
    const everything = JSON.stringify([app.store.listAudit(50), app.store.robotsOfCompany('c-demo')])
    assert.ok(!everything.includes(apiKey))
    const entry = app.store.listAudit(50)[0]!
    assert.equal(entry.action, 'robot.key-sent')
    assert.match(entry.detail ?? '', /Food Robot 2/)
  })

  test('refuses a key that does not belong to the robot, an unknown robot, and a simulator that left', async () => {
    const { robot: made, apiKey } = await robot()
    const { id, secret } = (await device('POST', '/pairings', { body: {} })).json
    const wrong = await app.call('POST', `/pairings/${id}/deliver`, { body: { robotId: made.id, apiKey: 'rb_andere-sleutel-xyz' } })
    assert.equal(wrong.json.code, 'key_mismatch')
    assert.equal((await app.call('POST', `/pairings/${id}/deliver`, { body: { robotId: 'nope', apiKey } })).status, 404)
    await device('DELETE', `/pairings/${id}`, { secret })
    assert.equal((await app.call('POST', `/pairings/${id}/deliver`, { body: { robotId: made.id, apiKey } })).status, 404)
  })

  test('gives nothing to a simulator that does not know the secret', async () => {
    const { robot: made, apiKey } = await robot()
    const { id } = (await device('POST', '/pairings', { body: {} })).json
    await app.call('POST', `/pairings/${id}/deliver`, { body: { robotId: made.id, apiKey } })
    assert.equal((await device('GET', `/pairings/${id}`, { secret: 'geraden' })).status, 403)
    assert.equal((await device('GET', `/pairings/${id}`)).status, 403)
  })

  test('a simulator in a browser on any address may call the device routes, but nobody else the seller routes', async () => {
    const open = await device('OPTIONS', '/pairings', { origin: 'http://localhost:60123' })
    assert.equal(open.status, 204)
    const created = await device('POST', '/pairings', { body: {}, origin: 'http://localhost:60123' })
    assert.equal(created.headers.get('access-control-allow-origin'), '*')
    const seller = await app.call('GET', '/pairings', { origin: 'http://kwaad.example' })
    assert.equal(seller.headers.get('access-control-allow-origin'), null)
  })
})

test('the demo seed gives the robots of the platform a simulated state, once', async () => {
  const app = await startApp()
  try {
    app.platform.companiesList = [
      { id: 'c-demo', name: 'Demozaak', subdomain: 'demo', createdAt: '2026-09-23T08:00:00.000Z' },
      { id: 'c-gelato', name: 'Gelato Bar', subdomain: 'gelato', createdAt: '2026-10-10T09:30:00.000Z' },
      { id: 'c-pizza', name: 'Pizzeria Test', subdomain: 'pizzeria-test', createdAt: '2026-10-14T11:15:00.000Z' },
    ]
    await seedDemo(app.service, app.store, app.platform)
    assert.equal(app.store.countRobots(), 6)
    assert.equal(app.platform.simulated.size, 6)
    assert.ok([...app.platform.simulated.values()].every((state) => typeof state.battery === 'number'))
    assert.equal(app.store.listDefects(true).length, 1)
    assert.equal(app.store.listDefects(true)[0]!.robotName, 'Demo Parcel Bot')
    await seedDemo(app.service, app.store, app.platform)
    assert.equal(app.store.countRobots(), 6, 'running it again changes nothing')
  } finally {
    await app.close()
  }
})
