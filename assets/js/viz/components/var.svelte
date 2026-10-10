<!--
  A value the reader controls, inline in the prose (see layouts/shortcodes/var.html).

    name     the shared value it holds
    kind     "number", "choice" or "toggle", worked out by the shortcode
    min, max, step, format   for a number
    options  for a choice: "a,b,c", or a list a figure publishes, bound as "$name"
    labels   for a toggle: what to say when on and when off, "on,off"
-->
<script lang="ts">
  import { pointing, values, type Value } from "../store.svelte.ts";
  import Choice from "../ui/Choice.svelte";
  import Scrubber from "../ui/Scrubber.svelte";
  import { format as formatValue } from "../ui/format.ts";

  interface Props {
    name: string;
    kind: "number" | "choice" | "toggle";
    min?: number | string;
    max?: number | string;
    step?: number | string;
    format?: string;
    options?: string | string[];
    labels?: string;
  }

  let { name, kind, min = 0, max = 1, step = 1, format, options = [], labels = "on,off" }: Props = $props();

  const value = {
    get current() { return values.get(name); },
    set current(v: Value | undefined) { if (v !== undefined) values.set(name, v); },
  };

  const optionList = $derived(
    Array.isArray(options) ? options.map(String) : options.split(",").map((o) => o.trim()),
  );
  const [onLabel, offLabel] = $derived(labels.split(",").map((l) => l.trim()));

  const point = () => (pointing.names = [name]);
  const unpoint = () => (pointing.names = []);
</script>

<span
  class="var"
  role="presentation"
  onpointerenter={point}
  onpointerleave={unpoint}
  onfocusin={point}
  onfocusout={unpoint}
>{#if kind === "number"}
    <Scrubber
      bind:value={() => Number(value.current), (v) => (value.current = v)}
      min={+min}
      max={+max}
      step={+step}
      label={name}
      format={(v) => formatValue(v, format)}
    />
  {:else if kind === "toggle"}
    <button type="button" aria-pressed={value.current === true} onclick={() => (value.current = !value.current)}
      >{value.current ? onLabel : offLabel}</button
    >
  {:else}
    <Choice
      bind:value={() => value.current as string | undefined, (v) => (value.current = v)}
      options={optionList}
      label={name}
    />
  {/if}</span>

<style>
  button {
    font: inherit;
    color: var(--link);
    background: none;
    border: 0;
    border-bottom: 1px dashed currentColor;
    padding: 0;
    cursor: pointer;
  }

  button:hover { border-bottom-style: solid; }
</style>
