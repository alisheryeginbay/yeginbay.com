<!-- Puts every shared value back how the post set it. Shown only once the
     reader has changed something. -->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";
  import { isDefault, reset } from "../store.svelte.ts";

  let { names }: { names: string[] } = $props();

  const changed = $derived(names.filter((n) => !isDefault(n)));
</script>

{#if changed.length}
  <button
    type="button"
    onclick={() => changed.forEach(reset)}
    transition:fade={{ duration: prefersReducedMotion.current ? 0 : 150 }}
  >Reset figures</button>
{/if}

<style>
  button {
    position: fixed;
    right: 1.25rem;
    bottom: 1.25rem;
    z-index: 20;
    font: inherit;
    font-size: 0.8rem;
    color: var(--muted);
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: 999px;
    padding: 0.3rem 0.85rem;
    cursor: pointer;
  }

  button:hover { color: var(--fg); }
</style>
