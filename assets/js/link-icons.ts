// Link icon rules shared by scripts/inject-link-icons.ts (build) and
// link-icons-preview.ts (`hugo server`).
import {
  siArxiv,
  siGithub,
  siSubstack,
  siWikipedia,
  siX,
  siYoutube,
} from "simple-icons";

// A monochrome 24×24 logo, shown in the muted text colour and switched to
// `hex` while its link is hovered.
type Icon = { title: string; path: string; hex: string };

// Which logo goes next to links to which site. A rule for "wikipedia.org"
// also covers its subdomains, such as en.wikipedia.org. Logos come from
// Simple Icons (https://simpleicons.org); to recolour one, spread it and
// override `hex`, e.g. { ...siGithub, hex: "333333" }.
const RULES: Record<string, Icon> = {
  "arxiv.org": siArxiv,
  "github.com": siGithub,
  "substack.com": siSubstack,
  "twitter.com": siX,
  "wikipedia.org": siWikipedia,
  "x.com": siX,
  "youtube.com": siYoutube,
};

// Links that get an icon, unless they sit inside SKIP_INSIDE.
export const LINK_SELECTOR = ".post-content a[href^='http']";
export const SKIP_INSIDE = "pre, code";
export const ICON_SELECTOR = ".link-icon";

export function normalizeHost(rawUrl: string): string | null {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

export function iconFor(href: string): Icon | null {
  const host = normalizeHost(href);
  if (!host) return null;
  for (const [domain, icon] of Object.entries(RULES)) {
    if (host === domain || host.endsWith(`.${domain}`)) return icon;
  }
  return null;
}

// How many characters at the end of the link text stay glued to the icon, so
// the icon never wraps onto a new line by itself. Kept short so a long URL
// used as link text can still break.
const GLUED_CHARS = 4;

// Splits a link's last text node into the part that may wrap and the tail
// that goes into the nowrap span with the icon.
export function splitGluedTail(text: string): [head: string, tail: string] {
  const chars = Array.from(text);
  const tail = chars.slice(-GLUED_CHARS);
  // Whitespace inside the tail would be a break point the span suppresses, so
  // only glue the characters after it.
  const lastSpace = tail.findLastIndex((c) => /\s/.test(c));
  const glued = tail.slice(lastSpace + 1);
  return [chars.slice(0, chars.length - glued.length).join(""), glued.join("")];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function iconHtml(icon: Icon, tail = ""): string {
  const svg = `<svg class="link-icon" viewBox="0 0 24 24" style="--brand:#${icon.hex}" aria-hidden="true"><path d="${icon.path}"/></svg>`;
  return `<span class="link-icon-nowrap">${escapeHtml(tail)}${svg}</span>`;
}
