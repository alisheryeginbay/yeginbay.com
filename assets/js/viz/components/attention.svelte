<!--
  One attention head's matrices over a set of tokens, with a choice of layer,
  head and matrix.

    src     JSON with `tokens` and, for each head ("L0H3"), its matrices by name
    fields  the matrices to offer, as "Label:key,…" or just "key"
    rows    what a row stands for, e.g. "query"
    cols    what a column stands for, e.g. "key"
    head    the head shown, like "L10H2"; bind it to share it with the prose
    field   the matrix shown, by key; bindable too
    name    publishes the matrix shown as `name`, by row then column token
            ("qk.France.Paris"), and the heads as `name_heads`
-->
<script lang="ts">
  import { untrack } from "svelte";
  import { fetched } from "../data.svelte.ts";
  import { publish } from "../store.svelte.ts";
  import Controls from "../ui/Controls.svelte";
  import Heatmap from "../ui/Heatmap.svelte";
  import Select from "../ui/Select.svelte";
  import Status from "../ui/Status.svelte";

  type Matrix = number[][];

  interface AttnData {
    tokens?: string[];
    [head: string]: Record<string, Matrix> | string[] | undefined;
  }

  interface Props {
    src: string;
    fields: string;
    rows?: string;
    cols?: string;
    head?: string;
    field?: string;
    name?: string;
  }

  const HEAD_RE = /^L(\d+)H(\d+)$/;

  let {
    src,
    fields: rawFields,
    rows = "row",
    cols = "col",
    head = $bindable(),
    field = $bindable(),
    name,
  }: Props = $props();

  const data = fetched<AttnData>(() => src);

  const fields = $derived(
    rawFields.split(",").map((pair) => {
      const [label, key = label] = pair.split(":").map((s) => s.trim());
      return { label, value: key };
    }),
  );

  const heads = $derived(
    Object.keys(data.current ?? {})
      .flatMap((key) => {
        const m = key.match(HEAD_RE);
        return m ? [{ key, layer: m[1], head: m[2] }] : [];
      })
      .sort((a, b) => +a.layer - +b.layer || +a.head - +b.head),
  );
  const layers = $derived([...new Set(heads.map((h) => h.layer))]);

  // What's shown: the chosen head and matrix, or the first of each until
  // there's a choice that exists.
  const shown = $derived(heads.find((h) => h.key === head) ?? heads[0]);
  const shownField = $derived(fields.some((f) => f.value === field) ? field! : fields[0].value);
  const headsInLayer = $derived(heads.filter((h) => h.layer === shown?.layer));

  const matrix = $derived((data.current?.[shown?.key ?? ""] as Record<string, Matrix> | undefined)?.[shownField]);
  const labels = $derived(matrix?.map((_, i) => String(data.current?.tokens?.[i] ?? i)) ?? []);

  // The matrix by token, keeping the first where a token repeats.
  const byToken = $derived.by(() => {
    if (!matrix) return undefined;
    const out: Record<string, Record<string, number>> = {};
    labels.forEach((r, i) => {
      const row = (out[r.trim()] ??= {});
      labels.forEach((c, j) => (row[c.trim()] ??= matrix[i][j]));
    });
    return out;
  });

  // A figure's name is set once, by the shortcode.
  untrack(() => {
    if (!name) return;
    publish(name, () => byToken);
    publish(`${name}_heads`, () => heads.map((h) => h.key));
  });
</script>

{#if data.current}
  <div class="attention">
    <Controls>
      <Select
        label="Layer"
        bind:value={() => shown?.layer ?? "", (l) => (head = heads.find((h) => h.layer === l)?.key)}
        options={layers.map((l) => ({ value: l, label: `Layer ${l}` }))}
      />
      <Select
        label="Head"
        bind:value={() => shown?.key ?? "", (k) => (head = k)}
        options={headsInLayer.map((h) => ({ value: h.key, label: `Head ${h.head}` }))}
      />
      <Select label="Matrix" bind:value={() => shownField, (f) => (field = f)} options={fields} />
    </Controls>
    {#if matrix}
      <Heatmap {matrix} rows={labels} cols={labels} rowName={rows} colName={cols} />
    {/if}
    <Status>
      {shown?.key}{#if fields.length > 1}&nbsp;· {fields.find((f) => f.value === shownField)?.label}{/if}
    </Status>
  </div>
{/if}

<style>
  .attention { text-align: center; }

  .attention :global(.controls) { justify-content: center; }
</style>
