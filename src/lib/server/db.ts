import { createClient, type Client } from '@libsql/client';
import { env } from '$env/dynamic/private';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

let client: Client | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * Returns the shared Drizzle database instance, creating it on first use.
 *
 * Construction is lazy so that importing this module never requires credentials:
 * `vite build` and the unit tests load it without a reachable database, and a
 * missing variable surfaces as a failed request rather than a failed build.
 */
export function getDb() {
	if (!db) {
		const url = env.TURSO_URL;

		if (!url) {
			throw new Error('TURSO_URL is not set');
		}

		client = createClient({ url, authToken: env.TURSO_TOKEN });
		db = drizzle(client, { schema });
	}

	return db;
}
