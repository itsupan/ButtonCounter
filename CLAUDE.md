# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A team learning project: build a button counter, learn SvelteKit 5, and show a real workflow.
The app matters less than the workflow around it. Keep everything small enough that a teammate
reads it once and gets it.

SvelteKit + TypeScript on Vercel, Turso (libSQL) through Drizzle. Right now there is a health
endpoint, a `counters` table, and an unstyled `ButtonCounter.svelte` that counts in a `$state` rune —
so nothing touches the database yet except `/api/health`.

Open work: #4 API endpoints, #5 the real UI component, #7 dashboard, #8 tests, #17 realtime.
The thinking lives in the issues, not in the code: `gh issue list --repo itsupan/ButtonCounter`.

## How we work

One issue → one branch → one PR. Small PRs, one thing each.

```
issue-N/short-slug  →  development  →  main
```

- Branch name is `issue-N/slug` so the branch says which issue it closes.
- PR body: what changed, why, and `Closes #N`. Plain sentences, no template ceremony.
- `main` is protected — merges by PR only, even for owners, and the `Lint, typecheck, test, build`
  check must pass.
- Before you open a PR, run all four locally: `lint`, `check`, `test`, `build`.

## Code style

Write the simplest thing that solves the problem. That is the point of the project — a teammate
should understand the diff without asking.

- No abstraction until there are two real callers. No config for a value that never changes.
- Reach for what is already here (Svelte runes, Drizzle, stdlib) before adding anything.
- Comment the surprising part, not the obvious one.
- Tests: plain and few. One test that fails when the logic breaks beats a suite of ceremony.
  No elaborate mocks or fixtures. `src/routes/api/health/health.test.ts` is the model.
- Delete freely. Shorter is better as long as it still reads clearly.

## Commands

**Use pnpm, not npm.** The project pins `pnpm@11.6.0`.

| Command              | Purpose                  |
| -------------------- | ------------------------ |
| `pnpm run dev`       | Dev server on :5173      |
| `pnpm run lint`      | Prettier check + ESLint  |
| `pnpm run check`     | `svelte-check` typecheck |
| `pnpm run test`      | Vitest, single run       |
| `pnpm run test:unit` | Vitest watch mode        |
| `pnpm run build`     | Production build         |

One test file: `pnpm exec vitest run src/routes/api/health/health.test.ts`

pnpm forwards script args directly: `pnpm run dev --port 5175`. Adding `--` the npm way passes a
literal `--` to vite, which then ignores the flags after it.

The `db:*` scripts write to a **real** database — read `docs/DATABASE.md` first. `db:push:dev` is the
normal path; `db:generate` is a dead end today (it writes SQL nothing applies).

## Things that will bite you

**There is no `svelte.config.js`.** The adapter is configured inline in `vite.config.ts` via
`sveltekit({ adapter })`. Vitest config is in the same file.

**Vercel functions are pinned to `hnd1` (Tokyo)** because both Turso databases are in
`aws-ap-northeast-1`. Unpinning adds a cross-region round trip to every query.

**Query through `getDb()`** in `src/lib/server/db.ts`, never a bare `createClient`. It builds the
Drizzle instance on first use, so importing it needs no credentials — build and tests run without a
database, and a missing `TURSO_URL` fails one request instead of the whole build. Credentials come
from `$env/dynamic/private` (runtime), never `$env/static/private` (build time), so Vercel can
inject them. `src/lib/server/schema.ts` is the only source of schema truth — no hand-written SQL.

**`/api/health` runs a real `SELECT 1`** and returns 503 when the database is down. It is the whole
monitoring story, so don't soften it into a static 200. Errors go to `console.error`, not the
response, to keep the connection URL out of a public endpoint.

**Two databases.** `.env.development` → `button-counter-dev-itsupan`, `.env.production` →
`buttoncounter-itsupan`. Vite picks the file by mode; drizzle-kit does not, hence the `dotenv -e`
wrappers. Check which one is loaded before anything that writes.

**`.gitignore` ignores `*.md` outside `docs/`.** A new note at the repo root is silently untracked.

**Vercel deploys on push, in parallel with CI** — the deploy is not gated by the tests. Branch
protection on `main` is what keeps untested code out of production, and it matches the CI job by
name, so renaming `Lint, typecheck, test, build` in `.github/workflows/ci.yml` disables the gate.
`development` deploys to **Preview**, not to Vercel's "Development" environment — that one only
scopes variables for `vercel dev`, and confusing the two has already cost time here.

**Never run `npm audit fix --force`.** The `cookie` advisory is a low-severity transitive issue via
`@sveltejs/kit`; the "fix" downgrades SvelteKit to 0.0.30 and destroys the project.

**pnpm 11 reads `pnpm-workspace.yaml`**, not the `pnpm` field in `package.json`. The
`allowBuilds: esbuild: true` there is required, or pnpm skips esbuild's install script and
vite/vitest won't start.

More detail: `docs/DEPLOYMENT.md`, `docs/DATABASE.md`.
