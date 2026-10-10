<!-- A number in the prose the reader changes by dragging it sideways, or
     with the arrow keys (Shift for bigger steps). -->
<script lang="ts">
  interface Props {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    format: (v: number) => string;
  }

  let { value = $bindable(), min, max, step = 1, label, format }: Props = $props();

  // The whole range takes about 240px of dragging, but a step never less than 2px.
  const pxPerStep = $derived(Math.max(2, 240 / ((max - min) / step)));

  let drag: { x: number; value: number } | undefined = $state();

  function snap(v: number): number {
    const stepped = min + Math.round((v - min) / step) * step;
    return Number(Math.min(max, Math.max(min, stepped)).toFixed(10));
  }

  function down(e: PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { x: e.clientX, value };
  }

  function move(e: PointerEvent) {
    if (drag) value = snap(drag.value + Math.round((e.clientX - drag.x) / pxPerStep) * step);
  }

  function key(e: KeyboardEvent) {
    const by = step * (e.shiftKey ? 10 : 1);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") value = snap(value + by);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") value = snap(value - by);
    else if (e.key === "Home") value = min;
    else if (e.key === "End") value = max;
    else return;
    e.preventDefault();
  }
</script>

<span
  role="slider"
  tabindex="0"
  aria-label={label}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuenow={value}
  aria-valuetext={format(value)}
  class:dragging={drag}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={() => (drag = undefined)}
  onpointercancel={() => (drag = undefined)}
  onkeydown={key}
>{format(value)}</span>

<style>
  span {
    color: var(--link);
    border-bottom: 1px dashed currentColor;
    cursor: ew-resize;
    font-variant-numeric: tabular-nums;
    user-select: none;
    -webkit-user-select: none;
    /* Sideways drags change the value; up and down still scroll the page. */
    touch-action: pan-y;
  }

  span:hover,
  .dragging { border-bottom-style: solid; }
</style>
