<script lang="ts">
	import CountersPanel from '$lib/components/CountersPanel.svelte';
	import HealthPanel from '$lib/components/HealthPanel.svelte';
</script>

<svelte:head>
	<title>Status | ステータス</title>
	<meta
		name="description"
		content="Live database health and counter totals for the shared button counter."
	/>
</svelte:head>

<main id="top" class="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
	<h1 class="text-2xl font-black tracking-tight uppercase sm:text-3xl">
		Status<span class="ml-3 text-base text-[#171717]/55 sm:text-lg">ステータス</span>
	</h1>
	<p class="mt-2 max-w-2xl text-xs font-bold text-[#171717]/70 sm:text-sm">
		Both panels read the public API directly and refresh every five seconds.
	</p>

	<div class="mt-8 flex flex-col gap-10 sm:gap-12">
		<div id="health" class="scroll-mt-8">
			<HealthPanel />
		</div>
		<div id="counters" class="scroll-mt-8">
			<CountersPanel />
		</div>
	</div>
</main>
