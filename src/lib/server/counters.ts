import { getDb } from '$lib/server/db';
import type { Row } from '@libsql/client';

export type Counter = {
	id: number;
	name: string;
	value: number;
	createdAt: string;
	updatedAt: string;
};

const SELECT_COLUMNS = 'id, name, value, created_at, updated_at';

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

export async function listCounters(): Promise<Counter[]> {
	const result = await getDb().execute(`SELECT ${SELECT_COLUMNS} FROM counters ORDER BY id`);
	return result.rows.map(mapRow);
}

export async function getCounterById(id: number): Promise<Counter | undefined> {
	const result = await getDb().execute({
		sql: `SELECT ${SELECT_COLUMNS} FROM counters WHERE id = ?`,
		args: [id]
	});
	const row = result.rows[0];
	return row ? mapRow(row) : undefined;
}

export async function createCounter(input: { name: string; value?: number }): Promise<Counter> {
	const result = await getDb().execute({
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
	const result = await getDb().execute({
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
	const result = await getDb().execute({
		sql: `DELETE FROM counters WHERE id = ? RETURNING ${SELECT_COLUMNS}`,
		args: [id]
	});
	const row = result.rows[0];
	return row ? mapRow(row) : undefined;
}

async function shiftCounterValue(id: number, delta: 1 | -1): Promise<Counter | undefined> {
	const result = await getDb().execute({
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
