<script lang="ts">
	import { resolve } from '$app/paths';
	import ButtonCounter from '$lib/components/ButtonCounter.svelte';
</script>

<svelte:head>
	<title>Button Counter | ボタンカウンター</title>
	<meta
		name="description"
		content="A shared real-time button counter with a Japanese-inspired interface."
	/>
</svelte:head>

<div
	class="flex min-h-dvh flex-col bg-[#f4f0e8] bg-[url(/seigaiha.svg)] bg-[length:120px_60px] font-mono text-[#171717]"
>
	<header class="shrink-0 border-y-4 border-black bg-[#fffdfa]">
		<nav class="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3 sm:px-8">
			<a
				href="#top"
				class="flex items-center gap-3 border-4 border-black px-3 py-2 text-lg font-black tracking-tight uppercase transition hover:bg-[#e60012] hover:text-white sm:text-2xl"
			>
				<span class="size-4 shrink-0 rounded-full bg-[#e60012]"></span>
				CAM<span class="hidden sm:inline">/JP</span>
			</a>

			<div class="flex items-center gap-4 text-sm font-bold sm:gap-8 sm:text-base">
				<a class="underline-offset-4 hover:text-[#e60012] hover:underline" href="#counter">
					Counter
				</a>
				<a
					class="hidden underline-offset-4 hover:text-[#e60012] hover:underline sm:inline"
					href={resolve('/api/counters')}>API</a
				>
				<a
					class="border-2 border-black bg-[#e60012] px-3 py-2 text-white shadow-[3px_3px_0_#171717] transition hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#171717]"
					href={resolve('/api/health')}>Status</a
				>
			</div>
		</nav>
	</header>

	<main id="top" class="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-6 sm:px-8">
		<div id="counter" class="w-full scroll-mt-8">
			<ButtonCounter />
		</div>
	</main>

	<footer class="shrink-0 border-t-4 border-black bg-[#e60012] text-white">
		<div
			class="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-3 text-xs font-bold sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:text-sm"
		>
			<p>BUTTON COUNTER © 2026</p>
			<p>クリックして、数字を共有。</p>
		</div>
	</footer>
</div>
