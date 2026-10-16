import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql'
import { printSchema } from 'graphql'
import { AccountsResolver } from './accounts/accounts.resolver.js'
import { ArchiveResolver } from './archive/archive.resolver.js'
import { AuditResolver } from './audit/audit.resolver.js'
import { MeResolver } from './authentication/me.resolver.js'
import { CompaniesResolver } from './companies/companies.resolver.js'
import { DefectsResolver } from './defects/defects.resolver.js'
import { DefectFieldsResolver } from './defects/defect-fields.resolver.js'
import { HealthResolver } from './health/health.resolver.js'
import { PairingsResolver } from './pairings/pairings.resolver.js'
import { RobotFieldsResolver } from './robots/robot-fields.resolver.js'
import { RobotsResolver } from './robots/robots.resolver.js'
import { RolePresetsResolver } from './role-presets/role-presets.resolver.js'
import { RolesResolver } from './roles/roles.resolver.js'
import { SellerRolesResolver } from './seller-roles/seller-roles.resolver.js'

/**
 * Writes the GraphQL schema to dist/schema.gql WITHOUT starting the API or the database: the types package
 * (Lukas/seller-types) generates the TypeScript types of the frontend from this file.
 * Run it with `npm run generate:graphql`.
 */
const OUT = process.env.SCHEMA_OUT ?? './dist/schema.gql'

const app = await NestFactory.create(GraphQLSchemaBuilderModule, { logger: false })
await app.init()
const factory = app.get(GraphQLSchemaFactory)
const schema = await factory.create([
  HealthResolver,
  MeResolver,
  AccountsResolver,
  SellerRolesResolver,
  AuditResolver,
  ArchiveResolver,
  CompaniesResolver,
  RobotsResolver,
  RobotFieldsResolver,
  DefectsResolver,
  DefectFieldsResolver,
  RolesResolver,
  RolePresetsResolver,
  PairingsResolver,
])
await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, printSchema(schema))
console.info(`GraphQL schema written to ${OUT}`)
await app.close()
