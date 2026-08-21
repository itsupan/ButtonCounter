<script lang="ts">
	let count = $state(0);

	function increment() {
		count += 1;
	}

	function decrement() {
		count -= 1;
	}

	function reset() {
		count = 0;
	}
</script>

<div>
	<div>
		<h2>Interactive Counter</h2>
		<p>Built with Svelte 5 Runes</p>
	</div>

	<div>
		<span>
			{count}
		</span>
	</div>

	<div>
		<button onclick={decrement} aria-label="Decrease counter"> - </button>

		<button onclick={increment} aria-label="Increase counter"> + </button>
	</div>

	{#if count !== 0}
		<div>
			<button onclick={reset}>Reset Counter</button>
		</div>
	{/if}
</div>
