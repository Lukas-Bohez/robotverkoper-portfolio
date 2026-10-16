import { DataSource } from 'typeorm'
import { RobotsService } from '../../src/robots/robots.service.js'
import { ADMIN, gql, type TestContext } from './test-app.js'
import { ADD_ACCOUNT, CREATE_ROBOT, REPORT_DEFECT } from './operations.js'

/** A second technician, for the tests where two people work on the same defects (the first one is TECH) */
export const OTHER_TECH = 'tweede@fabrikant.example'

export interface MadeRobot {
  id: string
  name: string
  serial: string
  apiKey: string
}

/** A robot at a company, made the normal way (through the API and the fake platform) */
export async function createRobot(
  ctx: TestContext,
  name = 'Food Robot 2',
  options: { companyId?: string; modelId?: string; as?: string } = {},
): Promise<MadeRobot> {
  const created = await gql<{
    createRobot: { apiKey: string; robot: { id: string; name: string; serial: string } }
  }>(
    ctx.app,
    CREATE_ROBOT,
    {
      companyId: options.companyId ?? 'c-demo',
      input: { name, modelId: options.modelId ?? 'model-food' },
    },
    options.as ?? ADMIN,
  )
  if (created.errors) throw new Error(JSON.stringify(created.errors))
  const { robot, apiKey } = created.data!.createRobot
  return { ...robot, apiKey }
}

export interface ReportedDefect {
  id: string
  status: string
  robot: { id: string; name: string }
}

export async function reportDefect(
  ctx: TestContext,
  robotId: string,
  summary = 'Sensor vast',
  as = ADMIN,
): Promise<ReportedDefect> {
  const reported = await gql<{ reportDefect: ReportedDefect }>(
    ctx.app,
    REPORT_DEFECT,
    { robotId, input: { summary, severity: 'HIGH' } },
    as,
  )
  if (reported.errors) throw new Error(JSON.stringify(reported.errors))
  return reported.data!.reportDefect
}

/** Gives someone a role of our own staff */
export async function addAccount(ctx: TestContext, email: string, roleKey: string): Promise<void> {
  const added = await gql(ctx.app, ADD_ACCOUNT, { input: { email, roleKey } })
  if (added.errors) throw new Error(JSON.stringify(added.errors))
}

/** A robot in the warehouse, ready to be scanned (the number is what its QR code says) */
export async function addStockRobot(
  ctx: TestContext,
  serial = 'RBT-000417',
  modelId = 'model-food',
): Promise<void> {
  await ctx.app.get(RobotsService).addToStock('test', { name: `Reserve ${serial}`, modelId, serial })
}

/** What the platform knows about the condition of a robot: cargo, tilt, a place (the demo and the tests) */
export async function setCondition(
  ctx: TestContext,
  robotId: string,
  condition: Record<string, unknown>,
): Promise<void> {
  await ctx.platform.simulateCondition(robotId, condition)
}

export const MARKSE = {
  country: 'BE',
  address: 'Marksesteenweg 58, Kortrijk',
  longitude: 3.2647,
  latitude: 50.8283,
}
export const NEARBY = {
  country: 'BE',
  address: 'Marksesteenweg 60, Kortrijk',
  longitude: 3.265,
  latitude: 50.8293,
}
export const FAR = { country: 'BE', address: 'Grote Markt 1, Gent', longitude: 3.7248, latitude: 51.0543 }

/**
 * A defect from the past, written straight into the database with old dates (the API only makes defects of now).
 * It is what cold storage and the filter per year are tested with.
 */
export async function insertOldDefect(
  ctx: TestContext,
  robot: MadeRobot,
  dates: { createdAt: string; resolvedAt: string | null },
  summary = 'Oude storing',
): Promise<void> {
  const mongo = ctx.app.get(DataSource).mongoManager
  await mongo.getMongoRepository('defects').insertOne({
    robotId: robot.id,
    companyId: 'c-demo',
    summary,
    severity: 'medium',
    reportedBy: ADMIN,
    assignedTo: 'technieker@fabrikant.example',
    claimedAt: new Date(dates.createdAt),
    onSiteAt: new Date(dates.createdAt),
    checklistDone: ['robot_stable'],
    resolution: dates.resolvedAt ? 'repaired' : null,
    resolvedAt: dates.resolvedAt ? new Date(dates.resolvedAt) : null,
    resolvedBy: dates.resolvedAt ? 'technieker@fabrikant.example' : null,
    resolutionNote: null,
    replacementRobotId: null,
    condition: { tilted: false, hasCargo: false, lid: 'LOCKED', capturedAt: dates.createdAt },
    location: null,
    callRequestedAt: null,
    calledBy: null,
    helpRequestedAt: null,
    coldAt: null,
    createdAt: new Date(dates.createdAt),
    updatedAt: new Date(dates.resolvedAt ?? dates.createdAt),
    deletedAt: null,
  } as never)
}

/** A line of the log from the past */
export async function insertOldAuditEntry(ctx: TestContext, createdAt: string, action = 'robot.created'): Promise<void> {
  const mongo = ctx.app.get(DataSource).mongoManager
  await mongo.getMongoRepository('audit').insertOne({
    createdAt: new Date(createdAt),
    actor: ADMIN,
    action,
    target: null,
    detail: 'oud',
    coldAt: null,
  } as never)
}
