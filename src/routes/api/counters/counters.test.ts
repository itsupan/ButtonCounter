import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCounters = vi.fn();
const createCounter = vi.fn();
const countCounters = vi.fn();

// parseListQuery is deliberately NOT mocked — the route's 400 behaviour is the
// real parser's, and counters.test.ts covers the parser itself.
vi.mock('$lib/server/counters', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/counters')>();
	return { ...actual, listCounters, createCounter, countCounters };
});

const sampleCounter = {
	id: 1,
	name: 'clicks',
	value: 0,
	createdAt: '2026-08-20T00:00:00.000Z',
	updatedAt: '2026-08-20T00:00:00.000Z'
};

// The GET handler reads `url` for its query parameters, so the stand-in event has
// to carry one.
const invokeGet = async (search = '') => {
	const { GET } = await import('./+server');
	const url = new URL(`http://localhost/api/counters${search}`);
	return GET({ url } as Parameters<typeof GET>[0]);
};

const invokePost = async (body: unknown) => {
	const { POST } = await import('./+server');
	const request = new Request('http://localhost/api/counters', {
		method: 'POST',
		body: JSON.stringify(body)
	});
	return POST({ request } as Parameters<typeof POST>[0]);
};

describe('GET /api/counters', () => {
	beforeEach(() => {
		listCounters.mockReset();
		countCounters.mockReset();
		listCounters.mockResolvedValue([sampleCounter]);
		countCounters.mockResolvedValue({ totalCount: 1, totalValue: 5 });
	});

	it('returns the list of counters', async () => {
		const response = await invokeGet();
		expect(response.status).toBe(200);
		// toMatchObject, not toEqual: `data` must stay exactly as it was, but the
		// response now carries `meta` alongside it.
		await expect(response.json()).resolves.toMatchObject({ data: [sampleCounter] });
	});

	it('asks for every counter when no parameters are given', async () => {
		await invokeGet();
		expect(listCounters).toHaveBeenCalledWith(
			expect.objectContaining({ limit: null, offset: 0, sort: 'id', order: 'asc', name: null })
		);
	});

	it('reports counts, totals and a snapshot time', async () => {
		const body = await (await invokeGet()).json();

		expect(body.meta).toMatchObject({ count: 1, totalCount: 1, totalValue: 5 });
		expect(Date.parse(body.meta.generatedAt)).not.toBeNaN();
	});

	it('separates rows returned from rows matching', async () => {
		listCounters.mockResolvedValue([sampleCounter]);
		countCounters.mockResolvedValue({ totalCount: 7, totalValue: 70 });

		const body = await (await invokeGet('?limit=1')).json();

		expect(body.meta.count).toBe(1);
		expect(body.meta.totalCount).toBe(7);
	});

	it('echoes the effective parameters', async () => {
		const body = await (await invokeGet('?limit=5&offset=2&sort=value&order=desc&name=cli')).json();

		expect(body.meta).toMatchObject({
			limit: 5,
			offset: 2,
			sort: 'value',
			order: 'desc',
			name: 'cli'
		});
	});

	it('passes the parsed parameters to the data layer', async () => {
		await invokeGet('?limit=5&sort=value&order=desc&name=cli');

		expect(listCounters).toHaveBeenCalledWith(
			expect.objectContaining({ limit: 5, sort: 'value', order: 'desc', name: 'cli' })
		);
		expect(countCounters).toHaveBeenCalledWith(expect.objectContaining({ name: 'cli' }));
	});

	it('rejects an invalid parameter with 400 and does not query', async () => {
		const response = await invokeGet('?limit=abc');

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: 'invalid_query' }
		});
		expect(listCounters).not.toHaveBeenCalled();
	});

	it('rejects a sort column outside the whitelist with 400', async () => {
		const response = await invokeGet('?sort=value;DROP TABLE counters');

		expect(response.status).toBe(400);
		expect(listCounters).not.toHaveBeenCalled();
	});

	it('forbids caching so pollers never see a stale count', async () => {
		const response = await invokeGet();
		expect(response.headers.get('cache-control')).toBe('no-store');
	});

	it('returns 500 when listing fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		listCounters.mockRejectedValue(new Error('db unreachable'));
		const response = await invokeGet();
		expect(response.status).toBe(500);
	});

	it('returns 500 when the totals query fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		countCounters.mockRejectedValue(new Error('db unreachable'));
		const response = await invokeGet();
		expect(response.status).toBe(500);
	});
});

describe('POST /api/counters', () => {
	beforeEach(() => {
		createCounter.mockReset();
	});

	it('creates a counter and returns 201', async () => {
		createCounter.mockResolvedValue(sampleCounter);
		const response = await invokePost({ name: 'clicks' });
		expect(response.status).toBe(201);
		await expect(response.json()).resolves.toEqual({ data: sampleCounter });
		expect(createCounter).toHaveBeenCalledWith({ name: 'clicks', value: undefined });
	});

	it('rejects a missing name with 400', async () => {
		const response = await invokePost({});
		expect(response.status).toBe(400);
		expect(createCounter).not.toHaveBeenCalled();
	});

	it('rejects a non-string name with 400', async () => {
		const response = await invokePost({ name: 42 });
		expect(response.status).toBe(400);
	});

	it('rejects a non-number value with 400', async () => {
		const response = await invokePost({ name: 'clicks', value: '5' });
		expect(response.status).toBe(400);
	});

	it('rejects invalid JSON with 400', async () => {
		const { POST } = await import('./+server');
		const request = new Request('http://localhost/api/counters', {
			method: 'POST',
			body: 'not json'
		});
		const response = await POST({ request } as Parameters<typeof POST>[0]);
		expect(response.status).toBe(400);
	});

	it('returns 500 when creation fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		createCounter.mockRejectedValue(new Error('db unreachable'));
		const response = await invokePost({ name: 'clicks' });
		expect(response.status).toBe(500);
	});
});
