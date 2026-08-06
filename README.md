# weeb-frontend

The web front end for [weeb.vip](https://weeb.vip) — the anime site's pages,
search and account screens.

Built with SvelteKit 2 and Svelte 5. Data comes from the GraphQL gateway rather
than from any database directly, with types generated from the schema; search is
served by Algolia.

## Running it

Requires the Node version in `.nvmrc`.

```sh
yarn install
yarn dev            # dev server
yarn build          # production build
yarn preview        # serve the build locally
```

Copy `.env.example` to `.env` first — the app needs the gateway URL and the
Algolia credentials to do anything useful.

## Checks

```sh
yarn check          # svelte-check against tsconfig.json
yarn test           # unit tests (Jest)
yarn test:e2e       # end-to-end (Playwright)
yarn storybook      # component explorer on :6006
```

`yarn check:gate` compares svelte-check output against
`.svelte-check-baseline`, so existing errors do not fail a build but new ones
do.

The Playwright suite includes mobile projects (`test:e2e:mobile`,
`test:e2e:ios`, `test:e2e:android`) as well as the desktop run.

## GraphQL

```sh
yarn graphql-codegen    # regenerate typed documents from the schema
```

Generated types are committed, so a schema change means regenerating and
committing the result alongside it.

## Deployment

Cloudflare, via `@sveltejs/adapter-cloudflare`:

```sh
yarn deploy:staging
yarn deploy:production
```

`.github/workflows/deploy-cloudflare.yml` does the same on merge. An
`@sveltejs/adapter-node` build (`yarn start`) and a `Dockerfile` are kept for
running it as a container instead.

Tracing config for a local OpenTelemetry, Tempo and Grafana stack lives in
`docker-compose.otel.yml` and the `*-config.yaml` files beside it.
