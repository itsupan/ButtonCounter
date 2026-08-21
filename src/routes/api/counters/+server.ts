import { json } from '@sveltejs/kit';
import { createCounter, isRecord, listCounters } from '$lib/server/counters';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const counters = await listCounters();
		return json({ data: counters });
	} catch (error) {
		console.error('[counters] list failed:', error);
		return json(
			{ error: { message: 'Failed to list counters', code: 'internal_error' } },
			{ status: 500 }
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
