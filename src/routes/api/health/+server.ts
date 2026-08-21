import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import type { RequestHandler } from './$types';

/**
 * Liveness probe for uptime monitoring.
 *
 * Deliberately queries Turso rather than returning a static 200 — a health check
 * that cannot fail tells you nothing. Responds 503 when the database is
 * unreachable so an uptime monitor treats it as an outage.
 */
export const GET: RequestHandler = async () => {
	const timestamp = new Date().toISOString();

	try {
		await getDb().run('SELECT 1');

		return json({ status: 'ok', db: 'ok', timestamp });
	} catch (error) {
		// Log the detail for Vercel's logs, but keep the connection URL and any
		// token material out of a publicly reachable response body.
		console.error('[health] database probe failed:', error);

		return json({ status: 'degraded', db: 'error', timestamp }, { status: 503 });
	}
};
