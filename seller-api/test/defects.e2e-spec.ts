import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  ADMIN,
  TECH,
  codeOf,
  createTestApp,
  domainCodeOf,
  gql,
  type TestContext,
} from './utils/test-app.js'
import {
  ARRIVE_AT_DEFECT,
  AUDIT,
  CALL_TECHNICIAN,
  CLAIM_DEFECT,
  CLOSE_DEFECT,
  COMPANIES,
  DEFECT,
  DEFECTS,
  DEFECTS_BY_STATUS,
  DEFECT_DISTANCE,
  NEARBY_DEFECTS,
  RELEASE_DEFECT,
  REMOVE_DEFECT,
  REPLACE_ROBOT,
  REPORT_DEFECT,
  REQUEST_HELP,
  RESTORE_DEFECT,
  ROBOT,
  ROBOTS,
  STOCK_ROBOTS,
  UPDATE_CHECKLIST,
} from './utils/operations.js'
import {
  FAR,
  MARKSE,
  NEARBY,
  OTHER_TECH,
  addAccount,
  addStockRobot,
  createRobot,
  reportDefect,
  setCondition,
} from './utils/helpers.js'

interface Defect {
  id: string
  status: string
  summary: string
  assignedTo: string | null
  checklistDone: string[]
  resolution: string | null
  replacementRobotId: string | null
  robot: { id: string; name: string; serial: string }
  company: { id: string; name: string }
  condition: {
    hasCargo: boolean
    tilted: boolean
    tiltDegrees: number | null
    errorCode: string | null
  } | null
  location: { address: string; geometry: { coordinates: [number, number] } } | null
}

let ctx: TestContext

beforeAll(async () => {
  ctx = await createTestApp()
})
afterAll(() => ctx.close())
beforeEach(async () => {
  await ctx.reset()
  await addAccount(ctx, TECH, 'technician')
  await addAccount(ctx, OTHER_TECH, 'technician')
})

const defects = async (variables: Record<string, unknown> = {}, as = ADMIN) =>
  (await gql<{ defects: Defect[] }>(ctx.app, DEFECTS, variables, as)).data!.defects
const one = async (id: string) =>
  (await gql<{ defect: Defect }>(ctx.app, DEFECT, { id })).data!.defect
const claim = (id: string, as = TECH) => gql(ctx.app, CLAIM_DEFECT, { id }, as)
const arrive = (id: string, as = TECH) => gql(ctx.app, ARRIVE_AT_DEFECT, { id }, as)
const checklist = (id: string, done: string[], as = TECH) =>
  gql(ctx.app, UPDATE_CHECKLIST, { id, done }, as)
const close = (id: string, resolution = 'REPAIRED', as = TECH, note?: string) =>
  gql(ctx.app, CLOSE_DEFECT, { id, input: { resolution, note } }, as)

