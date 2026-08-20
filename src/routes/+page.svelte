<script lang="ts">
	import { resolve } from '$app/paths';
	import ButtonCounter from '$lib/components/ButtonCounter.svelte';
</script>

<svelte:head>
	<title>ButtonCounter - Interactive App</title>
	<meta
		name="description"
		content="A beautiful and interactive button counter built with Svelte 5."
	/>
</svelte:head>

<main>
	<div>
		<h1>Button Counter App</h1>
		<p>Experience the speed of Svelte 5 Runes.</p>
	</div>

	<ButtonCounter />

	<div>
		<a href={resolve('/api/health')}>System Health Check</a>
	</div>
</main>
