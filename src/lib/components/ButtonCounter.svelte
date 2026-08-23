<script lang="ts">
	type Counter = { id: number; name: string; value: number };

	// Poll for updates from other clients.
	const POLL_MS = 2000;

	let counter = $state<Counter | null>(null);
	let error = $state('');

	// Track optimistic updates until the server confirms them.
	let unconfirmed = $state(0);

	const value = $derived(counter ? counter.value + unconfirmed : null);

	$effect(() => {
		void start();
	});

	$effect(() => {
		const timer = setInterval(refresh, POLL_MS);
		return () => clearInterval(timer);
	});

	// Return API data or throw its error message.
	async function send(path: string, init?: RequestInit): Promise<Counter> {
		const response = await fetch(path, init);
		const body = await response.json();

		if (!response.ok) {
			throw new Error(body?.error?.message ?? 'Request failed');
		}

		return body.data;
	}

	// Use the first counter or create a default one.
	async function start() {
		try {
			const response = await fetch('/api/counters');
			const body = await response.json();

			if (!response.ok) {
				throw new Error(body?.error?.message ?? 'Could not load the counter');
			}

			counter =
				body.data[0] ??
				(await send('/api/counters', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ name: 'Clicks' })
				}));
		} catch (cause) {
			error = describe(cause);
		}
	}

	async function refresh() {
		// Do not overwrite an optimistic update with stale data.
		if (!counter || unconfirmed !== 0) return;

		try {
			counter = await send(`/api/counters/${counter.id}`);
		} catch {
			// Retry on the next poll.
		}
	}

	// Update immediately, then sync with the server response.
	async function change(delta: number, path: string, init: RequestInit) {
		unconfirmed += delta;
		error = '';

		try {
			counter = await send(path, init);
		} catch (cause) {
			error = describe(cause);
		} finally {
			unconfirmed -= delta;
		}
	}

	function describe(cause: unknown) {
		return cause instanceof Error ? cause.message : 'Something went wrong';
	}

	function increment() {
		if (counter) change(1, `/api/counters/${counter.id}/increment`, { method: 'POST' });
	}

	function decrement() {
		if (counter) change(-1, `/api/counters/${counter.id}/decrement`, { method: 'POST' });
	}

	function reset() {
		// Move the displayed value to zero immediately.
		if (counter && value !== null) {
			change(-value, `/api/counters/${counter.id}`, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ value: 0 })
			});
		}
	}
</script>

<section
	class="relative border-4 border-black bg-[#fffdfa] shadow-[8px_8px_0_#171717]"
	aria-labelledby="counter-title"
>
	<div
		class="flex items-center justify-between gap-4 border-b-4 border-black bg-[#e60012] px-5 py-3 text-white sm:px-8"
	>
		<p class="text-xs font-black tracking-[0.25em] uppercase">現在のカウント</p>
		<p class="text-xs font-bold uppercase">Live / 2s</p>
	</div>

	<div class="flex flex-col items-center px-5 py-6 sm:px-10 sm:py-8">
		<h2 id="counter-title" class="text-sm font-black tracking-[0.2em] uppercase">
			{counter?.name ?? 'Loading'}
		</h2>

		<p
			class="my-5 w-full border-y-4 border-black py-3 text-center text-[clamp(5rem,22vw,10rem)] leading-none font-black text-[#e60012] tabular-nums sm:my-6 sm:py-4"
			aria-live="polite"
			aria-busy={unconfirmed !== 0}
		>
			{value ?? '—'}
		</p>

		<div class="grid w-full max-w-xl grid-cols-2 gap-4 sm:gap-6">
			<button
				class="cursor-pointer border-4 border-black bg-[#fffdfa] px-4 py-3 text-2xl font-black shadow-[5px_5px_0_#171717] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0_#171717] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
				onclick={decrement}
				disabled={!counter}
				aria-label="Subtract one"
			>
				<span aria-hidden="true">−</span>
				<span class="mt-1 block text-[0.65rem] tracking-[0.2em] uppercase">減らす</span>
			</button>
			<button
				class="cursor-pointer border-4 border-black bg-[#e60012] px-4 py-3 text-2xl font-black text-white shadow-[5px_5px_0_#171717] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-[#c90010] hover:shadow-[3px_3px_0_#171717] active:translate-x-[5px] active:translate-y-[5px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
				onclick={increment}
				disabled={!counter}
				aria-label="Add one"
			>
				<span aria-hidden="true">+</span>
				<span class="mt-1 block text-[0.65rem] tracking-[0.2em] uppercase">増やす</span>
			</button>
		</div>

		<button
			class="mt-5 cursor-pointer border-b-2 border-black text-xs font-black tracking-[0.2em] uppercase transition hover:border-[#e60012] hover:text-[#e60012]"
			class:invisible={!value}
			onclick={reset}
			disabled={!value}
			aria-hidden={!value}>Reset / リセット</button
		>

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
