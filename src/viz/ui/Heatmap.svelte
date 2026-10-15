<!-- A matrix as a grid of cells, coloured on a scale centred on zero. -->
<script lang="ts">
  import { diverging, maxAbs } from "./scale.ts";

  interface Props {
    matrix: number[][];
    rows: string[];
    cols: string[];
    // What a row and a column stand for, shown on hover, e.g. "query" and "key".
    rowName?: string;
    colName?: string;
  }

  let { matrix, rows, cols, rowName = "row", colName = "col" }: Props = $props();

  const color = $derived(diverging(maxAbs(matrix)));
</script>

<div class="heatmap">
  <table>
    <thead>
      <tr>
        <th></th>
        {#each cols as c}
          <th title="{colName}: {c}">{c.trim()}</th>
        {/each}
        <th class="balance"></th>
      </tr>
    </thead>
    <tbody>
      {#each matrix as row, i}
        <tr>
          <th title="{rowName}: {rows[i]}">{rows[i].trim()}</th>
          {#each row as v}
            <td style:background={color(v)} title={v.toFixed(3)}></td>
          {/each}
          <!-- An unseen copy of the row's label, so the grid itself sits in the middle. -->
          <th class="balance" aria-hidden="true">{rows[i].trim()}</th>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .heatmap { overflow-x: auto; }

  table {
    margin-inline: auto;
    border-collapse: collapse;
    font-size: 0.7rem;
  }

  th, td {
    padding: 0;
    text-align: center;
  }

  thead th {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    color: var(--muted);
    font-weight: 400;
    padding-bottom: 0.25rem;
    max-height: 5rem;
  }

  tbody th {
    color: var(--muted);
    font-weight: 400;
    text-align: right;
    padding-right: 0.4rem;
    white-space: nowrap;
  }

  .balance { visibility: hidden; }

  /* Where there's no room to spare, the grid shifts right of centre instead. */
  @media (max-width: 40rem) {
    .balance { display: none; }
  }

  td {
    width: 1.4rem;
    height: 1.4rem;
    border: 1px solid var(--bg);
  }
</style>
