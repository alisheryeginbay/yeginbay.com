#!/usr/bin/env bun
// Compiles posts written in Typst (content/**/*.typ) to HTML for Hugo, which
// can't read Typst. A .typ file is a post if it has front matter:
//
//   #metadata((title: "…", date: "2026-10-13", tags: ("mathematics",))) <frontmatter>
//
// Other .typ files are left alone, so they can be imported by posts. Each
// post's HTML goes into assets/typst-build/pages.json with its front matter,
// and content/_content.gotmpl makes pages of them at the .typ file's path.
// The stylesheet Typst writes for its MathML goes to typst.css beside it.
// Imports starting with / are resolved from the repo root.
// Must run before `hugo`; with --watch it recompiles on every change, for
// use alongside `hugo server`.
import { glob, mkdir, readFile, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { ROOT } from "./site.ts";

const CONTENT = path.join(ROOT, "content");
const OUT = path.join(ROOT, "assets/typst-build");

type Page = {
  path: string;
  source: string;
  title: string;
  dates: { date?: string; lastmod?: string };
  aliases?: string[];
  draft?: boolean;
  params: Record<string, unknown>;
  html: string;
};

async function typst(args: string[]): Promise<{ ok: boolean; out: string; err: string }> {
  const proc = Bun.spawn(["typst", ...args, "--root", ROOT, "--features", "html"], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  // Every HTML export warns that HTML export is experimental.
  const warnings = err
    .split(/\n(?=\S)/)
    .filter((w) => !w.includes("html export is under active development") && !w.startsWith(" "))
    .join("\n")
    .trim();
  return { ok: code === 0, out, err: warnings };
}

// Browsers stretch brackets in MathML to cover what they enclose evenly
// above and below the maths axis, so a subscript inside, as in T(u_k), makes
// them taller than the text around them. Only brackets around something
// that is actually tall are left to stretch.
const FENCES = new Set([..."()[]{}|‖⟨⟩⌈⌉⌊⌋"]);
const TALL = "mfrac, mtable, munderover, munder, mover, msqrt, mroot";

function unstretchFences(html: string): string {
  const $ = cheerio.load(html, null, false);
  $("mrow > mo").each((_, mo) => {
    const $mo = $(mo);
    const fence = $mo.is(":first-child") || $mo.is(":last-child");
    if (fence && FENCES.has($mo.text()) && !$mo.attr("stretchy") && $mo.parent().find(TALL).length === 0) {
      $mo.attr("stretchy", "false");
    }
  });
  return $.html();
}

// Rewrites Typst's HTML into what Hugo's Org renderer emits, so the layout's
// partials treat both alike: headings get the placeholder ids that
// heading-ids.html replaces with readable ones, and footnotes take the
// markup sidenotes.html turns into sidenotes. A □ ending a paragraph, as
// proofs end, becomes the site's own tombstone (.qed in style.css).
// Code loses Typst's inline colours, which only suit a light background.
function orgify(html: string): string {
  let headings = 0;
  html = html.replace(/<h([2-6])>/g, (_, level) => `<h${level} id="headline-${++headings}">`);

  // Typst numbers footnotes by its own element ids; Org by footnote number.
  const numbers = new Map<string, string>();
  html = html.replace(
    /<section role="doc-endnotes"><ol[^>]*>([\s\S]*?)<\/ol><\/section>/,
    (_, items: string) => {
      const defs = [...items.matchAll(/<li id="([^"]+)"><sup role="doc-backlink"><a [^>]*>(\d+)<\/a><\/sup>([\s\S]*?)<\/li>/g)].map(
        ([, id, n, body]) => {
          numbers.set(id, n);
          const paragraphs = body.startsWith("<p>") ? body : `<p>${body}</p>`;
          return `<div class="footnote-definition"><sup id="footnote-${n}"><a href="#footnote-reference-${n}">${n}</a></sup><div class="footnote-body">${paragraphs}</div></div>`;
        },
      );
      return `<div class="footnotes"><hr><div class="footnote-definitions">${defs.join("")}</div></div>`;
    },
  );
  html = html.replace(/<sup id="[^"]+" role="doc-noteref"><a href="#([^"]+)">\d+<\/a><\/sup>/g, (ref, id) => {
    const n = numbers.get(id);
    return n ? `<sup class="footnote-reference"><a id="footnote-reference-${n}" href="#footnote-${n}">${n}</a></sup>` : ref;
  });

  html = html.replace(/<math><mi>□<\/mi><\/math><\/p>/g, '<span class="qed" role="img" aria-label="End of proof"></span></p>');

  return html.replace(/<pre>[\s\S]*?<\/pre>/g, (pre) => pre.replace(/<span style="[^"]*">([\s\S]*?)<\/span>/g, "$1"));
}

// When the file was last committed, as Hugo's enableGitInfo would give.
async function lastCommit(file: string): Promise<string | undefined> {
  const proc = Bun.spawn(["git", "log", "-1", "--format=%cI", "--", file], { cwd: ROOT, stdout: "pipe" });
  return (await new Response(proc.stdout).text()).trim() || undefined;
}

async function compile(rel: string): Promise<Page | null | "failed"> {
  const file = path.join(CONTENT, rel);
  const meta = await typst(["eval", "--in", file, "--format", "json", "query(<frontmatter>).map(m => m.value)"]);
  if (!meta.ok) {
    console.error(`compile-typst: ${path.join("content", rel)}:\n${meta.err}`);
    return "failed";
  }
  const [front] = JSON.parse(meta.out) as Record<string, unknown>[];
  if (!front) return null;

  const html = await typst(["compile", "--format", "html", file, "-"]);
  if (html.err) console.error(`compile-typst: ${path.join("content", rel)}:\n${html.err}`);
  if (!html.ok) return "failed";

  const { title, date, lastmod, aliases, draft, ...params } = front;
  const body = html.out.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? "";
  const css = html.out.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  if (css) await writeFile(path.join(OUT, "typst.css"), css.trim() + "\n");

  return {
    path: rel.replace(/\.typ$/, ""),
    source: rel,
    title: String(title ?? ""),
    dates: { date: date as string | undefined, lastmod: (lastmod as string | undefined) ?? (await lastCommit(file)) },
    aliases: aliases as string[] | undefined,
    draft: draft === true,
    params,
    html: orgify(unstretchFences(body)),
  };
}

async function build(): Promise<[number, number]> {
  await mkdir(OUT, { recursive: true });
  const files = await Array.fromAsync(glob("**/*.typ", { cwd: CONTENT }));
  const results = await Promise.all(files.map(compile));
  const pages = results.filter((r): r is Page => r !== null && r !== "failed");
  await writeFile(path.join(OUT, "pages.json"), JSON.stringify(pages, null, 2) + "\n");
  return [pages.length, results.filter((r) => r === "failed").length];
}

function report([n, failed]: [number, number]): number {
  console.log(`compile-typst: ${n} posts${failed ? `, ${failed} failed` : ""}`);
  return failed;
}

if (process.argv.includes("--watch")) {
  let timer: Timer | undefined;
  const rebuild = () => build().then(report, (err) => console.error(`compile-typst: ${err.message ?? err}`));
  await rebuild();
  watch(ROOT, { recursive: true }, (_, name) => {
    if (!name?.endsWith(".typ")) return;
    clearTimeout(timer);
    timer = setTimeout(rebuild, 50);
  });
} else if (report(await build())) {
  process.exit(1);
}
