// Turns citations in a post's text into links to its `references` (in the
// front matter, src/content.config.ts). In the text:
//
//   As the Othello paper showed [@li2022], …
//   Several works agree [@li2022; @nanda2023].
//
// A citation is numbered by the reference's place in the list, so [@li2022]
// becomes [1] when li2022 is the first reference, linking to #ref-li2022. A
// key that isn't in the list fails the build. How many times each key is
// cited is noted as `citations` in the front matter, for the links from each
// reference back to where it's cited (src/components/Sources.astro).
//
// Only for posts written in Markdown: in Typst, @key is already a reference.
import type { PhrasingContent, Root, Text } from "mdast";
import { SKIP, visit } from "unist-util-visit";
import type { VFile } from "vfile";

const CITATION = /\[(@[\w-]+(?:\s*;\s*@[\w-]+)*)\]/g;

type Raw = { key?: unknown; title?: unknown; author?: unknown; year?: unknown };

// "Kenneth Li et al., Emergent World Representations (2022)", for the
// citation's tooltip.
function describe(ref: Raw): string | undefined {
  const title = typeof ref.title === "string" ? ref.title : undefined;
  if (!title) return undefined;
  const author = typeof ref.author === "string" ? `${ref.author}, ` : "";
  const year = ref.year !== undefined ? ` (${ref.year})` : "";
  return `${author}${title}${year}`;
}

export default function remarkCitations() {
  return (tree: Root, file: VFile) => {
    const frontmatter = (file.data.astro as { frontmatter?: Record<string, unknown> } | undefined)?.frontmatter;
    if (!frontmatter) return;

    // The front matter isn't validated yet, so read it with care.
    const references = Array.isArray(frontmatter.references) ? (frontmatter.references as unknown[]) : [];
    const byKey = new Map<string, { n: number; ref: Raw }>();
    references.forEach((ref, i) => {
      if (ref && typeof ref === "object" && typeof (ref as Raw).key === "string") byKey.set((ref as Raw).key as string, { n: i + 1, ref: ref as Raw });
    });

    const counts: Record<string, number> = {};
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === undefined || !node.value.includes("[@")) return;
      const out: PhrasingContent[] = [];
      let last = 0;
      for (const match of node.value.matchAll(CITATION)) {
        if (match.index > last) out.push({ type: "text", value: node.value.slice(last, match.index) });
        const keys = match[1].split(";").map((k) => k.trim().slice(1));
        const children: PhrasingContent[] = [{ type: "text", value: "[" }];
        keys.forEach((key, i) => {
          const found = byKey.get(key);
          if (!found) throw new Error(`${file.path}: [@${key}] cites a key that isn't in the front matter's references`);
          counts[key] = (counts[key] ?? 0) + 1;
          if (i > 0) children.push({ type: "text", value: ", " });
          children.push({
            type: "link",
            url: `#ref-${key}`,
            title: describe(found.ref),
            children: [{ type: "text", value: String(found.n) }],
            data: { hProperties: { id: `cite-${key}-${counts[key]}` } },
          });
        });
        children.push({ type: "text", value: "]" });
        // A span, so the brackets and numbers don't break across lines.
        out.push({ type: "citation", children, data: { hName: "span", hProperties: { className: ["cite"] } } } as unknown as PhrasingContent);
        last = match.index + match[0].length;
      }
      if (last === 0) return;
      if (last < node.value.length) out.push({ type: "text", value: node.value.slice(last) });
      parent.children.splice(index, 1, ...(out as typeof parent.children));
      return [SKIP, index + out.length];
    });
    frontmatter.citations = counts;
  };
}
