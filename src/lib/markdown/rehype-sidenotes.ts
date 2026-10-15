// Turns footnotes into Tufte-style sidenotes: each note moves next to its
// first reference, and the footnote list at the end is dropped. Repeated
// references keep their number but no note. A paragraph inside a <p> isn't
// valid HTML, so note paragraphs become block-level spans, and a note that
// holds anything other than paragraphs and inline markup fails the build.
//
// Takes the markup remark-rehype gives GFM footnotes: references are
// <sup><a data-footnote-ref href="#user-content-fn-x">1</a></sup>, and the
// notes a <section data-footnotes> list of <li id="user-content-fn-x">.
import type { Element, ElementContent, Root } from "hast";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";

const BLOCK = new Set(["div", "ul", "ol", "dl", "pre", "table", "blockquote", "figure", "h1", "h2", "h3", "h4", "h5", "h6"]);

const el = (tagName: string, properties: Element["properties"], children: ElementContent[]): Element => ({ type: "element", tagName, properties, children });
const text = (value: string): ElementContent => ({ type: "text", value });

export default function rehypeSidenotes() {
  return (tree: Root, file: VFile) => {
    const notes = new Map<string, ElementContent[]>();

    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "section" || node.properties.dataFootnotes === undefined) return;
      visit(node, "element", (li) => {
        if (li.tagName !== "li" || typeof li.properties.id !== "string") return;
        notes.set(li.properties.id, noteBody(li, file));
        return SKIP;
      });
      parent!.children.splice(index!, 1);
      return [SKIP, index!];
    });

    const seen = new Set<string>();
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "sup") return;
      const a = node.children.find((c): c is Element => c.type === "element" && c.properties.dataFootnoteRef !== undefined);
      if (!a || !parent || index === undefined) return;
      const id = String(a.properties.href).replace(/^#/, "");
      const n = a.children.map((c) => (c.type === "text" ? c.value : "")).join("");
      const note = notes.get(id);
      if (!note) throw new Error(`${file.path}: footnote ${n} has no definition`);

      const replacement: ElementContent[] = seen.has(id)
        ? [el("span", { className: ["sidenote-number"] }, [text(n)])]
        : [
            el("label", { htmlFor: [`sidenote-${n}`], className: ["margin-toggle", "sidenote-number"] }, [text(n)]),
            el("input", { type: "checkbox", id: `sidenote-${n}`, className: ["margin-toggle"] }, []),
            el("span", { className: ["sidenote"] }, [el("span", { className: ["sidenote-number"] }, [text(n)]), text(" "), ...note]),
          ];
      seen.add(id);
      parent.children.splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });
  };
}

// A note's paragraphs as spans, without the link back to the reference.
function noteBody(li: Element, file: VFile): ElementContent[] {
  visit(li, "element", (node, index, parent) => {
    if (node.properties.dataFootnoteBackref !== undefined && parent && index !== undefined) {
      parent.children.splice(index, 1);
      return [SKIP, index];
    }
  });
  const body: ElementContent[] = [];
  for (const child of li.children) {
    if (child.type === "text" && !child.value.trim()) continue;
    if (child.type === "element" && BLOCK.has(child.tagName)) {
      throw new Error(`${file.path}: footnote ${li.properties.id} contains <${child.tagName}>, which can't go in a sidenote; keep footnotes to paragraphs and inline markup`);
    }
    if (child.type === "element" && child.tagName === "p") {
      // The space that stood before the link back.
      let last = child.children.at(-1);
      while (last?.type === "text" && !(last.value = last.value.trimEnd())) {
        child.children.pop();
        last = child.children.at(-1);
      }
      body.push(el("span", { className: ["sidenote-paragraph"] }, child.children));
    } else {
      body.push(child);
    }
  }
  return body;
}
