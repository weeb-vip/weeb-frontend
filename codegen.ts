// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  // The staging gateway plus the parts of the schema not deployed to it yet
  // (follow graph in user-service, notifications-service). Delete
  // codegen-pending.graphql and the second entry once staging serves them.
  schema: ['https://gateway.staging.weeb.vip/graphql', './codegen-pending.graphql'],
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**/*'], // avoid scanning generated files
  ignoreNoDocuments: true,
  generates: {
    './src/gql/': {
      preset: 'client',
      config: {
        useTypeImports: true,      // <- ensures `import type { ... }` (no runtime import)
        // documentMode: 'string', // <- optional: see note below
      }
    }
  }
}
export default config
