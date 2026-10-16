import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { codeOf, createTestApp, domainCodeOf, gql, type TestContext } from './utils/test-app.js'
import {
  CLOSE_DEFECT,
  COMPANIES,
  CREATE_ROBOT,
  DEFECTS,
  REPLACE_ROBOT,
  REPORT_DEFECT,
  ROBOTS,
} from './utils/operations.js'

interface Defect {
  id: string
  status: string
  robot: { id: string; name: string }
  company: { id: string; name: string }
  replacementRobotId: string | null
}

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(() => ctx.reset())

async function robotWithDefect() {
  const created = await gql<{ createRobot: { robot: { id: string } } }>(ctx.app, CREATE_ROBOT, {
    companyId: 'c-demo',
    input: { name: 'Demo Food Bot', modelId: 'model-food' },
  })
  const robot = created.data!.createRobot.robot
  const defect = await gql<{ reportDefect: Defect }>(ctx.app, REPORT_DEFECT, {
    robotId: robot.id,
    input: { summary: 'Sensor vast', severity: 'HIGH' },
  })
  return { robot, defect: defect.data!.reportDefect }
}

describe('defects and replacing robots', () => {
  it('reports a defect: the robot shows as defective and the company counts it', async () => {
    const { robot, defect } = await robotWithDefect()
    expect(defect.status).toBe('OPEN')
    expect(defect.company.name).toBe('Demozaak')
    const robots = (await gql<{ robots: { items: { status: string; openDefectId: string }[] } }>(ctx.app, ROBOTS, { companyId: 'c-demo' })).data!
      .robots.items
    expect(robots[0]).toMatchObject({ status: 'DEFECT', openDefectId: defect.id })
    const companies = (await gql<{ companies: { items: { id: string; openDefects: number }[] } }>(ctx.app, COMPANIES)).data!.companies.items
    expect(companies.find(company => company.id === 'c-demo')?.openDefects).toBe(1)
    const open = (await gql<{ defects: Defect[] }>(ctx.app, DEFECTS, { onlyOpen: true })).data!.defects
    expect(open.map(item => item.robot.id)).toEqual([robot.id])
  })

  it('validates a defect and refuses an unknown robot', async () => {
    const { robot } = await robotWithDefect()
    expect(codeOf(await gql(ctx.app, REPORT_DEFECT, { robotId: robot.id, input: { summary: 'x' } }))).toBe('BAD_REQUEST')
    expect(
      codeOf(await gql(ctx.app, REPORT_DEFECT, { robotId: robot.id, input: { summary: 'Kapot', severity: 'ENORM' } })),
    ).toBeDefined()
    expect(domainCodeOf(await gql(ctx.app, REPORT_DEFECT, { robotId: 'nope', input: { summary: 'Kapot' } }))).toBe('robot_not_found')
  })

  it('looks up the robots and companies of a list of defects in batches (no query per defect)', async () => {
    for (const name of ['Bot A', 'Bot B', 'Bot C']) {
      const created = await gql<{ createRobot: { robot: { id: string } } }>(ctx.app, CREATE_ROBOT, {
        companyId: 'c-demo',
        input: { name, modelId: 'model-food' },
      })
      await gql(ctx.app, REPORT_DEFECT, { robotId: created.data!.createRobot.robot.id, input: { summary: `Defect van ${name}` } })
    }
    const { data } = await gql<{ defects: Defect[] }>(ctx.app, DEFECTS, { onlyOpen: true })
    expect(data!.defects.map(defect => defect.robot.name).sort()).toEqual(['Bot A', 'Bot B', 'Bot C'])
    expect(new Set(data!.defects.map(defect => defect.company.id))).toEqual(new Set(['c-demo']))
  })

  it('replaces a defective robot: the old key is stopped first, a new robot takes its place', async () => {
    const { robot: old, defect } = await robotWithDefect()
    const replaced = await gql<{
      replaceRobot: { apiKey: string; defect: Defect; robot: { id: string; name: string; model: { kind: string } } }
    }>(ctx.app, REPLACE_ROBOT, { defectId: defect.id })
    expect(replaced.errors).toBeUndefined()
    const result = replaced.data!.replaceRobot
    expect(result.apiKey).toMatch(/^rb_/)
    expect(result.defect.status).toBe('REPLACED')
    expect(result.defect.replacementRobotId).toBe(result.robot.id)
    expect(result.robot.name).toBe('Demo Food Bot (vervanger)')
    expect(ctx.platform.robots.get(old.id)!.retired, 'the platform stopped the old key').toBe(true)
    expect(ctx.platform.robots.get(result.robot.id)!.registration.modelKind, 'same kind as the old robot').toBe('FOOD')

    const robots = (await gql<{ robots: { items: { id: string }[] } }>(ctx.app, ROBOTS, { companyId: 'c-demo' })).data!.robots.items
    expect(robots.map(robot => robot.id), 'the old robot is gone from the list').toEqual([result.robot.id])
    expect((await gql<{ defects: Defect[] }>(ctx.app, DEFECTS, { onlyOpen: true })).data!.defects).toHaveLength(0)
    const all = (await gql<{ defects: Defect[] }>(ctx.app, DEFECTS, { onlyOpen: false })).data!.defects
    expect(all).toHaveLength(1)
    expect(all[0]?.robot.name, 'the replaced robot is still shown with its defect').toBe('Demo Food Bot')

    const again = await gql(ctx.app, REPLACE_ROBOT, { defectId: defect.id })
    expect(codeOf(again)).toBe('CONFLICT')
    expect(domainCodeOf(again)).toBe('defect_not_open')
  })

  it('does not replace anything when the platform cannot stop the old key', async () => {
    const { defect } = await robotWithDefect()
    ctx.platform.down = true
    expect(codeOf(await gql(ctx.app, REPLACE_ROBOT, { defectId: defect.id }))).toBe('BAD_GATEWAY')
    ctx.platform.down = false
    const open = (await gql<{ defects: Defect[] }>(ctx.app, DEFECTS, { onlyOpen: true })).data!.defects
    expect(open.map(item => item.status)).toEqual(['OPEN'])
    expect((await gql<{ robots: { items: unknown[] } }>(ctx.app, ROBOTS, { companyId: 'c-demo' })).data!.robots.items).toHaveLength(1)
  })

  it('closes a defect without replacing the robot', async () => {
    const { robot, defect } = await robotWithDefect()
    const closed = await gql<{ closeDefect: { status: string } }>(ctx.app, CLOSE_DEFECT, { id: defect.id })
    expect(closed.data?.closeDefect.status).toBe('CLOSED')
    const robots = (await gql<{ robots: { items: { id: string; status: string }[] } }>(ctx.app, ROBOTS, { companyId: 'c-demo' })).data!.robots.items
    expect(robots[0]).toMatchObject({ id: robot.id, status: 'ONLINE' })
  })
})
