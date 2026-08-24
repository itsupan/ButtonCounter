# Database

Turso (libSQL) accessed through Drizzle ORM. This covers where the schema lives, how a change
reaches a database, and — the part that bites — how to be certain _which_ database you are about to
write to.

For how the app itself ships, see `docs/DEPLOYMENT.md`.

## The stack

| Piece       | Choice                               | Why                                                                           |
| ----------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| Database    | Turso / libSQL, `aws-ap-northeast-1` | Serverless SQLite; Vercel functions are pinned to `hnd1` to sit beside it     |
| Driver      | `@libsql/client`                     | Speaks `libsql://` over HTTP                                                  |
| ORM         | `drizzle-orm`                        | Connection handling and typing; the counter queries are hand-written SQL      |
| Schema tool | `drizzle-kit`                        | Diffs `schema.ts` against a live database and emits the DDL                   |
| Env loading | `dotenv-cli`                         | drizzle-kit is not a Vite process, so it cannot use Vite's `.env.*` selection |

That last row is the reason every database script is wrapped in `dotenv -e <file> --`. Vite picks
`.env.development` or `.env.production` automatically from its mode; drizzle-kit has no such notion
and would otherwise see an empty environment.

## Two databases, never mix them

| Database                     | Used by                         | Credentials from   |
| ---------------------------- | ------------------------------- | ------------------ |
| `button-counter-dev-itsupan` | local dev, every Preview deploy | `.env.development` |
| `buttoncounter-itsupan`      | Production — pushes to `main`   | `.env.production`  |

Both files are gitignored (`.env.*` with an exception for `.env.example`). Copy `.env.example` and
fill in values from the Turso dashboard.

## Schema

One table, `counters`, created by `migrations/0001_create_counters.sql`:

| Column       | Type      | Notes                                                               |
| ------------ | --------- | ------------------------------------------------------------------- |
| `id`         | `integer` | primary key, autoincrement                                          |
| `name`       | `text`    | not null — deliberately **not** unique, and there is no index on it |
| `value`      | `integer` | not null, defaults to `0`                                           |
| `created_at` | `text`    | not null, defaults to `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`     |
| `updated_at` | `text`    | not null, defaults to `(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`     |

The timestamp default is ISO-8601 with milliseconds, **not** `CURRENT_TIMESTAMP` — SQLite's
`CURRENT_TIMESTAMP` yields `YYYY-MM-DD HH:MM:SS`, a different format from what the API returns.

`src/lib/server/schema.ts` mirrors this table for drizzle-kit's benefit, but it is neither the only
place SQL lives nor the definition the app runs on:

- Request-time queries are hand-written SQL in `src/lib/server/counters.ts`, executed through the
  raw libSQL client (`getDb().$client`). They never go through Drizzle's query builder.
- The table was created by the hand-written `migrations/0001_create_counters.sql`, applied with
  `node --env-file=.env.development scripts/migrate.mjs`.

**That combination is the trap.** Because nothing reads `schema.ts` at request time, an error in it
cannot fail a test or break an endpoint — it stays invisible until `db:push` diffs it against a live
database and emits DDL to close the gap. A wrong column name there is a `DROP COLUMN` against
production. This file did drift once, describing a `text` id and a `count` column that never
existed; a push would have destroyed the real `value` data.

`src/lib/server/schema.test.ts` is the guard: it asserts the table's inferred row type is exactly
the `Counter` type the API returns, so the next drift fails `pnpm run check` instead of a
deployment. To re-check the file against a real database without writing to it, `drizzle-kit pull`
introspects into a scratch directory — it only reads:

```bash
pnpm exec dotenv -e .env.development -- drizzle-kit pull --out=/tmp/introspect
```

## Applying a schema change

| Command                  | What it does                                      | Writes to a database? |
| ------------------------ | ------------------------------------------------- | --------------------- |
| `pnpm run db:push:dev`   | Diffs `schema.ts` against dev and applies the DDL | **Yes — dev**         |
| `pnpm run db:push:prod`  | The same, against production                      | **Yes — production**  |
| `pnpm run db:generate`   | Writes versioned SQL into `drizzle/`              | No                    |
| `pnpm run db:studio:dev` | Opens Drizzle Studio against dev                  | Reads dev             |

`push` is the normal path for this project. It prints the statements it intends to run and prompts
before anything that loses data. Useful flags, passed straight through by pnpm:
`--verbose` (print every statement), `--strict` (always confirm), `--force` (auto-approve data loss —
avoid).

