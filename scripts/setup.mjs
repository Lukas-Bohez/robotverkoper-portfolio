// Installs the packages of the three Node parts of Lukas/ when needed:
// `npm ci` on a fresh clone, again when a package-lock.json changed since the last time.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const lukas = join(dirname(fileURLToPath(import.meta.url)), '..')
const PARTS = ['platform-simulator', 'seller-api', 'seller-pwa']

for (const part of PARTS) {
  const dir = join(lukas, part)
  const lock = readFileSync(join(dir, 'package-lock.json'))
  const hash = createHash('sha256').update(lock).digest('hex')
  const marker = join(dir, 'node_modules', '.lukas-lock')
  const installed = existsSync(join(dir, 'node_modules', '.package-lock.json'))
  const seen = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : null

  if (installed && seen === hash) continue
  // Installed before this script kept track: trust it
  if (installed && seen === null) {
    writeFileSync(marker, hash)
    continue
  }

  console.log(`[setup] ${part}: packages installeren…`)
  const result = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit', shell: true })
  if (result.status !== 0) {
    console.error(`[setup] ${part}: installeren mislukt (npm ci, code ${result.status})`)
    process.exit(result.status ?? 1)
  }
  writeFileSync(marker, hash)
}
console.log('[setup] klaar')
