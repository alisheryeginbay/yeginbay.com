import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";
import { rehypePlugins, remarkPlugins, smartypants } from "./src/lib/markdown/index.ts";
import { SITE } from "./src/site.ts";

// Code is coloured with the site's own tokens (src/styles/style.css):
// keywords take the plum of links, strings and numbers a muted green, and
// comments the muted text colour. Everything else stays in the text colour.
const codeTheme = {
  name: "site",
  type: "light" as const,
  colors: { "editor.foreground": "var(--fg)", "editor.background": "var(--code-bg)" },
  tokenColors: [
    { scope: ["keyword", "storage", "constant.language"], settings: { foreground: "var(--code-keyword)" } },
    { scope: ["keyword.operator"], settings: { foreground: "var(--fg)" } },
    {
      scope: ["keyword.operator.logical", "keyword.operator.word", "keyword.operator.new", "keyword.operator.expression"],
      settings: { foreground: "var(--code-keyword)" },
    },
    { scope: ["string", "constant.numeric", "constant.character"], settings: { foreground: "var(--code-literal)" } },
    { scope: ["comment", "punctuation.definition.comment"], settings: { foreground: "var(--muted)", fontStyle: "italic" } },
  ],
};

export default defineConfig({
  site: SITE.url,
  // Pages are served without a trailing slash (wrangler.toml).
  build: { format: "directory" },
  integrations: [mdx(), svelte()],
  markdown: {
    processor: unified({ remarkPlugins, rehypePlugins, smartypants }),
    shikiConfig: { theme: codeTheme },
  },
  devToolbar: { enabled: false },
});
