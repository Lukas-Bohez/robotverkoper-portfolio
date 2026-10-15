import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, test } from 'node:test'
import { createPlatformSimulator, type Snapshot } from '../src/server.ts'
import { DEMO_COMPANIES } from '../src/seed.ts'

const TOKEN = 'test-token'
let base = ''
let close: () => Promise<void>

async function call(method: string, path: string, body?: unknown, token: string | null = TOKEN) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const raw = await response.text()
  return { status: response.status, json: (raw ? JSON.parse(raw) : null) as any }
}

before(async () => {
  const { server } = createPlatformSimulator({ token: TOKEN, companies: DEMO_COMPANIES })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => new Promise((resolve) => server.close(() => resolve()))
})

after(() => close())

describe('platform simulator', () => {
  test('health needs no token, everything else does', async () => {
    assert.equal((await call('GET', '/health', undefined, null)).status, 200)
    assert.equal((await call('GET', '/companies', undefined, null)).status, 401)
    assert.equal((await call('GET', '/companies', undefined, 'wrong')).status, 401)
  })

  test('lists the made-up companies of the seed', async () => {
    const { status, json } = await call('GET', '/companies')
    assert.equal(status, 200)
    assert.deepEqual(
      json.slice(0, 3).map((c: any) => c.subdomain),
      ['demo', 'gelato', 'pizzeria-test'],
    )
  })

  test('creates a company and refuses a taken or reserved subdomain', async () => {
    const created = await call('POST', '/companies', {
      name: 'Taverne',
      subdomain: ' Taverne ',
      adminEmail: 'Chef@Taverne.example',
    })
    assert.equal(created.status, 201)
    assert.equal(created.json.subdomain, 'taverne')
    assert.equal(created.json.adminEmail, 'chef@taverne.example')

    const taken = await call('POST', '/companies', { name: 'Andere', subdomain: 'taverne', adminEmail: 'a@b.example' })
    assert.equal(taken.status, 409)
    assert.equal(taken.json.code, 'subdomain_taken')

    const reserved = await call('POST', '/companies', { name: 'Admin', subdomain: 'admin', adminEmail: 'a@b.example' })
    assert.equal(reserved.status, 400)
    assert.equal(reserved.json.code, 'reserved_subdomain')

    const badEmail = await call('POST', '/companies', { name: 'Slecht', subdomain: 'slecht', adminEmail: 'geen-email' })
    assert.equal(badEmail.json.code, 'invalid_email')
  })

  test('registers a robot, shows its key once, and it is offline until it reports itself', async () => {
    const company = DEMO_COMPANIES[0]!
    const food = await call('POST', '/robots', {
      companyId: company.id,
      modelKind: 'FOOD',
      name: 'Demo Food Bot',
      temperatureType: 'WARM',
    })
    assert.equal(food.status, 201)
    assert.match(food.json.apiKey, /^rb_[A-Za-z0-9_-]{43}$/)
    assert.equal(food.json.apiKeyPrefix, food.json.apiKey.slice(0, 11))

    const live = await call('GET', `/robots/live?ids=${food.json.id},unknown`)
    assert.equal(live.json.length, 1)
    assert.deepEqual(live.json[0], { id: food.json.id, online: false, battery: null })

    // By hand (a demo): the robot is online with this battery until it reports itself
    await call('POST', `/robots/${food.json.id}/telemetry`, { online: true, battery: 80 })
    const after = await call('GET', `/robots/live?ids=${food.json.id}`)
    assert.deepEqual(after.json[0], { id: food.json.id, online: true, battery: 80 })
  })

  test('food robots need a temperature, parcel robots refuse one', async () => {
    const companyId = DEMO_COMPANIES[0]!.id
    const missing = await call('POST', '/robots', { companyId, modelKind: 'FOOD', name: 'Zonder' })
    assert.equal(missing.json.code, 'temperature_required')
    const extra = await call('POST', '/robots', {
      companyId,
      modelKind: 'PARCEL',
      name: 'Pakket',
      temperatureType: 'COLD',
    })
    assert.equal(extra.json.code, 'temperature_not_allowed')
    const unknown = await call('POST', '/robots', { companyId: 'nope', modelKind: 'PARCEL', name: 'Pakket' })
    assert.equal(unknown.status, 404)
  })

  test('creates roles with known permissions only', async () => {
    const company = DEMO_COMPANIES[1]!
    const ok = await call('POST', `/companies/${company.id}/roles`, {
      name: 'Kok',
      permissions: ['orders:read', 'orders:prepare', 'orders:read'],
    })
    assert.equal(ok.status, 201)
    assert.deepEqual(ok.json.permissions, ['orders:read', 'orders:prepare'])
    assert.equal((await call('POST', `/companies/${company.id}/roles`, { name: 'kok', permissions: [] })).status, 409)
    const bad = await call('POST', `/companies/${company.id}/roles`, { name: 'Hacker', permissions: ['db:drop'] })
    assert.equal(bad.json.code, 'unknown_permission')
    const list = await call('GET', `/companies/${company.id}/roles`)
    assert.deepEqual(
      list.json.map((r: any) => r.name),
      ['TENANT_ADMIN', 'Personeel', 'Kok'],
    )
  })

  test('every company starts with a locked administrator role that cannot be removed', async () => {
    const company = DEMO_COMPANIES[2]!
    const list = await call('GET', `/companies/${company.id}/roles`)
    const admin = list.json.find((r: any) => r.locked)
    assert.equal(admin.name, 'TENANT_ADMIN')
    assert.ok(admin.permissions.length >= 15)
    const removed = await call('DELETE', `/companies/${company.id}/roles/${admin.id}`)
    assert.equal(removed.status, 409)
    assert.equal(removed.json.code, 'role_locked')

    const lader = await call('POST', `/companies/${company.id}/roles`, { name: 'Lader', permissions: ['robots:load'] })
    assert.equal((await call('DELETE', `/companies/${company.id}/roles/${lader.json.id}`)).status, 204)
    assert.equal((await call('DELETE', `/companies/${company.id}/roles/${lader.json.id}`)).status, 404)
  })

  test('a retired robot is offline for good and refuses telemetry', async () => {
    const created = await call('POST', '/robots', { companyId: DEMO_COMPANIES[0]!.id, modelKind: 'PARCEL', name: 'Oud' })
    assert.equal((await call('POST', `/robots/${created.json.id}/retire`, {})).status, 200)
    assert.equal((await call('POST', `/robots/${created.json.id}/retire`, {})).status, 200, 'calling it twice is fine')
    const live = await call('GET', `/robots/live?ids=${created.json.id}`)
    assert.equal(live.json[0].online, false)
    const telemetry = await call('POST', `/robots/${created.json.id}/telemetry`, { online: true })
    assert.equal(telemetry.json.code, 'robot_retired')
  })

  test('answers unknown routes and wrong methods clearly', async () => {
    assert.equal((await call('GET', '/nope')).status, 404)
    assert.equal((await call('DELETE', '/companies')).status, 405)
  })
})

describe('saving the state', () => {
  test('reports every change and can start again from a saved state', async () => {
    const saved: Snapshot[] = []
    const first = createPlatformSimulator({ token: TOKEN, companies: DEMO_COMPANIES, onChange: (s) => saved.push(s) })
    await new Promise<void>((resolve) => first.server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${(first.server.address() as AddressInfo).port}`
    const headers = { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' }
    await fetch(`${url}/companies`, { method: 'GET', headers })
    assert.equal(saved.length, 0, 'reading does not save')
    await fetch(`${url}/companies`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Bewaard', subdomain: 'bewaard', adminEmail: 'a@b.example' }),
    })
    assert.equal(saved.length, 1)
    await new Promise<void>((resolve) => first.server.close(() => resolve()))

    const second = createPlatformSimulator({ token: TOKEN, companies: DEMO_COMPANIES, restoreFrom: saved[0]! })
    assert.ok([...second.state.companies.values()].some((c) => c.subdomain === 'bewaard'))
    assert.equal(second.state.companies.size, DEMO_COMPANIES.length + 1)
    second.server.close()
  })
})
