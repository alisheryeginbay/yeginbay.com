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

export function faviconHtml(host: string): string {
  return `<img class="favicon-icon" src="https://www.google.com/s2/favicons?sz=32&domain=${host}" alt="" loading="lazy" decoding="async">`;
}
