import type { AddressInfo } from 'node:net'
import { createClient, type Client } from 'graphql-ws'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { ADMIN, TECH, createTestApp, gql, type TestContext } from './utils/test-app.js'
import { CALL_TECHNICIAN, CLAIM_DEFECT, CREATE_PAIRING, REQUEST_HELP } from './utils/operations.js'
import { addAccount, createRobot, OTHER_TECH, reportDefect } from './utils/helpers.js'

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
        next: (result) => {
          clearTimeout(timer)
          if (result.errors?.length) reject(new Error(result.errors[0]?.message))
          else resolve(result.data as T)
        },
        error: (error) => {
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
  for (const client of clients) await client.dispose()
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
    expect(event.waitingPairingsChanged.map((pairing) => pairing.device)).toEqual([
      'Pixel-simulator',
    ])
  })

  it('the defects screen hears that a defect was reported', async () => {
    const robot = await createRobot(ctx)
    const event = await firstEvent<{ defectsChanged: { openDefects: number } }>(
      socket(ADMIN),
      'subscription { defectsChanged { openDefects } }',
      () => reportDefect(ctx, robot.id),
    )
    expect(event.defectsChanged.openDefects).toBe(1)
  })

  it('refuses a subscription without a login, and one from someone who is not on our staff', async () => {
    const query = 'subscription { defectsChanged { openDefects } }'
    await expect(firstEvent(socket(null), query, async () => undefined)).rejects.toThrow()
    await expect(
      firstEvent(socket('vreemde@example.com'), query, async () => undefined),
    ).rejects.toThrow()
  })

  it('a technician may follow the defects too', async () => {
    await addAccount(ctx, TECH, 'technician')
    const robot = await createRobot(ctx)
    const event = await firstEvent<{ defectsChanged: { openDefects: number } }>(
      socket(TECH),
      'subscription { defectsChanged { openDefects } }',
      () => reportDefect(ctx, robot.id),
    )
    expect(event.defectsChanged.openDefects).toBe(1)
  })

  it('the detail of one defect follows that defect and no other', async () => {
    await addAccount(ctx, TECH, 'technician')
    const watched = await reportDefect(ctx, (await createRobot(ctx, 'Bot A')).id)
    const other = await reportDefect(ctx, (await createRobot(ctx, 'Bot B')).id)
    const query = `subscription { defectUpdated(defectId: "${watched.id}") { id status assignedTo } }`
    const event = await firstEvent<{
      defectUpdated: { id: string; status: string; assignedTo: string }
    }>(socket(ADMIN), query, async () => {
      // The other defect changes first: the screen of the watched one must not hear that
      await gql(ctx.app, CLAIM_DEFECT, { id: other.id }, TECH)
      await gql(ctx.app, CLAIM_DEFECT, { id: watched.id }, TECH)
    })
    expect(event.defectUpdated).toEqual({ id: watched.id, status: 'EN_ROUTE', assignedTo: TECH })
  })

  it('the dashboard of a technician hears when an administrator calls for a technician', async () => {
    await addAccount(ctx, TECH, 'technician')
    const robot = await createRobot(ctx, 'Food Robot 2')
    const { id } = await reportDefect(ctx, robot.id, 'Robot staat scheef')
    const event = await firstEvent<{
      technicianCalled: {
        kind: string
        defectId: string
        robotName: string
        companyName: string
        requestedBy: string
      }
    }>(
      socket(TECH),
      'subscription { technicianCalled { kind defectId robotName companyName summary hasCargo requestedBy } }',
      () => gql(ctx.app, CALL_TECHNICIAN, { id }),
    )
    expect(event.technicianCalled).toMatchObject({
      kind: 'CALL',
      defectId: id,
      robotName: 'Food Robot 2',
      companyName: 'Demozaak',
      requestedBy: ADMIN,
    })
  })

  it('a call for help of a technician reaches the others', async () => {
    await addAccount(ctx, TECH, 'technician')
    await addAccount(ctx, OTHER_TECH, 'technician')
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    await gql(ctx.app, CLAIM_DEFECT, { id }, TECH)
    const event = await firstEvent<{ technicianCalled: { kind: string; requestedBy: string } }>(
      socket(OTHER_TECH),
      'subscription { technicianCalled { kind requestedBy } }',
      () => gql(ctx.app, REQUEST_HELP, { id }, TECH),
    )
    expect(event.technicianCalled).toEqual({ kind: 'HELP', requestedBy: TECH })
  })

  it('someone who may not claim defects does not hear the calls', async () => {
    await gql(
      ctx.app,
      'mutation { createSellerRole(input: { key: "stagiair", names: { nl: "Stagiair" }, permissions: ["defects:read"] }) { id } }',
    )
    await addAccount(ctx, 'stagiair@fabrikant.example', 'stagiair')
    await expect(
      firstEvent(
        socket('stagiair@fabrikant.example'),
        'subscription { technicianCalled { kind } }',
        async () => undefined,
      ),
    ).rejects.toThrow()
  })
})
