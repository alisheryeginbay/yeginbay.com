import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";
import type { AstroIntegration } from "astro";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

// Post sources are published as .mdx (src/pages/[...source].ts), but .md is
// the likelier guess: send /about.md to /about.mdx. Workers' asset routing
// only allows a wildcard at the end of a rule, so each source gets its own.
const mdRedirects: AstroIntegration = {
  name: "md-redirects",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      const root = fileURLToPath(dir);
      const sources = (await readdir(root, { recursive: true })).filter((file) => file.endsWith(".mdx"));
      const rules = sources.map((file) => {
        const url = "/" + file.split(path.sep).join("/");
        return `${url.replace(/\.mdx$/, ".md")} ${url} 301\n`;
      });
      await writeFile(path.join(root, "_redirects"), rules.sort().join(""));
    },
  },
};

export default defineConfig({
  site: SITE.url,
  // Pages are served without a trailing slash (wrangler.toml).
  build: { format: "directory" },
  integrations: [mdx(), svelte(), mdRedirects],
  markdown: {
    processor: unified({ remarkPlugins, rehypePlugins, smartypants }),
    shikiConfig: { theme: codeTheme },
  },
  devToolbar: { enabled: false },
});
