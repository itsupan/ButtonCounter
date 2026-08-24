<script lang="ts">
	// One labelled figure inside a stat grid. The grid supplies the black rules by
	// showing its own background through a 4px gap, so the cell itself is just a
	// filled block — no borders of its own to line up.
	let {
		label,
		jp,
		value,
		accent = false
	}: { label: string; jp: string; value: string; accent?: boolean } = $props();
</script>

<div class="bg-[#fffdfa] px-4 py-3">
	<dt class="text-[0.6rem] font-black tracking-[0.2em] text-[#171717]/55 uppercase">
		{label} / {jp}
	</dt>
	<dd class="mt-1 truncate text-lg font-black tabular-nums {accent ? 'text-[#e60012]' : ''}">
		{value}
	</dd>
</div>
