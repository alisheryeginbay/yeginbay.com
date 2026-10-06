// Helpers shared by the post-build scripts.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeHost } from "../assets/js/favicons.ts";

export { normalizeHost };

export const ROOT = path.resolve(import.meta.dirname, "..");
export const PUBLIC_DIR = path.join(ROOT, "public");

export async function getSiteHost(): Promise<string | null> {
  const toml = await readFile(path.join(ROOT, "hugo.toml"), "utf8");
  const match = toml.match(/baseURL\s*=\s*"([^"]+)"/);
  if (!match) return null;
  return normalizeHost(match[1]);
}
