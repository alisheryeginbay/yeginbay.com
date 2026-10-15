// Renders the maths remark-math finds ($…$ inline, $$…$$ on lines of their
// own) with KaTeX at build time, so pages ship the KaTeX stylesheet but no
// KaTeX JavaScript. Uses the KaTeX this site vendors the stylesheet and
// fonts of (public/vendor/katex/), rather than rehype-katex's own. A
// formula KaTeX can't parse is reported and left as it was written.
//
// A display formula becomes a paragraph of its own, so the paragraph after
// it is indented as one following a paragraph.
import type { Element, ElementContent, Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toString } from "hast-util-to-string";
import katex from "katex";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";

export default function rehypeMath() {
  return (tree: Root, file: VFile) => {
    // Shared across the page so \gdef macros carry over.
    const macros: Record<string, string> = {};

    const render = (tex: string, displayMode: boolean): ElementContent[] => {
      try {
        const html = katex.renderToString(tex, { displayMode, macros, throwOnError: true });
        return fromHtml(html, { fragment: true }).children as ElementContent[];
      } catch (err) {
        if (!(err instanceof katex.ParseError)) throw err;
        console.error(`rehype-math: ${file.path}: failed to parse \`${tex}\`: ${err.message}`);
        return [{ type: "text", value: displayMode ? `$$${tex}$$` : `$${tex}$` }];
      }
    };

    visit(tree, "element", (node, index, parent) => {
      if (!parent || index === undefined) return;
      const classes = (node.properties.className as string[] | undefined) ?? [];
      const code = node.tagName === "pre" ? (node.children[0] as Element | undefined) : node;
      const codeClasses = (code?.properties?.className as string[] | undefined) ?? [];
      if (node.tagName === "pre" && codeClasses.includes("math-display")) {
        const p: Element = { type: "element", tagName: "p", properties: {}, children: render(toString(code!), true) };
        parent.children.splice(index, 1, p);
        return SKIP;
      }
      if (node.tagName === "code" && classes.includes("math-inline")) {
        parent.children.splice(index, 1, ...render(toString(node), false));
        return SKIP;
      }
    });
  };
}