**`db:generate` is not currently a working migration path.** It runs without credentials, because it
only reads `schema.ts` — but nothing applies what it writes. Prefer `push` unless you are
deliberately introducing the versioned workflow.

### Two directories, two systems

| Directory     | Holds                               | Applied by                               | In git     |
| ------------- | ----------------------------------- | ---------------------------------------- | ---------- |
| `migrations/` | hand-written `.sql`                 | `scripts/migrate.mjs`, in filename order | tracked    |
| `drizzle/`    | whatever `db:generate`/`pull` emits | nothing                                  | gitignored |

They are kept apart on purpose. `drizzle-kit`'s `out` used to be `./migrations` — the same directory
`migrate.mjs` replays — and drizzle-kit numbers its output from `0000`, so a generated file would
have sorted _ahead_ of the hand-written `0001_create_counters.sql` and been applied first. Pointing
`out` at `./drizzle` makes that collision impossible; `migrate.mjs` only ever sees files a human put
there.

Nothing reads `drizzle/`, so it is safe to delete at any time.

## Verify the target before you write

The script name is not evidence. `dotenv -p` prints a resolved variable without invoking drizzle-kit,
which makes it a safe pre-flight check:

```bash
pnpm exec dotenv -e .env.development -p TURSO_URL
# libsql://button-counter-dev-itsupan.aws-ap-northeast-1.turso.io
```

Compare the tokens too, without ever printing one:

```bash
pnpm exec dotenv -e .env.development -p TURSO_TOKEN | sha256sum | cut -c1-12
pnpm exec dotenv -e .env.production  -p TURSO_TOKEN | sha256sum | cut -c1-12
```

The two fingerprints must differ. Different hosts but an identical fingerprint means one env file was
copied from the other and still carries the wrong credentials — the URL would look right while the
token pointed elsewhere.

### The override trap

`dotenv-cli` does **not** override variables already present in the environment, and the scripts do
not pass its `-o` flag. If `TURSO_URL` is exported in your shell, `dotenv -e .env.development` is
silently ignored for that variable and `db:push:dev` writes wherever your shell points — with nothing
in the output to show it. Before a push:

```bash
env | grep TURSO_    # expect no output
```

Adding `-o` to the `db:*` scripts makes the env file authoritative regardless of shell state.

Related: drizzle-kit auto-loads a bare `.env` if one exists. This repo deliberately has none — adding
one creates a third, invisible source of credentials that outranks nothing and confuses everything.

### The safety net

With no credentials loaded at all, `push` fails loudly rather than guessing:

```
Error  Please provide required params:
    [x] url: ''
```

`drizzle.config.ts` falls back to an empty string rather than throwing, so that `db:generate` still
runs credential-free; drizzle-kit rejects the empty URL itself the moment a command needs to connect.
There is no default database to fall through to.

## Querying from app code

`getDb()` in `src/lib/server/db.ts` returns the shared Drizzle instance, constructed on first use.
The laziness is deliberate: importing the module never requires credentials, so `vite build` and the
unit tests work without a database, and a missing `TURSO_URL` surfaces as a failed request instead of
a failed build. Credentials come from `$env/dynamic/private` (runtime), never `$env/static/private`
(build time) — Vercel injects them at runtime.

Raw SQL goes through the SQLite API — `.run()`, `.all()`, `.get()`. **There is no `.execute()`**; that
method belongs to Drizzle's Postgres and MySQL drivers. The distinction is easy to miss because the
raw `@libsql/client` `Client` _does_ have `.execute()`, so code written against the client before the
ORM was introduced typechecks until the moment `getDb()` starts returning a Drizzle instance. That is
exactly how `/api/health` broke.

```ts
await getDb().run('SELECT 1'); // string args are wrapped in sql.raw() internally
```

## Troubleshooting

| Symptom                                                      | Cause                                                                                                          |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `Please provide required params: [x] url: ''`                | No env file loaded — you ran drizzle-kit without its `dotenv` wrapper                                          |
| Push succeeded but the change is on the wrong database       | `TURSO_URL` exported in your shell shadowed the env file; see the override trap                                |
| `Property 'execute' does not exist on type 'LibSQLDatabase'` | Use `.run()` — see above                                                                                       |
| `/api/health` returns 503 locally                            | `.env.development` missing or unreachable; detail is in the server console, deliberately not the response body |
| A `drizzle/` directory appears                               | Something ran `db:generate` or `db:pull`; gitignored and applied by nothing — safe to delete                   |
