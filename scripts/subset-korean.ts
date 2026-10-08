#!/usr/bin/env bun
// Subsets Source Han Serif KR down to the Hangul the site actually uses.
// Runs before `hugo` in `bun run build`: reads the Hangul-only fonts in
// assets/fonts/ and writes assets/fonts/subset/sourcehanserifkr-{400,600}.woff2
// (gitignored), which layouts/partials/korean-font.html fingerprints. Under
// `hugo server` the full Hangul fonts are used instead, so drafts need no rerun.
//
// The Hangul-only fonts come from Adobe's sources
// (github.com/adobe-fonts/source-han-serif), built with AFDKO's makeotf per the
// "Korean" lines in its COMMANDS.txt, then cut down with
//   pyftsubset SourceHanSerifKR-Regular.otf --layout-features='*' --flavor=woff2 \
//     --unicodes=1100-11FF,3130-318F,A960-A97F,AC00-D7FF
import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import subsetFont from "subset-font";
import { ROOT } from "./site.ts";

const FONT_DIR = path.join(ROOT, "assets", "fonts");
const OUT_DIR = path.join(FONT_DIR, "subset");
const SCAN = ["content", "data", "layouts", "hugo.toml"];
const WEIGHTS = [400, 600];

// Jamo, compatibility jamo, extended jamo and syllables: the same ranges as the
// fonts' unicode-range in layouts/partials/korean-font.html.
const HANGUL = /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-퟿]/gu;

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

// Without Hangul there is nothing to subset, and the partial emits no fonts.
await rm(OUT_DIR, { recursive: true, force: true });
if (chars.size === 0) process.exit(0);
await mkdir(OUT_DIR, { recursive: true });

const text = [...chars].sort().join("");
for (const weight of WEIGHTS) {
  const source = await readFile(path.join(FONT_DIR, `sourcehanserifkr-hangul-${weight}.woff2`));
  const subset = await subsetFont(source, text, { targetFormat: "woff2" });
  await writeFile(path.join(OUT_DIR, `sourcehanserifkr-${weight}.woff2`), subset);
}

console.log(`subset-korean: ${chars.size} characters`);
