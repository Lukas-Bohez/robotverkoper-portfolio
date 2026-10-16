import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { DataSource } from 'typeorm'
import request from 'supertest'
import { AppModule } from '../../src/app.module.js'
import { applySecurity } from '../../src/common/security/app-security.js'
import { DatabaseVersionService } from '../../src/database/database-version.service.js'
import { PlatformGateway } from '../../src/platform/platform.gateway.js'
import { SeedService } from '../../src/seed/seed.service.js'
import { FakePlatform } from './fake-platform.js'

export const ADMIN = 'docent@howest.be'
export const OWNER = 'lukasbohez@gmail.com'
export const TECH = 'technieker@fabrikant.example'

export interface TestContext {
  app: INestApplication
  platform: FakePlatform
  /** Empty database, indexes, robot models and the standard roles again, and a fresh platform: every test starts clean */
  reset(): Promise<void>
  close(): Promise<void>
}

/** The whole AppModule on the in-memory MongoDB, with a platform played in memory. `admins` = SELLER_ADMIN_EMAILS. */
export async function createTestApp(admins: string[] = [ADMIN]): Promise<TestContext> {
  process.env.SELLER_ADMIN_EMAILS = admins.join(',')
  const platform = new FakePlatform()
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PlatformGateway)
    .useValue(platform)
    .compile()
  const app = moduleRef.createNestApplication()
  applySecurity(app, ['http://localhost:5174'])
  await app.init()

  const reset = async () => {
    platform.reset()
    await app.get(DataSource).dropDatabase()
    await app.get(DatabaseVersionService).migrate()
    await app.get(SeedService).seedModels()
    await app.get(SeedService).seedRoles()
  }
  await reset()
  return { app, platform, reset, close: () => app.close() }
}

export interface GraphqlResponse<T> {
  data?: T | null
  errors?: { message: string; extensions?: { code?: string; domainCode?: string } }[]
}

/** One GraphQL call as `as` (a dev token, `dev:<email>`); `as: null` is nobody */
export async function gql<T = Record<string, never>>(
  app: INestApplication,
  query: string,
  variables: Record<string, unknown> = {},
  as: string | null = ADMIN,
): Promise<GraphqlResponse<T>> {
  let req = request(app.getHttpServer()).post('/graphql')
  if (as) req = req.set('Authorization', `Bearer dev:${as}`)
  const response = await req.send({ query, variables })
  return response.body as GraphqlResponse<T>
}

/** The standard code of the first error (UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, ...) */
export const codeOf = (response: GraphqlResponse<unknown>) => response.errors?.[0]?.extensions?.code
/** Our own stable code of the first error (subdomain_taken, role_locked, ...), which the PWA translates */
export const domainCodeOf = (response: GraphqlResponse<unknown>) =>
  response.errors?.[0]?.extensions?.domainCode
