import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();

vi.mock('$lib/server/db', () => ({
	getDb: () => ({ $client: { execute } })
}));

import {
	createCounter,
	decrementCounter,
	deleteCounter,
	getCounterById,
	incrementCounter,
	isRecord,
	listCounters,
	parseCounterId,
	updateCounter
} from './counters';

const sampleRow = {
	id: 1,
	name: 'clicks',
	value: 5,
	created_at: '2026-08-20T00:00:00.000Z',
	updated_at: '2026-08-20T00:00:00.000Z'
};

const sampleCounter = {
	id: 1,
	name: 'clicks',
	value: 5,
	createdAt: '2026-08-20T00:00:00.000Z',
	updatedAt: '2026-08-20T00:00:00.000Z'
};

describe('parseCounterId', () => {
	it('accepts positive integers', () => {
		expect(parseCounterId('42')).toBe(42);
	});

	it('rejects non-numeric, zero, negative, and decimal input', () => {
		expect(parseCounterId('abc')).toBeUndefined();
		expect(parseCounterId('0')).toBeUndefined();
		expect(parseCounterId('-1')).toBeUndefined();
		expect(parseCounterId('1.5')).toBeUndefined();
	});
});

describe('isRecord', () => {
	it('distinguishes plain objects from arrays, null, and primitives', () => {
		expect(isRecord({})).toBe(true);
		expect(isRecord([])).toBe(false);
		expect(isRecord(null)).toBe(false);
		expect(isRecord('x')).toBe(false);
	});
});

describe('counters data access', () => {
	beforeEach(() => {
		execute.mockReset();
	});

	it('listCounters maps rows to Counter objects', async () => {
		execute.mockResolvedValue({ rows: [sampleRow] });
		await expect(listCounters()).resolves.toEqual([sampleCounter]);
	});

	it('getCounterById passes the id as a parameterized arg', async () => {
		execute.mockResolvedValue({ rows: [sampleRow] });
		await expect(getCounterById(1)).resolves.toEqual(sampleCounter);
		expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: [1] }));
	});

	it('getCounterById returns undefined when no row matches', async () => {
		execute.mockResolvedValue({ rows: [] });
		await expect(getCounterById(999)).resolves.toBeUndefined();
	});

	it('createCounter defaults value to 0 and returns the inserted row', async () => {
		execute.mockResolvedValue({ rows: [sampleRow] });
		await expect(createCounter({ name: 'clicks' })).resolves.toEqual(sampleCounter);
		expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ['clicks', 0] }));
	});

	it('createCounter throws if the insert returns no row', async () => {
		execute.mockResolvedValue({ rows: [] });
		await expect(createCounter({ name: 'clicks' })).rejects.toThrow();
	});

	it('updateCounter passes null for omitted fields so COALESCE keeps existing values', async () => {
		execute.mockResolvedValue({ rows: [sampleRow] });
		await updateCounter(1, { name: 'renamed' });
		expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: ['renamed', null, 1] }));
	});

	it('updateCounter returns undefined when the id does not exist', async () => {
		execute.mockResolvedValue({ rows: [] });
		await expect(updateCounter(999, { name: 'x' })).resolves.toBeUndefined();
	});

	it('deleteCounter returns the deleted row', async () => {
		execute.mockResolvedValue({ rows: [sampleRow] });
		await expect(deleteCounter(1)).resolves.toEqual(sampleCounter);
		expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: [1] }));
	});

	it('incrementCounter sends a +1 delta', async () => {
		execute.mockResolvedValue({ rows: [sampleRow] });
		await incrementCounter(1);
		expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: [1, 1] }));
	});

	it('decrementCounter sends a -1 delta', async () => {
		execute.mockResolvedValue({ rows: [sampleRow] });
		await decrementCounter(1);
		expect(execute).toHaveBeenCalledWith(expect.objectContaining({ args: [-1, 1] }));
	});
});
