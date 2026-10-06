#!/usr/bin/env bun
// Post-processes Hugo's build output to add favicon icons next to external
// links, gated by how often each domain is linked across the site's org
// sources. Must run after `hugo build`.
import { readFile, writeFile, glob } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { CONTENT_DIR, PUBLIC_DIR, ROOT, getSiteHost, normalizeHost } from "./site.ts";

const CONFIG_PATH = path.join(ROOT, "scripts", "favicon-config.json");

const URL_RE = /https?:\/\/[^\s\]\)"'<>]+/g;

interface FaviconConfig {
  minCount?: number;
  allowlist?: string[];
  blocklist?: string[];
}

async function countDomains(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for await (const file of glob("**/*.org", { cwd: CONTENT_DIR })) {
    const text = await readFile(path.join(CONTENT_DIR, file), "utf8");
    for (const raw of text.matchAll(URL_RE)) {
      const host = normalizeHost(raw[0].replace(/[.,;:]+$/, ""));
      if (!host) continue;
      counts.set(host, (counts.get(host) ?? 0) + 1);
    }
  }
  return counts;
}

async function main() {
  if (!existsSync(PUBLIC_DIR)) {
    console.error(
      `inject-favicons: ${PUBLIC_DIR} does not exist. Run "hugo build" first.`,
    );
    process.exit(1);
  }

  const config: FaviconConfig = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  const allowlist = new Set((config.allowlist ?? []).map((d) => d.toLowerCase()));
  const blocklist = new Set((config.blocklist ?? []).map((d) => d.toLowerCase()));
  const minCount = config.minCount ?? 2;

  const ownHost = await getSiteHost();
  const counts = await countDomains();

  const qualifies = (host: string | null): host is string => {
    if (!host) return false;
    if (host === ownHost || host === "localhost") return false;
    if (blocklist.has(host)) return false;
    if (allowlist.has(host)) return true;
    return (counts.get(host) ?? 0) >= minCount;
  };

  let filesChanged = 0;
  let iconsAdded = 0;

  for await (const file of glob("**/*.html", { cwd: PUBLIC_DIR })) {
    const filePath = path.join(PUBLIC_DIR, file);
    const html = await readFile(filePath, "utf8");
    if (!html.includes('class="post-content"')) continue;

    const $ = cheerio.load(html, { xmlMode: false });
    let changed = false;

    $(".post-content a[href^='http']").each((_, el) => {
      const $a = $(el);
      if ($a.closest("pre, code").length) return;
      if ($a.find("img.favicon-icon").length) return;

      const host = normalizeHost($a.attr("href")!);
      if (!qualifies(host)) return;

      $a.append(
        `<img class="favicon-icon" src="https://www.google.com/s2/favicons?sz=32&domain=${host}" alt="" loading="lazy" decoding="async">`,
      );
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
