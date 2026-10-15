const cache = new Map<string, Promise<unknown>>();

// Fetches JSON once per page, however many figures read it.
export function load<T>(src: string): Promise<T> {
  if (!cache.has(src)) cache.set(src, fetch(src).then((res) => res.json()));
  return cache.get(src) as Promise<T>;
}

// The parsed JSON at `src()`, undefined while it loads. Reactive: values
// derived from `.current` update once it arrives, and it reloads if `src()`
// changes. Call while a component is being set up.
export function fetched<T>(src: () => string): { readonly current: T | undefined } {
  let current = $state<T>();
  $effect(() => {
    let live = true;
    load<T>(src()).then((d) => { if (live) current = d; });
    return () => { live = false; };
  });
  return { get current() { return current; } };
}
