import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo'
import { Module, ValidationPipe, type ValidationError } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_PIPE } from '@nestjs/core'
import { GraphQLModule } from '@nestjs/graphql'
import { TypeOrmModule } from '@nestjs/typeorm'
import type { Request } from 'express'
import type { ExecutionResult, GraphQLFormattedError } from 'graphql'
import { AccountsModule } from './accounts/accounts.module.js'
import { ArchiveModule } from './archive/archive.module.js'
import { AuditModule } from './audit/audit.module.js'
import { AuthenticationModule } from './authentication/authentication.module.js'
import { requestFromConnectionParams } from './authentication/request.js'
import { DomainException } from './common/domain-exception.js'
import {
  formatGraphqlError,
  logUnexpectedError,
  withErrorCodes,
} from './common/graphql/format-error.js'
import { RealtimeModule } from './common/realtime/realtime.module.js'
import { CompaniesModule } from './companies/companies.module.js'
import { APP_CONFIG, type AppConfig } from './config/app-config.js'
import { AppConfigModule } from './config/config.module.js'
import { DatabaseModule } from './database/database.module.js'
import { createMongodbTypeOrmOptions } from './database/mongodb-typeorm-options.js'
import { DefectsModule } from './defects/defects.module.js'
import { HealthModule } from './health/health.module.js'
import { PairingsModule } from './pairings/pairings.module.js'
import { PlatformModule } from './platform/platform.module.js'
import { RobotsModule } from './robots/robots.module.js'
import { RolePresetsModule } from './role-presets/role-presets.module.js'
import { RolesModule } from './roles/roles.module.js'
import { SellerRolesModule } from './seller-roles/seller-roles.module.js'
import { SeedModule } from './seed/seed.module.js'

/** The generated schema, next to the build. `memory` keeps it in memory only (the tests). */
export const SCHEMA_FILE = process.env.GRAPHQL_SCHEMA_FILE === 'memory' ? true : './dist/schema.gql'

/** The field of a failed validation decides the stable code the PWA translates */
function validationException(errors: ValidationError[]): DomainException {
  const first = errors[0]
  const messages = Object.values(first?.constraints ?? {})
  const code =
    messages.find((message) => /^invalid_[a-z_]+$/.test(message)) ??
    (first?.constraints && 'isEmail' in first.constraints ? 'invalid_email' : 'invalid_input')
  return new DomainException(
    400,
    code,
    `${first?.property ?? 'input'}: ${messages[0] ?? 'is not valid'}`,
  )
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AppConfigModule,
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: SCHEMA_FILE, // code first
      graphiql: true,
      // HTTP: the request. Websocket (subscriptions): the token comes from the connectionParams
      context: (ctx: { req?: Request; connectionParams?: Record<string, unknown> }) => ({
        req: ctx.req ?? requestFromConnectionParams(ctx.connectionParams),
      }),
      subscriptions: {
        'graphql-ws': {
          // The result is the last argument (graphql-ws: ctx, id, payload, args, result)
          onNext: (...args: unknown[]) => withErrorCodes(args.at(-1) as ExecutionResult),
        },
      },
      formatError: (error: GraphQLFormattedError, original: unknown) => {
        const formatted = formatGraphqlError(error, original)
        logUnexpectedError(formatted, original)
        return formatted
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        createMongodbTypeOrmOptions(config.mongodbUri, { synchronize: !config.production }),
    }),
    RealtimeModule,
    PlatformModule,
    DatabaseModule,
    HealthModule,
    AuthenticationModule,
    AccountsModule,
    AuditModule,
    CompaniesModule,
    RobotsModule,
    DefectsModule,
    RolesModule,
    SellerRolesModule,
    RolePresetsModule,
    ArchiveModule,
    PairingsModule,
    SeedModule,
  ],
  providers: [
    // Every input (DTO) is validated with class-validator
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        exceptionFactory: validationException,
      }),
    },
  ],
})
export class AppModule {}
