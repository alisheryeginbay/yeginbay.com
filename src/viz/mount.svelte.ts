// Runs once per page, over the elements src/components/viz/ leave for the
// page's components (`data-viz` names the component, `data-props` holds its
// props). It sets up the shared values the components bind to,
// from the prose's defaults and then the address, mounts the components, and
// keeps the address in step with the values so a reader can share what
// they're looking at. Figures are drawn as they near the screen, so a long
// post with many figures doesn't do all its work up front.
import { mount as mountComponent, type Component } from "svelte";
import Reset from "./ui/Reset.svelte";
import { assign, declare, isChangeable, isDefault, pointing, read, use, write } from "./store.svelte.ts";

type Params = Record<string, unknown>;

// Each component is loaded only when a page uses it.
const components = import.meta.glob<{ default: Component<Params> }>("./components/*.svelte");

async function load(is: string): Promise<Component<Params>> {
  const loader = components[`./components/${is}.svelte`];
  if (!loader) throw new Error(`viz: no component "${is}" in src/viz/components/`);
  return (await loader()).default;
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
        set: (x: unknown) => write(name, x),
      });
    } else {
      props[k] = v;
    }
  }
  return props;
}

export default function mount() {
  const instances = [...document.querySelectorAll<HTMLElement>("[data-viz]")].map((el) => ({
    el,
    is: el.dataset.viz!,
    params: JSON.parse(el.dataset.props ?? "{}") as Params,
  }));

  // Every shared name the page refers to. Ones that figures publish are left
  // out of the address and the reset button (see isChangeable).
  const names = new Set<string>();
  for (const { is, params } of instances) {
    if (is === "var") {
      declare(params.name as string, params.value as string | number | boolean);
      names.add(params.name as string);
    }
    if (is === "set") for (const n of Object.keys(params.to as Params)) names.add(n);
    for (const v of Object.values(params)) {
      const n = ref(v);
      if (n) names.add(n);
    }
  }

  for (const n of names) use(n);

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

  for (const { el, is, params } of instances) {
    const props = propsFor(params);
    // What the page has in the element is for readers without JavaScript.
    const run = () =>
      load(is).then((component) => {
        el.replaceChildren();
        mountComponent(component, { target: el, props });
      });
    // Figures that publish values are drawn now, for the prose that shows them.
    if (INLINE.has(is) || "name" in params) run();
    else {
      pending.set(el, run);
      observer.observe(el);
    }
    const bound = Object.values(params).map(ref).filter((n) => n !== undefined);
    if (!INLINE.has(is) && bound.length) linked.push([el.closest("figure") ?? el, bound]);
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
        if (!isChangeable(n)) continue;
        const v = read(n);
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
