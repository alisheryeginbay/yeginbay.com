// Adds favicons in the browser under `hugo server`, which skips the
// post-build scripts. Production builds use scripts/inject-favicons.ts.
import { ICON_SELECTOR, LINK_SELECTOR, SKIP_INSIDE, faviconHtml, normalizeHost, splitGluedTail } from "./favicons.ts";

const hosts = new Set<string>(JSON.parse(document.currentScript!.dataset.hosts!));

document.querySelectorAll<HTMLAnchorElement>(LINK_SELECTOR).forEach((a) => {
  if (a.closest(SKIP_INSIDE) || a.querySelector(ICON_SELECTOR)) return;
  const host = normalizeHost(a.getAttribute("href")!);
  if (!host || !hosts.has(host)) return;

  // Move the end of the link text into the icon's nowrap span.
  let tail = "";
  const last = a.lastChild;
  if (last instanceof Text) [last.data, tail] = splitGluedTail(last.data);

  a.insertAdjacentHTML("beforeend", faviconHtml(host, tail));
});
