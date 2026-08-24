<script lang="ts">
	import { resolve } from '$app/paths';
	import StatCell from '$lib/components/StatCell.svelte';
	import {
		EMPTY,
		formatClockTime,
		formatCommit,
		formatLatency,
		formatUptime,
		orDash
	} from '$lib/status-format';

	type Health = {
		status: string;
		timestamp: string;
		checks: { db: { status: string; latencyMs: number } };
		uptimeSeconds: number;
		build: { version: string; commit: string | null; environment: string; region: string | null };
	};

	const POLL_MS = 5000;

	let health = $state<Health | null>(null);
	let error = $state('');

	const ok = $derived(health?.status === 'ok');
	const label = $derived(!health ? EMPTY : ok ? 'OK' : 'Degraded');
	const labelJp = $derived(!health ? '接続中' : ok ? '正常' : '異常');

	// Escalate by inverting the block rather than introducing a colour: red is
	// already the brand accent, so a red word would not read as an alarm.
	const heroClass = $derived(
		!health || ok ? 'bg-[#fffdfa] text-[#e60012]' : 'bg-[#e60012] text-white'
	);

	$effect(() => {
		void load();
		const timer = setInterval(load, POLL_MS);
		return () => clearInterval(timer);
	});

	async function load() {
		try {
			const response = await fetch(resolve('/api/health'));
			const body = await response.json();

			// A 503 is the degraded state, not a failed request: that response still
			// carries a complete body, and it is the one most worth displaying. Only
			// an unreachable endpoint or an unrecognisable body counts as an error.
			if (!body || typeof body.status !== 'string') {
				throw new Error('The health endpoint returned an unexpected response');
			}

			health = body;
			error = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not reach the health endpoint';
		}
	}
</script>

<section
	class="border-4 border-black bg-[#fffdfa] shadow-[8px_8px_0_#171717]"
	aria-labelledby="health-title"
>
	<div
		class="flex items-center justify-between gap-4 border-b-4 border-black bg-[#e60012] px-5 py-3 text-white sm:px-8"
	>
		<p class="text-xs font-black tracking-[0.25em] uppercase">システム状態</p>
		<p class="text-xs font-bold uppercase">Live / 5s</p>
	</div>

	<div class="px-5 py-6 sm:px-8 sm:py-8">
		<h2 id="health-title" class="text-sm font-black tracking-[0.2em] uppercase">System status</h2>

		<div
			class="mt-4 flex flex-col gap-4 border-b-4 border-black pb-6 sm:flex-row sm:items-center sm:justify-between"
		>
			<p
				class="inline-flex flex-col self-start border-4 border-black px-5 py-2 leading-none {heroClass}"
				aria-live="polite"
			>
				<span class="text-[clamp(2.25rem,9vw,3.75rem)] font-black tracking-tight uppercase">
					{label}
				</span>
				<span class="mt-2 text-[0.65rem] font-black tracking-[0.3em]">{labelJp}</span>
			</p>

			<p class="text-left sm:text-right">
				<span class="block text-[0.6rem] font-black tracking-[0.2em] text-[#171717]/55 uppercase">
					Database probe / 応答
				</span>
				<span class="block text-3xl font-black tabular-nums">
					{formatLatency(health?.checks?.db?.latencyMs)}
				</span>
			</p>
		</div>

		<dl class="mt-6 grid grid-cols-2 gap-1 border-4 border-black bg-black sm:grid-cols-3">
			<StatCell label="Uptime" jp="稼働" value={formatUptime(health?.uptimeSeconds)} />
			<StatCell label="Version" jp="版" value={orDash(health?.build?.version)} />
			<StatCell label="Environment" jp="環境" value={orDash(health?.build?.environment)} />
			<StatCell label="Commit" jp="コミット" value={formatCommit(health?.build?.commit)} />
			<StatCell label="Region" jp="地域" value={orDash(health?.build?.region)} />
			<StatCell
				label="Database"
				jp="データベース"
				value={orDash(health?.checks?.db?.status)}
				accent={!!health && !ok}
			/>
		</dl>

		<div class="mt-5 flex flex-wrap items-center justify-between gap-3">
			<p class="text-[0.65rem] font-bold tracking-[0.2em] text-[#171717]/55 uppercase">
				Checked {formatClockTime(health?.timestamp)}
			</p>
			<a
				class="border-b-2 border-black text-[0.65rem] font-black tracking-[0.2em] uppercase transition hover:border-[#e60012] hover:text-[#e60012]"
				href={resolve('/api/health')}
			>
				Raw JSON
			</a>
		</div>

		{#if error}
			<p
				class="mt-5 border-2 border-[#e60012] px-4 py-2 text-sm font-bold text-[#e60012]"
				role="alert"
			>
				{error}
			</p>
		{/if}
	</div>
</section>
