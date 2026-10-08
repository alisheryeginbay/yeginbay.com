#!/usr/bin/env bun
// Subsets Source Han Serif KR down to the Hangul the site actually uses and
// writes static/fonts/sourcehanserifkr-{400,600}.woff2. The full fonts are
// ~7.5 MB each, so they stay out of the repo and the subsets are committed;
// rerun this after adding Korean text to a post.
//
//   bun run subset-korean [path/to/source-han-serif]
//
// The OTFs are built from Adobe's sources (github.com/adobe-fonts/source-han-serif)
// with AFDKO's makeotf, following the "Korean" lines in its COMMANDS.txt.
// Needs pyftsubset with brotli: `uv tool install fonttools --with brotli`.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { ROOT } from "./site.ts";

const SOURCE = path.resolve(process.argv[2] ?? path.join(ROOT, "source-han-serif"));
const OUT_DIR = path.join(ROOT, "static", "fonts");
const SCAN = ["content", "data", "layouts", "hugo.toml"];

const WEIGHTS = { 400: "Regular", 600: "SemiBold" } as const;

// Jamo, compatibility jamo, extended jamo and syllables. Keep in sync with the
// unicode-range of the "Source Han Serif KR" @font-face rules in style.css.
const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힯ힰ-퟿]/gu;

async function* files(p: string): AsyncGenerator<string> {
  if (!(await stat(p)).isDirectory()) return yield p;
  for (const entry of await readdir(p, { withFileTypes: true })) {
    yield* files(path.join(p, entry.name));
  }
}

const chars = new Set<string>();
for (const top of SCAN) {
  for await (const file of files(path.join(ROOT, top))) {
    for (const [ch] of (await readFile(file, "utf8")).matchAll(HANGUL)) chars.add(ch);
  }
}

if (chars.size === 0) {
  console.error("no Hangul found; nothing to subset");
  process.exit(1);
}

const unicodes = [...chars]
  .map((ch) => ch.codePointAt(0)!.toString(16).toUpperCase())
  .sort()
  .join(",");

for (const [weight, name] of Object.entries(WEIGHTS)) {
  const input = path.join(SOURCE, "Masters", name, `SourceHanSerifKR-${name}.otf`);
  const output = path.join(OUT_DIR, `sourcehanserifkr-${weight}.woff2`);
  const proc = Bun.spawn(
    [
      "pyftsubset",
      input,
      `--unicodes=${unicodes}`,
      "--layout-features=*",
      "--flavor=woff2",
      `--output-file=${output}`,
    ],
    { stdout: "inherit", stderr: "inherit" },
  );
  if ((await proc.exited) !== 0) process.exit(1);
  console.log(`${path.relative(ROOT, output)}: ${(await stat(output)).size} bytes`);
}

console.log(`${chars.size} characters: ${[...chars].sort().join("")}`);
