# Interactive figures

Svelte components that draw figures in posts, and the shared values that let
the prose and figures talk to each other.

## How it fits together

- `components/<name>.svelte`: one per figure or prose control. `<name>` is
  what a post writes in `is="<name>"`.
- `ui/`: the parts components are built from (`Controls`, `Select`,
  `Status`, `Heatmap`, `Scrubber`, `Choice`, colour scales, number formats).
- `store.svelte.ts`: the page's shared values, and `publish` for values a
  figure offers to the prose.
- `data.svelte.ts`: `fetched(() => src)` loads JSON once per page, however
  many figures read it.
- `mount.svelte.ts`: sets up the shared values (the prose's defaults, then
  the address), draws each component, and keeps the address in step.

Hugo can't read Svelte, so `scripts/compile-svelte.ts` compiles this folder
into `assets/js/viz-build/` (gitignored), gathering component styles into
`viz.css`. The shortcodes (`layouts/shortcodes/{viz,var,set,show}.html`) add
each component to a per-page `js.Batch` group through
`layouts/partials/viz-instance.html`, so a page loads only what it uses.

## Adding a component

1. Run `bun run dev`: `hugo server -D` with the compiler in watch mode.

2. Create `components/<name>.svelte`, lowercase, starting with a comment
   listing its props:

   ```svelte
   <!--
     A distribution you can reshape by dragging its mean.

       src    JSON with `samples`
       mean   the mean shown; bindable
       name   publishes the current variance as `name`
   -->
   <script lang="ts">
     import { untrack } from "svelte";
     import { fetched } from "../data.svelte.ts";
     import { publish } from "../store.svelte.ts";
     import Status from "../ui/Status.svelte";

     let { src, mean = $bindable(), name }: { src: string; mean?: number | string; name?: string } = $props();

     const data = fetched<{ samples: number[] }>(() => src);
     // What's shown: the bound value, or a fallback until there is one.
     const shownMean = $derived(mean === undefined ? 0 : Number(mean));
     const variance = $derived(/* … */);

     // A figure's name is set once, by the shortcode.
     untrack(() => {
       if (name) publish(name, () => variance);
     });
   </script>

   {#if data.current}
     <!-- SVG, canvas, controls; assign to `mean` when the reader changes it -->
     <Status>mean {shownMean}</Status>
   {/if}

   <style>
     /* Scoped to this component. */
   </style>
   ```

3. Put its data in `static/data/<post>/`, or in the post's bundle.

4. Use it in the post:

   ```org
   {{< viz is="distribution" src="/data/my-post/samples.json" mean="$mu" name="dist" >}}

   Drag the mean to {{< var name="mu" value=0 min=-3 max=3 step=0.1 >}}; the
   variance is now {{< show "dist" ".2f" >}}.
   ```

   `width="wide"` lets a figure reach into the sidenote margin, and
   `caption="…"` gives it a caption in org markup.

## In the prose

| Shortcode | Does |
|---|---|
| `{{< viz is="…" prop="$name" >}}` | A figure. A prop starting with `$` is bound to that shared value. |
| `{{< var name="n" value=3 min=1 max=10 >}}` | A number the reader drags. `options="a,b"` (or `"$published_list"`) makes a choice, `labels="on,off"` a toggle. |
| `{{< set head="L10H2" >}}L10H2{{< /set >}}` | Words that set values when clicked. |
| `{{< show "qk.France.Paris" ".2f" >}}` | A live value: a name, then keys into it. Formats: `.2f`, `.1%`, or none. |

Values the reader changes go into the address (`?head=L10H6`), so a view
can be shared. The build fails when a `show` or `set` names a value nothing
on the page provides.

## Conventions

- Props from Hugo are strings, or numbers when written unquoted. Convert
  them, don't trust their type.
- To share a prop with the prose, declare it `$bindable()`, derive what's
  shown from it with a fallback for when it's unset or invalid, and assign
  to it only when the reader does something. Writing defaults back fills
  the address with values nobody chose. `attention.svelte` shows the
  pattern.
- Publish with a `name` prop and `publish()` inside `untrack`. Further
  values go under `name_something`, which the build check accepts.
- Reach for `ui/` first, and move anything a second component could use
  there.
- Colour with the site's tokens: `--fg`, `--muted`, `--rule`, `--link`,
  `--highlight`, `--code-bg`, and `--viz-pos`/`--viz-neg` for scales.
- Respect `prefersReducedMotion` from `svelte/motion` in any animation.
- Components that sit inside a sentence must not leave whitespace at the
  edges of their markup, or the prose gets stray spaces.
- Figures are drawn as they near the screen; ones with a `name` are drawn
  straight away, for the prose that shows their values, so keep those cheap
  to start.

## Before committing

1. Add an example to `content/posts/test.org`.
2. `bun run typecheck` (`tsc` and `svelte-check`, which should report no
   warnings).
3. `bun run build`.
4. Check it at phone width.
5. Commit the component and the post that uses it separately.
