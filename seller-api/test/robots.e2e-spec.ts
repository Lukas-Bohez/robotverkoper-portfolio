import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DataSource } from 'typeorm'
import { ADMIN, codeOf, createTestApp, domainCodeOf, gql, type TestContext } from './utils/test-app.js'
import { AUDIT, COMPANIES, CREATE_ROBOT, ROBOTS, ROBOT_MODELS } from './utils/operations.js'

interface RobotsData {
  robots: {
    source: string
    items: {
      id: string
      status: string
      battery: number | null
      model: { name: string } | null
      apiKeyPrefix: string
    }[]
  }
}
interface CreatedData {
  createRobot: { apiKey: string; robot: { id: string; apiKeyPrefix: string; status: string } }
}

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(() => ctx.reset())

async function makeRobot(companyId = 'c-demo', input: Record<string, unknown> = {}) {
  return gql<CreatedData>(ctx.app, CREATE_ROBOT, {
    companyId,
    input: { name: 'Demo Food Bot', modelId: 'model-food', ...input },
  })
}

describe('robots', () => {
  it('creates a robot, shows the key once and stores only its start', async () => {
    const created = await makeRobot()
    expect(created.errors).toBeUndefined()
    const { robot, apiKey } = created.data!.createRobot
    expect(apiKey).toMatch(/^rb_/)
    expect(robot.apiKeyPrefix).toBe(apiKey.slice(0, 11))
    expect(robot.status).toBe('UNKNOWN')

    const list = (await gql<RobotsData>(ctx.app, ROBOTS, { companyId: 'c-demo' })).data!.robots
    expect(list.source).toBe('PLATFORM')
    expect(list.items).toHaveLength(1)
    expect(list.items[0]).toMatchObject({ status: 'ONLINE', battery: 80, model: { name: 'Delivery Bot Eten' } })
    expect(JSON.stringify(list), 'the list never carries the key').not.toContain(apiKey)

    const mongo = ctx.app.get(DataSource).mongoManager
    const everything = JSON.stringify([
      await mongo.getMongoRepository('robots').find(),
      await mongo.getMongoRepository('audit').find(),
    ])
    expect(everything, 'the database never holds the key').not.toContain(apiKey)
    expect(everything, 'but the start of it, to recognise the robot').toContain(apiKey.slice(0, 11))
  })

  it('a food robot is always an insulated one: there is no temperature to choose', async () => {
    const created = await makeRobot()
    expect(created.errors).toBeUndefined()
    const registered = [...ctx.platform.robots.values()][0]!.registration
    expect(registered).toEqual({ companyId: 'c-demo', modelKind: 'FOOD', name: 'Demo Food Bot' })
    // A field that is not in the schema is refused, so a temperature cannot even be sent
    const warm = await makeRobot('c-demo', { temperatureType: 'COLD' })
    expect(codeOf(warm)).toBeDefined()
    expect((await makeRobot('c-demo', { modelId: 'model-parcel' })).errors).toBeUndefined()
  })

  it('refuses an unknown model, a short name and an unknown company', async () => {
    expect(domainCodeOf(await makeRobot('c-demo', { modelId: 'model-x' }))).toBe('model_not_found')
    expect(codeOf(await makeRobot('c-demo', { name: 'A' }))).toBe('BAD_REQUEST')
    expect(codeOf(await makeRobot('bestaat-niet'))).toBe('NOT_FOUND')
  })

  it('without the platform a new robot cannot get a key', async () => {
    await gql(ctx.app, COMPANIES)
    ctx.platform.down = true
    const result = await makeRobot()
    expect(codeOf(result)).toBe('BAD_GATEWAY')
    ctx.platform.down = false
    expect((await gql<RobotsData>(ctx.app, ROBOTS, { companyId: 'c-demo' })).data?.robots.items).toHaveLength(0)
  })

  it('shows the last known state of the robots when the platform is down', async () => {
    await makeRobot()
    await gql(ctx.app, ROBOTS, { companyId: 'c-demo' })
    ctx.platform.down = true
    const { data } = await gql<RobotsData>(ctx.app, ROBOTS, { companyId: 'c-demo' })
    expect(data?.robots.source).toBe('CACHE')
    expect(data?.robots.items[0]).toMatchObject({ status: 'ONLINE', battery: 80 })
  })

  it('lists the robot models of our own catalogue', async () => {
    const { data } = await gql<{ robotModels: { id: string; kind: string }[] }>(ctx.app, ROBOT_MODELS)
    expect(data?.robotModels.map(model => model.id).sort()).toEqual(['model-food', 'model-parcel'])
    expect(data?.robotModels.find(model => model.id === 'model-food')?.kind).toBe('FOOD')
  })

  it('records who made the robot', async () => {
    await makeRobot()
    const { data } = await gql<{ auditLog: { action: string; actor: string }[] }>(ctx.app, AUDIT)
    expect(data?.auditLog[0]).toMatchObject({ action: 'robot.created', actor: ADMIN })
  })
})
