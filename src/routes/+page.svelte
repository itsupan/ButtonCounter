<script lang="ts">
	import ButtonCounter from '$lib/components/ButtonCounter.svelte';
</script>

<svelte:head>
	<title>Button Counter | ボタンカウンター</title>
	<meta
		name="description"
		content="A shared real-time button counter with a Japanese-inspired interface."
	/>
</svelte:head>

<main id="top" class="mx-auto flex w-full max-w-6xl flex-1 items-center px-5 py-6 sm:px-8">
	<div id="counter" class="w-full scroll-mt-8">
		<ButtonCounter />
	</div>
</main>
