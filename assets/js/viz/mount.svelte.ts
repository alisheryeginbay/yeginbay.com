// Runs once per page with the page's components (see layouts/partials/
// viz-instance.html). It sets up the shared values the components bind to,
// from the prose's defaults and then the address, mounts the components, and
// keeps the address in step with the values so a reader can share what
// they're looking at. Figures are drawn as they near the screen, so a long
// post with many figures doesn't do all its work up front.
import { mount as mountComponent, type Component } from "svelte";
import Reset from "./ui/Reset.svelte";
import { assign, declare, isDefault, pointing, read, values, type Value } from "./store.svelte.ts";

type Params = Record<string, unknown>;

interface Group {
  id: string;
  scripts: {
    id: string;
    binding: Component<Params>;
    instances: { id: string; params: Params }[];
  }[];
}

// Components that sit in the prose. They're small and the text reads wrong
// without them, so they're mounted straight away.
const INLINE = new Set(["var", "set", "show"]);

// The shared value a prop like `head="$qk_head"` is bound to.
function ref(v: unknown): string | undefined {
  return typeof v === "string" && v.startsWith("$") ? v.slice(1) : undefined;
}

// A component's props, with bound ones read from and written to the store.
function propsFor(params: Params): Params {
  const props: Params = {};
  for (const [k, v] of Object.entries(params)) {
    const name = ref(v);
    if (name) {
      Object.defineProperty(props, k, {
        enumerable: true,
        get: () => read(name),
        set: (x: Value) => values.set(name, x),
      });
    } else {
      props[k] = v;
    }
  }
  return props;
}

export default function mount(group: Group) {
  const instances = group.scripts.flatMap((script) => script.instances.map((i) => ({ script, ...i })));

  // Every name the reader can change on this page.
  const names = new Set<string>();
  for (const { script, params } of instances) {
    if (script.id === "var") {
      declare(params.name as string, params.value as Value);
      names.add(params.name as string);
    }
    if (script.id === "set") for (const n of Object.keys(params.to as Params)) names.add(n);
    for (const v of Object.values(params)) {
      const n = ref(v);
      if (n) names.add(n);
    }
  }

  const query = new URLSearchParams(location.search);
  for (const n of names) {
    const v = query.get(n);
    if (v !== null) assign(n, v);
  }

  const pending = new Map<Element, () => void>();
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        pending.get(entry.target)?.();
        pending.delete(entry.target);
      }
    },
    { rootMargin: "50% 0px" },
  );

  // Figures bound to shared values, which light up when the reader points
  // at something in the prose that changes them.
  const linked: [Element, string[]][] = [];

  for (const { script, id, params } of instances) {
    const el = document.getElementById("viz-" + id);
    if (!el) {
      console.warn("viz: no element for", script.id, id);
      continue;
    }
    const props = propsFor(params);
    // What Hugo put in the element is for readers without JavaScript.
    const run = () => {
      el.replaceChildren();
      mountComponent(script.binding, { target: el, props });
    };
    // Figures that publish values are drawn now, for the prose that shows them.
    if (INLINE.has(script.id) || "name" in params) run();
    else {
      pending.set(el, run);
      observer.observe(el);
    }
    const bound = Object.values(params).map(ref).filter((n) => n !== undefined);
    if (!INLINE.has(script.id) && bound.length) linked.push([el.closest("figure") ?? el, bound]);
  }

  $effect.root(() => {
    $effect(() => {
      for (const [el, bound] of linked) {
        el.classList.toggle("viz-linked", bound.some((n) => pointing.names.includes(n)));
      }
    });

    $effect(() => {
      const query = new URLSearchParams(location.search);
      for (const n of names) {
        const v = values.get(n);
        if (v === undefined || isDefault(n)) query.delete(n);
        else query.set(n, String(v));
      }
      const q = query.toString();
      const url = location.pathname + (q ? "?" + q : "") + location.hash;
      if (url !== location.pathname + location.search + location.hash) history.replaceState(history.state, "", url);
    });
  });

  if (names.size) {
    const overlay = document.body.appendChild(document.createElement("div"));
    overlay.className = "viz-overlay";
    mountComponent(Reset, { target: overlay, props: { names: [...names] } });
  }
}
