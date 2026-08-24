import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Mirrors the table created by `migrations/0001_create_counters.sql`.
 *
 * Nothing here runs at request time — every query in `counters.ts` is hand-written
 * SQL against the raw libSQL client, and drizzle-kit is this file's only real
 * consumer. That is precisely why it has to stay accurate: `db:push` diffs this
 * definition against a live database and emits DDL to close the gap, so a wrong
 * column name here becomes a DROP COLUMN against production.
 *
 * `schema.test.ts` ties it back to the `Counter` type the app actually returns, so
 * the next drift fails typecheck instead of a deployment.
 */
export const counters = sqliteTable('counters', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	// Deliberately not `.unique()`: the real table has no index on name.
	name: text('name').notNull(),
	value: integer('value').notNull().default(0),
	// Not CURRENT_TIMESTAMP, which yields 'YYYY-MM-DD HH:MM:SS'. The table stores
	// ISO-8601 with milliseconds, which is what the API hands back.
	createdAt: text('created_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`)
});
