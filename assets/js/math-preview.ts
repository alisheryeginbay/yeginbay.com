// Renders math in the browser under `hugo server`, which skips the post-build
// scripts. Production builds render math with scripts/render-math.ts instead,
// using the same delimiters.
import renderMathInElement from "katex/contrib/auto-render/auto-render.ts";

renderMathInElement(document.body, {
  delimiters: [
    { left: "$$", right: "$$", display: true },
    { left: "$", right: "$", display: false },
  ],
  // Interactive figures and the prose bound to them may already be drawn,
  // and auto-render would remove the empty text nodes Svelte keeps its place
  // with.
  ignoredClasses: ["viz", "viz-inline", "viz-overlay"],
});
