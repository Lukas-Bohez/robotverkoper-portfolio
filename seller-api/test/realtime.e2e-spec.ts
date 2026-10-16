import type { AddressInfo } from 'node:net'
import { createClient, type Client } from 'graphql-ws'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ADMIN, TECH, createTestApp, gql, type TestContext } from './utils/test-app.js'
import { ADD_ACCOUNT, CREATE_PAIRING, CREATE_ROBOT, REPORT_DEFECT } from './utils/operations.js'

let ctx: TestContext
let url: string
const clients: Client[] = []

/** A websocket client logged in as `email` (the token travels in the connectionParams) */
function socket(email: string | null): Client {
  const client = createClient({
    url,
    webSocketImpl: WebSocket,
    retryAttempts: 0,
    connectionParams: email ? { authorization: `Bearer dev:${email}` } : {},
  })
  clients.push(client)
  return client
}

/** The next result of a subscription, or the error that refused it */
function firstEvent<T>(client: Client, query: string, trigger: () => Promise<unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('no event within 8 seconds')), 8000)
    client.subscribe<T>(
      { query },
      {
        next: result => {
          clearTimeout(timer)
          if (result.errors?.length) reject(new Error(result.errors[0]?.message))
          else resolve(result.data as T)
        },
        error: error => {
          clearTimeout(timer)
          reject(error instanceof Error ? error : new Error('refused'))
        },
        complete: () => undefined,
      },
    )
    // Give the subscription a moment to register before the change that it must see
    setTimeout(() => void trigger(), 300)
  })
}

beforeAll(async () => {
  ctx = await createTestApp()
  await ctx.app.listen(0, '127.0.0.1')
  const { port } = ctx.app.getHttpServer().address() as AddressInfo
  url = `ws://127.0.0.1:${port}/graphql`
})
afterAll(async () => {
  await Promise.all(clients.map(client => client.dispose()))
  await ctx.close()
})
beforeEach(() => ctx.reset())

describe('realtime (GraphQL subscriptions over a websocket)', () => {
  it('the seller sees a simulator appear without asking again', async () => {
    const event = await firstEvent<{ waitingPairingsChanged: { device: string; code: string }[] }>(
      socket(ADMIN),
      'subscription { waitingPairingsChanged { id device code } }',
      () => gql(ctx.app, CREATE_PAIRING, { input: { device: 'Pixel-simulator' } }, null),
    )
    expect(event.waitingPairingsChanged.map(pairing => pairing.device)).toEqual(['Pixel-simulator'])
  })

  it('the defects screen hears that a defect was reported', async () => {
    const created = await gql<{ createRobot: { robot: { id: string } } }>(ctx.app, CREATE_ROBOT, {
      companyId: 'c-demo',
      input: { name: 'Demo Food Bot', modelId: 'model-food' },
    })
    const robotId = created.data!.createRobot.robot.id
    const event = await firstEvent<{ defectsChanged: { openDefects: number } }>(
      socket(ADMIN),
      'subscription { defectsChanged { openDefects } }',
      () => gql(ctx.app, REPORT_DEFECT, { robotId, input: { summary: 'Sensor vast' } }),
    )
    expect(event.defectsChanged.openDefects).toBe(1)
  })

  it('refuses a subscription without a login, and one from someone who is not on our staff', async () => {
    const query = 'subscription { defectsChanged { openDefects } }'
    await expect(firstEvent(socket(null), query, async () => undefined)).rejects.toThrow()
    await expect(firstEvent(socket('vreemde@example.com'), query, async () => undefined)).rejects.toThrow()
  })

  it('a technician may follow the defects too', async () => {
    await gql(ctx.app, ADD_ACCOUNT, { input: { email: TECH, role: 'TECHNICIAN' } })
    const created = await gql<{ createRobot: { robot: { id: string } } }>(ctx.app, CREATE_ROBOT, {
      companyId: 'c-demo',
      input: { name: 'Demo Food Bot', modelId: 'model-food' },
    })
    const robotId = created.data!.createRobot.robot.id
    const event = await firstEvent<{ defectsChanged: { openDefects: number } }>(
      socket(TECH),
      'subscription { defectsChanged { openDefects } }',
      () => gql(ctx.app, REPORT_DEFECT, { robotId, input: { summary: 'Sensor vast' } }),
    )
    expect(event.defectsChanged.openDefects).toBe(1)
  })
})
