import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getBuildInfo, getUptimeSeconds } from '$lib/server/runtime-info';
import type { RequestHandler } from './$types';

// A cached 200 would let the uptime probe pass straight through a real outage,
// so every response opts out of any CDN or proxy in front of the function.
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Liveness probe for uptime monitoring.
 *
 * Deliberately queries Turso rather than returning a static 200 — a health check
 * that cannot fail tells you nothing. Responds 503 when the database is
 * unreachable so an uptime monitor treats it as an outage.
 *
 * The body also carries the two things an incident actually starts with: how long
 * the database took to answer (slow-but-alive is invisible in a bare 200) and
 * which build is serving the request.
 */
export const GET: RequestHandler = async () => {
	const timestamp = new Date().toISOString();
	const build = getBuildInfo();
	const uptimeSeconds = getUptimeSeconds();
	const startedAt = performance.now();

	try {
		await getDb().run('SELECT 1');

		const latencyMs = Math.round(performance.now() - startedAt);

		return json(
			{
				status: 'ok',
				// `db` is retained alongside `checks` so existing consumers of the flat
				// shape keep working.
				db: 'ok',
				timestamp,
				checks: { db: { status: 'ok', latencyMs } },
				uptimeSeconds,
				build
			},
			{ headers: NO_STORE }
		);
	} catch (error) {
		const latencyMs = Math.round(performance.now() - startedAt);

		// Log the detail for Vercel's logs, but keep the connection URL and any
		// token material out of a publicly reachable response body.
		console.error('[health] database probe failed:', error);

		return json(
			{
				status: 'degraded',
				db: 'error',
				timestamp,
				checks: { db: { status: 'error', latencyMs } },
				uptimeSeconds,
				build
			},
			{ status: 503, headers: NO_STORE }
		);
	}
};
