import { beforeEach, describe, expect, it, vi } from 'vitest';

const decrementCounter = vi.fn();

vi.mock('$lib/server/counters', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/counters')>();
	return { ...actual, decrementCounter };
});

const sampleCounter = {
	id: 1,
	name: 'clicks',
	value: 4,
	createdAt: '2026-08-20T00:00:00.000Z',
	updatedAt: '2026-08-20T00:00:00.000Z'
};

const invoke = async (id: string) => {
	const { POST } =
		await import('../../../../../../../src/routes/api/counters/[id]/decrement/+server');
	return POST({ params: { id } } as Parameters<typeof POST>[0]);
};

describe('POST /api/counters/:id/decrement', () => {
	beforeEach(() => {
		decrementCounter.mockReset();
	});

	it('decrements the counter and returns it', async () => {
		decrementCounter.mockResolvedValue(sampleCounter);
		const response = await invoke('1');
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ data: sampleCounter });
		expect(decrementCounter).toHaveBeenCalledWith(1);
	});

	it('returns 404 when the counter does not exist', async () => {
		decrementCounter.mockResolvedValue(undefined);
		const response = await invoke('999');
		expect(response.status).toBe(404);
	});

	it('returns 400 for a non-numeric id', async () => {
		const response = await invoke('abc');
		expect(response.status).toBe(400);
		expect(decrementCounter).not.toHaveBeenCalled();
	});

	it('returns 500 on a database error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		decrementCounter.mockRejectedValue(new Error('db unreachable'));
		const response = await invoke('1');
		expect(response.status).toBe(500);
	});
});
