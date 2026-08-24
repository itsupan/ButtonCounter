import { describe, expect, it } from 'vitest';
import {
	EMPTY,
	formatClockTime,
	formatCommit,
	formatLatency,
	formatRelativeTime,
	formatUptime,
	orDash
} from './status-format';

describe('formatLatency', () => {
	it('reports sub-second timings in milliseconds', () => {
		expect(formatLatency(0)).toBe('0 ms');
		expect(formatLatency(792)).toBe('792 ms');
		expect(formatLatency(999)).toBe('999 ms');
	});

	it('switches to seconds once a probe passes one second', () => {
		// Four digits of milliseconds is harder to read at a glance than '1.2 s'.
		expect(formatLatency(1000)).toBe('1.0 s');
		expect(formatLatency(1234)).toBe('1.2 s');
		expect(formatLatency(12500)).toBe('12.5 s');
	});

	it('rounds fractional milliseconds', () => {
		expect(formatLatency(41.6)).toBe('42 ms');
	});

	it('falls back for missing or nonsensical values', () => {
		expect(formatLatency(null)).toBe(EMPTY);
		expect(formatLatency(undefined)).toBe(EMPTY);
		expect(formatLatency(-1)).toBe(EMPTY);
		expect(formatLatency(Number.NaN)).toBe(EMPTY);
	});
});

describe('formatUptime', () => {
	it('shows plain seconds under a minute', () => {
		expect(formatUptime(0)).toBe('0s');
		expect(formatUptime(45)).toBe('45s');
	});

	it('pads seconds once minutes appear so the width stays stable', () => {
		expect(formatUptime(63)).toBe('1m 03s');
		expect(formatUptime(599)).toBe('9m 59s');
	});

	it('drops to hours and minutes past an hour', () => {
		expect(formatUptime(3600)).toBe('1h 00m');
		expect(formatUptime(3725)).toBe('1h 02m');
	});

	it('drops to days and hours past a day', () => {
		expect(formatUptime(86400)).toBe('1d 00h');
		expect(formatUptime(90000)).toBe('1d 01h');
	});

	it('falls back for missing or nonsensical values', () => {
		expect(formatUptime(null)).toBe(EMPTY);
		expect(formatUptime(-5)).toBe(EMPTY);
		expect(formatUptime(Number.NaN)).toBe(EMPTY);
	});
});

describe('formatCommit', () => {
	it('shortens a full SHA to the usual seven characters', () => {
		expect(formatCommit('a9dd154e8f2b1c3d4e5f6a7b8c9d0e1f2a3b4c5d')).toBe('a9dd154');
	});

	it('leaves an already-short SHA alone', () => {
		expect(formatCommit('a9dd154')).toBe('a9dd154');
	});

	it('falls back when the deployment reports no commit', () => {
		// Local development has no VERCEL_GIT_COMMIT_SHA.
		expect(formatCommit(null)).toBe(EMPTY);
		expect(formatCommit('')).toBe(EMPTY);
	});
});

describe('formatRelativeTime', () => {
	const now = new Date('2026-08-24T12:00:00.000Z');
	const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

	it('calls the last few seconds "just now"', () => {
		expect(formatRelativeTime(ago(0), now)).toBe('just now');
		expect(formatRelativeTime(ago(4000), now)).toBe('just now');
	});

	it('counts seconds, then minutes, then hours, then days', () => {
		expect(formatRelativeTime(ago(12_000), now)).toBe('12s ago');
		expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('5m ago');
		expect(formatRelativeTime(ago(3 * 3_600_000), now)).toBe('3h ago');
		expect(formatRelativeTime(ago(2 * 86_400_000), now)).toBe('2d ago');
	});

	it('treats a future timestamp as "just now" rather than negative time', () => {
		// The server clock can sit slightly ahead of the browser's.
		expect(formatRelativeTime(new Date(now.getTime() + 30_000).toISOString(), now)).toBe(
			'just now'
		);
	});

	it('falls back on missing or unparseable input', () => {
		expect(formatRelativeTime(null, now)).toBe(EMPTY);
		expect(formatRelativeTime('not a date', now)).toBe(EMPTY);
	});
});

describe('formatClockTime', () => {
	it('renders a zero-padded 24-hour clock', () => {
		expect(formatClockTime('2026-08-24T03:25:11.012Z')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
	});

	it('falls back on missing or unparseable input', () => {
		expect(formatClockTime(null)).toBe(EMPTY);
		expect(formatClockTime('nope')).toBe(EMPTY);
	});
});

describe('orDash', () => {
	it('passes through a real value', () => {
		expect(orDash('production')).toBe('production');
	});

	it('replaces the values the API reports as absent', () => {
		expect(orDash(null)).toBe(EMPTY);
		expect(orDash(undefined)).toBe(EMPTY);
		expect(orDash('')).toBe(EMPTY);
		expect(orDash('   ')).toBe(EMPTY);
	});
});
