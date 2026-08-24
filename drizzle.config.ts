import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/schema.ts',
	// Deliberately NOT './migrations'. That directory holds hand-written SQL which
	// `scripts/migrate.mjs` replays in filename order, while drizzle-kit numbers its
	// own output from 0000 — so a generated file would sort *ahead* of
	// `0001_create_counters.sql` and be applied first. Giving drizzle-kit its own
	// gitignored directory means the two migration systems cannot collide.
	out: './drizzle',
	dialect: 'turso',
	dbCredentials: {
		// Falls back rather than throwing so `db:generate`, which only reads the
		// schema, still runs without credentials loaded. drizzle-kit rejects the
		// empty url itself when a command actually needs to connect.
		url: process.env.TURSO_URL ?? '',
		authToken: process.env.TURSO_TOKEN
	}
});
