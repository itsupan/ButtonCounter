import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/schema.ts',
	out: './migrations',
	dialect: 'turso',
	dbCredentials: {
		// Falls back rather than throwing so `db:generate`, which only reads the
		// schema, still runs without credentials loaded. drizzle-kit rejects the
		// empty url itself when a command actually needs to connect.
		url: process.env.TURSO_URL ?? '',
		authToken: process.env.TURSO_TOKEN
	}
});
