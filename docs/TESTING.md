# Testing

ButtonCounter uses Vitest for both server-side unit tests and route handler tests. All 9 test
files run against mocked dependencies — no test in the suite talks to a real Turso database.

## Running tests

| Command                                                     | Purpose                |
| ----------------------------------------------------------- | ---------------------- |
| `pnpm run test`                                             | Single run, used in CI |
| `pnpm run test:unit`                                        | Watch mode             |
| `pnpm exec vitest run src/routes/api/health/health.test.ts` | Run a single test file |

CI runs `lint`, `check`, `test`, `build` in that order via the `Lint, typecheck, test, build`
check, which gates merges to `main` (see `docs/DEPLOYMENT.md`). Run all four locally before
calling work done.

## How the suite is structured

| Test file                                                  | Covers                                                                                                         |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/counters.test.ts`                          | `src/lib/server/counters.ts` — data access layer plus the `parseCounterId`/`isRecord`/`parseListQuery` helpers |
| `src/lib/server/runtime-info.test.ts`                      | `src/lib/server/runtime-info.ts` — build identity and instance uptime                                          |
| `src/lib/server/schema.test.ts`                            | `src/lib/server/schema.ts` — that the Drizzle table still matches the real one                                 |
| `src/lib/status-format.test.ts`                            | `src/lib/status-format.ts` — uptime/latency/relative-time formatting for the status page                       |
| `src/routes/api/counters/counters.test.ts`                 | `GET`/`POST /api/counters`                                                                                     |
| `src/routes/api/counters/[id]/counter.test.ts`             | `GET`/`PUT`/`DELETE /api/counters/:id`                                                                         |
| `src/routes/api/counters/[id]/increment/increment.test.ts` | `POST /api/counters/:id/increment`                                                                             |
| `src/routes/api/counters/[id]/decrement/decrement.test.ts` | `POST /api/counters/:id/decrement`                                                                             |
| `src/routes/api/health/health.test.ts`                     | `GET /api/health`                                                                                              |

Vitest is configured (in `vite.config.ts`, there is no separate `vitest.config.ts`) with one
project named `server`, `environment: 'node'`, matching `src/**/*.{test,spec}.{js,ts}` and
excluding `*.svelte.{test,spec}.{js,ts}` (component tests, once any exist, run under a browser-like
environment instead). `expect: { requireAssertions: true }` means every `it` block must contain at
least one assertion — a test that silently asserts nothing fails the run.

## Two layers of mocking

**Data-access tests** (`counters.test.ts`) mock the database client itself:

```ts
const execute = vi.fn();
vi.mock('$lib/server/db', () => ({ getDb: () => ({ execute }) }));
```

This exercises the real SQL string construction and row-mapping logic in `counters.ts` while
controlling exactly what "the database" returns.

**Route handler tests** (everything under `src/routes/api/counters/**`) instead mock the data-access
functions, one level up:

```ts
const listCounters = vi.fn();
vi.mock('$lib/server/counters', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/counters')>();
	return { ...actual, listCounters };
});
```

`importOriginal` is spread first so unmocked exports (like `parseCounterId` and `parseListQuery`,
which the route handlers call directly) keep their real implementation — only the specific
data-access functions under test are replaced. This isolates request parsing, validation, and
status-code selection from persistence. It also means `GET /api/counters`'s `400` responses are
produced by the real query parser, not a stub.

`/api/health` mocks `$lib/server/db` directly (like `counters.test.ts`) since it runs `SELECT 1`
itself rather than going through the `counters` module.

`status-format.test.ts` mocks nothing either — it is a plain module of pure functions. The status
page's Svelte components deliberately hold no formatting logic of their own so that the part which
can actually be wrong (padding, a negative uptime, an unparseable timestamp) is reachable from the
existing node project; there is no component-test runner in this repo.

`schema.test.ts` mocks nothing — it inspects the Drizzle table definition in memory. Its most
important assertion is a _type-level_ one: `schema.ts` never executes at request time, so a wrong
column there breaks no test and no endpoint, and surfaces only as DDL when `db:push` diffs it
against a live database. Equating the table's inferred row type with the `Counter` the API returns
turns that silent hazard into a `pnpm run check` failure. See `docs/DATABASE.md`.

**Environment-dependent tests** (`runtime-info.test.ts`) mock SvelteKit's env module. The factory
passed to `vi.mock` is hoisted above ordinary declarations, so the stand-in object has to be created
with `vi.hoisted`:

```ts
const env = vi.hoisted(() => ({}) as Record<string, string | undefined>);
vi.mock('$env/dynamic/private', () => ({ env }));
```

Mutating `env` between tests then exercises both the deployed case (the `VERCEL_*` variables set)
and local development (all of them absent).

## What each route's tests check

Per-route coverage generally follows the same shape:

- **Happy path** — valid input returns the expected status and JSON body.
- **Validation** — malformed input (bad id, missing/wrong-typed fields, invalid JSON body) returns
  `400` without calling the underlying data-access function.
- **Not found** — an id that doesn't exist returns `404`.
- **Failure** — a rejected promise from the data-access layer returns `500`. These tests spy on
  `console.error` (`vi.spyOn(console, 'error').mockImplementation(() => {})`) to keep expected
  failure logs out of the test output.

`health.test.ts` additionally asserts that a database error's detail (e.g. a connection string)
never leaks into the response body — see `docs/DEPLOYMENT.md`'s note on `/api/health` keeping
failure detail server-side only.

## Adding a test for a new route

1. Mock `$lib/server/counters` (or `$lib/server/db`, if the route talks to the database directly)
   the same way the neighboring test file does, spreading `importOriginal` first.
2. Build a small `invoke*` helper that dynamically imports `./+server` and calls the handler with a
   minimal `RequestEvent` stand-in (only the fields the handler actually reads — `params`,
   `request`, etc.).
3. Cover the same four cases as the existing route tests: happy path, validation, not found (if the
   route takes an id), and a rejected data-access call.
4. Reset every mock in a `beforeEach` so state doesn't leak between tests.

## Database migrations

Schema lives in `migrations/*.sql`, applied in filename order by `scripts/migrate.mjs`. Only
hand-written files belong there — drizzle-kit's generated output goes to the gitignored `drizzle/`
instead, so it cannot slip into the sequence (see `docs/DATABASE.md`). Since it's a plain Node
script (not run through Vite), it doesn't get the mode-based `.env.development` /
`.env.production` selection described in the main `CLAUDE.md` — load an env file explicitly:

```sh
node --env-file=.env.development scripts/migrate.mjs
```

Migrations use `CREATE TABLE IF NOT EXISTS`, so re-running an already-applied migration is a no-op.
Always confirm which database an env file points at before running a migration that writes data —
dev and production are separate Turso databases (see `CLAUDE.md`).
