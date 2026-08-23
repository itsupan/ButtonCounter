import { json } from '@sveltejs/kit';
import { incrementCounter, parseCounterId } from '$lib/server/counters';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
	const id = parseCounterId(params.id);

	if (id === undefined) {
		return json(
			{ error: { message: '"id" must be a positive integer', code: 'invalid_id' } },
			{ status: 400 }
		);
	}

	try {
		const counter = await incrementCounter(id);

		if (!counter) {
			return json({ error: { message: 'Counter not found', code: 'not_found' } }, { status: 404 });
		}

		return json({ data: counter });
	} catch (error) {
		console.error('[counters] increment failed:', error);
		return json(
			{ error: { message: 'Failed to increment counter', code: 'internal_error' } },
			{ status: 500 }
		);
	}
};