describe('reporting a defect', () => {
  it('shows the robot as defective and the company counts it', async () => {
    const robot = await createRobot(ctx)
    const defect = await reportDefect(ctx, robot.id)
    expect(defect.status).toBe('OPEN')
    expect((await one(defect.id)).company.name).toBe('Demozaak')
    const robots = (
      await gql<{ robots: { items: { status: string; openDefectId: string }[] } }>(
        ctx.app,
        ROBOTS,
        { companyId: 'c-demo' },
      )
    ).data!.robots.items
    expect(robots[0]).toMatchObject({ status: 'DEFECT', openDefectId: defect.id })
    const companies = (
      await gql<{ companies: { items: { id: string; openDefects: number }[] } }>(ctx.app, COMPANIES)
    ).data!.companies.items
    expect(companies.find((company) => company.id === 'c-demo')?.openDefects).toBe(1)
    expect((await defects()).map((item) => item.robot.id)).toEqual([robot.id])
  })

  it('keeps the condition of the robot at that moment: food inside, tilted, error, place', async () => {
    const robot = await createRobot(ctx)
    await setCondition(ctx, robot.id, {
      tilted: true,
      tiltDegrees: 35,
      hasCargo: true,
      cargoSummary: 'Bestelling 5B57B0',
      errorCode: 'E42',
      location: MARKSE,
    })
    const reported = await reportDefect(ctx, robot.id)
    // What changes at the robot afterwards does not change what was seen when it was reported
    await setCondition(ctx, robot.id, { hasCargo: false, tilted: false })
    const defect = await one(reported.id)
    expect(defect.condition).toMatchObject({
      hasCargo: true,
      tilted: true,
      tiltDegrees: 35,
      errorCode: 'E42',
    })
    expect(defect.location).toMatchObject({
      address: 'Marksesteenweg 58, Kortrijk',
      geometry: { coordinates: [3.2647, 50.8283] },
    })
  })

  it('reports a robot without a known condition too', async () => {
    const robot = await createRobot(ctx)
    const defect = await one((await reportDefect(ctx, robot.id)).id)
    expect(defect.condition).toBeNull()
    expect(defect.location).toBeNull()
  })

  it('validates a defect, refuses an unknown robot, and one open defect per robot', async () => {
    const robot = await createRobot(ctx)
    expect(
      codeOf(await gql(ctx.app, REPORT_DEFECT, { robotId: robot.id, input: { summary: 'x' } })),
    ).toBe('BAD_REQUEST')
    expect(
      codeOf(
        await gql(ctx.app, REPORT_DEFECT, {
          robotId: robot.id,
          input: { summary: 'Kapot', severity: 'ENORM' },
        }),
      ),
    ).toBeDefined()
    expect(
      domainCodeOf(
        await gql(ctx.app, REPORT_DEFECT, { robotId: 'nope', input: { summary: 'Kapot' } }),
      ),
    ).toBe('robot_not_found')
    await reportDefect(ctx, robot.id)
    const twice = await gql(ctx.app, REPORT_DEFECT, {
      robotId: robot.id,
      input: { summary: 'Nog eens kapot' },
    })
    expect(codeOf(twice)).toBe('CONFLICT')
    expect(domainCodeOf(twice)).toBe('defect_exists')
  })

  it('a robot in the warehouse is not at a company, so it cannot have a defect', async () => {
    await addStockRobot(ctx)
    const stock = (await gql<{ stockRobots: { id: string }[] }>(ctx.app, STOCK_ROBOTS)).data!
      .stockRobots[0]!
    const result = await gql(ctx.app, REPORT_DEFECT, {
      robotId: stock.id,
      input: { summary: 'Kapot' },
    })
    expect(domainCodeOf(result)).toBe('robot_not_at_company')
  })

  it('looks up the robots and companies of a list of defects in batches (no query per defect)', async () => {
    for (const name of ['Bot A', 'Bot B', 'Bot C']) {
      const robot = await createRobot(ctx, name)
      await reportDefect(ctx, robot.id, `Defect van ${name}`)
    }
    const list = await defects()
    expect(list.map((defect) => defect.robot.name).sort()).toEqual(['Bot A', 'Bot B', 'Bot C'])
    expect(new Set(list.map((defect) => defect.company.id))).toEqual(new Set(['c-demo']))
  })
})

