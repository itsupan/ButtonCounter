import { createClient } from '@libsql/client';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const migrationsDir = fileURLToPath(new URL('../migrations', import.meta.url));

async function main() {
	const url = process.env.TURSO_URL;

	if (!url) {
		throw new Error(
			'TURSO_URL is not set. Load an env file first, e.g. ' +
				'`node --env-file=.env.development scripts/migrate.mjs`.'
		);
	}

	const client = createClient({ url, authToken: process.env.TURSO_TOKEN });
	const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();

	for (const file of files) {
		const sql = await readFile(path.join(migrationsDir, file), 'utf8');
		console.log(`Applying ${file}...`);
		await client.executeMultiple(sql);
	}

	client.close();
	console.log('Migrations applied.');
}

main().catch((error) => {
	console.error('[migrate] failed:', error);
	process.exitCode = 1;
});
