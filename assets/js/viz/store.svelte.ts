// The page's shared values: what `var`, `set` and `show` in the prose and
// `$name` props on figures read and write. One store per page; see mount.svelte.ts.
//
// Two kinds of value share one namespace: ones the reader controls (declared
// by a `var`, set by a `set`, or bound to a figure's prop), and ones figures
// compute and offer to the prose (see `publish`).

import { SvelteSet } from "svelte/reactivity";

export type Value = string | number | boolean;

// Each name gets a cell of its own, so a change wakes only what reads it.
class Cell {
  current = $state.raw<unknown>();
}

const cells = new Map<string, Cell>();

// The names in use. Reading a name nothing has used yet asks this, so the
// reader is woken once the name appears, and not by changes to other names.
const named = new SvelteSet<string>();

// Names figures publish, which aren't the reader's to change.
const published = new Set<string>();

function cell(name: string): Cell {
  let c = cells.get(name);
  if (!c) {
    c = new Cell();
    cells.set(name, c);
    named.add(name);
  }
  return c;
}

// The names the reader is pointing at, so everything bound to them lights up.
export const pointing = $state({ names: [] as string[] });

const defaults = new Map<string, Value>();

// The value at a path like "qk.France.Paris": a name, then keys into it.
export function read(path: string): unknown {
  const [root, ...keys] = path.split(".");
  if (!named.has(root)) return undefined;
  let v = cells.get(root)!.current;
  for (const k of keys) v = v == null ? undefined : (v as Record<string, unknown>)[k];
  return v;
}

export function write(name: string, value: unknown) {
  cell(name).current = value;
}

// Makes room for a name before anything reads it.
export function use(name: string) {
  cell(name);
}

// A value declared by a `var` in the prose, with its starting value.
export function declare(name: string, value: Value) {
  if (defaults.has(name) && defaults.get(name) !== value) {
    console.warn(`viz: "${name}" starts as both ${defaults.get(name)} and ${value}; keeping the first`);
    return;
  }
  defaults.set(name, value);
  if (read(name) === undefined) write(name, value);
}

// Sets a value that arrives as text, from the address or a `set` in the
// prose, converting it to the type of the value's default.
export function assign(name: string, raw: Value) {
  const d = defaults.get(name);
  let v = raw;
  if (typeof d === "number") v = Number(raw);
  else if (typeof d === "boolean") v = raw === true || raw === "true";
  write(name, v);
}

// Whether a value is one the reader changes, rather than one a figure publishes.
export function isChangeable(name: string): boolean {
  return !published.has(name);
}

export function isDefault(name: string): boolean {
  return read(name) === defaults.get(name);
}

export function reset(name: string) {
  write(name, defaults.get(name));
}

// Offers what `get` returns to the rest of the page as `name`, kept up to
// date. Call while a component is being set up.
export function publish(name: string, get: () => unknown) {
  published.add(name);
  $effect(() => {
    write(name, get());
  });
  $effect(() => () => {
    write(name, undefined);
  });
}