describe('the technician takes a defect and works through it', () => {
  it('goes OPEN → EN_ROUTE → ON_SITE → CLOSED, and the robot is online again', async () => {
    const robot = await createRobot(ctx)
    const { id } = await reportDefect(ctx, robot.id)

    expect((await claim(id)).errors).toBeUndefined()
    expect(await one(id)).toMatchObject({ status: 'EN_ROUTE', assignedTo: TECH })

    expect((await arrive(id)).errors).toBeUndefined()
    expect((await one(id)).status).toBe('ON_SITE')

    const ticked = await gql<{ updateDefectChecklist: { checklistDone: string[] } }>(
      ctx.app,
      UPDATE_CHECKLIST,
      { id, done: ['robot_stable', 'lid_checked', 'robot_stable'] },
      TECH,
    )
    expect(ticked.data?.updateDefectChecklist.checklistDone).toEqual([
      'robot_stable',
      'lid_checked',
    ])

    const closed = await close(id, 'REPAIRED', TECH, 'Motor vervangen')
    expect(closed.errors).toBeUndefined()
    expect(await one(id)).toMatchObject({ status: 'CLOSED', resolution: 'REPAIRED' })

    const robots = (
      await gql<{ robots: { items: { id: string; status: string }[] } }>(ctx.app, ROBOTS, {
        companyId: 'c-demo',
      })
    ).data!.robots.items
    expect(robots[0]).toMatchObject({ id: robot.id, status: 'ONLINE' })
    expect(await defects()).toHaveLength(0)
    expect((await defects({ onlyOpen: false })).map((item) => item.status)).toEqual(['CLOSED'])
  })

  it('a technician can take more than one defect (the ones nearby)', async () => {
    const first = await reportDefect(ctx, (await createRobot(ctx, 'Bot A')).id)
    const second = await reportDefect(ctx, (await createRobot(ctx, 'Bot B')).id)
    expect((await claim(first.id)).errors).toBeUndefined()
    expect((await claim(second.id)).errors).toBeUndefined()
    expect((await defects({ mine: true }, TECH)).map((defect) => defect.id).sort()).toEqual(
      [first.id, second.id].sort(),
    )
    expect(await defects({ mine: true }, OTHER_TECH)).toHaveLength(0)
  })

  it('refuses a defect that another technician took, and taking it twice changes nothing', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    await claim(id)
    const taken = await claim(id, OTHER_TECH)
    expect(codeOf(taken)).toBe('CONFLICT')
    expect(domainCodeOf(taken)).toBe('defect_claimed')
    expect((await claim(id)).errors).toBeUndefined()
    expect((await one(id)).assignedTo).toBe(TECH)
  })

  it('only the technician who took it arrives, ticks the check or gives it back', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    await claim(id)
    expect(domainCodeOf(await arrive(id, OTHER_TECH))).toBe('not_your_defect')
    expect(domainCodeOf(await checklist(id, ['robot_stable'], OTHER_TECH))).toBe('not_your_defect')
    expect(domainCodeOf(await gql(ctx.app, RELEASE_DEFECT, { id }, OTHER_TECH))).toBe(
      'not_your_defect',
    )
  })

  it('gives a defect back: it is open again, the arrival and the check are forgotten', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    await claim(id)
    await arrive(id)
    await checklist(id, ['robot_stable'])
    const released = await gql<{ releaseDefect: { status: string; assignedTo: string | null } }>(
      ctx.app,
      RELEASE_DEFECT,
      { id },
      TECH,
    )
    expect(released.data?.releaseDefect).toMatchObject({ status: 'OPEN', assignedTo: null })
    expect((await one(id)).checklistDone).toEqual([])
    expect((await claim(id, OTHER_TECH)).errors).toBeUndefined()
  })

  it('the check needs an arrival first and only knows its own items', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    await claim(id)
    expect(domainCodeOf(await checklist(id, ['robot_stable']))).toBe('not_on_site')
    await arrive(id)
    const unknown = await checklist(id, ['koffie_gezet'])
    expect(codeOf(unknown)).toBe('BAD_REQUEST')
    expect(domainCodeOf(unknown)).toBe('invalid_checklist')
  })

  it('a resolved defect cannot be worked on any more', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    await claim(id)
    await close(id)
    for (const result of [await claim(id, OTHER_TECH), await close(id), await arrive(id)]) {
      expect(codeOf(result)).toBe('CONFLICT')
      expect(domainCodeOf(result)).toBe('defect_not_open')
    }
  })

  it('a false alarm is a way to close too, and a replacement may not be closed as "repaired"', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    expect(codeOf(await close(id, 'REPLACED'))).toBeDefined()
    expect((await close(id, 'FALSE_ALARM')).errors).toBeUndefined()
    expect((await one(id)).resolution).toBe('FALSE_ALARM')
  })

  it('keeps an audit trail of the steps', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    await claim(id)
    await arrive(id)
    await close(id)
    const log = (await gql<{ auditLog: { action: string; actor: string }[] }>(ctx.app, AUDIT)).data!
      .auditLog
    expect(log.map((entry) => entry.action).slice(0, 4)).toEqual([
      'defect.closed',
      'defect.on-site',
      'defect.claimed',
      'defect.reported',
    ])
    expect(log[1]?.actor).toBe(TECH)
  })
})

