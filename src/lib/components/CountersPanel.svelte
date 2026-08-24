<script lang="ts">
	import { resolve } from '$app/paths';
	import StatCell from '$lib/components/StatCell.svelte';
	import { EMPTY, formatClockTime, formatRelativeTime } from '$lib/status-format';

	type Counter = { id: number; name: string; value: number; createdAt: string; updatedAt: string };
	type Meta = { count: number; totalCount: number; totalValue: number; generatedAt: string };

	const POLL_MS = 5000;

	let counters = $state<Counter[]>([]);
	let meta = $state<Meta | null>(null);
	let error = $state('');
	let loaded = $state(false);

	// One clock for the whole table, refreshed with the data, so every row's
	// "5m ago" is measured from the same instant.
	let now = $state(new Date());

	const heading = $derived(
		!loaded ? EMPTY : counters.length === 1 ? '1 counter' : `${counters.length} counters`
	);

	// Once a load has succeeded, a later failure keeps the last known rows on screen
	// with the alert below them — stale numbers beat an empty panel. Only a first
	// load that never arrived replaces the table outright, so nothing claims to be
	// loading while the alert says it failed.
	const phase = $derived(
		loaded ? (counters.length === 0 ? 'empty' : 'table') : error ? 'failed' : 'loading'
	);

	$effect(() => {
		void load();
		const timer = setInterval(load, POLL_MS);
		return () => clearInterval(timer);
	});

	async function load() {
		try {
			const response = await fetch(resolve('/api/counters'));
			const body = await response.json();

			if (!response.ok) {
				throw new Error(body?.error?.message ?? 'Could not load the counters');
			}

			counters = body.data;
			meta = body.meta;
			now = new Date();
			loaded = true;
			error = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Could not reach the counters endpoint';
		}
	}
</script>

<section
	class="border-4 border-black bg-[#fffdfa] shadow-[8px_8px_0_#171717]"
	aria-labelledby="counters-title"
>
	<div
		class="flex items-center justify-between gap-4 border-b-4 border-black bg-[#e60012] px-5 py-3 text-white sm:px-8"
	>
		<p class="text-xs font-black tracking-[0.25em] uppercase">カウンター一覧</p>
		<p class="text-xs font-bold uppercase">{heading}</p>
	</div>

	<div class="px-5 py-6 sm:px-8 sm:py-8">
		<h2 id="counters-title" class="text-sm font-black tracking-[0.2em] uppercase">Counters</h2>

		{#if phase === 'empty'}
			<p class="mt-6 border-4 border-dashed border-black/30 px-4 py-8 text-center">
				<span class="block text-sm font-black tracking-[0.2em] uppercase">No counters yet</span>
				<span class="mt-2 block text-xs font-bold text-[#171717]/55">
					カウンターがありません — 作成すると、ここに表示されます。
				</span>
			</p>
		{:else if phase === 'failed'}
			<p class="mt-6 border-4 border-dashed border-[#e60012]/40 px-4 py-8 text-center">
				<span class="block text-sm font-black tracking-[0.2em] text-[#e60012] uppercase">
					Counters unavailable
				</span>
				<span class="mt-2 block text-xs font-bold text-[#171717]/55">
					一覧を取得できませんでした — 5秒ごとに再試行します。
				</span>
			</p>
		{:else}
			<div class="mt-4 overflow-x-auto">
				<table class="w-full min-w-[26rem] text-left">
					<thead>
						<tr class="border-b-4 border-black">
							<th scope="col" class="py-2 pr-3 text-[0.6rem] font-black tracking-[0.2em] uppercase"
								>ID</th
							>
							<th scope="col" class="py-2 pr-3 text-[0.6rem] font-black tracking-[0.2em] uppercase"
								>Name</th
							>
							<th
								scope="col"
								class="py-2 pr-3 text-right text-[0.6rem] font-black tracking-[0.2em] uppercase"
								>Value</th
							>
							<th
								scope="col"
								class="py-2 text-right text-[0.6rem] font-black tracking-[0.2em] uppercase"
								>Updated</th
							>
						</tr>
					</thead>
					<tbody>
						{#each counters as counter (counter.id)}
							<tr class="border-b-2 border-black/15">
								<td class="py-3 pr-3 text-sm font-bold tabular-nums">{counter.id}</td>
								<td class="py-3 pr-3 text-sm font-black">{counter.name}</td>
								<td class="py-3 pr-3 text-right text-xl font-black text-[#e60012] tabular-nums">
									{counter.value}
								</td>
								<td class="py-3 text-right text-xs font-bold text-[#171717]/70">
									{formatRelativeTime(counter.updatedAt, now)}
								</td>
							</tr>
						{:else}
							<tr>
								<td colspan="4" class="py-6 text-center text-sm font-bold text-[#171717]/55">
									Loading…
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<dl class="mt-6 grid grid-cols-3 gap-1 border-4 border-black bg-black">
			<StatCell label="Shown" jp="表示" value={meta ? String(meta.count) : EMPTY} />
			<StatCell label="Total" jp="合計" value={meta ? String(meta.totalCount) : EMPTY} />
			<StatCell label="Sum" jp="総和" value={meta ? String(meta.totalValue) : EMPTY} accent />
		</dl>

		<div class="mt-5 flex flex-wrap items-center justify-between gap-3">
			<p class="text-[0.65rem] font-bold tracking-[0.2em] text-[#171717]/55 uppercase">
				Generated {formatClockTime(meta?.generatedAt)}
			</p>
			<a
				class="border-b-2 border-black text-[0.65rem] font-black tracking-[0.2em] uppercase transition hover:border-[#e60012] hover:text-[#e60012]"
				href={resolve('/api/counters')}
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
