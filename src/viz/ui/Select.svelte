<!-- A dropdown, hidden when there's nothing to choose. -->
<script lang="ts">
  export interface Option {
    value: string;
    label: string;
  }

  let { label, value = $bindable(), options }: { label: string; value: string; options: Option[] } = $props();
</script>

{#if options.length > 1}
  <select aria-label={label} bind:value>
    {#each options as o (o.value)}
      <option value={o.value}>{o.label}</option>
    {/each}
  </select>
{/if}

<style>
  select {
    font: inherit;
    font-size: 0.85rem;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 0.2rem 0.4rem;
  }
</style>