describe('food still in the robot', () => {
  const robotWithFood = async () => {
    const robot = await createRobot(ctx)
    await setCondition(ctx, robot.id, {
      hasCargo: true,
      cargoSummary: '2 pizza’s',
      tilted: true,
      tiltDegrees: 20,
    })
    const { id } = await reportDefect(ctx, robot.id)
    await claim(id)
    await arrive(id)
    return { robot, id }
  }

  it('cannot be repaired or replaced before the food is taken out', async () => {
    const { id } = await robotWithFood()
    await addStockRobot(ctx)
    for (const result of [
      await close(id, 'REPAIRED'),
      await gql(ctx.app, REPLACE_ROBOT, { defectId: id, input: { code: 'RBT-000417' } }, TECH),
      await gql(ctx.app, REPLACE_ROBOT, { defectId: id }, TECH),
    ]) {
      expect(codeOf(result)).toBe('CONFLICT')
      expect(domainCodeOf(result)).toBe('cargo_still_aboard')
    }
    await checklist(id, ['robot_stable', 'lid_checked'])
    expect(domainCodeOf(await close(id, 'REPAIRED'))).toBe('cargo_still_aboard')
    expect((await one(id)).status).toBe('ON_SITE')
  })

  it('can once it is ticked off in the check', async () => {
    const { id } = await robotWithFood()
    await checklist(id, ['cargo_removed'])
    expect((await close(id, 'REPAIRED')).errors).toBeUndefined()
    expect((await one(id)).status).toBe('CLOSED')
  })

  it('a false alarm needs no check: the robot was fine', async () => {
    const { id } = await robotWithFood()
    expect((await close(id, 'FALSE_ALARM')).errors).toBeUndefined()
  })

  it('a robot without food is not held up by the rule', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    await claim(id)
    expect((await close(id, 'REPAIRED')).errors).toBeUndefined()
  })
})

