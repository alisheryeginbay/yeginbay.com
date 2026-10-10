#!/usr/bin/env bun
// Compiles the interactive figures in assets/js/viz/ for Hugo, whose
// JavaScript bundler can't read Svelte. The folder is mirrored into
// assets/js/viz-build/ with each .svelte component and .svelte.ts module
// compiled to plain JavaScript and imports of them pointed at the output,
// so js.Batch (see layouts/partials/viz-instance.html) bundles the mirror as
// usual. The components' styles are gathered into viz.css in the same folder,
// which pages with components link to.
// Must run before `hugo`; with --watch it recompiles on every change, for
// use alongside `hugo server`.
import { glob, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { watch } from "node:fs";
import path from "node:path";
import { compile, compileModule } from "svelte/compiler";
import { ROOT } from "./site.ts";

const SRC = path.join(ROOT, "assets/js/viz");
const OUT = path.join(ROOT, "assets/js/viz-build");

const ts = new Bun.Transpiler({ loader: "ts" });

// "./x.svelte" and "./x.svelte.ts" become "./x.svelte.js".
function pointAtOutput(code: string): string {
  return code.replace(/(["'])(\.{1,2}\/[^"']+?\.svelte)(?:\.ts)?\1/g, "$1$2.js$1");
}

async function compileFile(rel: string): Promise<[string, string, string?]> {
  const filename = path.join(SRC, rel);
  const source = await readFile(filename, "utf8");
  if (rel.endsWith(".svelte")) {
    const { js, css } = compile(source, { filename, generate: "client", css: "external" });
    return [rel + ".js", js.code, css?.code];
  }
  if (rel.endsWith(".svelte.ts")) {
    const { js } = compileModule(ts.transformSync(source), { filename, generate: "client" });
    return [rel.replace(/\.ts$/, ".js"), js.code];
  }
  return [rel, source];
}

async function build() {
  const files = await Array.fromAsync(glob("**/*.{svelte,ts}", { cwd: SRC }));
  const outputs = await Promise.all(files.map(compileFile));
  await rm(OUT, { recursive: true, force: true });
  for (const [rel, code] of outputs) {
    const file = path.join(OUT, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, pointAtOutput(code));
  }
  const css = outputs.flatMap(([rel, , css]) => (css ? [`/* ${rel.replace(/\.js$/, "")} */\n${css}`] : []));
  await writeFile(path.join(OUT, "viz.css"), css.join("\n\n") + "\n");
  return files.length;
}

if (process.argv.includes("--watch")) {
  let timer: Timer | undefined;
  const rebuild = () =>
    build().then(
      (n) => console.log(`compile-svelte: ${n} files`),
      (err) => console.error(`compile-svelte: ${err.message ?? err}`),
    );
  await rebuild();
  watch(SRC, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 50);
  });
} else {
  console.log(`compile-svelte: ${await build()} files`);
}
