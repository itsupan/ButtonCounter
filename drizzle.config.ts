import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: './src/lib/server/schema.ts',
	out: './migrations',
	dialect: 'turso',
	dbCredentials: {
		url: process.env.TURSO_URL!,
		authToken: process.env.TURSO_TOKEN!
	}
});
