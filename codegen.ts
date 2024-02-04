import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  // schema: './schema.graphql',
  schema: "https://gateway.staging.weeb.vip/graphql",
  documents: ['src/**/*.tsx', "src/**/*.ts"],
  generates: {
    './src/gql/': {
      preset: 'client',
    }
  }
}
export default config
