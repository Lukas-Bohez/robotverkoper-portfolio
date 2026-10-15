import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, test } from 'node:test'
import { ADMIN, startApp, type TestApp } from './helpers.ts'

let app: TestApp

beforeEach(async () => {
  app = await startApp()
})
afterEach(() => app.close())

const TECH = 'technieker@fabrikant.example'

async function makeRobot(companyId = 'c-demo', body: Record<string, unknown> = {}) {
  return app.call('POST', `/companies/${companyId}/robots`, {
    body: { name: 'Demo Food Bot', modelId: 'model-food', ...body },
  })
}

describe('who may do what', () => {
  test('health is public, everything else needs a login', async () => {
    assert.equal((await app.call('GET', '/health', { as: null })).status, 200)
    assert.equal((await app.call('GET', '/companies', { as: null })).status, 401)
    const bad = await fetch(`${app.base}/companies`, { headers: { authorization: 'Bearer nonsense' } })
    assert.equal(bad.status, 401)
  })

  test('someone who is not on our staff is told there is no access', async () => {
    const me = await app.call('GET', '/me', { as: 'vreemde@example.com' })
    assert.equal(me.status, 200)
    assert.equal(me.json.role, null)
    assert.deepEqual(me.json.permissions, [])
    assert.equal((await app.call('GET', '/companies', { as: 'vreemde@example.com' })).status, 403)
  })

  test('the configured administrator may do everything', async () => {
    const me = (await app.call('GET', '/me')).json
    assert.equal(me.role, 'admin')
    assert.ok(me.permissions.includes('accounts:manage'))
  })

  test('a technician sees robots and defects but cannot create companies, set up roles or manage staff', async () => {
    await app.call('POST', '/accounts', { body: { email: TECH, role: 'technician' } })
    assert.equal((await app.call('GET', '/companies', { as: TECH })).status, 200)
    assert.equal((await app.call('GET', '/defects', { as: TECH })).status, 200)
    assert.equal((await app.call('POST', '/companies', { as: TECH, body: { name: 'X', subdomain: 'xx', adminEmail: 'a@b.be' } })).status, 403)
    assert.equal((await app.call('GET', '/companies/c-demo/roles', { as: TECH })).status, 403)
    assert.equal((await app.call('GET', '/accounts', { as: TECH })).status, 403)
    assert.equal((await app.call('GET', '/audit', { as: TECH })).status, 403)
    const robot = await app.call('POST', '/companies/c-demo/robots', {
      as: TECH,
      body: { name: 'Robot T', modelId: 'model-parcel' },
    })
    assert.equal(robot.status, 201)
  })
})

describe('companies', () => {
  test('lists the companies of the platform with our own counts', async () => {
    const { json } = await app.call('GET', '/companies')
    assert.equal(json.source, 'platform')
    assert.deepEqual(json.items.map((c: any) => c.name), ['Gelato Bar', 'Demozaak'].sort((a, b) => a.localeCompare(b)))
    assert.deepEqual(json.items[0], { ...json.items[0], robotCount: 0, openDefects: 0 })
  })

  test('creates a company through the platform and keeps no email address of anyone', async () => {
    const created = await app.call('POST', '/companies', {
      body: { name: 'Pizzeria Test', subdomain: ' Pizzeria-Test ', adminEmail: 'Chef@Pizzeria.example' },
    })
    assert.equal(created.status, 201)
    assert.equal(created.json.subdomain, 'pizzeria-test')
    assert.deepEqual(app.platform.lastCreateCompany, {
      name: 'Pizzeria Test',
      subdomain: 'pizzeria-test',
      adminEmail: 'chef@pizzeria.example',
    })
    const dump = JSON.stringify([
      app.store.listCompanies(),
      app.store.listAudit(50),
      app.store.listAccounts(),
    ]).toLowerCase()
    assert.ok(!dump.includes('chef@pizzeria'), 'the first administrator belongs to the company, not to us')
  })

  test('passes on the platform answer when the subdomain is taken, and validates the input', async () => {
    const taken = await app.call('POST', '/companies', { body: { name: 'Nog een', subdomain: 'demo', adminEmail: 'a@b.be' } })
    assert.equal(taken.status, 409)
    assert.equal(taken.json.code, 'subdomain_taken')
    assert.equal((await app.call('POST', '/companies', { body: { name: 'A', subdomain: 'ok', adminEmail: 'a@b.be' } })).status, 400)
    assert.equal((await app.call('POST', '/companies', { body: { name: 'Goed', subdomain: '-slecht-', adminEmail: 'a@b.be' } })).json.code, 'invalid_subdomain')
    assert.equal((await app.call('POST', '/companies', { body: { name: 'Goed', subdomain: 'goed', adminEmail: 'geen' } })).json.code, 'invalid_email')
  })

  test('says 404 for a company the platform does not know', async () => {
    assert.equal((await app.call('GET', '/companies/bestaat-niet')).status, 404)
  })

  test('shows the last known list, marked as cache, when the platform is down', async () => {
    await app.call('GET', '/companies')
    app.platform.down = true
    const { status, json } = await app.call('GET', '/companies')
    assert.equal(status, 200)
    assert.equal(json.source, 'cache')
    assert.equal(json.items.length, 2)
    const create = await app.call('POST', '/companies', { body: { name: 'Nieuw', subdomain: 'nieuw', adminEmail: 'a@b.be' } })
    assert.equal(create.status, 502)
    assert.equal(create.json.code, 'platform_unavailable')
  })

  test('a company that disappeared at the platform disappears here too', async () => {
    await app.call('GET', '/companies')
    app.platform.companiesList = app.platform.companiesList.filter((c) => c.id !== 'c-gelato')
    const { json } = await app.call('GET', '/companies')
    assert.deepEqual(json.items.map((c: any) => c.id), ['c-demo'])
  })
})

