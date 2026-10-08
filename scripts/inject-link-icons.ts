#!/usr/bin/env bun
// Post-processes Hugo's build output to add site logos next to external
// links. Which sites get which logo is decided by the rules in
// assets/js/link-icons.ts. Must run after `hugo build`.
import { readFile, writeFile, glob } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { ICON_SELECTOR, LINK_SELECTOR, SKIP_INSIDE, iconFor, iconHtml, splitGluedTail } from "../assets/js/link-icons.ts";
import { PUBLIC_DIR } from "./site.ts";

async function main() {
  if (!existsSync(PUBLIC_DIR)) {
    console.error(
      `inject-link-icons: ${PUBLIC_DIR} does not exist. Run "hugo build" first.`,
    );
    process.exit(1);
  }

  let filesChanged = 0;
  let iconsAdded = 0;

  for await (const file of glob("**/*.html", { cwd: PUBLIC_DIR })) {
    const filePath = path.join(PUBLIC_DIR, file);
    const html = await readFile(filePath, "utf8");
    if (!html.includes('class="post-content')) continue;

    const $ = cheerio.load(html, { xmlMode: false });
    let changed = false;

    $(LINK_SELECTOR).each((_, el) => {
      const $a = $(el);
      if ($a.closest(SKIP_INSIDE).length) return;
      if ($a.find(ICON_SELECTOR).length) return;

      const icon = iconFor($a.attr("href")!);
      if (!icon) return;

      // Move the end of the link text into the icon's nowrap span.
      let tail = "";
      const last = $a.contents().last()[0];
      if (last?.type === "text") [last.data, tail] = splitGluedTail(last.data);

      $a.append(iconHtml(icon, tail));
      changed = true;
      iconsAdded += 1;
    });

    if (changed) {
      await writeFile(filePath, $.html());
      filesChanged += 1;
    }
  }

  console.log(
    `inject-link-icons: added ${iconsAdded} icon(s) across ${filesChanged} file(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
