#!/usr/bin/env bun
// Post-processes Hugo's build output to add favicon icons next to external
// links. The hosts that qualify are chosen by
// layouts/partials/favicon-hosts.html, which Hugo publishes as
// favicon-hosts.json. Must run after `hugo build`.
import { readFile, writeFile, rm, glob } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { ICON_SELECTOR, LINK_SELECTOR, SKIP_INSIDE, faviconHtml } from "../assets/js/favicons.ts";
import { PUBLIC_DIR, normalizeHost } from "./site.ts";

const HOSTS_PATH = path.join(PUBLIC_DIR, "favicon-hosts.json");

async function main() {
  if (!existsSync(HOSTS_PATH)) {
    console.error(
      `inject-favicons: ${HOSTS_PATH} does not exist. Run "hugo build" first.`,
    );
    process.exit(1);
  }

  const hosts = new Set<string>(JSON.parse(await readFile(HOSTS_PATH, "utf8")));
  // Only this script needs the list, so it isn't deployed.
  await rm(HOSTS_PATH);

  let filesChanged = 0;
  let iconsAdded = 0;

  for await (const file of glob("**/*.html", { cwd: PUBLIC_DIR })) {
    const filePath = path.join(PUBLIC_DIR, file);
    const html = await readFile(filePath, "utf8");
    if (!html.includes('class="post-content"')) continue;

    const $ = cheerio.load(html, { xmlMode: false });
    let changed = false;

    $(LINK_SELECTOR).each((_, el) => {
      const $a = $(el);
      if ($a.closest(SKIP_INSIDE).length) return;
      if ($a.find(ICON_SELECTOR).length) return;

      const host = normalizeHost($a.attr("href")!);
      if (!host || !hosts.has(host)) return;

      $a.append(faviconHtml(host));
      changed = true;
      iconsAdded += 1;
    });

    if (changed) {
      await writeFile(filePath, $.html());
      filesChanged += 1;
    }
  }

  console.log(
    `inject-favicons: added ${iconsAdded} icon(s) across ${filesChanged} file(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
