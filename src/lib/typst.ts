// A content loader for posts written in Typst. A .typ file is a post if it
// has front matter:
//
//   #metadata((title: "…", date: "2026-10-13", tags: ("mathematics",))) <frontmatter>
//
// Other .typ files are left alone, so they can be imported by posts. Each
// post is compiled to HTML and run through the same steps as posts written
// in Markdown (src/lib/markdown/), so headings, footnotes and links come out
// alike. The stylesheet Typst writes for its MathML is kept as the entry's
// `css`. Imports starting with / are resolved from the repo root. Uses the
// typst on PATH, or else downloads TYPST_VERSION, as on Cloudflare's build
// image. Under `astro dev`, posts are recompiled when a .typ file changes.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { glob, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Element, Root } from "hast";
import { visit } from "unist-util-visit";
import type { Loader, LoaderContext } from "astro/loaders";
import { lastCommitDate } from "./git.ts";
import { processHtml, type Heading } from "./markdown/index.ts";

const ROOT = process.cwd();
const TYPST_VERSION = "0.15.1";

const TARGETS: Record<string, string> = {
  "linux x64": "x86_64-unknown-linux-musl",
  "linux arm64": "aarch64-unknown-linux-musl",
  "darwin x64": "x86_64-apple-darwin",
  "darwin arm64": "aarch64-apple-darwin",
};

async function run(cmd: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd[0], cmd.slice(1), { cwd: ROOT });
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", reject);
    proc.on("close", (code) => resolve({ code: code ?? 1, out, err }));
  });
}

async function onPath(): Promise<string | undefined> {
  const { code, out } = await run(["sh", "-c", "command -v typst"]).catch(() => ({ code: 1, out: "" }));
  return code === 0 ? out.trim() : undefined;
}

