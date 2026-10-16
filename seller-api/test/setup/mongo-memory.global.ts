import { homedir } from 'node:os'
import { join } from 'node:path'
import { MongoMemoryServer } from 'mongodb-memory-server'
import type { TestProject } from 'vitest/node'

// The MongoDB binary is downloaded once and shared by every project that uses it
process.env.MONGOMS_DOWNLOAD_DIR ??= join(homedir(), '.cache', 'mongodb-binaries')

let mongo: MongoMemoryServer | undefined

/** One in-memory MongoDB for the whole e2e run. Every test file gets its own database in it (see env.ts). */
export async function setup(project: TestProject) {
  mongo = await MongoMemoryServer.create()
  project.provide('mongoUri', mongo.getUri())
}

export async function teardown() {
  await mongo?.stop()
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string
  }
}
