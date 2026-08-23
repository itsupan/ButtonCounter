import { json } from '@sveltejs/kit';
import {
	deleteCounter,
	getCounterById,
	isRecord,
	parseCounterId,
	updateCounter
} from '$lib/server/counters';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseCounterId(params.id);

	if (id === undefined) {
		return json(
			{ error: { message: '"id" must be a positive integer', code: 'invalid_id' } },
			{ status: 400 }
		);
	}

	try {
		const counter = await getCounterById(id);

		if (!counter) {
			return json({ error: { message: 'Counter not found', code: 'not_found' } }, { status: 404 });
		}

		return json({ data: counter });
	} catch (error) {
		console.error('[counters] get failed:', error);
		return json(
			{ error: { message: 'Failed to fetch counter', code: 'internal_error' } },
			{ status: 500 }
		);
	}
};

export const PUT: RequestHandler = async ({ params, request }) => {
	const id = parseCounterId(params.id);

	if (id === undefined) {
		return json(
			{ error: { message: '"id" must be a positive integer', code: 'invalid_id' } },
			{ status: 400 }
		);
	}

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

	if (name === undefined && value === undefined) {
		return json(
			{ error: { message: 'At least one of "name" or "value" is required', code: 'invalid_body' } },
			{ status: 400 }
		);
	}

	if (name !== undefined && (typeof name !== 'string' || name.trim() === '')) {
		return json(
			{ error: { message: '"name" must be a non-empty string', code: 'invalid_body' } },
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
		const counter = await updateCounter(id, { name, value });

		if (!counter) {
			return json({ error: { message: 'Counter not found', code: 'not_found' } }, { status: 404 });
		}

		return json({ data: counter });
	} catch (error) {
		console.error('[counters] update failed:', error);
		return json(
			{ error: { message: 'Failed to update counter', code: 'internal_error' } },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const id = parseCounterId(params.id);

	if (id === undefined) {
		return json(
			{ error: { message: '"id" must be a positive integer', code: 'invalid_id' } },
			{ status: 400 }
		);
	}

	try {
		const counter = await deleteCounter(id);

		if (!counter) {
			return json({ error: { message: 'Counter not found', code: 'not_found' } }, { status: 404 });
		}

		return json({ data: counter });
	} catch (error) {
		console.error('[counters] delete failed:', error);
		return json(
			{ error: { message: 'Failed to delete counter', code: 'internal_error' } },
			{ status: 500 }
		);
	}
};
