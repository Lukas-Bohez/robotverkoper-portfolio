import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, test } from 'node:test'
import { createPlatformSimulator } from '../src/server.ts'
import { DEMO_COMPANIES } from '../src/seed.ts'

const TOKEN = 'test-token'
let base = ''
let close: () => Promise<void>
let clock = new Date('2026-10-15T12:00:00Z')

before(async () => {
  const { server } = createPlatformSimulator({ token: TOKEN, companies: DEMO_COMPANIES, now: () => clock })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  close = () => new Promise((resolve) => server.close(() => resolve()))
})

after(() => close())

async function platform(method: string, path: string, body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, json: (await response.json()) as any }
}

/** What the robot app (Lukas/simulator) sends: GraphQL with the API key of the robot */
async function robotCall(apiKey: string | null, query: string, variables: unknown = {}) {
  const response = await fetch(`${base}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}) },
    body: JSON.stringify({ query, variables }),
  })
  return { status: response.status, json: (await response.json()) as any }
}

async function newRobot(kind: 'FOOD' | 'PARCEL' = 'FOOD') {
  const created = await platform('POST', '/robots', {
    companyId: DEMO_COMPANIES[0]!.id,
    modelKind: kind,
    name: 'Robot Gelato 1',
    ...(kind === 'FOOD' ? { temperatureType: 'COLD' } : {}),
  })
  return created.json as { id: string; apiKey: string }
}

const REPORT = 'mutation ReportTelemetry($input: TelemetryInput!) { reportTelemetry(input: $input) }'

describe('the robot side (/graphql)', () => {
  test('refuses a missing or wrong key, in a 200 answer like a GraphQL server', async () => {
    const none = await robotCall(null, 'query MyRobot { myRobot { name } }')
    assert.equal(none.status, 200)
    assert.equal(none.json.errors[0].message, 'Invalid API key')
    const wrong = await robotCall('rb_wrong', 'query MyRobot { myRobot { name } }')
    assert.equal(wrong.json.errors[0].message, 'Invalid API key')
  })

  test('tells the robot who it is: its name, company, kind and temperature', async () => {
    const robot = await newRobot('FOOD')
    const { json } = await robotCall(robot.apiKey, 'query MyRobot { myRobot { name companyName kind } }')
    assert.deepEqual(json.data.myRobot, {
      name: 'Robot Gelato 1',
      companyName: 'Demozaak',
      kind: 'FOOD',
      modelName: 'Delivery Bot Eten',
      widthMm: 350,
      heightMm: 250,
      depthMm: 300,
      temperatureType: 'COLD',
      unlockMethod: 'REMOTE',
    })
  })

  test('a robot that reports its telemetry shows up online with its battery', async () => {
    const robot = await newRobot('PARCEL')
    const report = await robotCall(robot.apiKey, REPORT, { input: { lat: 50.8, lng: 3.2, battery: 64.4, compartments: [] } })
    assert.deepEqual(report.json.data, { reportTelemetry: true })
    const live = await platform('GET', `/robots/live?ids=${robot.id}`)
    assert.deepEqual(live.json[0], { id: robot.id, online: true, battery: 64 })
  })

  test('a robot that stops reporting goes offline after 20 seconds', async () => {
    const robot = await newRobot('PARCEL')
    await robotCall(robot.apiKey, REPORT, { input: { battery: 50 } })
    clock = new Date(clock.getTime() + 10_000)
    assert.equal((await platform('GET', `/robots/live?ids=${robot.id}`)).json[0].online, true)
    clock = new Date(clock.getTime() + 15_000)
    assert.deepEqual((await platform('GET', `/robots/live?ids=${robot.id}`)).json[0], {
      id: robot.id,
      online: false,
      battery: 50,
    })
  })

  test('a robot that reports itself overrules what was set by hand', async () => {
    const robot = await newRobot('PARCEL')
    await platform('POST', `/robots/${robot.id}/telemetry`, { online: false, battery: 5 })
    assert.equal((await platform('GET', `/robots/live?ids=${robot.id}`)).json[0].online, false)
    await robotCall(robot.apiKey, REPORT, { input: { battery: 90 } })
    assert.deepEqual((await platform('GET', `/robots/live?ids=${robot.id}`)).json[0], {
      id: robot.id,
      online: true,
      battery: 90,
    })
  })

  test('refuses a report without a battery', async () => {
    const robot = await newRobot()
    const { json } = await robotCall(robot.apiKey, REPORT, { input: {} })
    assert.equal(json.errors[0].message, 'battery is required')
  })

  test('a retired robot can no longer connect', async () => {
    const robot = await newRobot()
    await platform('POST', `/robots/${robot.id}/retire`, {})
    const { json } = await robotCall(robot.apiKey, 'query MyRobot { myRobot { name } }')
    assert.equal(json.errors[0].message, 'Invalid API key')
  })

  test('answers the other operations of the robot app with nothing to do', async () => {
    const robot = await newRobot()
    assert.deepEqual((await robotCall(robot.apiKey, 'query PendingRobotCommands { pendingRobotCommands { id } }')).json.data, {
      pendingRobotCommands: [],
    })
    assert.deepEqual((await robotCall(robot.apiKey, 'query MyActiveTrip { myActiveTrip { id } }')).json.data, { myActiveTrip: null })
    assert.deepEqual((await robotCall(robot.apiKey, 'query WalkingRoute { walkingRoute(fromLat: 1) }')).json.data, { walkingRoute: null })
    assert.deepEqual(
      (await robotCall(robot.apiKey, 'mutation AckRobotCommand($id: ID!) { ackRobotCommand(id: $id) }', { id: '1' })).json.data,
      { ackRobotCommand: true },
    )
    assert.match((await robotCall(robot.apiKey, 'mutation { unlockWithPin(pin: "1") }')).json.errors[0].message, /cannot check a PIN/)
    assert.match((await robotCall(robot.apiKey, '{ iets }')).json.errors[0].message, /does not know/)
  })

  test('is open for a robot app in a browser (CORS)', async () => {
    const preflight = await fetch(`${base}/graphql`, { method: 'OPTIONS' })
    assert.equal(preflight.status, 204)
    assert.equal(preflight.headers.get('access-control-allow-origin'), '*')
    assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /x-api-key/)
  })

  test('refuses a GET on /graphql', async () => {
    assert.equal((await fetch(`${base}/graphql`)).status, 405)
  })
})
