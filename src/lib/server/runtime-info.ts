import { env } from '$env/dynamic/private';
import { version } from '../../../package.json';

export type BuildInfo = {
	version: string;
	commit: string | null;
	environment: string;
	region: string | null;
};

// Captured the first time this module is loaded. On Vercel that is the start of a
// serverless instance rather than of a long-lived process, so this measures
// instance age: consistently small values across requests mean cold starts.
const bootedAt = Date.now();

export function getUptimeSeconds(): number {
	return Math.floor((Date.now() - bootedAt) / 1000);
}

/**
 * Identifies the running deployment for the health endpoint.
 *
 * The `VERCEL_*` variables are system-provided in production and simply absent
 * locally, so every one of them falls back rather than throwing — an unknown
 * region must not be able to fail a health check. Empty strings are normalised to
 * `null` because Vercel supplies those in some contexts and `""` in the response
 * body would read as a real value.
 */
export function getBuildInfo(): BuildInfo {
	return {
		version,
		commit: env.VERCEL_GIT_COMMIT_SHA || null,
		environment: env.VERCEL_ENV || 'development',
		region: env.VERCEL_REGION || null
	};
}
