// codegen.ts
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'https://gateway.weeb.vip/graphql',
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
