// Starts the whole of Lukas's part and nothing of anyone else's:
//   platform-simulator (4100)  plays the platform of the companies, with made-up data
//   seller-api         (4200)  our own API and database (SQLite)
//   seller-pwa         (5174)  the website for the sellers of the robots
// Stops everything when one of them stops or when you press Ctrl+C.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const lukas = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORTS = { simulator: 4100, api: 4200, pwa: 5174 }
/** Who is superadmin of the seller panel in the demo: the teacher's account and Lukas. A real deployment sets SELLER_ADMIN_EMAILS. */
const DEMO_ADMINS = 'docent@howest.be,lukasbohez@gmail.com'

/** The VITE_* values of seller-pwa/.env (only to find out whether Firebase is set up) */
function readDotEnv(path) {
  if (!existsSync(path)) return {}
  const values = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line)
    if (match && !line.trim().startsWith('#')) values[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
  return values
}

const pwaEnv = readDotEnv(join(lukas, 'seller-pwa', '.env'))
const apiEnv = readDotEnv(join(lukas, 'seller-api', '.env'))
const projectId = process.env.FIREBASE_PROJECT_ID || apiEnv.FIREBASE_PROJECT_ID || pwaEnv.VITE_FIREBASE_projectId || ''
const hasFirebase = Boolean(projectId && pwaEnv.VITE_FIREBASE_apiKey)
// Without Firebase values the demo still works: local "dev" logins, no internet needed
const authMode = process.env.AUTH_MODE || (hasFirebase ? 'firebase' : 'dev')

if (authMode === 'firebase' && !hasFirebase) {
  console.error('AUTH_MODE=firebase vraagt de Firebase-waarden in Lukas/seller-pwa/.env (zie .env.example).')
  process.exit(1)
}

/** True when something already answers on the port (on IPv4 or IPv6, as `localhost` can be either) */
function portInUse(port) {
  const tryHost = (host) =>
    new Promise((resolve) => {
      const socket = connect({ port, host })
      socket.setTimeout(800)
      socket.once('connect', () => (socket.destroy(), resolve(true)))
      socket.once('timeout', () => (socket.destroy(), resolve(false)))
      socket.once('error', () => resolve(false))
    })
  return Promise.all([tryHost('127.0.0.1'), tryHost('::1')]).then((results) => results.some(Boolean))
}

for (const [name, port] of Object.entries(PORTS)) {
  if (await portInUse(port)) {
    console.error(`Poort ${port} (${name}) is al in gebruik. Stop dat programma en start opnieuw.`)
    process.exit(1)
  }
}

const platformToken = process.env.PLATFORM_TOKEN || 'dev-platform-token'
const parts = [
  {
    name: 'platform-simulator',
    cwd: 'platform-simulator',
    args: ['start'],
    env: { PORT: String(PORTS.simulator), PLATFORM_TOKEN: platformToken },
  },
  {
    name: 'seller-api',
    cwd: 'seller-api',
    args: ['start'],
    env: {
      PORT: String(PORTS.api),
      AUTH_MODE: authMode,
      FIREBASE_PROJECT_ID: projectId,
      PLATFORM_URL: `http://127.0.0.1:${PORTS.simulator}`,
      PLATFORM_TOKEN: platformToken,
      SEED_DEMO: process.env.SEED_DEMO ?? 'true',
      SELLER_ADMIN_EMAILS: process.env.SELLER_ADMIN_EMAILS || apiEnv.SELLER_ADMIN_EMAILS || DEMO_ADMINS,
    },
  },
  {
    name: 'seller-pwa',
    cwd: 'seller-pwa',
    args: ['run', 'dev'],
    env: { VITE_API_URL: `http://localhost:${PORTS.api}`, VITE_AUTH_MODE: authMode },
  },
]

const children = []
let stopping = false

function killTree(child) {
  if (!child.pid || child.exitCode !== null) return
  if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGTERM')
}

function stopAll(code) {
  if (stopping) return
  stopping = true
  children.forEach(killTree)
  setTimeout(() => process.exit(code), 300)
}

function pipeLines(stream, prefix, target) {
  let rest = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    const lines = (rest + chunk).split(/\r?\n/)
    rest = lines.pop() ?? ''
    for (const line of lines) if (line.trim()) target.write(`${prefix} ${line}\n`)
  })
}

console.log(`Lukas: ${authMode === 'dev' ? 'lokale demo-logins (geen Firebase nodig)' : `Firebase-project ${projectId}`}`)

for (const part of parts) {
  const child = spawn('npm', part.args, {
    cwd: join(lukas, part.cwd),
    env: { ...process.env, ...part.env },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const prefix = `[${part.name}]`
  pipeLines(child.stdout, prefix, process.stdout)
  pipeLines(child.stderr, prefix, process.stderr)
  child.on('exit', (code) => {
    if (stopping) return
    console.error(`${prefix} is gestopt (code ${code}). De rest wordt ook gestopt.`)
    stopAll(code || 1)
  })
  children.push(child)
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) })
    return res.status < 500
  } catch {
    return false
  }
}

const checks = [
  ['platform-simulator', `http://127.0.0.1:${PORTS.simulator}/health`],
  ['seller-api', `http://127.0.0.1:${PORTS.api}/health`],
  ['seller-pwa', `http://localhost:${PORTS.pwa}/`],
]
const deadline = Date.now() + 120_000
const ready = new Set()
while (!stopping && ready.size < checks.length && Date.now() < deadline) {
  for (const [name, url] of checks) {
    if (!ready.has(name) && (await reachable(url))) {
      ready.add(name)
      console.log(`[lukas] ${name} draait`)
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1000))
}
if (ready.size === checks.length) {
  console.log(`\n[lukas] Alles draait. Open http://localhost:${PORTS.pwa}`)
  if (authMode === 'dev') console.log('[lukas] Log in met docent@howest.be (elk wachtwoord, dit is de lokale demo)')
} else if (!stopping) {
  console.error('[lukas] Niet alles reageert binnen 2 minuten, zie hierboven wat er misging.')
}
