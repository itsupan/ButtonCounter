/**
 * Presentation helpers for the status page.
 *
 * These live apart from the components because they are the part that can
 * actually be wrong — off-by-one padding, a negative uptime, an unparseable
 * timestamp — and the repo's Vitest setup only runs plain modules. The components
 * stay thin enough to check by looking at them.
 *
 * Client-safe on purpose: not under `lib/server/`, since the panels import it.
 */

/** Shown wherever the API reports no value. An em dash, not an empty cell. */
export const EMPTY = '—';

const SECOND = 1000;
const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function isUsableNumber(value: number | null | undefined): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseDate(iso: string | null | undefined): Date | undefined {
	if (!iso) return undefined;

	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Replaces a null, undefined, or blank string with the placeholder. */
export function orDash(value: string | null | undefined): string {
	return value && value.trim() !== '' ? value : EMPTY;
}

/**
 * Database probe timing. Past a second the millisecond count stops being
 * scannable, so it switches unit rather than showing four digits.
 */
export function formatLatency(ms: number | null | undefined): string {
	if (!isUsableNumber(ms)) return EMPTY;
	if (ms < SECOND) return `${Math.round(ms)} ms`;

	return `${(ms / SECOND).toFixed(1)} s`;
}

/**
 * Instance age, in the largest two units that apply. Seconds are zero-padded once
 * minutes appear so the value does not change width as it ticks.
 */
export function formatUptime(seconds: number | null | undefined): string {
	if (!isUsableNumber(seconds)) return EMPTY;

	const whole = Math.floor(seconds);

	if (whole < MINUTE) return `${whole}s`;

	if (whole < HOUR) {
		const minutes = Math.floor(whole / MINUTE);
		return `${minutes}m ${String(whole % MINUTE).padStart(2, '0')}s`;
	}

	if (whole < DAY) {
		const hours = Math.floor(whole / HOUR);
		return `${hours}h ${String(Math.floor((whole % HOUR) / MINUTE)).padStart(2, '0')}m`;
	}

	const days = Math.floor(whole / DAY);
	return `${days}d ${String(Math.floor((whole % DAY) / HOUR)).padStart(2, '0')}h`;
}

/** Shortens a deployment SHA to the seven characters people actually quote. */
export function formatCommit(sha: string | null | undefined): string {
	return sha ? sha.slice(0, 7) : EMPTY;
}

/**
 * How long ago something happened, at one unit of precision.
 *
 * `now` is a parameter rather than a call to `Date.now()` so the behaviour is
 * testable and so a polling component can render a whole table against one clock.
 */
export function formatRelativeTime(iso: string | null | undefined, now: Date): string {
	const then = parseDate(iso);
	if (!then) return EMPTY;

	const elapsed = Math.floor((now.getTime() - then.getTime()) / SECOND);

	// A server clock slightly ahead of the browser's would otherwise read as
	// negative time.
	if (elapsed < 5) return 'just now';
	if (elapsed < MINUTE) return `${elapsed}s ago`;
	if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;
	if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h ago`;

	return `${Math.floor(elapsed / DAY)}d ago`;
}

/** Wall-clock time in the viewer's own timezone, 24-hour and zero-padded. */
export function formatClockTime(iso: string | null | undefined): string {
	const date = parseDate(iso);
	if (!date) return EMPTY;

	return date.toLocaleTimeString(undefined, {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}
