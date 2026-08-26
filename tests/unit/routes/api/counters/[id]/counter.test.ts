import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCounterById = vi.fn();
const updateCounter = vi.fn();
const deleteCounter = vi.fn();

vi.mock('$lib/server/counters', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/counters')>();
	return { ...actual, getCounterById, updateCounter, deleteCounter };
});

const sampleCounter = {
	id: 1,
	name: 'clicks',
	value: 5,
	createdAt: '2026-08-20T00:00:00.000Z',
	updatedAt: '2026-08-20T00:00:00.000Z'
};

const invokeGet = async (id: string) => {
	const { GET } = await import('../../../../../../src/routes/api/counters/[id]/+server');
	return GET({ params: { id } } as Parameters<typeof GET>[0]);
};

const invokePut = async (id: string, body: unknown) => {
	const { PUT } = await import('../../../../../../src/routes/api/counters/[id]/+server');
	const request = new Request(`http://localhost/api/counters/${id}`, {
		method: 'PUT',
		body: JSON.stringify(body)
	});
	return PUT({ params: { id }, request } as Parameters<typeof PUT>[0]);
};

const invokeDelete = async (id: string) => {
	const { DELETE } = await import('../../../../../../src/routes/api/counters/[id]/+server');
	return DELETE({ params: { id } } as Parameters<typeof DELETE>[0]);
};

describe('GET /api/counters/:id', () => {
	beforeEach(() => {
		getCounterById.mockReset();
	});

	it('returns the counter when found', async () => {
		getCounterById.mockResolvedValue(sampleCounter);
		const response = await invokeGet('1');
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ data: sampleCounter });
	});

	it('returns 404 when not found', async () => {
		getCounterById.mockResolvedValue(undefined);
		const response = await invokeGet('999');
		expect(response.status).toBe(404);
	});

	it('returns 400 for a non-numeric id', async () => {
		const response = await invokeGet('abc');
		expect(response.status).toBe(400);
		expect(getCounterById).not.toHaveBeenCalled();
	});

	it('returns 500 on a database error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		getCounterById.mockRejectedValue(new Error('db unreachable'));
		const response = await invokeGet('1');
		expect(response.status).toBe(500);
	});
});

describe('PUT /api/counters/:id', () => {
	beforeEach(() => {
		updateCounter.mockReset();
	});

	it('updates name and/or value', async () => {
		updateCounter.mockResolvedValue(sampleCounter);
		const response = await invokePut('1', { name: 'renamed' });
		expect(response.status).toBe(200);
		expect(updateCounter).toHaveBeenCalledWith(1, { name: 'renamed', value: undefined });
	});

	it('rejects an empty body with 400', async () => {
		const response = await invokePut('1', {});
		expect(response.status).toBe(400);
		expect(updateCounter).not.toHaveBeenCalled();
	});

	it('rejects a non-string name with 400', async () => {
		const response = await invokePut('1', { name: 42 });
		expect(response.status).toBe(400);
	});

	it('rejects a non-number value with 400', async () => {
		const response = await invokePut('1', { value: 'five' });
		expect(response.status).toBe(400);
	});

	it('returns 404 when the counter does not exist', async () => {
		updateCounter.mockResolvedValue(undefined);
		const response = await invokePut('999', { name: 'x' });
		expect(response.status).toBe(404);
	});

	it('returns 400 for a non-numeric id', async () => {
		const response = await invokePut('abc', { name: 'x' });
		expect(response.status).toBe(400);
	});
});

describe('DELETE /api/counters/:id', () => {
	beforeEach(() => {
		deleteCounter.mockReset();
	});

	it('deletes the counter and returns it', async () => {
		deleteCounter.mockResolvedValue(sampleCounter);
		const response = await invokeDelete('1');
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ data: sampleCounter });
	});

	it('returns 404 when not found', async () => {
		deleteCounter.mockResolvedValue(undefined);
		const response = await invokeDelete('999');
		expect(response.status).toBe(404);
	});

	it('returns 400 for a non-numeric id', async () => {
		const response = await invokeDelete('abc');
		expect(response.status).toBe(400);
		expect(deleteCounter).not.toHaveBeenCalled();
	});

	it('returns 500 on a database error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		deleteCounter.mockRejectedValue(new Error('db unreachable'));
		const response = await invokeDelete('1');
		expect(response.status).toBe(500);
	});
});
