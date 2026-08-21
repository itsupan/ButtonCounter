import { beforeEach, describe, expect, it, vi } from 'vitest';

const run = vi.fn();

vi.mock('$lib/server/db', () => ({
	getDb: () => ({ run })
}));

// The handler ignores its RequestEvent, so an empty stand-in keeps the test
// focused on the probe's two outcomes.
const invoke = async () => {
	const { GET } = await import('./+server');
	return GET({} as Parameters<typeof GET>[0]);
};

describe('GET /api/health', () => {
	beforeEach(() => {
		run.mockReset();
	});

	it('reports ok when the database answers', async () => {
		run.mockResolvedValue({ rows: [{ 1: 1 }] });

		const response = await invoke();

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({ status: 'ok', db: 'ok' });
		expect(run).toHaveBeenCalledWith('SELECT 1');
	});

	it('reports 503 when the database is unreachable', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		run.mockRejectedValue(new Error('connection refused'));

		const response = await invoke();

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toMatchObject({ status: 'degraded', db: 'error' });
	});

	it('keeps database detail out of the response body', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		run.mockRejectedValue(new Error('libsql://secret-host.turso.io unreachable'));

		const body = await (await invoke()).text();

		expect(body).not.toContain('secret-host');
	});
});
