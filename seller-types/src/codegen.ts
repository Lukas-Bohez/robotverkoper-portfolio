import { type CodegenConfig } from '@graphql-codegen/cli'

/**
 * Generates the TypeScript types of the frontend from the GraphQL schema of the API (code first: the schema is
 * written by `npm run generate:graphql` in Lukas/seller-api, without starting the API or the database).
 */
const config: CodegenConfig = {
  overwrite: true,
  schema: '../seller-api/dist/schema.gql',
  generates: {
    './dist/graphql.d.ts': {
      plugins: ['typescript'],
      config: {
        // Enums are TypeScript unions of their GraphQL names: 'ADMIN' | 'TECHNICIAN'
        enumsAsTypes: true,
        // DateTime travels as an ISO string in JSON
        scalars: { DateTime: 'string' },
        avoidOptionals: false,
        skipTypename: true,
      },
    },
  },
}

export default config
