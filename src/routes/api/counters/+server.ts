import { json } from '@sveltejs/kit';
import {
	countCounters,
	createCounter,
	isRecord,
	listCounters,
	parseListQuery
} from '$lib/server/counters';
import type { RequestHandler } from './$types';

// The UI polls this route every two seconds, so a CDN caching it would pin every
// other client to a stale count.
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * Lists counters, optionally paged, sorted and filtered.
 *
 * With no query parameters the `data` array is exactly what it has always been —
 * every counter ordered by id — so existing consumers are unaffected. `meta`
 * describes the whole match rather than the returned page, which is why
 * `totalCount` and `totalValue` come from a separate aggregate query.
 */
export const GET: RequestHandler = async ({ url }) => {
	const parsed = parseListQuery(url);

	if (!parsed.ok) {
		return json(
			{ error: { message: parsed.message, code: 'invalid_query' } },
			{ status: 400, headers: NO_STORE }
		);
	}

	const { options } = parsed;

	try {
		const [counters, totals] = await Promise.all([listCounters(options), countCounters(options)]);

		return json(
			{
				data: counters,
				meta: {
					count: counters.length,
					totalCount: totals.totalCount,
					totalValue: totals.totalValue,
					generatedAt: new Date().toISOString(),
					limit: options.limit,
					offset: options.offset,
					sort: options.sort,
					order: options.order,
					name: options.name
				}
			},
			{ headers: NO_STORE }
		);
	} catch (error) {
		console.error('[counters] list failed:', error);
		return json(
			{ error: { message: 'Failed to list counters', code: 'internal_error' } },
			{ status: 500, headers: NO_STORE }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json(
			{ error: { message: 'Request body must be valid JSON', code: 'invalid_body' } },
			{ status: 400 }
		);
	}

	if (!isRecord(body)) {
		return json(
			{ error: { message: 'Request body must be a JSON object', code: 'invalid_body' } },
			{ status: 400 }
		);
	}

	const { name, value } = body;

	if (typeof name !== 'string' || name.trim() === '') {
		return json(
			{
				error: {
					message: '"name" is required and must be a non-empty string',
					code: 'invalid_body'
				}
			},
			{ status: 400 }
		);
	}

	if (value !== undefined && typeof value !== 'number') {
		return json(
			{ error: { message: '"value" must be a number', code: 'invalid_body' } },
			{ status: 400 }
		);
	}

	try {
		const counter = await createCounter({ name, value });
		return json({ data: counter }, { status: 201 });
	} catch (error) {
		console.error('[counters] create failed:', error);
		return json(
			{ error: { message: 'Failed to create counter', code: 'internal_error' } },
			{ status: 500 }
		);
	}
};
