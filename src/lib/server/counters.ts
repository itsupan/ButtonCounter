// These queries are hand-written SQL, so they go through the raw libSQL client
// rather than the query builder. `getDb()` returns a Drizzle instance, which
// exposes that client as `$client`.
import { getDb } from '$lib/server/db';
import type { Row } from '@libsql/client';

export type Counter = {
	id: number;
	name: string;
	value: number;
	createdAt: string;
	updatedAt: string;
};

export type CounterSortKey = 'id' | 'name' | 'value' | 'createdAt' | 'updatedAt';
export type SortOrder = 'asc' | 'desc';

export type ListCountersOptions = {
	/** `null` means unbounded — the default, which preserves the original behaviour. */
	limit: number | null;
	offset: number;
	sort: CounterSortKey;
	order: SortOrder;
	/** Case-insensitive substring match on the counter name; `null` means no filter. */
	name: string | null;
};

export type CounterTotals = {
	/** Rows matching the filter, ignoring limit/offset. */
	totalCount: number;
	/** Sum of `value` across those same rows. */
	totalValue: number;
};

export type ParsedListQuery =
	{ ok: true; options: ListCountersOptions } | { ok: false; message: string };

const SELECT_COLUMNS = 'id, name, value, created_at, updated_at';

/**
 * Maps the API's sort keys to real column names.
 *
 * A column name cannot be a bound parameter, so it has to be interpolated into
 * the SQL string. Going through this table is what makes that safe: only these
 * five literals can ever reach the query.
 */
const SORT_COLUMNS: Record<CounterSortKey, string> = {
	id: 'id',
	name: 'name',
	value: 'value',
	createdAt: 'created_at',
	updatedAt: 'updated_at'
};

const MAX_LIMIT = 100;

export const DEFAULT_LIST_OPTIONS: ListCountersOptions = {
	limit: null,
	offset: 0,
	sort: 'id',
	order: 'asc',
	name: null
};

/**
 * Builds the shared `WHERE` fragment for the list and aggregate queries.
 *
 * `%` and `_` in the user's input are escaped so they filter literally rather
 * than acting as wildcards.
 */
function nameFilter(name: string | null): { clause: string; args: string[] } {
	if (name === null) {
		return { clause: '', args: [] };
	}

	return {
		clause: ` WHERE name LIKE ? ESCAPE '\\'`,
		args: [`%${name.replace(/[\\%_]/g, '\\$&')}%`]
	};
}

function mapRow(row: Row): Counter {
	const { id, name, value, created_at: createdAt, updated_at: updatedAt } = row;

	if (
		typeof id !== 'number' ||
		typeof name !== 'string' ||
		typeof value !== 'number' ||
		typeof createdAt !== 'string' ||
		typeof updatedAt !== 'string'
	) {
		throw new Error('Unexpected counter row shape');
	}

	return { id, name, value, createdAt, updatedAt };
}

/** Narrows a parsed JSON body to a plain object, ruling out arrays/null/primitives. */
export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parses a route `[id]` param into a positive integer, or `undefined` if invalid. */
export function parseCounterId(raw: string): number | undefined {
	if (!/^\d+$/.test(raw)) {
		return undefined;
	}

	const id = Number(raw);
	return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function isSortKey(value: string): value is CounterSortKey {
	return Object.hasOwn(SORT_COLUMNS, value);
}

/**
 * Validates `/api/counters` query parameters into fully resolved options.
 *
 * Every parameter is optional and an empty value is treated as absent, so an
 * unadorned request yields `DEFAULT_LIST_OPTIONS` and the untouched original
 * behaviour. Returns the failure as a value rather than throwing so the route can
 * turn it into a 400 with the message.
 */
export function parseListQuery(url: URL): ParsedListQuery {
	const params = url.searchParams;
	const options: ListCountersOptions = { ...DEFAULT_LIST_OPTIONS };

	const rawLimit = params.get('limit');
	if (rawLimit) {
		if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1) {
			return { ok: false, message: '"limit" must be a positive integer' };
		}
		// Cap rather than reject: an oversized page size is a reasonable request to
		// answer conservatively, not a client error.
		options.limit = Math.min(Number(rawLimit), MAX_LIMIT);
	}

	const rawOffset = params.get('offset');
	if (rawOffset) {
		if (!/^\d+$/.test(rawOffset)) {
			return { ok: false, message: '"offset" must be a non-negative integer' };
		}
		options.offset = Number(rawOffset);
	}

	const rawSort = params.get('sort');
	if (rawSort) {
		if (!isSortKey(rawSort)) {
			return {
				ok: false,
				message: `"sort" must be one of: ${Object.keys(SORT_COLUMNS).join(', ')}`
			};
		}
		options.sort = rawSort;
	}

	const rawOrder = params.get('order');
	if (rawOrder) {
		if (rawOrder !== 'asc' && rawOrder !== 'desc') {
			return { ok: false, message: '"order" must be "asc" or "desc"' };
		}
		options.order = rawOrder;
	}

	const rawName = params.get('name');
	if (rawName !== null && rawName.trim() !== '') {
		options.name = rawName.trim();
	}

	return { ok: true, options };
}

