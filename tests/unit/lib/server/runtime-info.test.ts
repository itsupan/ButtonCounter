import { beforeEach, describe, expect, it, vi } from 'vitest';

// getBuildInfo() reads `$env/dynamic/private` on every call, so a mutable stand-in
// lets each test set the Vercel system variables it cares about. `vi.hoisted` is
// required because the `vi.mock` factory below is lifted above normal declarations.
const env = vi.hoisted(() => ({}) as Record<string, string | undefined>);

vi.mock('$env/dynamic/private', () => ({ env }));

import { getBuildInfo, getUptimeSeconds } from '$lib/server/runtime-info';

describe('getBuildInfo', () => {
	beforeEach(() => {
		// Cleared to undefined rather than deleted — an absent variable and an
		// unset one reach getBuildInfo() identically.
		for (const key of Object.keys(env)) {
			env[key] = undefined;
		}
	});

	it('reports the package version', () => {
		expect(getBuildInfo().version).toMatch(/^\d+\.\d+\.\d+/);
	});

	it('reports the Vercel deployment identity when it is present', () => {
		env.VERCEL_GIT_COMMIT_SHA = 'a9dd154';
		env.VERCEL_ENV = 'production';
		env.VERCEL_REGION = 'hnd1';

		expect(getBuildInfo()).toMatchObject({
			commit: 'a9dd154',
			environment: 'production',
			region: 'hnd1'
		});
	});

	it('falls back to development when the Vercel variables are absent', () => {
		expect(getBuildInfo()).toMatchObject({
			commit: null,
			environment: 'development',
			region: null
		});
	});

	it('treats an empty variable as absent', () => {
		// Vercel supplies '' rather than unsetting the variable in some contexts,
		// and an empty string in the response body would read as a real value.
		env.VERCEL_GIT_COMMIT_SHA = '';
		env.VERCEL_REGION = '';

		expect(getBuildInfo()).toMatchObject({ commit: null, region: null });
	});
});

describe('getUptimeSeconds', () => {
	it('reports a non-negative whole number of seconds', () => {
		const uptime = getUptimeSeconds();

		expect(Number.isInteger(uptime)).toBe(true);
		expect(uptime).toBeGreaterThanOrEqual(0);
	});

	it('grows as time passes', () => {
		vi.useFakeTimers();
		try {
			const before = getUptimeSeconds();
			vi.advanceTimersByTime(5000);

			expect(getUptimeSeconds()).toBe(before + 5);
		} finally {
			vi.useRealTimers();
		}
	});
});
