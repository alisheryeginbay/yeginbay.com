#!/usr/bin/env node
// Post-processes Hugo's build output so links to other sites open in a new
// tab, while links within the site keep opening in the same tab. Org content
// can't use Hugo's Markdown link render hooks, so this runs after `hugo build`.
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { glob } from "node:fs/promises";
import * as cheerio from "cheerio";

const ROOT = path.resolve(import.meta.dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

function normalizeHost(rawUrl) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

async function getSiteHost() {
  const toml = await readFile(path.join(ROOT, "hugo.toml"), "utf8");
  const match = toml.match(/baseURL\s*=\s*"([^"]+)"/);
  if (!match) return null;
  return normalizeHost(match[1]);
}

async function main() {
  if (!existsSync(PUBLIC_DIR)) {
    console.error(
      `external-links: ${PUBLIC_DIR} does not exist. Run "hugo build" first.`,
    );
    process.exit(1);
  }

  const ownHost = await getSiteHost();
  const isExternal = (href) => {
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
      if (!isExternal($a.attr("href"))) return;
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
