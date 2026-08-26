import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();

// getDb() returns a Drizzle instance; the raw libSQL client hangs off `$client`.
vi.mock('$lib/server/db', () => ({
	getDb: () => ({ $client: { execute } })
}));

import {
	countCounters,
	createCounter,
	decrementCounter,
	deleteCounter,
	getCounterById,
	incrementCounter,
	isRecord,
	listCounters,
	parseCounterId,
	parseListQuery,
	updateCounter
} from '$lib/server/counters';

/** Reads back the SQL the data layer handed to the libSQL client. */
const lastSql = () => String(execute.mock.calls.at(-1)?.[0]?.sql ?? '');
const lastArgs = () => execute.mock.calls.at(-1)?.[0]?.args ?? [];

/** Builds the URL a route handler would pass to parseListQuery. */
const query = (search: string) => new URL(`http://localhost/api/counters${search}`);

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

describe('parseListQuery', () => {
	it('supplies defaults for an empty query string', () => {
		expect(parseListQuery(query(''))).toEqual({
			ok: true,
			options: { limit: null, offset: 0, sort: 'id', order: 'asc', name: null }
		});
	});

	it('accepts every supported parameter', () => {
		const result = parseListQuery(query('?limit=10&offset=5&sort=value&order=desc&name=click'));

		expect(result).toEqual({
			ok: true,
			options: { limit: 10, offset: 5, sort: 'value', order: 'desc', name: 'click' }
		});
	});

	it('accepts the camelCase timestamp sort keys', () => {
		expect(parseListQuery(query('?sort=createdAt'))).toMatchObject({
			ok: true,
			options: { sort: 'createdAt' }
		});
		expect(parseListQuery(query('?sort=updatedAt'))).toMatchObject({
			ok: true,
			options: { sort: 'updatedAt' }
		});
	});

	it('caps an oversized limit instead of rejecting it', () => {
		expect(parseListQuery(query('?limit=5000'))).toMatchObject({
			ok: true,
			options: { limit: 100 }
		});
	});

	it('rejects a non-integer or non-positive limit', () => {
		expect(parseListQuery(query('?limit=abc')).ok).toBe(false);
		expect(parseListQuery(query('?limit=0')).ok).toBe(false);
		expect(parseListQuery(query('?limit=-1')).ok).toBe(false);
		expect(parseListQuery(query('?limit=1.5')).ok).toBe(false);
	});

	it('rejects a negative or non-integer offset', () => {
		expect(parseListQuery(query('?offset=-1')).ok).toBe(false);
		expect(parseListQuery(query('?offset=abc')).ok).toBe(false);
	});

	it('rejects a sort column outside the whitelist', () => {
		// The whitelist is what keeps an identifier out of the SQL string.
		expect(parseListQuery(query('?sort=value;DROP TABLE counters')).ok).toBe(false);
		expect(parseListQuery(query('?sort=secret')).ok).toBe(false);
	});

	it('rejects an unknown order', () => {
		expect(parseListQuery(query('?order=sideways')).ok).toBe(false);
	});

	it('explains what was wrong', () => {
		const result = parseListQuery(query('?limit=abc'));

		expect(result.ok === false && result.message).toContain('limit');
	});

	it('treats a blank name as no filter', () => {
		expect(parseListQuery(query('?name='))).toMatchObject({ ok: true, options: { name: null } });
	});
});

describe('listCounters options', () => {
	beforeEach(() => {
		execute.mockReset();
		execute.mockResolvedValue({ rows: [sampleRow] });
	});

	it('emits an unfiltered, unpaginated query by default', async () => {
		await listCounters();

		expect(lastSql()).toContain('ORDER BY id ASC');
		expect(lastSql()).not.toContain('WHERE');
		expect(lastSql()).not.toContain('LIMIT');
		expect(lastArgs()).toEqual([]);
	});

	it('binds limit and offset as arguments', async () => {
		await listCounters({ limit: 10, offset: 5 });

		expect(lastSql()).toContain('LIMIT ? OFFSET ?');
		expect(lastArgs()).toEqual([10, 5]);
	});

	it('applies an offset without a limit using the SQLite -1 sentinel', async () => {
		// SQLite requires a LIMIT before OFFSET; -1 means "no limit".
		await listCounters({ offset: 5 });

		expect(lastArgs()).toEqual([-1, 5]);
	});

	it('interpolates only whitelisted identifiers into ORDER BY', async () => {
		await listCounters({ sort: 'createdAt', order: 'desc' });

		expect(lastSql()).toContain('ORDER BY created_at DESC');
		expect(lastArgs()).toEqual([]);
	});

	it('binds a name filter as a LIKE pattern', async () => {
		await listCounters({ name: 'click' });

		expect(lastSql()).toContain('WHERE name LIKE ?');
		expect(lastArgs()).toEqual(['%click%']);
	});

	it('escapes LIKE wildcards so they filter literally', async () => {
		await listCounters({ name: '100%_x' });

		expect(lastSql()).toContain("ESCAPE '\\'");
		expect(lastArgs()).toEqual(['%100\\%\\_x%']);
	});

	it('still maps rows to Counter objects when options are used', async () => {
		await expect(listCounters({ limit: 1 })).resolves.toEqual([sampleCounter]);
	});
});

describe('countCounters', () => {
	beforeEach(() => {
		execute.mockReset();
	});

	it('returns the row count and summed value', async () => {
		execute.mockResolvedValue({ rows: [{ total_count: 3, total_value: 42 }] });

		await expect(countCounters()).resolves.toEqual({ totalCount: 3, totalValue: 42 });
	});

	it('applies the same name filter as the list query', async () => {
		execute.mockResolvedValue({ rows: [{ total_count: 1, total_value: 5 }] });

		await countCounters({ name: 'click' });

		expect(lastSql()).toContain('WHERE name LIKE ?');
		expect(lastArgs()).toEqual(['%click%']);
	});

	it('ignores limit and offset so the totals describe the whole match', async () => {
		execute.mockResolvedValue({ rows: [{ total_count: 9, total_value: 90 }] });

		await countCounters({ name: null, limit: 1, offset: 2 });

		expect(lastSql()).not.toContain('LIMIT');
		expect(lastArgs()).toEqual([]);
	});

	it('reports zeroes for an empty table', async () => {
		// COALESCE keeps SUM(value) from coming back as NULL.
		execute.mockResolvedValue({ rows: [{ total_count: 0, total_value: 0 }] });

		await expect(countCounters()).resolves.toEqual({ totalCount: 0, totalValue: 0 });
	});

	it('throws when the aggregate row is missing or malformed', async () => {
		execute.mockResolvedValue({ rows: [] });

		await expect(countCounters()).rejects.toThrow();
	});
});
