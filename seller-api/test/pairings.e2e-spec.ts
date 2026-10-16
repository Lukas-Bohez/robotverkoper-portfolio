import request from 'supertest'
import { DataSource } from 'typeorm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { codeOf, createTestApp, domainCodeOf, gql, type TestContext } from './utils/test-app.js'
import {
  AUDIT,
  CANCEL_PAIRING,
  COLLECT_PAIRING,
  CREATE_PAIRING,
  CREATE_ROBOT,
  DELIVER,
  WAITING_PAIRINGS,
} from './utils/operations.js'

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(() => ctx.reset())

async function robot() {
  const created = await gql<{ createRobot: { robot: { id: string }; apiKey: string } }>(ctx.app, CREATE_ROBOT, {
    companyId: 'c-demo',
    input: { name: 'Food Robot 2', modelId: 'model-food' },
  })
  return created.data!.createRobot
}

/** The simulator is a device: it calls without a login */
async function announce(device = 'Windows-simulator') {
  const response = await gql<{ createPairing: { id: string; secret: string; code: string } }>(
    ctx.app,
    CREATE_PAIRING,
    { input: { device } },
    null,
  )
  return response.data!.createPairing
}

const collect = (id: string, secret: string) =>
  gql<{ collectPairing: { status: string; apiKey?: string; robotName?: string; platformUrl?: string } }>(
    ctx.app,
    COLLECT_PAIRING,
    { id, secret },
    null,
  )

describe('the key goes from the PWA to the simulator', () => {
  it('a simulator announces itself without a login, and the seller sees it', async () => {
    const ticket = await announce()
    expect(ticket.secret.length).toBeGreaterThanOrEqual(20)

    const list = await gql<{ waitingPairings: { device: string; code: string; loopback: boolean }[] }>(ctx.app, WAITING_PAIRINGS)
    expect(list.data!.waitingPairings).toHaveLength(1)
    expect(list.data!.waitingPairings[0]).toMatchObject({
      device: 'Windows-simulator',
      code: ticket.code,
      loopback: true,
    })
    expect(JSON.stringify(list), 'the seller never sees the secret').not.toContain(ticket.secret)
  })

  it('only a logged-in seller sees the waiting simulators or hands out a key', async () => {
    expect(codeOf(await gql(ctx.app, WAITING_PAIRINGS, {}, null))).toBe('UNAUTHENTICATED')
    expect(codeOf(await gql(ctx.app, WAITING_PAIRINGS, {}, 'vreemde@example.com'))).toBe('FORBIDDEN')
    const { id } = await announce()
    const deliver = await gql(ctx.app, DELIVER, { pairingId: id, input: { robotId: 'x', apiKey: 'rb_xxxxxxxxxxxx' } }, null)
    expect(codeOf(deliver)).toBe('UNAUTHENTICATED')
  })

  it('delivers the key of a robot: the simulator collects it once, with the robot name and address', async () => {
    const { robot: made, apiKey } = await robot()
    const { id, secret } = await announce()
    expect((await collect(id, secret)).data?.collectPairing).toEqual({
      status: 'WAITING',
      apiKey: null,
      robotName: null,
      platformUrl: null,
    })

    const delivered = await gql<{ deliverToSimulator: boolean }>(ctx.app, DELIVER, {
      pairingId: id,
      input: { robotId: made.id, apiKey },
    })
    expect(delivered.data?.deliverToSimulator).toBe(true)

    expect((await collect(id, secret)).data?.collectPairing).toEqual({
      status: 'DELIVERED',
      apiKey,
      robotName: 'Food Robot 2',
      platformUrl: 'http://platform.test/graphql',
    })
    const again = await collect(id, secret)
    expect(codeOf(again), 'the key is handed over once').toBe('NOT_FOUND')
  })

  it('never writes the key down: not in the database, not in the audit trail', async () => {
    const { robot: made, apiKey } = await robot()
    const { id } = await announce()
    await gql(ctx.app, DELIVER, { pairingId: id, input: { robotId: made.id, apiKey } })
    const mongo = ctx.app.get(DataSource).mongoManager
    const everything = JSON.stringify([
      await mongo.getMongoRepository('audit').find(),
      await mongo.getMongoRepository('robots').find(),
    ])
    expect(everything).not.toContain(apiKey)
    const audit = (await gql<{ auditLog: { action: string; detail: string }[] }>(ctx.app, AUDIT)).data!.auditLog[0]!
    expect(audit.action).toBe('robot.key-sent')
    expect(audit.detail).toMatch(/Food Robot 2/)
  })

  it('refuses a key that does not belong to the robot, an unknown robot, and a simulator that left', async () => {
    const { robot: made, apiKey } = await robot()
    const { id, secret } = await announce()
    const wrong = await gql(ctx.app, DELIVER, { pairingId: id, input: { robotId: made.id, apiKey: 'rb_andere-sleutel-xyz' } })
    expect(domainCodeOf(wrong)).toBe('key_mismatch')
    expect(codeOf(await gql(ctx.app, DELIVER, { pairingId: id, input: { robotId: 'nope', apiKey } }))).toBe('NOT_FOUND')
    const cancelled = await gql<{ cancelPairing: boolean }>(ctx.app, CANCEL_PAIRING, { id, secret }, null)
    expect(cancelled.data?.cancelPairing).toBe(true)
    expect(codeOf(await gql(ctx.app, DELIVER, { pairingId: id, input: { robotId: made.id, apiKey } }))).toBe('NOT_FOUND')
  })

  it('gives nothing to a simulator that does not know the secret', async () => {
    const { robot: made, apiKey } = await robot()
    const { id } = await announce()
    await gql(ctx.app, DELIVER, { pairingId: id, input: { robotId: made.id, apiKey } })
    expect(codeOf(await collect(id, 'geraden'))).toBe('FORBIDDEN')
    expect(codeOf(await collect(id, ''))).toBe('FORBIDDEN')
  })

  it('a simulator in a browser on localhost may call the API, a website of someone else may not', async () => {
    const open = await request(ctx.app.getHttpServer())
      .options('/graphql')
      .set('Origin', 'http://localhost:60123')
      .set('Access-Control-Request-Method', 'POST')
    expect(open.status).toBe(204)
    expect(open.headers['access-control-allow-origin']).toBe('http://localhost:60123')
    const other = await request(ctx.app.getHttpServer())
      .options('/graphql')
      .set('Origin', 'http://kwaad.example')
      .set('Access-Control-Request-Method', 'POST')
    expect(other.headers['access-control-allow-origin']).toBeUndefined()
  })
})
