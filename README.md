# ButtonCounter

A SvelteKit + TypeScript app backed by a Turso (libSQL) database, deployed to Vercel.

Currently a deployable shell: a hello-world page plus a health endpoint. The counter features are
tracked in issues #4, #5 and #7.

## Quickstart

```bash
pnpm install
cp .env.example .env.development   # add your Turso credentials
pnpm run dev
```

http://localhost:5173 serves the page; `/api/health` reports database connectivity.

## Scripts

| Command              | Purpose                         |
| -------------------- | ------------------------------- |
| `pnpm run dev`       | Dev server                      |
| `pnpm run build`     | Production build                |
| `pnpm run preview`   | Preview the production build    |
| `pnpm run lint`      | Prettier + ESLint               |
| `pnpm run check`     | `svelte-check` typecheck        |
| `pnpm run test`      | Unit tests (Vitest, single run) |
| `pnpm run test:unit` | Unit tests in watch mode        |

CI runs `lint`, `check`, `test` and `build` on every push. Vercel deploys every push independently; `main` is branch-protected on the CI check, so only tested code reaches production. Live at <https://buttoncounter.vercel.app>.

## API

All responses are JSON. Success bodies carry `data`; failures carry
`error: { message, code }`. Both endpoints below send `Cache-Control: no-store` — the health probe
must never be answered from a cache, and the counter list is polled every two seconds.

### `GET /api/health`

Runs a real `SELECT 1` against Turso and reports `200` when it answers, `503` when it does not.
Alongside `status`/`db`/`timestamp` the body carries `checks.db.latencyMs` (so a slow-but-alive
database is visible), `uptimeSeconds` (instance age, which reveals cold starts) and `build`
(`version`, `commit`, `environment`, `region` — which deployment answered). Connection details are
never included; they go to the server log.

### `GET /api/counters`

Returns `data` (the counters) and `meta`. With no query parameters this is every counter ordered by
id. `meta` reports `count` (rows in this response), `totalCount` and `totalValue` (rows matched and
their summed value, both ignoring pagination), `generatedAt`, and the effective query parameters.

| Parameter | Values                                              | Default   |
| --------- | --------------------------------------------------- | --------- |
| `limit`   | positive integer, capped at 100                     | unbounded |
| `offset`  | non-negative integer                                | `0`       |
| `sort`    | `id`, `name`, `value`, `createdAt`, `updatedAt`     | `id`      |
| `order`   | `asc`, `desc`                                       | `asc`     |
| `name`    | substring match on the counter name                 | no filter |

Anything outside those values returns `400` with code `invalid_query`.

Counters are also addressable individually: `GET`/`PUT`/`DELETE /api/counters/:id`, plus
`POST /api/counters/:id/increment` and `.../decrement`.

## Layout

```
src/lib/server/db.ts        libSQL client (lazily constructed)
src/routes/+page.svelte     hello-world page
src/routes/api/health/      health endpoint + its tests
.github/workflows/ci.yml    lint, typecheck, test, build
.github/workflows/uptime.yml  scheduled health probe
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for first-time Vercel setup, the secret and
environment-variable matrix, rollback, and troubleshooting.
