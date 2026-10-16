import type { PlatformState, Robot } from './server.ts'

/**
 * The robot side of the platform (contract #9): what the robot app asks over GraphQL, with the API key
 * of the robot in the header `x-api-key`. The simulator answers just enough for a robot to connect, report
 * its battery and be seen online by the seller. There are no orders here, so no trips and no commands.
 */
export interface GraphqlAnswer {
  data?: Record<string, unknown>
  errors?: { message: string }[]
}

const SIZES = {
  FOOD: { widthMm: 350, heightMm: 250, depthMm: 300, modelName: 'Delivery Bot Eten' },
  PARCEL: { widthMm: 300, heightMm: 200, depthMm: 300, modelName: 'Delivery Bot Pakket' },
} as const

function failure(message: string): GraphqlAnswer {
  return { errors: [{ message }] }
}

function profile(state: PlatformState, robot: Robot): Record<string, unknown> {
  const size = SIZES[robot.modelKind]
  return {
    name: robot.name,
    companyName: state.companies.get(robot.companyId)?.name ?? '',
    kind: robot.modelKind,
    modelName: size.modelName,
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    depthMm: size.depthMm,
    // An insulated robot keeps the temperature of the order: there is no warm, cold or neutral type
    temperatureType: null,
    unlockMethod: 'REMOTE',
  }
}

export function handleRobotGraphql(state: PlatformState, apiKey: string, body: Record<string, unknown>): GraphqlAnswer {
  const robot = state.robotByKey(apiKey)
  if (!robot) return failure('Invalid API key')

  const query = typeof body.query === 'string' ? body.query : ''
  const variables = (typeof body.variables === 'object' && body.variables !== null ? body.variables : {}) as Record<string, unknown>

  if (/\breportTelemetry\b/.test(query)) {
    const input = (variables.input ?? {}) as Record<string, unknown>
    const battery = Number(input.battery)
    if (!Number.isFinite(battery)) return failure('battery is required')
    state.report(robot, battery)
    return { data: { reportTelemetry: true } }
  }
  // What the robot knows about itself besides its battery: tilt, food inside, lid, temperature, error and place
  if (/\breportCondition\b/.test(query)) {
    const input = (variables.input ?? {}) as Record<string, unknown>
    try {
      state.setCondition(robot.id, input)
    } catch (error) {
      return failure(error instanceof Error ? error.message : 'The condition is not valid')
    }
    return { data: { reportCondition: true } }
  }
  if (/\back(nowledge)?RobotCommand\b/.test(query)) return { data: { ackRobotCommand: true } }
  if (/\bpendingRobotCommands\b/.test(query)) return { data: { pendingRobotCommands: [] } }
  if (/\bmyActiveTrip\b/.test(query)) return { data: { myActiveTrip: null } }
  if (/\bmyRobot\b/.test(query)) return { data: { myRobot: profile(state, robot) } }
  if (/\bwalkingRoute\b/.test(query)) return { data: { walkingRoute: null } }
  if (/\bunlockWithPin\b/.test(query)) return failure('This platform simulator cannot check a PIN')
  return failure('This platform simulator does not know this operation')
}
