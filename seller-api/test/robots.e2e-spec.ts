import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { DataSource } from 'typeorm'
import { ADMIN, TECH, codeOf, createTestApp, domainCodeOf, gql, type TestContext } from './utils/test-app.js'
import {
  AUDIT,
  COMPANIES,
  CREATE_ROBOT,
  REMOVE_ROBOT,
  RESTORE_ROBOT,
  ROBOT,
  ROBOTS,
  ROBOT_BY_CODE,
  ROBOT_MODELS,
  STOCK_ROBOTS,
} from './utils/operations.js'
import { addAccount, addStockRobot, createRobot, reportDefect, setCondition } from './utils/helpers.js'

interface RobotsData {
  robots: {
    source: string
    items: {
      id: string
      name: string
      serial: string
      qrCode: string
      status: string
      battery: number | null
      model: { name: string } | null
      apiKeyPrefix: string
      deletedAt: string | null
    }[]
  }
}
interface CreatedData {
  createRobot: { apiKey: string; robot: { id: string; serial: string; apiKeyPrefix: string; status: string } }
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

const list = async (withDeleted = false) =>
  (await gql<RobotsData>(ctx.app, ROBOTS, { companyId: 'c-demo', withDeleted })).data!.robots

describe('robots', () => {
  it('creates a robot, shows the key once and stores only its start', async () => {
    const created = await makeRobot()
    expect(created.errors).toBeUndefined()
    const { robot, apiKey } = created.data!.createRobot
    expect(apiKey).toMatch(/^rb_/)
    expect(robot.apiKeyPrefix).toBe(apiKey.slice(0, 11))
    expect(robot.status).toBe('UNKNOWN')

    const robots = await list()
    expect(robots.source).toBe('PLATFORM')
    expect(robots.items).toHaveLength(1)
    expect(robots.items[0]).toMatchObject({ status: 'ONLINE', battery: 80, model: { name: 'Delivery Bot Eten' } })
    expect(JSON.stringify(robots), 'the list never carries the key').not.toContain(apiKey)

    const mongo = ctx.app.get(DataSource).mongoManager
    const everything = JSON.stringify([
      await mongo.getMongoRepository('robots').find(),
      await mongo.getMongoRepository('audit').find(),
    ])
    expect(everything, 'the database never holds the key').not.toContain(apiKey)
    expect(everything, 'but the start of it, to recognise the robot').toContain(apiKey.slice(0, 11))
  })

  it('gives every robot a number for its QR code, one higher each time', async () => {
    const first = (await makeRobot()).data!.createRobot.robot
    const second = (await makeRobot('c-demo', { name: 'Tweede Bot' })).data!.createRobot.robot
    expect([first.serial, second.serial]).toEqual(['RBT-000001', 'RBT-000002'])
    const items = (await list()).items
    expect(items.map(robot => robot.qrCode)).toEqual(['rbt:RBT-000001', 'rbt:RBT-000002'])
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
    expect((await list()).items).toHaveLength(0)
  })

  it('shows the last known state of the robots when the platform is down', async () => {
    await makeRobot()
    await list()
    ctx.platform.down = true
    const robots = await list()
    expect(robots.source).toBe('CACHE')
    expect(robots.items[0]).toMatchObject({ status: 'ONLINE', battery: 80 })
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

describe('what a technician wants to know about a robot (the condition)', () => {
  it('shows tilt, cargo, lid, temperature, error and place of a robot', async () => {
    const robot = await createRobot(ctx)
    await setCondition(ctx, robot.id, {
      tilted: true,
      tiltDegrees: 35,
      hasCargo: true,
      cargoSummary: '2 pizza’s, 1 cola',
      compartmentTemp: 6.5,
      lid: 'OPEN',
      errorCode: 'E42',
      errorText: 'Gripper stuck',
      location: { country: 'BE', address: 'Marksesteenweg 58, Kortrijk', longitude: 3.2647, latitude: 50.8283 },
    })
    const { data } = await gql<{
      robot: { condition: Record<string, unknown>; inStock: boolean; qrCode: string }
    }>(ctx.app, ROBOT, { id: robot.id })
    expect(data?.robot.inStock).toBe(false)
    expect(data?.robot.condition).toMatchObject({
      tilted: true,
      tiltDegrees: 35,
      hasCargo: true,
      cargoSummary: '2 pizza’s, 1 cola',
      compartmentTemp: 6.5,
      lid: 'OPEN',
      errorCode: 'E42',
      location: {
        address: 'Marksesteenweg 58, Kortrijk',
        geometry: { type: 'Point', coordinates: [3.2647, 50.8283] },
      },
    })
  })

  it('knows nothing (null) about a robot the platform has no condition for, and still works when it is down', async () => {
    const robot = await createRobot(ctx)
    expect((await gql<{ robot: { condition: unknown } }>(ctx.app, ROBOT, { id: robot.id })).data?.robot.condition).toBeNull()
    await setCondition(ctx, robot.id, { hasCargo: true })
    ctx.platform.down = true
    const answer = await gql<{ robot: { name: string; condition: unknown } }>(ctx.app, ROBOT, { id: robot.id })
    expect(answer.errors).toBeUndefined()
    expect(answer.data?.robot.condition).toBeNull()
  })
})

describe('the warehouse and the QR codes', () => {
  it('finds a robot from what the scanner reads, in every notation', async () => {
    await addStockRobot(ctx, 'RBT-000417')
    for (const code of ['rbt:RBT-000417', 'RBT-000417', ' rbt:rbt-000417 ']) {
      const { data } = await gql<{ robotByCode: { serial: string; inStock: boolean; status: string } | null }>(
        ctx.app,
        ROBOT_BY_CODE,
        { code },
      )
      expect(data?.robotByCode, code).toMatchObject({ serial: 'RBT-000417', inStock: true, status: 'STOCK' })
    }
  })

  it('says null for an unknown number and BAD_REQUEST for a code that is not ours', async () => {
    expect((await gql<{ robotByCode: unknown }>(ctx.app, ROBOT_BY_CODE, { code: 'RBT-999999' })).data?.robotByCode).toBeNull()
    const other = await gql(ctx.app, ROBOT_BY_CODE, { code: 'https://example.com/x' })
    expect(codeOf(other)).toBe('BAD_REQUEST')
    expect(domainCodeOf(other)).toBe('invalid_robot_code')
  })

  it('lists the robots in the warehouse, and a robot at a company is not one of them', async () => {
    await addStockRobot(ctx, 'RBT-000417')
    await addStockRobot(ctx, 'RBT-000418', 'model-parcel')
    await createRobot(ctx)
    const { data } = await gql<{ stockRobots: { serial: string; model: { kind: string } }[] }>(ctx.app, STOCK_ROBOTS)
    expect(data?.stockRobots.map(robot => [robot.serial, robot.model.kind]).sort()).toEqual([
      ['RBT-000417', 'FOOD'],
      ['RBT-000418', 'PARCEL'],
    ])
  })

  it('a new robot gets a number after the highest one, also after robots in the warehouse', async () => {
    await addStockRobot(ctx, 'RBT-000040')
    expect((await createRobot(ctx)).serial).toBe('RBT-000041')
  })
})

describe('putting a robot out of service (soft delete)', () => {
  it('stops its key, takes it out of the list, and keeps it', async () => {
    const robot = await createRobot(ctx)
    const removed = await gql<{ removeRobot: { status: string; deletedAt: string | null } }>(ctx.app, REMOVE_ROBOT, {
      id: robot.id,
    })
    expect(removed.errors).toBeUndefined()
    expect(removed.data?.removeRobot).toMatchObject({ status: 'OUT_OF_SERVICE' })
    expect(removed.data?.removeRobot.deletedAt).toBeTruthy()
    expect(ctx.platform.robots.get(robot.id)!.retired, 'the platform stopped the key').toBe(true)

    expect((await list()).items).toHaveLength(0)
    const all = (await list(true)).items
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ status: 'OUT_OF_SERVICE' })
    expect(all[0]?.deletedAt).toBeTruthy()
  })

  it('restores the robot: the key works again', async () => {
    const robot = await createRobot(ctx)
    await gql(ctx.app, REMOVE_ROBOT, { id: robot.id })
    const restored = await gql<{ restoreRobot: { status: string; deletedAt: string | null } }>(ctx.app, RESTORE_ROBOT, {
      id: robot.id,
    })
    expect(restored.errors).toBeUndefined()
    expect(restored.data?.restoreRobot.deletedAt).toBeNull()
    expect(ctx.platform.robots.get(robot.id)!.retired).toBe(false)
    expect((await list()).items).toHaveLength(1)
    expect(codeOf(await gql(ctx.app, RESTORE_ROBOT, { id: robot.id }))).toBe('CONFLICT')
  })

  it('refuses a robot with an open defect, and an unknown robot', async () => {
    const robot = await createRobot(ctx)
    await reportDefect(ctx, robot.id)
    const refused = await gql(ctx.app, REMOVE_ROBOT, { id: robot.id })
    expect(codeOf(refused)).toBe('CONFLICT')
    expect(domainCodeOf(refused)).toBe('robot_has_defect')
    expect(ctx.platform.robots.get(robot.id)!.retired).toBe(false)
    expect(codeOf(await gql(ctx.app, REMOVE_ROBOT, { id: 'nope' }))).toBe('NOT_FOUND')
  })

  it('is a right of its own: a technician may add robots but not archive them', async () => {
    await addAccount(ctx, TECH, 'technician')
    const robot = await createRobot(ctx, 'Robot van de technicus', { as: TECH })
    expect(codeOf(await gql(ctx.app, REMOVE_ROBOT, { id: robot.id }, TECH))).toBe('FORBIDDEN')
    expect(codeOf(await gql(ctx.app, RESTORE_ROBOT, { id: robot.id }, TECH))).toBe('FORBIDDEN')
  })
})
