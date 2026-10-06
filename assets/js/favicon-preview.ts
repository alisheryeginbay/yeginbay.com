// Adds favicons in the browser under `hugo server`, which skips the
// post-build scripts. Production builds use scripts/inject-favicons.ts.
import { ICON_SELECTOR, LINK_SELECTOR, SKIP_INSIDE, faviconHtml, normalizeHost } from "./favicons.ts";

const hosts = new Set<string>(JSON.parse(document.currentScript!.dataset.hosts!));

document.querySelectorAll<HTMLAnchorElement>(LINK_SELECTOR).forEach((a) => {
  if (a.closest(SKIP_INSIDE) || a.querySelector(ICON_SELECTOR)) return;
  const host = normalizeHost(a.getAttribute("href")!);
  if (host && hosts.has(host)) a.insertAdjacentHTML("beforeend", faviconHtml(host));
});
