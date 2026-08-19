<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>ButtonCounter</title>
	<meta name="description" content="ButtonCounter" />
</svelte:head>

<h1>Hello world</h1>
<p>ButtonCounter is deployed. Counter features are still to come.</p>
<p><a href={resolve('/api/health')}>Health check</a></p>