describe('replacing a defective robot', () => {
  it('makes a new robot: the old key is stopped first, a new robot takes its place', async () => {
    const old = await createRobot(ctx)
    const { id } = await reportDefect(ctx, old.id)
    const replaced = await gql<{
      replaceRobot: {
        apiKey: string
        defect: Defect
        robot: { id: string; name: string; model: { kind: string } }
      }
    }>(ctx.app, REPLACE_ROBOT, { defectId: id })
    expect(replaced.errors).toBeUndefined()
    const result = replaced.data!.replaceRobot
    expect(result.apiKey).toMatch(/^rb_/)
    expect(result.defect.status).toBe('REPLACED')
    expect(result.defect.replacementRobotId).toBe(result.robot.id)
    expect(result.robot.name).toBe('Food Robot 2 (vervanger)')
    expect(ctx.platform.robots.get(old.id)!.retired, 'the platform stopped the old key').toBe(true)
    expect(
      ctx.platform.robots.get(result.robot.id)!.registration.modelKind,
      'same kind as the old robot',
    ).toBe('FOOD')

    const robots = (
      await gql<{ robots: { items: { id: string }[] } }>(ctx.app, ROBOTS, { companyId: 'c-demo' })
    ).data!.robots.items
    expect(
      robots.map((robot) => robot.id),
      'the old robot is gone from the list',
    ).toEqual([result.robot.id])
    expect(await defects()).toHaveLength(0)
    const all = await defects({ onlyOpen: false })
    expect(all).toHaveLength(1)
    expect(all[0]?.robot.name, 'the replaced robot is still shown with its defect').toBe(
      'Food Robot 2',
    )

    const again = await gql(ctx.app, REPLACE_ROBOT, { defectId: id })
    expect(codeOf(again)).toBe('CONFLICT')
    expect(domainCodeOf(again)).toBe('defect_not_open')
  })

  it('does not replace anything when the platform cannot stop the old key', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    ctx.platform.down = true
    expect(codeOf(await gql(ctx.app, REPLACE_ROBOT, { defectId: id }))).toBe('BAD_GATEWAY')
    ctx.platform.down = false
    expect((await defects()).map((item) => item.status)).toEqual(['OPEN'])
    expect(
      (await gql<{ robots: { items: unknown[] } }>(ctx.app, ROBOTS, { companyId: 'c-demo' })).data!
        .robots.items,
    ).toHaveLength(1)
  })

  it('scans a robot from the warehouse: it takes over the place, the name and the company of the old one', async () => {
    const old = await createRobot(ctx, 'Food Robot 2')
    await addStockRobot(ctx, 'RBT-000417')
    const { id } = await reportDefect(ctx, old.id)
    await claim(id)

    const replaced = await gql<{
      replaceRobot: {
        apiKey: string
        defect: Defect
        robot: { id: string; name: string; serial: string; status: string }
      }
    }>(ctx.app, REPLACE_ROBOT, { defectId: id, input: { code: 'rbt:RBT-000417' } }, TECH)
    expect(replaced.errors).toBeUndefined()
    const { robot, defect, apiKey } = replaced.data!.replaceRobot
    expect(robot).toMatchObject({ name: 'Food Robot 2', serial: 'RBT-000417' })
    expect(apiKey).toMatch(/^rb_/)
    expect(defect).toMatchObject({ status: 'REPLACED', replacementRobotId: robot.id })
    expect(ctx.platform.robots.get(old.id)!.retired).toBe(true)
    expect(ctx.platform.robots.get(robot.id)!.registration).toEqual({
      companyId: 'c-demo',
      modelKind: 'FOOD',
      name: 'Food Robot 2',
    })

    // The warehouse is empty again, and the company has the scanned robot
    expect(
      (await gql<{ stockRobots: unknown[] }>(ctx.app, STOCK_ROBOTS)).data!.stockRobots,
    ).toHaveLength(0)
    const robots = (
      await gql<{ robots: { items: { serial: string }[] } }>(ctx.app, ROBOTS, {
        companyId: 'c-demo',
      })
    ).data!.robots.items
    expect(robots.map((item) => item.serial)).toEqual(['RBT-000417'])
    // The number on the old robot stays with the old robot, and the log tells which robot came
    const log = (await gql<{ auditLog: { action: string; detail: string }[] }>(ctx.app, AUDIT))
      .data!.auditLog
    expect(log.find((entry) => entry.action === 'robot.replaced')?.detail).toMatch(/RBT-000417/)
  })

  it('refuses a robot that is not in the warehouse, another kind of robot, and a code that is not ours', async () => {
    const old = await createRobot(ctx, 'Food Robot 2')
    const atCompany = await createRobot(ctx, 'Andere Bot', { companyId: 'c-gelato' })
    await addStockRobot(ctx, 'RBT-000500', 'model-parcel')
    const { id } = await reportDefect(ctx, old.id)
    const replaceWith = (code: string) =>
      gql(ctx.app, REPLACE_ROBOT, { defectId: id, input: { code } })

    expect(domainCodeOf(await replaceWith(atCompany.serial))).toBe('robot_not_in_stock')
    expect(domainCodeOf(await replaceWith('RBT-000500'))).toBe('model_mismatch')
    expect(domainCodeOf(await replaceWith('RBT-999999'))).toBe('robot_not_found')
    expect(domainCodeOf(await replaceWith('https://example.com'))).toBe('invalid_robot_code')
    // Nothing happened: the defect is open, the old key still works
    expect((await one(id)).status).toBe('OPEN')
    expect(ctx.platform.robots.get(old.id)!.retired).toBe(false)
  })

  it('is a right of its own: someone who may not replace robots cannot', async () => {
    await gql(
      ctx.app,
      'mutation { createSellerRole(input: { key: "stagiair", names: { nl: "Stagiair" }, permissions: ["defects:read", "defects:claim"] }) { id } }',
    )
    await addAccount(ctx, 'stagiair@fabrikant.example', 'stagiair')
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    expect(
      codeOf(await gql(ctx.app, REPLACE_ROBOT, { defectId: id }, 'stagiair@fabrikant.example')),
    ).toBe('FORBIDDEN')
    expect(codeOf(await close(id, 'REPAIRED', 'stagiair@fabrikant.example'))).toBe('FORBIDDEN')
  })
})

