<!-- A line under a figure saying what it shows. -->
<script lang="ts">
  import type { Snippet } from "svelte";

  let { children }: { children: Snippet } = $props();
</script>

<p>{@render children()}</p>

<style>
  p {
    margin: 0.5rem 0 0;
    color: var(--muted);
    font-size: 0.85rem;
  }
</style>
