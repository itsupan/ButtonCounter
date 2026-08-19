# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

SvelteKit + TypeScript app on Vercel, backed by Turso (libSQL). Currently a deployable shell —
a hello-world page and a health endpoint — with CI/CD in place. The counter features themselves are
still open issues (#4 API, #5 UI component, #7 dashboard, #8 test suite). Design decisions live in
GitHub issues on `itsupan/ButtonCounter`, not in code: `gh issue list --repo itsupan/ButtonCounter`.

## Commands

**Use pnpm, not npm.** The project pins `pnpm@11.6.0` via `packageManager`.

| Command              | Purpose                  |
| -------------------- | ------------------------ |
| `pnpm run dev`       | Dev server on :5173      |
| `pnpm run lint`      | Prettier check + ESLint  |
| `pnpm run check`     | `svelte-check` typecheck |
| `pnpm run test`      | Vitest, single run       |
| `pnpm run test:unit` | Vitest watch mode        |
| `pnpm run build`     | Production build         |

Run a single test file: `pnpm exec vitest run src/routes/api/health/health.test.ts`

CI runs `lint`, `check`, `test`, `build` in that order — run all four before claiming work is done.

Note pnpm forwards script args directly: `pnpm run dev --port 5175`. Adding `--` the npm way passes
a literal `--` through to vite, which silently ignores the flags after it.

## Architecture notes

**There is no `svelte.config.js`.** This SvelteKit version configures the adapter inline in
`vite.config.ts` via the `sveltekit({ adapter })` plugin option. Vitest config lives in the same file.

**Vercel functions are pinned to `hnd1` (Tokyo)** in `vite.config.ts` because both Turso databases
are in `aws-ap-northeast-1`. Unpinning costs a cross-region round trip on every query.

**`src/lib/server/db.ts` builds the libSQL client lazily.** Importing it never requires credentials,
so `vite build` and the unit tests work without a database; a missing `TURSO_URL` surfaces as a
failed request instead of a failed build. Credentials are read via `$env/dynamic/private` (runtime),
not `$env/static/private` (build time) — keep it that way so Vercel can inject them.

**`/api/health` runs a real `SELECT 1`** and returns 503 when the database is unreachable. It is the
entire monitoring story (no Sentry), so do not weaken it into a static 200. Failure detail goes to
`console.error` rather than the response body, to keep the connection URL out of a public endpoint.

## Environment

`TURSO_URL` and `TURSO_TOKEN`, documented in `.env.example`. Vite selects the file by mode:
`dev` reads `.env.development`, `build` reads `.env.production`. They point at **different**
databases (`button-counter-dev-itsupan` vs `buttoncounter-itsupan`), so check which one is loaded
before running anything that writes. Both files are gitignored.

## Deployment

`.github/workflows/ci.yml` — `test` job, then a `deploy` job with `needs: test`. Push to `main`
deploys production; any other branch deploys a preview. The deploy job is **skipped, not failed**,
unless the repo variable `VERCEL_CONFIGURED` is `"true"`, so CI stays green before Vercel is set up.
`.github/workflows/uptime.yml` probes production `/api/health` every 15 minutes.

Vercel's own Git integration must stay **disabled** — otherwise pushes deploy twice, and the Vercel
one bypasses the test gate entirely.

Branch flow: `issue-N/slug` → `development` → `main`.

Full setup, secrets matrix, and rollback: `docs/DEPLOYMENT.md`.

## Gotchas

- **Never run `npm audit fix --force`.** The reported `cookie` advisory is a low-severity transitive
  issue via `@sveltejs/kit`; the "fix" downgrades SvelteKit to 0.0.30 and destroys the project.
- pnpm 11 reads settings from `pnpm-workspace.yaml`, not the `pnpm` field in `package.json`.
  `allowBuilds: esbuild: true` there is required — without it pnpm skips esbuild's install script
  and vite/vitest fail to start.