describe('calling a technician and asking for help', () => {
  it('an administrator calls: the defect keeps who called and when', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    const called = await gql<{
      callTechnician: { callRequestedAt: string | null; calledBy: string | null }
    }>(ctx.app, CALL_TECHNICIAN, { id })
    expect(called.data?.callTechnician.callRequestedAt).toBeTruthy()
    expect(called.data?.callTechnician.calledBy).toBe(ADMIN)
  })

  it('a technician cannot call for a technician (the right belongs to the administrator), but can ask for help', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    expect(codeOf(await gql(ctx.app, CALL_TECHNICIAN, { id }, TECH))).toBe('FORBIDDEN')
    await claim(id)
    const help = await gql<{ requestHelp: { helpRequestedAt: string | null } }>(
      ctx.app,
      REQUEST_HELP,
      { id },
      TECH,
    )
    expect(help.data?.requestHelp.helpRequestedAt).toBeTruthy()
  })

  it('does not call for a defect that is resolved', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    await close(id, 'FALSE_ALARM')
    expect(domainCodeOf(await gql(ctx.app, CALL_TECHNICIAN, { id }))).toBe('defect_not_open')
  })
})

describe('other defects nearby (the technician is there anyway)', () => {
  const defectAt = async (name: string, place: Record<string, unknown> | null) => {
    const robot = await createRobot(ctx, name)
    if (place) await setCondition(ctx, robot.id, { location: place })
    return reportDefect(ctx, robot.id, `Defect van ${name}`)
  }

  it('finds the defects within the radius, nearest first, and leaves out the far ones and the resolved ones', async () => {
    const here = await defectAt('Bot hier', MARKSE)
    await defectAt('Bot ver', FAR)
    const near = await defectAt('Bot naast', NEARBY)
    const resolved = await defectAt('Bot klaar', NEARBY)
    await close(resolved.id, 'FALSE_ALARM')
    await defectAt('Bot zonder plaats', null)

    const { data } = await gql<{
      nearbyDefects: { distanceMeters: number; defect: { id: string } }[]
    }>(ctx.app, NEARBY_DEFECTS, {
      defectId: here.id,
      radiusMeters: 500,
    })
    expect(data?.nearbyDefects.map((item) => item.defect.id)).toEqual([near.id])
    expect(data!.nearbyDefects[0]!.distanceMeters).toBeGreaterThan(5)
    expect(data!.nearbyDefects[0]!.distanceMeters).toBeLessThan(200)

    const wide = await gql<{ nearbyDefects: unknown[] }>(ctx.app, NEARBY_DEFECTS, {
      defectId: here.id,
      radiusMeters: 100_000,
    })
    expect(wide.data?.nearbyDefects).toHaveLength(2)
  })

  it('has nothing nearby for a defect whose robot has no place', async () => {
    const lost = await defectAt('Bot zonder plaats', null)
    await defectAt('Bot hier', MARKSE)
    const { data } = await gql<{ nearbyDefects: unknown[] }>(ctx.app, NEARBY_DEFECTS, {
      defectId: lost.id,
    })
    expect(data?.nearbyDefects).toEqual([])
  })

  it('tells how far a defect is from where the technician stands', async () => {
    const here = await defectAt('Bot hier', MARKSE)
    const withoutPlace = await defectAt('Bot zonder plaats', null)
    const from = { type: 'Point', coordinates: [3.2647, 50.8293] }
    const near = await gql<{ defect: { distanceMeters: number | null } }>(
      ctx.app,
      DEFECT_DISTANCE,
      { id: here.id, from },
    )
    expect(near.data?.defect.distanceMeters).toBeGreaterThan(100)
    expect(near.data?.defect.distanceMeters).toBeLessThan(120)
    const unknown = await gql<{ defect: { distanceMeters: number | null } }>(
      ctx.app,
      DEFECT_DISTANCE,
      { id: withoutPlace.id, from },
    )
    expect(unknown.data?.defect.distanceMeters).toBeNull()
  })
})

