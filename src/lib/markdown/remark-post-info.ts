// Notes in the front matter what the layout needs to know about a post's
// text: whether it starts with a letter (`startsWithLetter`, for the drop
// cap, whose font only has A to Z), whether it has maths (`hasMath`, for the
// KaTeX stylesheet), and a plain-text summary (`summary`, for feeds and the
// description): the opening paragraphs, up to about SUMMARY_WORDS words.
import type { Root } from "mdast";
import { toString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";
import type { VFile } from "vfile";

const SUMMARY_WORDS = 70;

export default function remarkPostInfo() {
  return (tree: Root, file: VFile) => {
    const frontmatter = (file.data.astro as { frontmatter?: Record<string, unknown> } | undefined)?.frontmatter;
    if (!frontmatter) return;

    // Everything a reader sees, which leaves out imports and exports.
    const shown = tree.children.filter((n) => !["mdxjsEsm", "yaml"].includes(n.type));
    frontmatter.startsWithLetter = /^\s*[A-Za-z]/.test(shown.map((n) => toString(n)).join(" "));

    let hasMath = false;
    visit(tree, ["math", "inlineMath"], () => {
      hasMath = true;
    });
    frontmatter.hasMath = hasMath;

    const paragraphs: string[] = [];
    let words = 0;
    for (const node of shown) {
      if (node.type !== "paragraph") continue;
      const text = toString(node).replace(/\s+/g, " ").trim();
      if (!text) continue;
      paragraphs.push(text);
      words += text.split(" ").length;
      if (words >= SUMMARY_WORDS) break;
    }
    frontmatter.summary = paragraphs.join(" ");
  };
}