describe('robots', () => {
  test('creates a robot, shows the key once and stores only its start', async () => {
    const created = await makeRobot()
    assert.equal(created.status, 201)
    const { robot, apiKey } = created.json
    assert.match(apiKey, /^rb_/)
    assert.equal(robot.apiKeyPrefix, apiKey.slice(0, 11))
    assert.equal(robot.status, 'unknown')

    const list = (await app.call('GET', '/companies/c-demo/robots')).json
    assert.equal(list.source, 'platform')
    assert.equal(list.items.length, 1)
    assert.equal(list.items[0].status, 'online')
    assert.equal(list.items[0].battery, 80)
    assert.equal(list.items[0].model.name, 'Delivery Bot Eten')
    assert.ok(!JSON.stringify(list).includes(apiKey), 'the list never carries the key')

    const everything = JSON.stringify([
      app.store.robotsOfCompany('c-demo'),
      app.store.listAudit(50),
    ])
    assert.ok(!everything.includes(apiKey), 'the database never holds the key')
    assert.ok(everything.includes(apiKey.slice(0, 11)), 'but the start of it, to recognise the robot')
  })

  test('a food robot is always an insulated one: there is no temperature to choose, and one that is sent is ignored', async () => {
    const created = await makeRobot('c-demo', { temperatureType: 'COLD' })
    assert.equal(created.status, 201)
    assert.equal('temperatureType' in created.json.robot, false)
    const registered = [...app.platform.robots.values()][0]!.registration
    assert.deepEqual(registered, { companyId: 'c-demo', modelKind: 'FOOD', name: 'Demo Food Bot' })
    assert.equal((await makeRobot('c-demo', { modelId: 'model-parcel' })).status, 201)
  })

  test('refuses an unknown model, a short name and an unknown company', async () => {
    assert.equal((await makeRobot('c-demo', { modelId: 'model-x' })).status, 404)
    assert.equal((await makeRobot('c-demo', { name: 'A' })).status, 400)
    assert.equal((await makeRobot('bestaat-niet')).status, 404)
  })

  test('without the platform a new robot cannot get a key', async () => {
    await app.call('GET', '/companies')
    app.platform.down = true
    const result = await makeRobot()
    assert.equal(result.status, 502)
    assert.equal(app.store.countRobots(), 0)
  })

  test('shows the last known state of the robots when the platform is down', async () => {
    await makeRobot()
    await app.call('GET', '/companies/c-demo/robots')
    app.platform.down = true
    const { json } = await app.call('GET', '/companies/c-demo/robots')
    assert.equal(json.source, 'cache')
    assert.equal(json.items[0].status, 'online')
    assert.equal(json.items[0].battery, 80)
  })

  test('lists the robot models of our own catalogue', async () => {
    const { json } = await app.call('GET', '/robot-models')
    assert.deepEqual(json.items.map((m: any) => m.id).sort(), ['model-food', 'model-parcel'])
  })
})