describe('the status is worked out, so it can be filtered on', () => {
  it('lists the defects with one of the given statuses', async () => {
    const open = await reportDefect(ctx, (await createRobot(ctx, 'Bot A')).id)
    const enRoute = await reportDefect(ctx, (await createRobot(ctx, 'Bot B')).id)
    const onSite = await reportDefect(ctx, (await createRobot(ctx, 'Bot C')).id)
    const closed = await reportDefect(ctx, (await createRobot(ctx, 'Bot D')).id)
    await claim(enRoute.id)
    await claim(onSite.id)
    await arrive(onSite.id)
    await claim(closed.id)
    await close(closed.id)

    const byStatus = async (statuses: string[]) =>
      (
        await gql<{ defectsByStatus: { id: string; status: string }[] }>(
          ctx.app,
          DEFECTS_BY_STATUS,
          { statuses },
        )
      )
        .data!.defectsByStatus.map((defect) => defect.id)
        .sort()
    expect(await byStatus(['OPEN'])).toEqual([open.id])
    expect(await byStatus(['EN_ROUTE', 'ON_SITE'])).toEqual([enRoute.id, onSite.id].sort())
    expect(await byStatus(['CLOSED'])).toEqual([closed.id])
    expect(await byStatus([])).toEqual([])
    expect(codeOf(await gql(ctx.app, DEFECTS_BY_STATUS, { statuses: ['KAPOT'] }))).toBeDefined()
  })

  it('"mine" shows only the defects of the technician who asks', async () => {
    const taken = await reportDefect(ctx, (await createRobot(ctx, 'Bot A')).id)
    await reportDefect(ctx, (await createRobot(ctx, 'Bot B')).id)
    await claim(taken.id)
    expect((await defects({ mine: true }, TECH)).map((defect) => defect.id)).toEqual([taken.id])
    expect(await defects({}, TECH)).toHaveLength(2)
  })
})

describe('archiving a resolved defect (soft delete)', () => {
  it('only a resolved defect can be archived; it leaves the lists and comes back on restore', async () => {
    const { id } = await reportDefect(ctx, (await createRobot(ctx)).id)
    const early = await gql(ctx.app, REMOVE_DEFECT, { id })
    expect(codeOf(early)).toBe('CONFLICT')
    expect(domainCodeOf(early)).toBe('defect_not_resolved')

    await close(id, 'FALSE_ALARM')
    const archived = await gql<{ removeDefect: { status: string; deletedAt: string | null } }>(
      ctx.app,
      REMOVE_DEFECT,
      { id },
    )
    expect(archived.data?.removeDefect.status).toBe('ARCHIVED')
    expect(archived.data?.removeDefect.deletedAt).toBeTruthy()
    expect(await defects({ onlyOpen: false })).toHaveLength(0)
    expect(await defects({ onlyOpen: false, withDeleted: true })).toHaveLength(1)
    expect(codeOf(await gql(ctx.app, DEFECT, { id }))).toBe('NOT_FOUND')
    expect(
      (
        await gql<{ defect: Defect }>(
          ctx.app,
          '{ defect(id: "' + id + '", withDeleted: true) { status } }',
        )
      ).data?.defect.status,
    ).toBe('ARCHIVED')

    const restored = await gql<{ restoreDefect: { status: string } }>(ctx.app, RESTORE_DEFECT, {
      id,
    })
    expect(restored.data?.restoreDefect.status).toBe('CLOSED')
    expect(await defects({ onlyOpen: false })).toHaveLength(1)
    expect(codeOf(await gql(ctx.app, RESTORE_DEFECT, { id }))).toBe('CONFLICT')
  })

  it('a robot with an archived resolved defect can have a new defect', async () => {
    const robot = await createRobot(ctx)
    const { id } = await reportDefect(ctx, robot.id)
    await close(id, 'REPAIRED')
    await gql(ctx.app, REMOVE_DEFECT, { id })
    expect((await reportDefect(ctx, robot.id, 'Weer iets')).status).toBe('OPEN')
  })
})

describe('the robot with a defect, as the screens ask for it', () => {
  it('gives the robot of the defect its condition and model without a query per robot', async () => {
    const robot = await createRobot(ctx)
    await setCondition(ctx, robot.id, { hasCargo: true, lid: 'OPEN' })
    await reportDefect(ctx, robot.id)
    const { data } = await gql<{
      robot: { status: string; condition: { hasCargo: boolean; lid: string } }
    }>(ctx.app, ROBOT, { id: robot.id })
    expect(data?.robot.status).toBe('DEFECT')
    expect(data?.robot.condition).toMatchObject({ hasCargo: true, lid: 'OPEN' })
  })
})
