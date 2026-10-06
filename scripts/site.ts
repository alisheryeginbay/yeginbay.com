// Helpers shared by the post-build scripts.
import { readFile } from "node:fs/promises";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..");
export const CONTENT_DIR = path.join(ROOT, "content");
export const PUBLIC_DIR = path.join(ROOT, "public");

export function normalizeHost(rawUrl: string): string | null {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export async function getSiteHost(): Promise<string | null> {
  const toml = await readFile(path.join(ROOT, "hugo.toml"), "utf8");
  const match = toml.match(/baseURL\s*=\s*"([^"]+)"/);
  if (!match) return null;
  return normalizeHost(match[1]);
}
