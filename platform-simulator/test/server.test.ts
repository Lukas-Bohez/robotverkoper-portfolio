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

  test('a food robot is an insulated one: no temperature to choose, and an unknown company is refused', async () => {
    const companyId = DEMO_COMPANIES[0]!.id
    const food = await call('POST', '/robots', { companyId, modelKind: 'FOOD', name: 'Zonder temperatuur' })
    assert.equal(food.status, 201)
    const bad = await call('POST', '/robots', { companyId, modelKind: 'LUCHT', name: 'Raar' })
    assert.equal(bad.status, 400)
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

  test('every company starts with a locked administrator role that cannot be changed or archived', async () => {
    const company = DEMO_COMPANIES[2]!
    const list = await call('GET', `/companies/${company.id}/roles`)
    const admin = list.json.find((r: any) => r.locked)
    assert.equal(admin.name, 'TENANT_ADMIN')
    assert.equal(admin.archivedAt, null)
    assert.ok(admin.permissions.length >= 15)
    const archived = await call('POST', `/companies/${company.id}/roles/${admin.id}/archive`, {})
    assert.equal(archived.status, 409)
    assert.equal(archived.json.code, 'role_locked')
    const changed = await call('PATCH', `/companies/${company.id}/roles/${admin.id}`, { permissions: [] })
    assert.equal(changed.json.code, 'role_locked')
  })

  test('a role has a name per language, and the staff role of the seed has all four', async () => {
    const company = DEMO_COMPANIES[0]!
    const staff = (await call('GET', `/companies/${company.id}/roles`)).json.find((r: any) => r.name === 'Personeel')
    assert.deepEqual(staff.names, { nl: 'Personeel', en: 'Staff', fr: 'Personnel', de: 'Personal' })
    const made = await call('POST', `/companies/${company.id}/roles`, {
      name: 'Lader',
      names: { nl: 'Lader', en: 'Loader', fr: '', de: null },
      permissions: ['robots:load'],
    })
    assert.equal(made.status, 201)
    assert.deepEqual(made.json.names, { nl: 'Lader', en: 'Loader' }, 'a language without a text is left out')
    const noNames = await call('POST', `/companies/${company.id}/roles`, { name: 'Zonder', permissions: [] })
    assert.equal(noNames.json.names, null)
    const bad = await call('POST', `/companies/${company.id}/roles`, { name: 'Slecht', names: 'nl', permissions: [] })
    assert.equal(bad.json.code, 'invalid_input')
  })

  test('changes a role: name, names and rights, and keeps the name unique', async () => {
    const company = DEMO_COMPANIES[1]!
    const role = (await call('POST', `/companies/${company.id}/roles`, { name: 'Ober', permissions: ['orders:read'] })).json
    const patched = await call('PATCH', `/companies/${company.id}/roles/${role.id}`, {
      names: { nl: 'Ober', en: 'Waiter', fr: 'Serveur' },
      permissions: ['orders:read', 'orders:dispatch', 'orders:read'],
    })
    assert.equal(patched.status, 200)
    assert.deepEqual(patched.json.permissions, ['orders:read', 'orders:dispatch'])
    assert.equal(patched.json.names.fr, 'Serveur')
    assert.equal(patched.json.name, 'Ober', 'what is not sent stays')
    const renamed = await call('PATCH', `/companies/${company.id}/roles/${role.id}`, { name: 'Bediende' })
    assert.equal(renamed.json.name, 'Bediende')
    const taken = await call('PATCH', `/companies/${company.id}/roles/${role.id}`, { name: 'personeel' })
    assert.equal(taken.status, 409)
    assert.equal(taken.json.code, 'role_exists')
    assert.equal((await call('PATCH', `/companies/${company.id}/roles/${role.id}`, { permissions: ['db:drop'] })).json.code, 'unknown_permission')
    assert.equal((await call('PATCH', `/companies/${company.id}/roles/nope`, { name: 'Iets' })).status, 404)
    assert.equal((await call('PATCH', `/companies/other/roles/${role.id}`, { name: 'Iets' })).status, 404)
  })

  test('a role is archived, not deleted: it leaves the list, stays known and can be restored', async () => {
    const company = DEMO_COMPANIES[2]!
    const lader = (await call('POST', `/companies/${company.id}/roles`, { name: 'Lader', permissions: ['robots:load'] })).json
    const archived = await call('POST', `/companies/${company.id}/roles/${lader.id}/archive`, {})
    assert.equal(archived.status, 200)
    assert.ok(archived.json.archivedAt)
    assert.equal((await call('POST', `/companies/${company.id}/roles/${lader.id}/archive`, {})).status, 200, 'calling it twice is fine')

    const normal = await call('GET', `/companies/${company.id}/roles`)
    assert.ok(!normal.json.some((r: any) => r.id === lader.id))
    const all = await call('GET', `/companies/${company.id}/roles?withArchived=true`)
    assert.equal(all.json.find((r: any) => r.id === lader.id).archivedAt, archived.json.archivedAt)
    // The name stays taken: bring the old role back instead of making a second one
    const again = await call('POST', `/companies/${company.id}/roles`, { name: 'Lader', permissions: [] })
    assert.equal(again.json.code, 'role_exists')

    const restored = await call('POST', `/companies/${company.id}/roles/${lader.id}/restore`, {})
    assert.equal(restored.json.archivedAt, null)
    assert.ok((await call('GET', `/companies/${company.id}/roles`)).json.some((r: any) => r.id === lader.id))
    assert.equal((await call('POST', `/companies/${company.id}/roles/nope/archive`, {})).status, 404)
  })

  test('the old way of deleting a role is gone (a role is never really deleted)', async () => {
    const company = DEMO_COMPANIES[2]!
    const role = (await call('POST', `/companies/${company.id}/roles`, { name: 'Tijdelijk', permissions: [] })).json
    assert.equal((await call('DELETE', `/companies/${company.id}/roles/${role.id}`)).status, 405)
  })

  test('a retired robot can be taken back into service: reinstate', async () => {
    const created = await call('POST', '/robots', { companyId: DEMO_COMPANIES[0]!.id, modelKind: 'FOOD', name: 'Terug' })
    await call('POST', `/robots/${created.json.id}/retire`, {})
    assert.equal((await call('POST', `/robots/${created.json.id}/telemetry`, { online: true })).json.code, 'robot_retired')
    const back = await call('POST', `/robots/${created.json.id}/reinstate`, {})
    assert.deepEqual(back.json, { id: created.json.id, retired: false })
    assert.equal((await call('POST', `/robots/${created.json.id}/telemetry`, { online: true, battery: 70 })).status, 200)
    assert.equal((await call('POST', '/robots/nope/reinstate', {})).status, 404)
  })

  describe('the condition of a robot', () => {
    const newRobotId = async () =>
      (await call('POST', '/robots', { companyId: DEMO_COMPANIES[0]!.id, modelKind: 'FOOD', name: 'Voorwaarde' })).json.id as string
    const MARKSE = { country: 'BE', address: 'Marksesteenweg 58, Kortrijk', longitude: 3.2647, latitude: 50.8283 }

    test('is unknown until something is set, and then only robots with a condition are listed', async () => {
      const id = await newRobotId()
      assert.deepEqual((await call('GET', `/robots/conditions?ids=${id},nope`)).json, [])
      const set = await call('PUT', `/robots/${id}/condition`, { tilted: true, tiltDegrees: 35, errorCode: 'E42', errorText: 'Wielmotor blokkeert', location: MARKSE })
      assert.equal(set.status, 200)
      const listed = (await call('GET', `/robots/conditions?ids=${id},nope`)).json
      assert.equal(listed.length, 1)
      assert.deepEqual(listed[0], {
        id,
        tilted: true,
        tiltDegrees: 35,
        hasCargo: false,
        cargoSummary: null,
        cargoSince: null,
        compartmentTemp: null,
        lid: 'LOCKED',
        errorCode: 'E42',
        errorText: 'Wielmotor blokkeert',
        location: MARKSE,
      })
    })

    test('changes only what is sent, and remembers since when there is food inside', async () => {
      const id = await newRobotId()
      await call('PUT', `/robots/${id}/condition`, { hasCargo: true, cargoSummary: '2 pizza’s', compartmentTemp: 6.5, tilted: true, tiltDegrees: 20 })
      const first = (await call('GET', `/robots/conditions?ids=${id}`)).json[0]
      assert.equal(first.hasCargo, true)
      assert.ok(first.cargoSince, 'the moment the food arrived is kept')
      await call('PUT', `/robots/${id}/condition`, { lid: 'OPEN' })
      const second = (await call('GET', `/robots/conditions?ids=${id}`)).json[0]
      assert.equal(second.lid, 'OPEN')
      assert.equal(second.cargoSummary, '2 pizza’s')
      assert.equal(second.cargoSince, first.cargoSince, 'a change of something else keeps it')
      // Food out: the "since" goes; standing up again: no tilt
      await call('PUT', `/robots/${id}/condition`, { hasCargo: false, tilted: false })
      const third = (await call('GET', `/robots/conditions?ids=${id}`)).json[0]
      assert.equal(third.cargoSince, null)
      assert.equal(third.tiltDegrees, null)
    })

    test('refuses what does not make sense', async () => {
      const id = await newRobotId()
      const refused = async (body: unknown) => (await call('PUT', `/robots/${id}/condition`, body)).status
      assert.equal(await refused({ tilted: 'ja' }), 400)
      assert.equal(await refused({ tiltDegrees: 400 }), 400)
      assert.equal(await refused({ lid: 'KAPOT' }), 400)
      assert.equal(await refused({ location: { longitude: 500, latitude: 0, address: 'x' } }), 400)
      assert.equal(await refused({ location: { longitude: 3, latitude: 50 } }), 400, 'a place needs an address')
      assert.equal((await call('PUT', '/robots/nope/condition', { tilted: false })).status, 404)
      assert.equal((await call('GET', `/robots/conditions?ids=${id}`)).json.length, 0, 'nothing was saved')
    })

    test('can be cleared with null', async () => {
      const id = await newRobotId()
      await call('PUT', `/robots/${id}/condition`, { errorCode: 'E1', location: MARKSE })
      await call('PUT', `/robots/${id}/condition`, { errorCode: null, location: null })
      const cleared = (await call('GET', `/robots/conditions?ids=${id}`)).json[0]
      assert.equal(cleared.errorCode, null)
      assert.equal(cleared.location, null)
    })
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
