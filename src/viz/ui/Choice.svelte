<!-- A choice in the prose. A few options cycle on click; more open a list. -->
<script lang="ts">
  import { fade } from "svelte/transition";
  import { prefersReducedMotion } from "svelte/motion";

  interface Props {
    value: string | undefined;
    options: string[];
    label: string;
  }

  let { value = $bindable(), options, label }: Props = $props();

  const cycles = $derived(options.length <= 3);
  // Roughly square, but never so wide it overflows a phone.
  const columns = $derived(Math.min(6, Math.ceil(Math.sqrt(options.length))));

  let open = $state(false);
  let root: HTMLElement;
  let button: HTMLButtonElement;
  let list: HTMLElement | undefined = $state();

  function click() {
    if (!cycles) open = !open;
    else value = options[(options.indexOf(value ?? "") + 1) % options.length];
  }

  function pick(option: string) {
    value = option;
    open = false;
    button.focus();
  }

  // Close on a press anywhere else.
  $effect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.contains(e.target as Node)) open = false;
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  });

  // Once open, focus the chosen option and keep the list on the screen.
  $effect(() => {
    if (!list) return;
    (list.querySelector<HTMLElement>('[aria-selected="true"]') ?? list.querySelector("button"))?.focus();
    const overflow = list.getBoundingClientRect().right - (innerWidth - 8);
    if (overflow > 0) list.style.left = `${-overflow}px`;
  });

  function key(e: KeyboardEvent) {
    const items = [...list!.querySelectorAll<HTMLElement>("button")];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, ArrowDown: i + columns, ArrowUp: i - columns }[e.key];
    if (e.key === "Escape") {
      open = false;
      button.focus();
    } else if (to !== undefined) {
      items[Math.max(0, Math.min(items.length - 1, to))].focus();
    } else return;
    e.preventDefault();
  }
</script>

<span class="choice" bind:this={root}>
  <button
    bind:this={button}
    type="button"
    class="current"
    aria-label={label}
    aria-haspopup={cycles ? undefined : "listbox"}
    aria-expanded={cycles ? undefined : open}
    onclick={click}
  >{value ?? "…"}</button
  >{#if open}
    <span
      bind:this={list}
      class="list"
      role="listbox"
      tabindex="-1"
      aria-label={label}
      style:--columns={columns}
      onkeydown={key}
      transition:fade={{ duration: prefersReducedMotion.current ? 0 : 120 }}
    >
      {#each options as option (option)}
        <button type="button" role="option" aria-selected={option === value} onclick={() => pick(option)}>{option}</button>
      {/each}
    </span>
  {/if}</span>

<style>
  .choice { position: relative; }

  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .current {
    color: var(--link);
    border-bottom: 1px dashed currentColor;
  }

  .current:hover { border-bottom-style: solid; }

  .list {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    z-index: 10;
    display: grid;
    grid-template-columns: repeat(var(--columns), auto);
    gap: 0.1rem;
    max-height: 16rem;
    overflow-y: auto;
    padding: 0.3rem;
    background: var(--bg);
    border: 1px solid var(--rule);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgb(0 0 0 / 0.08);
    font-size: 0.8rem;
    line-height: 1.4;
    font-variant-numeric: tabular-nums;
  }

  .list button {
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    text-align: left;
    white-space: nowrap;
  }

  .list button:hover,
  .list button:focus-visible { background: var(--code-bg); outline: none; }

  .list [aria-selected="true"] {
    background: color-mix(in srgb, var(--highlight) 45%, transparent);
  }
</style>