export async function listCounters(options: Partial<ListCountersOptions> = {}): Promise<Counter[]> {
	const limit = options.limit ?? DEFAULT_LIST_OPTIONS.limit;
	const offset = options.offset ?? DEFAULT_LIST_OPTIONS.offset;
	const filter = nameFilter(options.name ?? DEFAULT_LIST_OPTIONS.name);
	const column = SORT_COLUMNS[options.sort ?? DEFAULT_LIST_OPTIONS.sort];
	const direction = (options.order ?? DEFAULT_LIST_OPTIONS.order) === 'desc' ? 'DESC' : 'ASC';

	let sql = `SELECT ${SELECT_COLUMNS} FROM counters${filter.clause} ORDER BY ${column} ${direction}`;
	const args: (string | number)[] = [...filter.args];

	// SQLite only accepts OFFSET after a LIMIT, so an offset with no page size
	// passes -1 — SQLite's "no limit" sentinel.
	if (limit !== null || offset > 0) {
		sql += ' LIMIT ? OFFSET ?';
		args.push(limit ?? -1, offset);
	}

	const result = await getDb().$client.execute({ sql, args });
	return result.rows.map(mapRow);
}

/**
 * Totals for the rows matching `options.name`, deliberately ignoring `limit` and
 * `offset` so the numbers describe the whole match rather than the current page.
 * Costs a second round trip alongside `listCounters`.
 */
export async function countCounters(
	options: Partial<ListCountersOptions> = {}
): Promise<CounterTotals> {
	const filter = nameFilter(options.name ?? DEFAULT_LIST_OPTIONS.name);
	const result = await getDb().$client.execute({
		// COALESCE keeps SUM() from returning NULL for an empty table.
		sql: `SELECT COUNT(*) AS total_count, COALESCE(SUM(value), 0) AS total_value FROM counters${filter.clause}`,
		args: filter.args
	});
	const row = result.rows[0];

	if (!row) {
		throw new Error('Aggregate query returned no row');
	}

	const { total_count: totalCount, total_value: totalValue } = row;

	if (typeof totalCount !== 'number' || typeof totalValue !== 'number') {
		throw new Error('Unexpected counter totals row shape');
	}

	return { totalCount, totalValue };
}

export async function getCounterById(id: number): Promise<Counter | undefined> {
	const result = await getDb().$client.execute({
		sql: `SELECT ${SELECT_COLUMNS} FROM counters WHERE id = ?`,
		args: [id]
	});
	const row = result.rows[0];
	return row ? mapRow(row) : undefined;
}

export async function createCounter(input: { name: string; value?: number }): Promise<Counter> {
	const result = await getDb().$client.execute({
		sql: `INSERT INTO counters (name, value) VALUES (?, ?) RETURNING ${SELECT_COLUMNS}`,
		args: [input.name, input.value ?? 0]
	});
	const row = result.rows[0];

	if (!row) {
		throw new Error('Insert did not return a row');
	}

	return mapRow(row);
}

export async function updateCounter(
	id: number,
	input: { name?: string; value?: number }
): Promise<Counter | undefined> {
	const result = await getDb().$client.execute({
		sql: `UPDATE counters
		      SET name = COALESCE(?, name),
		          value = COALESCE(?, value),
		          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		      WHERE id = ?
		      RETURNING ${SELECT_COLUMNS}`,
		args: [input.name ?? null, input.value ?? null, id]
	});
	const row = result.rows[0];
	return row ? mapRow(row) : undefined;
}

export async function deleteCounter(id: number): Promise<Counter | undefined> {
	const result = await getDb().$client.execute({
		sql: `DELETE FROM counters WHERE id = ? RETURNING ${SELECT_COLUMNS}`,
		args: [id]
	});
	const row = result.rows[0];
	return row ? mapRow(row) : undefined;
}

async function shiftCounterValue(id: number, delta: 1 | -1): Promise<Counter | undefined> {
	const result = await getDb().$client.execute({
		sql: `UPDATE counters
		      SET value = value + (?),
		          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
		      WHERE id = ?
		      RETURNING ${SELECT_COLUMNS}`,
		args: [delta, id]
	});
	const row = result.rows[0];
	return row ? mapRow(row) : undefined;
}

export function incrementCounter(id: number): Promise<Counter | undefined> {
	return shiftCounterValue(id, 1);
}

export function decrementCounter(id: number): Promise<Counter | undefined> {
	return shiftCounterValue(id, -1);
}