describe('defects and replacing robots', () => {
  async function robotWithDefect() {
    const robot = (await makeRobot()).json.robot
    const defect = await app.call('POST', `/robots/${robot.id}/defects`, { body: { summary: 'Sensor vast', severity: 'high' } })
    return { robot, defect }
  }

  test('reports a defect: the robot shows as defective and the company counts it', async () => {
    const { robot, defect } = await robotWithDefect()
    assert.equal(defect.status, 201)
    assert.equal(defect.json.status, 'open')
    assert.equal(defect.json.company.name, 'Demozaak')
    const robots = (await app.call('GET', '/companies/c-demo/robots')).json.items
    assert.equal(robots[0].status, 'defect')
    assert.equal(robots[0].openDefectId, defect.json.id)
    const companies = (await app.call('GET', '/companies')).json.items
    assert.equal(companies.find((c: any) => c.id === 'c-demo').openDefects, 1)
    const open = (await app.call('GET', '/defects')).json.items
    assert.deepEqual(open.map((d: any) => d.robot.id), [robot.id])
  })

  test('validates a defect and refuses an unknown robot', async () => {
    const robot = (await makeRobot()).json.robot
    assert.equal((await app.call('POST', `/robots/${robot.id}/defects`, { body: { summary: 'x' } })).status, 400)
    assert.equal((await app.call('POST', `/robots/${robot.id}/defects`, { body: { summary: 'Kapot', severity: 'enorm' } })).status, 400)
    assert.equal((await app.call('POST', '/robots/nope/defects', { body: { summary: 'Kapot' } })).status, 404)
  })

  test('replaces a defective robot: the old key is stopped first, a new robot takes its place', async () => {
    const { robot: old, defect } = await robotWithDefect()
    const replaced = await app.call('POST', `/defects/${defect.json.id}/replace`, { body: {} })
    assert.equal(replaced.status, 201)
    assert.match(replaced.json.apiKey, /^rb_/)
    assert.equal(replaced.json.defect.status, 'replaced')
    assert.equal(replaced.json.defect.replacementRobotId, replaced.json.robot.id)
    assert.equal(replaced.json.robot.name, 'Demo Food Bot (vervanger)')
    assert.equal(app.platform.robots.get(old.id)!.retired, true, 'the platform stopped the old key')
    assert.equal(app.platform.robots.get(replaced.json.robot.id)!.registration.modelKind, 'FOOD', 'same kind as the old robot')

    const robots = (await app.call('GET', '/companies/c-demo/robots')).json.items
    assert.deepEqual(robots.map((r: any) => r.id), [replaced.json.robot.id], 'the old robot is gone from the list')
    assert.equal((await app.call('GET', '/defects')).json.items.length, 0)
    assert.equal((await app.call('GET', '/defects?status=all')).json.items.length, 1)
    const again = await app.call('POST', `/defects/${defect.json.id}/replace`, { body: {} })
    assert.equal(again.status, 409)
    assert.equal(again.json.code, 'defect_not_open')
  })

  test('does not replace anything when the platform cannot stop the old key', async () => {
    const { defect } = await robotWithDefect()
    app.platform.down = true
    const replaced = await app.call('POST', `/defects/${defect.json.id}/replace`, { body: {} })
    assert.equal(replaced.status, 502)
    app.platform.down = false
    assert.equal(app.store.defect(defect.json.id)!.status, 'open')
    assert.equal(app.store.countRobots(), 1)
  })

  test('closes a defect without replacing the robot', async () => {
    const { robot, defect } = await robotWithDefect()
    const closed = await app.call('POST', `/defects/${defect.json.id}/close`, { body: {} })
    assert.equal(closed.json.status, 'closed')
    const robots = (await app.call('GET', '/companies/c-demo/robots')).json.items
    assert.equal(robots[0].id, robot.id)
    assert.equal(robots[0].status, 'online')
  })
})

