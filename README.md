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

CI runs `lint`, `check`, `test` and `build` on every push, and deploys only if all four pass.

## Layout

```
src/lib/server/db.ts        libSQL client (lazily constructed)
src/routes/+page.svelte     hello-world page
src/routes/api/health/      health endpoint + its tests
.github/workflows/ci.yml    test gate + Vercel deploy
.github/workflows/uptime.yml  scheduled health probe
```

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for first-time Vercel setup, the secret and
environment-variable matrix, rollback, and troubleshooting.
