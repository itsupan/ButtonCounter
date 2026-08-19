# Deployment

ButtonCounter is a SvelteKit app deployed to Vercel as serverless functions, backed by a Turso
(libSQL) database. Deploys are driven by GitHub Actions rather than Vercel's Git integration, so
that tests gate every release.

## Architecture

| Piece           | Choice                                | Why                                                                                                      |
| --------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Host            | Vercel, `@sveltejs/adapter-vercel`    | First-class SvelteKit support                                                                            |
| Runtime         | `nodejs22.x`, region `hnd1` (Tokyo)   | Both Turso databases are in `aws-ap-northeast-1`; co-locating avoids a cross-region round trip per query |
| Database        | Turso / libSQL over `libsql://`       | Serverless SQLite                                                                                        |
| Package manager | pnpm 11 (pinned via `packageManager`) | —                                                                                                        |
| Monitoring      | `/api/health` + scheduled probe       | No third-party error tracker yet                                                                         |

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

Two variables, defined in `.env.example`:

| Variable      | Purpose               |
| ------------- | --------------------- |
| `TURSO_URL`   | libSQL connection URL |
| `TURSO_TOKEN` | Turso auth token      |

Vite picks the file by mode: `pnpm run dev` reads `.env.development`, `pnpm run build` reads
`.env.production`. Both are gitignored. They are read at runtime through `$env/dynamic/private`,
so the build never needs real credentials — a missing variable surfaces as a failing request,
not a failing build.

In Vercel, set them per environment so preview deploys never touch production data:

| Vercel environment | Database                     |
| ------------------ | ---------------------------- |
| Production         | `buttoncounter-itsupan`      |
| Preview            | `button-counter-dev-itsupan` |

## First-time setup

Steps 1–2 need interactive login, so run them yourself.

**1. Link the Vercel project**

```bash
vercel login
vercel link
```

This writes `.vercel/project.json` (gitignored) containing `orgId` and `projectId`.

**2. Create a Vercel token** at https://vercel.com/account/tokens.

**3. Add GitHub secrets**

```bash
gh secret set VERCEL_TOKEN      --repo itsupan/ButtonCounter
gh secret set VERCEL_ORG_ID     --repo itsupan/ButtonCounter   # orgId
gh secret set VERCEL_PROJECT_ID --repo itsupan/ButtonCounter   # projectId
```

**4. Enable deploys and the uptime probe**

```bash
gh variable set VERCEL_CONFIGURED --body "true" --repo itsupan/ButtonCounter
gh variable set PRODUCTION_URL --body "https://<your-project>.vercel.app" --repo itsupan/ButtonCounter
```

Until `VERCEL_CONFIGURED` is `true` the deploy job is **skipped rather than failed**, so CI stays
green before Vercel exists. Same for `PRODUCTION_URL` and the uptime workflow.

**5. Set the Turso variables in Vercel** (Project → Settings → Environment Variables) per the table
above.

**6. Disable Vercel's Git integration** (Project → Settings → Git).

> This step is not optional. Left on, every push deploys twice — once from Vercel directly,
> bypassing the tests entirely, and once from Actions. Turning it off is what makes "tests run
> before deployment" actually true.

## How the pipeline works

`.github/workflows/ci.yml` has two jobs:

- **test** — runs on every push and on PRs into `main`/`development`: lint, typecheck, unit tests,
  build.
- **deploy** — `needs: test`, so it cannot start on a red build.
  - push to `main` → **production** deploy
  - push to any other branch → **preview** deploy
  - after deploying, polls the new deployment's `/api/health` up to 5 times and fails the job if it
    never returns 200

Branch flow: `issue-N/slug` → `development` → `main`.

## Rollback

```bash
vercel ls                              # list deployments
vercel promote <deployment-url>        # promote a known-good one to production
```

Or in the dashboard: Deployments → pick a previous one → Promote to Production. Rolling back the
app does **not** roll back the database.

## Monitoring

`/api/health` returns:

- `200 {"status":"ok","db":"ok","timestamp":...}` — the app answered and `SELECT 1` succeeded
- `503 {"status":"degraded","db":"error","timestamp":...}` — the database was unreachable

Failure detail is written to the Vercel function logs, deliberately not to the response body, so
the connection URL and token stay private.

`.github/workflows/uptime.yml` probes it every 15 minutes, retries once, and on failure opens a
`uptime`-labelled issue (or comments on the open one, rather than filing a duplicate every 15
minutes during an outage).

## Troubleshooting

**Deploy job was skipped** — `VERCEL_CONFIGURED` is not set to `true`, or the push was not a push
event. This is the expected state before first-time setup.

**Health check returns 503 in production** — the Turso variables are missing or wrong in that
Vercel environment. Check the function logs for the `[health]` line, which carries the real error.

**`ERR_PNPM_IGNORED_BUILDS` during install** — esbuild's install script was skipped. It is allowed
in `pnpm-workspace.yaml`; if that file is missing the binary never lands and vite fails to start.

**`npm audit` reports a `cookie` advisory** — a low-severity transitive issue via `@sveltejs/kit`.
Do not run `audit fix --force`: its "fix" downgrades SvelteKit to 0.0.30 and destroys the project.
It resolves when SvelteKit ships an updated dependency.
