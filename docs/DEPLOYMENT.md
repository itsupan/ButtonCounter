# Deployment

ButtonCounter is a SvelteKit app on Vercel, backed by a Turso (libSQL) database. Vercel's GitHub
integration deploys every push; GitHub Actions runs the test suite. Untested code is kept out of
production by **branch protection on `main`**, not by the deploy step.

## Architecture

| Piece           | Choice                                | Why                                                                                                      |
| --------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Host            | Vercel, `@sveltejs/adapter-vercel`    | First-class SvelteKit support                                                                            |
| Runtime         | `nodejs22.x`, region `hnd1` (Tokyo)   | Both Turso databases are in `aws-ap-northeast-1`; co-locating avoids a cross-region round trip per query |
| Database        | Turso / libSQL over `libsql://`       | Serverless SQLite                                                                                        |
| Package manager | pnpm 11 (pinned via `packageManager`) | —                                                                                                        |
| Deploys         | Vercel Git integration                | Stable branch URLs and PR preview comments for free                                                      |
| Test gate       | Branch protection on `main`           | See below                                                                                                |
| Monitoring      | `/api/health` + scheduled probe       | No third-party error tracker yet                                                                         |

## How deploys work

Vercel watches the repository directly:

| Push to       | Vercel target | URL                              |
| ------------- | ------------- | -------------------------------- |
| `main`        | Production    | https://buttoncounter.vercel.app |
| `development` | Preview       | per-deploy URL + branch alias    |
| `issue-N/*`   | Preview       | per-deploy URL                   |

**Vercel does not wait for GitHub Actions.** Both start on the same push and run in parallel, so the
deploy step itself is not gated. What actually protects production is that `main` is a protected
branch requiring the `Lint, typecheck, test, build` check to pass before anything can merge into it.
Nothing untested reaches `main`, therefore nothing untested reaches Production.

Two consequences worth knowing:

- The check name in `.github/workflows/ci.yml` is load-bearing. The protection rule matches the job
  by name, so renaming the job silently disables the gate.
- `enforce_admins` is on, so direct pushes to `main` are refused even for owners. Merge through a PR.
  To bypass in an emergency, turn protection off, push, and turn it back on.

Branch flow: `issue-N/slug` → `development` → `main`.

## Local development

```bash
pnpm install
cp .env.example .env.development   # fill in Turso credentials
pnpm run dev
```

The app runs at http://localhost:5173. Verify the database wiring:

```bash
curl -s localhost:5173/api/health   # {"status":"ok","db":"ok","timestamp":"..."}
```

Quality gate — the same four commands CI runs:

```bash
pnpm run lint && pnpm run check && pnpm run test && pnpm run build
```

## Environment variables

Two variables, documented in `.env.example`:

| Variable      | Purpose               |
| ------------- | --------------------- |
| `TURSO_URL`   | libSQL connection URL |
| `TURSO_TOKEN` | Turso auth token      |

Vite picks the local file by mode: `pnpm run dev` reads `.env.development`, `pnpm run build` reads
`.env.production`. Both are gitignored. They are read at runtime through `$env/dynamic/private`, so
the build never needs real credentials — a missing variable surfaces as a failing request, not a
failing build.

Vercel exposes **three** environments and only two of them deploy:

| Environment | Deployed by                                        | Database                     |
| ----------- | -------------------------------------------------- | ---------------------------- |
| Production  | pushes to `main`                                   | `buttoncounter-itsupan`      |
| Preview     | every other deploy — `development`, `issue-N/*`    | `button-counter-dev-itsupan` |
| Development | nothing; scopes variables for `vercel dev` locally | —                            |

Setting a variable on Development and expecting the `development` branch to read it is an easy
mistake: that branch deploys to **Preview**. A genuine named environment per branch needs Vercel's
Custom Environments, a Pro feature (Hobby accounts report a limit of 0).

Pointing Preview at the dev database is what keeps PR deploys off production data.

## Rollback

```bash
vercel ls                              # list deployments
vercel promote <deployment-url>        # promote a known-good one to production
```

Or in the dashboard: Deployments → pick a previous one → Promote to Production. Rolling back the app
does **not** roll back the database.

## Monitoring

`/api/health` returns:

- `200 {"status":"ok","db":"ok","timestamp":...}` — the app answered and `SELECT 1` succeeded
- `503 {"status":"degraded","db":"error","timestamp":...}` — the database was unreachable

Failure detail goes to the Vercel function logs, deliberately not to the response body, so the
connection URL and token stay private.

`.github/workflows/uptime.yml` probes the `PRODUCTION_URL` repository variable every 15 minutes,
retries once, and on failure opens a `uptime`-labelled issue (or comments on the open one, rather
than filing a duplicate every 15 minutes during an outage).

## Troubleshooting

**A deployment URL returns 302** — Vercel protects per-deployment URLs
(`buttoncounter-<hash>-….vercel.app`) behind Vercel Authentication by default. The stable production
alias `buttoncounter.vercel.app` is public. For automated checks against protected URLs, enable
Settings → Deployment Protection → Protection Bypass for Automation and send the secret as a header.

**Health returns 503 on a preview deploy** — `TURSO_TOKEN` is probably missing from the **Preview**
environment. Check the function logs for the `[health]` line, which carries the real error.

**A PR cannot be merged into `main`** — the CI check has not passed, or the branch is behind
(`strict` is on, so update the branch first).

**`ERR_PNPM_IGNORED_BUILDS` during install** — esbuild's install script was skipped. It is allowed in
`pnpm-workspace.yaml`; if that file is missing the binary never lands and vite fails to start.

**`npm audit` reports a `cookie` advisory** — a low-severity transitive issue via `@sveltejs/kit`. Do
not run `audit fix --force`: its "fix" downgrades SvelteKit to 0.0.30 and destroys the project.
