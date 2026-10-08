// Favicon rules shared by scripts/inject-favicons.ts (build) and
// favicon-preview.ts (`hugo server`). Which hosts qualify is decided by
// layouts/partials/favicon-hosts.html.

// Links that get an icon, unless they sit inside SKIP_INSIDE.
export const LINK_SELECTOR = ".post-content a[href^='http']";
export const SKIP_INSIDE = "pre, code";
export const ICON_SELECTOR = "img.favicon-icon";

export function normalizeHost(rawUrl: string): string | null {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
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

export function faviconHtml(host: string, tail = ""): string {
  const icon = `<img class="favicon-icon" src="https://www.google.com/s2/favicons?sz=32&domain=${host}" alt="" loading="lazy" decoding="async">`;
  return `<span class="favicon-nowrap">${escapeHtml(tail)}${icon}</span>`;
}
