import { randomUUID } from 'node:crypto'
import { inject } from 'vitest'

// Every test file gets its own database on the shared in-memory MongoDB
const base = inject('mongoUri').replace(/\/?(\?.*)?$/, '')
process.env.MONGODB_URI = `${base}/e2e-${randomUUID().slice(0, 8)}`

// Local demo logins: the token of a test is `dev:<email>`, no Firebase and no network
process.env.AUTH_MODE = 'dev'
process.env.FIREBASE_PROJECT_ID = ''
delete process.env.NODE_ENV
process.env.SELLER_ADMIN_EMAILS = 'docent@howest.be'
process.env.SEED_DEMO = 'false'
process.env.CORS_ORIGINS = 'http://localhost:5174'
process.env.ROBOT_API_URL = 'http://platform.test/graphql'
// The schema stays in memory: no files are written
process.env.GRAPHQL_SCHEMA_FILE = 'memory'