describe('roles of a company', () => {
  test('creates and removes a role, but never the locked administrator role', async () => {
    const created = await app.call('POST', '/companies/c-demo/roles', { body: { name: 'Kok', permissions: ['orders:read', 'orders:prepare'] } })
    assert.equal(created.status, 201)
    const list = (await app.call('GET', '/companies/c-demo/roles')).json.items
    assert.deepEqual(list.map((r: any) => r.name), ['TENANT_ADMIN', 'Kok'])

    const locked = await app.call('DELETE', '/companies/c-demo/roles/c-demo-admin')
    assert.equal(locked.status, 409)
    assert.equal(locked.json.code, 'role_locked')
    assert.equal((await app.call('DELETE', `/companies/c-demo/roles/${created.json.id}`)).status, 204)
    assert.equal((await app.call('DELETE', `/companies/c-demo/roles/${created.json.id}`)).status, 404)
  })

  test('refuses a permission the platform does not know', async () => {
    const result = await app.call('POST', '/companies/c-demo/roles', { body: { name: 'Hacker', permissions: ['db:drop'] } })
    assert.equal(result.status, 400)
    assert.equal(result.json.code, 'unknown_permission')
  })

  test('offers the list of permissions to build a role from', async () => {
    const { json } = await app.call('GET', '/company-permissions')
    assert.ok(json.items.includes('orders:prepare'))
  })
})

describe('our own staff and the audit trail', () => {
  test('adds, changes and removes an account', async () => {
    assert.equal((await app.call('POST', '/accounts', { body: { email: ' Technieker@Fabrikant.example ', role: 'technician' } })).status, 201)
    assert.equal((await app.call('POST', '/accounts', { body: { email: TECH, role: 'admin' } })).json.role, 'admin')
    const list = (await app.call('GET', '/accounts')).json.items
    assert.deepEqual(list.map((a: any) => [a.email, a.role]), [[ADMIN, 'admin'], [TECH, 'admin']])
    assert.equal((await app.call('DELETE', `/accounts/${encodeURIComponent(TECH)}`)).status, 204)
    assert.equal((await app.call('DELETE', `/accounts/${encodeURIComponent(TECH)}`)).status, 404)
  })

  test('an administrator from the settings cannot be changed, and nobody removes themselves', async () => {
    assert.equal((await app.call('POST', '/accounts', { body: { email: ADMIN, role: 'technician' } })).json.code, 'managed_by_config')
    assert.equal((await app.call('DELETE', `/accounts/${encodeURIComponent(ADMIN)}`)).json.code, 'managed_by_config')
    await app.call('POST', '/accounts', { body: { email: TECH, role: 'admin' } })
    assert.equal((await app.call('DELETE', `/accounts/${encodeURIComponent(TECH)}`, { as: TECH })).json.code, 'cannot_remove_self')
    assert.equal((await app.call('POST', '/accounts', { body: { email: 'iemand@x.be', role: 'koning' } })).status, 400)
  })

  test('keeps an audit trail of what was done and by whom', async () => {
    await app.call('POST', '/companies', { body: { name: 'Taverne', subdomain: 'taverne', adminEmail: 'a@b.be' } })
    await makeRobot()
    const { json } = await app.call('GET', '/audit')
    assert.deepEqual(json.items.map((a: any) => a.action), ['robot.created', 'company.created'])
    assert.equal(json.items[0].actor, ADMIN)
  })
})

describe('the browser', () => {
  test('answers the preflight of an allowed website and not of another', async () => {
    const allowed = await app.call('OPTIONS', '/companies', { as: null, origin: 'http://localhost:5174' })
    assert.equal(allowed.status, 204)
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5174')
    const other = await app.call('OPTIONS', '/companies', { as: null, origin: 'http://kwaad.example' })
    assert.equal(other.headers.get('access-control-allow-origin'), null)
  })

  test('unknown routes and wrong methods are clear, and a broken body is a 400', async () => {
    assert.equal((await app.call('GET', '/nope')).status, 404)
    assert.equal((await app.call('DELETE', '/companies')).status, 405)
    const broken = await fetch(`${app.base}/companies`, {
      method: 'POST',
      headers: { authorization: `Bearer dev:${ADMIN}`, 'content-type': 'application/json' },
      body: '{kapot',
    })
    assert.equal(broken.status, 400)
  })
})
