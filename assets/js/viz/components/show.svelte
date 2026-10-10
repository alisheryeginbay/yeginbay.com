<!--
  A shared value, inline in the prose (see layouts/shortcodes/show.html).
  Numbers ease to their new value, and the value flashes when it changes.

    path      a value's name, then keys into it: "qk.France.Paris"
    format    how to write a number: ".2f", ".1%", or empty
    fallback  what to say until there's a value
-->
<script lang="ts">
  import { Tween, prefersReducedMotion } from "svelte/motion";
  import { pointing, read } from "../store.svelte.ts";
  import { format as formatValue } from "../ui/format.ts";

  let { path, format, fallback = "…" }: { path: string; format?: string; fallback?: string } = $props();

  const value = $derived(read(path));
  const root = $derived(path.split(".")[0]);

  const tween = Tween.of(() => (typeof value === "number" ? value : 0), {
    duration: prefersReducedMotion.current ? 0 : 300,
  });

  // Counts changes, not counting the value first arriving.
  let changes = $state(0);
  let previous: unknown;
  $effect(() => {
    if (previous !== undefined && value !== previous) changes++;
    previous = value;
  });

  const text = $derived(
    value === undefined ? fallback : typeof value === "number" ? formatValue(tween.current, format) : formatValue(value),
  );
</script>

{#key changes}
  <span class:flash={changes > 0} class:linked={pointing.names.includes(root)}>{text}</span>
{/key}

<style>
  span {
    font-variant-numeric: tabular-nums;
    border-radius: 3px;
    transition: background-color 150ms;
  }

  .linked { background: color-mix(in srgb, var(--highlight) 35%, transparent); }

  .flash { animation: flash 900ms ease-out; }

  @keyframes flash {
    from { background: color-mix(in srgb, var(--highlight) 60%, transparent); }
  }

  @media (prefers-reduced-motion: reduce) {
    span { transition: none; }
    .flash { animation: none; }
  }
</style>
