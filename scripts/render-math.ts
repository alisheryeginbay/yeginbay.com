#!/usr/bin/env bun
// Post-processes Hugo's build output to render $…$ and $$…$$ math with KaTeX
// at build time, so pages ship the KaTeX stylesheet but no KaTeX JavaScript.
// Mirrors KaTeX's auto-render (same delimiters, ignored tags and fallbacks)
// and only touches pages that link the KaTeX stylesheet. Must run after
// `hugo build`, and after the other post-build scripts, which never saw
// links inside rendered math when it was rendered in the browser.
import { readFile, writeFile, glob } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import type { AnyNode, Element, ParentNode } from "domhandler";
import katex from "katex";
import splitAtDelimiters from "katex/contrib/auto-render/splitAtDelimiters.ts";
import { PUBLIC_DIR } from "./site.ts";

const DELIMITERS = [
  { left: "$$", right: "$$", display: true },
  { left: "$", right: "$", display: false },
];

const IGNORED_TAGS = new Set(["script", "noscript", "style", "textarea", "pre", "code", "option"]);

const KATEX_CSS = "vendor/katex/katex.min.css";

function renderPage($: cheerio.CheerioAPI, file: string): number {
  // Shared across the page so \gdef macros carry over, as in auto-render.
  const macros: Record<string, string> = {};
  let rendered = 0;

  function renderText(text: string): string | null {
    const data = splitAtDelimiters(text, DELIMITERS);
    if (data.length === 1 && data[0].type === "text") return null;

    let html = "";
    for (const part of data) {
      if (part.type === "text") {
        html += escapeText(part.data);
        continue;
      }
      try {
        html += "<span>" + katex.renderToString(part.data, { displayMode: part.display, macros }) + "</span>";
        rendered += 1;
      } catch (err) {
        if (!(err instanceof katex.ParseError)) throw err;
        console.error(`render-math: ${file}: failed to parse \`${part.data}\`: ${err.message}`);
        html += escapeText(part.rawData!);
      }
    }
    return html;
  }

  function renderElem(elem: ParentNode) {
    const children = [...elem.children];
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node.type === "text") {
        // Treat a run of adjacent text nodes as one string, like auto-render.
        const run: AnyNode[] = [node];
        while (children[i + 1]?.type === "text") run.push(children[++i]);
        const html = renderText(run.map((n) => $(n).text()).join(""));
        if (html === null) continue;
        $(run[0]).replaceWith(html);
        run.slice(1).forEach((n) => $(n).remove());
      } else if (node.type === "tag" && !IGNORED_TAGS.has((node as Element).name)) {
        renderElem(node as Element);
      }
    }
  }

  const body = $("body").get(0);
  if (body) renderElem(body);
  return rendered;
}

function escapeText(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  if (!existsSync(PUBLIC_DIR)) {
    console.error(
      `render-math: ${PUBLIC_DIR} does not exist. Run "hugo build" first.`,
    );
    process.exit(1);
  }

  let filesChanged = 0;
  let formulasRendered = 0;

  for await (const file of glob("**/*.html", { cwd: PUBLIC_DIR })) {
    const filePath = path.join(PUBLIC_DIR, file);
    const html = await readFile(filePath, "utf8");
    if (!html.includes(KATEX_CSS)) continue;

    const $ = cheerio.load(html, { xmlMode: false });
    const rendered = renderPage($, file);
    if (rendered > 0) {
      await writeFile(filePath, $.html());
      filesChanged += 1;
      formulasRendered += rendered;
    }
  }

  console.log(
    `render-math: rendered ${formulasRendered} formula(s) across ${filesChanged} file(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
