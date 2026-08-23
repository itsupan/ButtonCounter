import { beforeEach, describe, expect, it, vi } from 'vitest';

const listCounters = vi.fn();
const createCounter = vi.fn();

vi.mock('$lib/server/counters', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/counters')>();
	return { ...actual, listCounters, createCounter };
});

const sampleCounter = {
	id: 1,
	name: 'clicks',
	value: 0,
	createdAt: '2026-08-20T00:00:00.000Z',
	updatedAt: '2026-08-20T00:00:00.000Z'
};

const invokeGet = async () => {
	const { GET } = await import('./+server');
	return GET({} as Parameters<typeof GET>[0]);
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
	});

	it('returns the list of counters', async () => {
		listCounters.mockResolvedValue([sampleCounter]);
		const response = await invokeGet();
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ data: [sampleCounter] });
	});

	it('returns 500 when listing fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		listCounters.mockRejectedValue(new Error('db unreachable'));
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
