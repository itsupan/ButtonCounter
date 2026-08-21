import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const counters = sqliteTable('counters', {
	id: text('id').primaryKey(),
	name: text('name').notNull().unique(),
	count: integer('count').notNull().default(0),
	createdAt: text('created_at')
		.notNull()
		.default(sql`(CURRENT_TIMESTAMP)`),
	updatedAt: text('updated_at')
		.notNull()
		.default(sql`(CURRENT_TIMESTAMP)`)
});
