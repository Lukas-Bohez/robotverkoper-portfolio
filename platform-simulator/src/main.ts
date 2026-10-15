import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { createPlatformSimulator, type Snapshot } from './server.ts'
import { DEMO_COMPANIES } from './seed.ts'

const port = Number(process.env.PORT ?? 4100)
/** 127.0.0.1: only this computer. 0.0.0.0 lets a robot app on a phone reach it. */
const host = process.env.BIND_HOST ?? '127.0.0.1'
const token = process.env.PLATFORM_TOKEN ?? 'dev-platform-token'
/** The state survives a restart, so the seller API and the simulator keep telling the same story */
const stateFile = process.env.STATE_FILE ?? 'data/state.json'

if (process.env.NODE_ENV === 'production') {
  console.error('The platform simulator plays a platform with made-up data: it never runs in production.')
  process.exit(1)
}

function load(): Snapshot | null {
  if (!existsSync(stateFile)) return null
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8')) as Snapshot
  } catch {
    console.warn(`${stateFile} could not be read, starting from the seed`)
    return null
  }
}

function save(snapshot: Snapshot): void {
  mkdirSync(dirname(stateFile), { recursive: true })
  const temporary = `${stateFile}.tmp`
  writeFileSync(temporary, JSON.stringify(snapshot, null, 2))
  renameSync(temporary, stateFile)
}

const restored = load()
const { server, state } = createPlatformSimulator({
  token,
  companies: DEMO_COMPANIES,
  restoreFrom: restored,
  onChange: save,
})
if (!restored) save(state.snapshot())

server.listen(port, host, () => {
  console.log(
    `Platform simulator on http://${host}:${port} (${state.companies.size} made-up companies, state in ${stateFile})`,
  )
})
