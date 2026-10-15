// Links to other sites open in a new tab, while links within the site keep
// opening in the same one, and some get the site's logo after them (the
// rules are in link-icons.ts). Links inside code get no logo.
import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { visitParents } from "unist-util-visit-parents";
import { SITE } from "../../site.ts";
import { brandStyle, iconFor, iconHtml, normalizeHost, splitGluedTail } from "./link-icons.ts";

const OWN_HOST = normalizeHost(SITE.url);

export function isExternal(href: string): boolean {
  const url = href.startsWith("//") ? `https:${href}` : href;
  if (!/^https?:\/\//i.test(url)) return false;
  const host = normalizeHost(url);
  return Boolean(host) && host !== OWN_HOST && host !== "localhost";
}

export default function rehypeLinks() {
  return (tree: Root) => {
    visitParents(tree, "element", (node, ancestors) => {
      if (node.tagName !== "a" || typeof node.properties.href !== "string") return;
      const href = node.properties.href;
      if (isExternal(href)) {
        node.properties.target = "_blank";
        node.properties.rel = ["noopener", "noreferrer"];
      }

      if (!href.startsWith("http")) return;
      if (ancestors.some((a) => a.type === "element" && (a.tagName === "pre" || a.tagName === "code"))) return;
      const icon = iconFor(href);
      if (!icon) return;

      // Move the end of the link text into the icon's nowrap span.
      let tail = "";
      const last = node.children.at(-1);
      if (last?.type === "text") [last.value, tail] = splitGluedTail(last.value);
      node.properties.style = brandStyle(icon);
      node.children.push(fromHtml(iconHtml(icon, tail), { fragment: true }).children[0] as Element);
    });
  };
}
