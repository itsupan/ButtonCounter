import { beforeEach, describe, expect, it, vi } from 'vitest';

const incrementCounter = vi.fn();

vi.mock('$lib/server/counters', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/counters')>();
	return { ...actual, incrementCounter };
});

const sampleCounter = {
	id: 1,
	name: 'clicks',
	value: 6,
	createdAt: '2026-08-20T00:00:00.000Z',
	updatedAt: '2026-08-20T00:00:00.000Z'
};

const invoke = async (id: string) => {
	const { POST } =
		await import('../../../../../../../src/routes/api/counters/[id]/increment/+server');
	return POST({ params: { id } } as Parameters<typeof POST>[0]);
};

describe('POST /api/counters/:id/increment', () => {
	beforeEach(() => {
		incrementCounter.mockReset();
	});

	it('increments the counter and returns it', async () => {
		incrementCounter.mockResolvedValue(sampleCounter);
		const response = await invoke('1');
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({ data: sampleCounter });
		expect(incrementCounter).toHaveBeenCalledWith(1);
	});

	it('returns 404 when the counter does not exist', async () => {
		incrementCounter.mockResolvedValue(undefined);
		const response = await invoke('999');
		expect(response.status).toBe(404);
	});

	it('returns 400 for a non-numeric id', async () => {
		const response = await invoke('abc');
		expect(response.status).toBe(400);
		expect(incrementCounter).not.toHaveBeenCalled();
	});

	it('returns 500 on a database error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		incrementCounter.mockRejectedValue(new Error('db unreachable'));
		const response = await invoke('1');
		expect(response.status).toBe(500);
	});
});
