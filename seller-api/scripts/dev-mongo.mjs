// A MongoDB on port 27028 for local development WITHOUT Docker (the same MongoDB binary the tests use).
// The data lives in the home folder of this computer (not in the project, which may sit in a synced folder), so
// it survives a restart. With Docker use `docker compose up` in Lukas/ instead: it brings its own MongoDB.
//
//   npm run db:memory        (stop with Ctrl+C)
//   MONGO_DATA_DIR=...       another place for the data
//   MONGO_PORT=...           another port
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { MongoMemoryServer } from 'mongodb-memory-server'

// The MongoDB binary is downloaded once and shared by every project that uses it
process.env.MONGOMS_DOWNLOAD_DIR ??= join(homedir(), '.cache', 'mongodb-binaries')

const port = Number(process.env.MONGO_PORT ?? 27028)
const dbPath = process.env.MONGO_DATA_DIR ?? join(homedir(), '.cache', 'robotverkoper-mongo')
mkdirSync(dbPath, { recursive: true })

const mongo = await MongoMemoryServer.create({ instance: { port, dbPath, storageEngine: 'wiredTiger' } })
console.info(`MongoDB ready: ${mongo.getUri('seller')} (data in ${dbPath}; Ctrl+C to stop)`)

const stop = async () => {
  await mongo.stop({ doCleanup: false })
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
