// Adds link icons in the browser under `hugo server`, which skips the
// post-build scripts. Production builds use scripts/inject-link-icons.ts.
import { ICON_SELECTOR, LINK_SELECTOR, SKIP_INSIDE, brandStyle, iconFor, iconHtml, splitGluedTail } from "./link-icons.ts";

document.querySelectorAll<HTMLAnchorElement>(LINK_SELECTOR).forEach((a) => {
  if (a.closest(SKIP_INSIDE) || a.querySelector(ICON_SELECTOR)) return;
  const icon = iconFor(a.getAttribute("href")!);
  if (!icon) return;

  // Move the end of the link text into the icon's nowrap span.
  let tail = "";
  const last = a.lastChild;
  if (last instanceof Text) [last.data, tail] = splitGluedTail(last.data);

  a.setAttribute("style", brandStyle(icon));
  a.insertAdjacentHTML("beforeend", iconHtml(icon, tail));
});
