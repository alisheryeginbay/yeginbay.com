// The page's shared values: what `var`, `set` and `show` in the prose and
// `$name` props on figures read and write. One store per page; see mount.svelte.ts.
import { SvelteMap } from "svelte/reactivity";

export type Value = string | number | boolean;

// Values the reader controls, by name.
export const values = new SvelteMap<string, Value>();

// Values figures compute and offer to the prose, by name (see `publish`).
export const published = new SvelteMap<string, unknown>();

// The names the reader is pointing at, so everything bound to them lights up.
export const pointing = $state({ names: [] as string[] });

const defaults = new Map<string, Value>();

// A value declared by a `var` in the prose, with its starting value.
export function declare(name: string, value: Value) {
  if (defaults.has(name) && defaults.get(name) !== value) {
    console.warn(`viz: "${name}" starts as both ${defaults.get(name)} and ${value}; keeping the first`);
    return;
  }
  defaults.set(name, value);
  if (!values.has(name)) values.set(name, value);
}

// Sets a value that arrives as text, from the address or a `set` in the
// prose, converting it to the type of the value's default.
export function assign(name: string, raw: Value) {
  const d = defaults.get(name);
  let v = raw;
  if (typeof d === "number") v = Number(raw);
  else if (typeof d === "boolean") v = raw === true || raw === "true";
  values.set(name, v);
}

export function isDefault(name: string): boolean {
  return values.get(name) === defaults.get(name);
}

export function reset(name: string) {
  const d = defaults.get(name);
  if (d === undefined) values.delete(name);
  else values.set(name, d);
}

// The value at a path like "qk.France.Paris": a name, then keys into it.
export function read(path: string): unknown {
  const [root, ...keys] = path.split(".");
  let v: unknown = values.has(root) ? values.get(root) : published.get(root);
  for (const k of keys) v = v == null ? undefined : (v as Record<string, unknown>)[k];
  return v;
}

// Offers what `get` returns to the rest of the page as `name`, kept up to
// date. Call while a component is being set up.
export function publish(name: string, get: () => unknown) {
  $effect(() => {
    published.set(name, get());
  });
  $effect(() => () => {
    published.delete(name);
  });
}
