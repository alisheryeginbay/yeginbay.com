#!/usr/bin/env bun
// Post-processes Hugo's build output so links to other sites open in a new
// tab, while links within the site keep opening in the same tab. Org content
// can't use Hugo's Markdown link render hooks, so this runs after `hugo build`.
import { readFile, writeFile, glob } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { PUBLIC_DIR, getSiteHost, normalizeHost } from "./site.ts";

async function main() {
  if (!existsSync(PUBLIC_DIR)) {
    console.error(
      `external-links: ${PUBLIC_DIR} does not exist. Run "hugo build" first.`,
    );
    process.exit(1);
  }

  const ownHost = await getSiteHost();
  const isExternal = (href: string) => {
    const url = href.startsWith("//") ? `https:${href}` : href;
    if (!/^https?:\/\//i.test(url)) return false;
    const host = normalizeHost(url);
    return Boolean(host) && host !== ownHost && host !== "localhost";
  };

  let filesChanged = 0;
  let linksUpdated = 0;

  for await (const file of glob("**/*.html", { cwd: PUBLIC_DIR })) {
    const filePath = path.join(PUBLIC_DIR, file);
    const html = await readFile(filePath, "utf8");
    const $ = cheerio.load(html, { xmlMode: false });
    let changed = false;

    $("a[href]").each((_, el) => {
      const $a = $(el);
      if (!isExternal($a.attr("href")!)) return;
      if ($a.attr("target") === "_blank" && $a.attr("rel") === "noopener noreferrer") return;

      $a.attr("target", "_blank");
      $a.attr("rel", "noopener noreferrer");
      changed = true;
      linksUpdated += 1;
    });

    if (changed) {
      await writeFile(filePath, $.html());
      filesChanged += 1;
    }
  }

  console.log(
    `external-links: updated ${linksUpdated} link(s) across ${filesChanged} file(s).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
