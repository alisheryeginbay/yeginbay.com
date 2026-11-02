// A post's text as HTML that reads on its own, outside the site: for the
// full text in feeds. Scripts, buttons and decorative icons are dropped,
// maths keeps only its MathML (KaTeX's HTML needs the site's stylesheet),
// interactive figures become a link to the post, and every address is made
// absolute.
import mdxRenderer from "@astrojs/mdx/server.js";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import type { Element, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import { SKIP, visit } from "unist-util-visit";
import { postComponents } from "../components/post-components.ts";
import { SITE } from "../site.ts";
import { renderPost, type Post } from "./posts.ts";

let container: Promise<AstroContainer> | undefined;

async function html(post: Post): Promise<string> {
  if (post.section !== "posts") return post.entry.rendered?.html ?? "";
  container ??= AstroContainer.create().then((c) => {
    c.addServerRenderer({ name: "astro:jsx", renderer: mdxRenderer });
    return c;
  });
  const { Content } = await renderPost(post);
  return (await container).renderToString(Content, { props: { components: postComponents } });
}

const classes = (el: Element) => {
  const c = el.properties.className;
  return Array.isArray(c) ? c.map(String) : [];
};

const URL_PROPS = ["href", "src", "poster"] as const;

export async function postHtml(post: Post): Promise<string> {
  const page = new URL(post.url, SITE.url);
  const tree = fromHtml(await html(post), { fragment: true }) as Root;

  visit(tree, "element", (el, i, parent) => {
    if (!parent || i === undefined) return;
    const drop = (): [typeof SKIP, number] => {
      parent.children.splice(i, 1);
      return [SKIP, i];
    };
    if (["script", "style", "button", "template"].includes(el.tagName)) return drop();
    if (el.tagName === "svg" && el.properties.ariaHidden === "true") return drop();
    if (classes(el).includes("katex-html")) return drop();
    if (classes(el).includes("viz-mount")) {
      parent.children[i] = fromHtml(`<p><a href="${page.href}">An interactive figure: see it in the post.</a></p>`, {
        fragment: true,
      }).children[0] as Element;
      return SKIP;
    }
    for (const prop of URL_PROPS) {
      const value = el.properties[prop];
      if (typeof value === "string" && !/^[a-z][a-z0-9+.-]*:/i.test(value)) el.properties[prop] = new URL(value, page).href;
    }
    // srcset is "url width, url width, …".
    const srcSet = el.properties.srcSet;
    if (typeof srcSet === "string") {
      el.properties.srcSet = srcSet.replace(/(^|,\s*)([^\s,]+)/g, (_, sep: string, url: string) => sep + new URL(url, page).href);
    }
  });

  return toHtml(tree);
}
