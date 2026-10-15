// Gives each heading below the title a readable id (`Experiment Setup`
// becomes `experiment-setup`, repeated titles `results`, `results-1`, …),
// makes it a link to itself with a § the CSS hangs in the margin to its left
// as a hint, and puts a button after the heading text that copies the link
// (src/scripts/heading-copy.ts). A heading that already holds a link or a
// footnote can't go inside another link, so the § alone is its link
// instead, and so it is for one inside a <summary>, where a click opens the
// details.
//
// The headings are kept for the table of contents: in the front matter as
// `toc` for Markdown, and in `file.data.toc` otherwise.
import Slugger from "github-slugger";
import type { Element, ElementContent, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toString } from "hast-util-to-string";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";

export type Heading = { depth: number; slug: string; text: string };

const COPY = `<button type="button" class="heading-copy" aria-label="Copy link to this section"><svg class="heading-copy-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><svg class="heading-copied-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></button>`;

const copyButton = () => fromHtml(COPY, { fragment: true }).children[0] as Element;

// The heading's text, without the numbers of footnotes in it.
function headingText(node: Element): string {
  const clone = structuredClone(node);
  visit(clone, "element", (el, i, parent) => {
    if (el.tagName === "sup" && parent && i !== undefined) {
      parent.children.splice(i, 1);
      return [SKIP, i];
    }
  });
  return toString(clone).trim();
}

function holdsInteractive(node: Element): boolean {
  let found = false;
  visit(node, "element", (el) => {
    if (el !== node && ["a", "label", "input", "button"].includes(el.tagName)) found = true;
  });
  return found;
}

export function anchorHeading(node: Element, unlinked: boolean) {
  const id = String(node.properties.id);
  const children = node.children;
  if (unlinked || holdsInteractive(node)) {
    node.children = [
      { type: "element", tagName: "a", properties: { className: ["heading-anchor"], href: `#${id}`, ariaLabel: "Link to this section" }, children: [{ type: "text", value: "§" }] },
      ...children,
      copyButton(),
    ];
  } else {
    const anchor: ElementContent = { type: "element", tagName: "span", properties: { className: ["heading-anchor"], ariaHidden: "true" }, children: [{ type: "text", value: "§" }] };
    node.children = [
      { type: "element", tagName: "a", properties: { className: ["heading-link"], href: `#${id}` }, children: [anchor, ...children] },
      copyButton(),
    ];
  }
}

export default function rehypeHeadings() {
  return (tree: Root, file: VFile) => {
    const slugger = new Slugger();
    const headings: Heading[] = [];
    visit(tree, "element", (node, _, parent) => {
      const level = /^h([2-6])$/.exec(node.tagName)?.[1];
      if (!level) return;
      // The footnotes' heading, which rehype-sidenotes.ts removes.
      if (parent?.type === "element" && parent.properties.dataFootnotes !== undefined) return SKIP;
      const text = headingText(node);
      if (typeof node.properties.id !== "string") node.properties.id = slugger.slug(text);
      headings.push({ depth: Number(level), slug: node.properties.id as string, text });
      anchorHeading(node, parent?.type === "element" && parent.tagName === "summary");
      return SKIP;
    });
    const astro = file.data.astro as { frontmatter?: Record<string, unknown> } | undefined;
    if (astro?.frontmatter) astro.frontmatter.toc = headings;
    file.data.toc = headings;
  };
}