async function download(logger: LoaderContext["logger"]): Promise<string> {
  const target = TARGETS[`${process.platform} ${process.arch}`];
  if (!target) throw new Error(`typst isn't on PATH, and there's no release for ${process.platform} ${process.arch}`);
  const dir = path.join(ROOT, "node_modules/.cache/typst", TYPST_VERSION);
  const bin = path.join(dir, `typst-${target}`, "typst");
  if (existsSync(bin)) return bin;

  const url = `https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${target}.tar.xz`;
  logger.info(`typst isn't on PATH; downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`downloading ${url}: ${res.status} ${res.statusText}`);
  await mkdir(dir, { recursive: true });
  const archive = path.join(dir, "typst.tar.xz");
  await writeFile(archive, new Uint8Array(await res.arrayBuffer()));
  const tar = await run(["tar", "-xJf", archive, "-C", dir]);
  if (tar.code !== 0 || !existsSync(bin)) throw new Error(`unpacking ${archive} failed: ${tar.err}`);
  await rm(archive);
  return bin;
}

let bin: Promise<string> | undefined;

async function typst(args: string[], logger: LoaderContext["logger"]) {
  bin ??= onPath().then((found) => found ?? download(logger));
  const { code, out, err } = await run([await bin, ...args, "--root", ROOT, "--features", "html"]);
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
const TALL = new Set(["mfrac", "mtable", "munderover", "munder", "mover", "msqrt", "mroot"]);

function rehypeUnstretchFences() {
  return (tree: Root) => {
    visit(tree, "element", (mrow) => {
      if (mrow.tagName !== "mrow") return;
      let tall = false;
      visit(mrow, "element", (el) => {
        if (TALL.has(el.tagName)) tall = true;
      });
      if (tall) return;
      const kids = mrow.children.filter((c): c is Element => c.type === "element");
      for (const mo of [kids[0], kids.at(-1)]) {
        if (mo?.tagName !== "mo" || mo.properties.stretchy !== undefined) continue;
        const text = mo.children.map((c) => (c.type === "text" ? c.value : "")).join("");
        if (FENCES.has(text)) mo.properties.stretchy = "false";
      }
    });
  };
}

// Rewrites Typst's HTML into what the Markdown pipeline expects: footnotes
// take the markup remark-rehype gives GFM footnotes, which rehype-sidenotes
// turns into sidenotes. A □ ending a paragraph or block, as proofs end,
// becomes the site's own tombstone (.qed in style.css). Code loses Typst's
// inline colours, which only suit a light background.
function adapt(html: string): string {
  // Typst numbers footnotes by its own element ids; GFM by footnote number.
  const numbers = new Map<string, string>();
  html = html.replace(/<section role="doc-endnotes"><ol[^>]*>([\s\S]*?)<\/ol><\/section>/, (_, items: string) => {
    const defs = [...items.matchAll(/<li id="([^"]+)"><sup role="doc-backlink"><a [^>]*>(\d+)<\/a><\/sup>([\s\S]*?)<\/li>/g)].map(([, id, n, body]) => {
      numbers.set(id, n);
      const paragraphs = body.startsWith("<p>") ? body : `<p>${body}</p>`;
      return `<li id="user-content-fn-${n}">${paragraphs}</li>`;
    });
    return `<section data-footnotes class="footnotes"><ol>${defs.join("")}</ol></section>`;
  });
  html = html.replace(/<sup id="[^"]+" role="doc-noteref"><a href="#([^"]+)">\d+<\/a><\/sup>/g, (ref, id) => {
    const n = numbers.get(id);
    return n ? `<sup><a href="#user-content-fn-${n}" data-footnote-ref>${n}</a></sup>` : ref;
  });

  // Typst sets f' as a superscript prime, which browsers raise and space off
  // from the f; the prime character is already raised.
  html = html.replace(/<msup>(<m[in]>[^<]*<\/m[in]>)<mo>(′+)<\/mo><\/msup>/g, '$1<mo lspace="0" rspace="0">$2</mo>');
  // Keep punctuation after inline maths on the same line as it.
  html = html.replace(/(<math>(?:(?!<\/math>)[\s\S])*<\/math>)([.,;:]+)/g, '<span class="nowrap">$1$2</span>');

  html = html.replace(/<math><mi>□<\/mi><\/math>(?=<\/(?:p|div)>)/g, '<span class="qed" role="img" aria-label="End of proof"></span>');

  return html.replace(/<pre>[\s\S]*?<\/pre>/g, (pre) => pre.replace(/<span style="[^"]*">([\s\S]*?)<\/span>/g, "$1"));
}

export type TypstMetadata = { headings: Heading[]; css?: string };

async function compile(rel: string, base: string, ctx: LoaderContext): Promise<boolean> {
  const { logger, store, parseData, generateDigest } = ctx;
  const file = path.join(base, rel);
  const shown = path.relative(ROOT, file);
  const meta = await typst(["eval", "--in", file, "--format", "json", "query(<frontmatter>).map(m => m.value)"], logger);
  if (!meta.ok) {
    logger.error(`${shown}:\n${meta.err}`);
    return false;
  }
  const [front] = JSON.parse(meta.out) as Record<string, unknown>[];
  if (!front) return true;

  const out = await typst(["compile", "--format", "html", file, "-"], logger);
  if (out.err) logger.warn(`${shown}:\n${out.err}`);
  if (!out.ok) return false;

  const body = out.out.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? "";
  const css = out.out.match(/<style>([\s\S]*?)<\/style>/)?.[1]?.trim();
  const { html, headings } = await processHtml(adapt(body), shown, [rehypeUnstretchFences]);

  const id = rel.replace(/\.typ$/, "");
  const data = await parseData({
    id,
    data: { ...front, lastmod: front.lastmod ?? lastCommitDate(shown)?.toISOString() },
    filePath: shown,
  });
  store.set({
    id,
    data,
    filePath: shown,
    digest: generateDigest(out.out),
    rendered: { html, metadata: { headings, css } as TypstMetadata as Record<string, unknown> },
  });
  return true;
}

export function typstLoader({ base }: { base: string }): Loader {
  const dir = path.resolve(ROOT, base);
  return {
    name: "typst",
    load: async (ctx) => {
      const build = async () => {
        ctx.store.clear();
        const files = await Array.fromAsync(glob("**/*.typ", { cwd: dir }));
        const results = await Promise.all(files.map((rel) => compile(rel, dir, ctx)));
        const failed = results.filter((ok) => !ok).length;
        if (failed) {
          const message = `${failed} Typst post(s) failed to compile`;
          if (ctx.watcher) ctx.logger.error(message);
          else throw new Error(message);
        }
      };
      await build();

      ctx.watcher?.add(dir);
      ctx.watcher?.on("change", (changed) => {
        if (changed.endsWith(".typ")) build().catch((err) => ctx.logger.error(String(err)));
      });
    },
  };
}
