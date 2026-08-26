import { describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { counters } from '$lib/server/schema';
import type { Counter } from '$lib/server/counters';

/**
 * Compile-time guard against the drift this file exists to prevent.
 *
 * `schema.ts` is never exercised at request time, so a wrong column name there
 * cannot fail a test by breaking a query — it fails much later, as DDL that
 * drizzle-kit pushes at a real database. Tying the table's inferred row type to
 * the `Counter` the API actually returns means the next mismatch stops
 * `pnpm run check` instead.
 */
type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;

export type SchemaRowMatchesCounter = Assert<Equal<typeof counters.$inferSelect, Counter>>;

describe('counters schema', () => {
	const columns = getTableColumns(counters);

	it('declares exactly the fields the app reads', () => {
		expect(Object.keys(columns).sort()).toEqual(['createdAt', 'id', 'name', 'updatedAt', 'value']);
	});

	it('maps them to the column names the migration created', () => {
		expect(Object.values(columns).map((column) => column.name)).toEqual([
			'id',
			'name',
			'value',
			'created_at',
			'updated_at'
		]);
	});

	it('makes id an integer primary key', () => {
		expect(columns.id.primary).toBe(true);
		expect(columns.id.getSQLType()).toBe('integer');
	});

	it('leaves name unconstrained beyond NOT NULL', () => {
		// The live table has no index on name. Claiming a unique constraint here
		// would make `db:push` try to create one, which fails on existing duplicates.
		expect(columns.name.notNull).toBe(true);
		expect(columns.name.isUnique).toBeFalsy();
	});

	it('defaults value to 0', () => {
		expect(columns.value.notNull).toBe(true);
		expect(columns.value.default).toBe(0);
		expect(columns.value.getSQLType()).toBe('integer');
	});

	it('stores timestamps as ISO-8601 text, not CURRENT_TIMESTAMP', () => {
		for (const column of [columns.createdAt, columns.updatedAt]) {
			expect(column.getSQLType()).toBe('text');
			expect(column.notNull).toBe(true);
			expect(column.hasDefault).toBe(true);
		}
	});
});
