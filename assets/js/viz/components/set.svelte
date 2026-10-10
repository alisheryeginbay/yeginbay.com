<!--
  Words in the prose that set shared values when clicked, like "look at
  L10H2" (see layouts/shortcodes/set.html).

    html  the words
    to    the values to set, by name
-->
<script lang="ts">
  import { assign, pointing, read, type Value } from "../store.svelte.ts";

  let { html, to }: { html: string; to: Record<string, Value> } = $props();

  const names = $derived(Object.keys(to));
  // Whether the values are already what these words set them to.
  const active = $derived(names.every((n) => String(read(n)) === String(to[n])));

  const point = () => (pointing.names = names);
  const unpoint = () => (pointing.names = []);
</script>

<button
  type="button"
  class:active
  aria-pressed={active}
  onclick={() => Object.entries(to).forEach(([n, v]) => assign(n, v))}
  onpointerenter={point}
  onpointerleave={unpoint}
  onfocus={point}
  onblur={unpoint}
>{@html html}</button>

<style>
  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0 0.1em;
    margin: 0 -0.1em;
    border-radius: 3px;
    cursor: pointer;
    text-decoration: underline dotted var(--link);
    text-decoration-thickness: 1.5px;
    text-underline-offset: 0.2em;
    transition: background-color 150ms;
  }

  button:hover { text-decoration-style: solid; }

  .active {
    background: color-mix(in srgb, var(--highlight) 35%, transparent);
    text-decoration-color: transparent;
  }

  @media (prefers-reduced-motion: reduce) {
    button { transition: none; }
  }
</style>
