import { beforeEach, describe, expect, it, vi } from 'vitest';

const run = vi.fn();

vi.mock('$lib/server/db', () => ({
	getDb: () => ({ run })
}));

// The handler ignores its RequestEvent, so an empty stand-in keeps the test
// focused on the probe's two outcomes.
const invoke = async () => {
	const { GET } = await import('../../../../../src/routes/api/health/+server');
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

	it('times the database probe', async () => {
		run.mockResolvedValue({ rows: [{ 1: 1 }] });

		const body = await (await invoke()).json();

		expect(body.checks.db.status).toBe('ok');
		expect(typeof body.checks.db.latencyMs).toBe('number');
		expect(body.checks.db.latencyMs).toBeGreaterThanOrEqual(0);
	});

	it('still times the probe when it fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		run.mockRejectedValue(new Error('connection refused'));

		const body = await (await invoke()).json();

		expect(body.checks.db.status).toBe('error');
		expect(body.checks.db.latencyMs).toBeGreaterThanOrEqual(0);
	});

	it('identifies the running deployment', async () => {
		run.mockResolvedValue({ rows: [{ 1: 1 }] });

		const body = await (await invoke()).json();

		expect(body.build).toMatchObject({
			version: expect.stringMatching(/^\d+\.\d+\.\d+/),
			environment: expect.any(String)
		});
		expect(body.build).toHaveProperty('commit');
		expect(body.build).toHaveProperty('region');
		expect(typeof body.uptimeSeconds).toBe('number');
	});

	it('still identifies the deployment when degraded', async () => {
		// Deploy identity matters most during an incident, so the 503 body must
		// carry it too.
		vi.spyOn(console, 'error').mockImplementation(() => {});
		run.mockRejectedValue(new Error('connection refused'));

		const body = await (await invoke()).json();

		expect(body.build.version).toMatch(/^\d+\.\d+\.\d+/);
		expect(typeof body.uptimeSeconds).toBe('number');
	});

	it('forbids caching on both outcomes', async () => {
		// A cached 200 would let the uptime probe pass during a real outage.
		vi.spyOn(console, 'error').mockImplementation(() => {});

		run.mockResolvedValue({ rows: [{ 1: 1 }] });
		expect((await invoke()).headers.get('cache-control')).toBe('no-store');

		run.mockRejectedValue(new Error('connection refused'));
		expect((await invoke()).headers.get('cache-control')).toBe('no-store');
	});

	it('keeps database detail out of the response body', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		run.mockRejectedValue(new Error('libsql://secret-host.turso.io unreachable'));

		const body = await (await invoke()).text();

		expect(body).not.toContain('secret-host');
	});
});
