<!-- A button among a figure's controls, matching Select. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { children, onclick, disabled = false }: { children: Snippet; onclick: () => void; disabled?: boolean } = $props();
</script>

<button type="button" {onclick} {disabled}>{@render children()}</button>

<style>
  button {
    font: inherit;
    font-size: 0.85rem;
    background: var(--bg);
    color: var(--fg);
    border: 1px solid var(--rule);
    border-radius: 4px;
    padding: 0.2rem 0.6rem;
    cursor: pointer;
  }

  button:hover:not(:disabled) { border-color: var(--muted); }

  button:disabled {
    color: var(--muted);
    cursor: default;
  }
</style>
