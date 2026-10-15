// The site's Markdown pipeline: the plugins astro.config.ts gives Astro for
// posts, and the same steps for HTML that doesn't come from Markdown (posts
// written in Typst) and for Markdown outside posts (book reviews).
import type { Root } from "hast";
import { fromHtml } from "hast-util-from-html";
import { toHtml } from "hast-util-to-html";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import remarkSmartypants from "remark-smartypants";
import type { RehypePlugins, RemarkPlugins } from "@astrojs/markdown-remark";
import { unified, type PluggableList } from "unified";
import { VFile } from "vfile";
import rehypeHeadings, { type Heading } from "./rehype-headings.ts";
import rehypeLinks from "./rehype-links.ts";
import rehypeMath from "./rehype-math.ts";
import rehypeSidenotes from "./rehype-sidenotes.ts";
import remarkPostInfo from "./remark-post-info.ts";
import remarkViz from "./remark-viz.ts";

export type { Heading };

// --- and -- become dashes and ... an ellipsis, as Org exported them;
// quotes stay straight.
export const smartypants = { dashes: "oldschool", quotes: false, backticks: false } as const;

export const remarkPlugins: RemarkPlugins = [remarkMath, remarkPostInfo, remarkViz];

// Headings take their ids before footnotes become sidenotes, so a heading
// holding a footnote is still seen to hold a link.
export const rehypePlugins: RehypePlugins = [rehypeMath, rehypeHeadings, rehypeSidenotes, rehypeLinks];

// Runs the rehype plugins, after any in `before`, over HTML from elsewhere.
// Returns the HTML and its headings, for the table of contents.
export async function processHtml(html: string, path: string, before: PluggableList = []): Promise<{ html: string; headings: Heading[] }> {
  const file = new VFile({ path });
  const tree = fromHtml(html, { fragment: true });
  const processor = unified().use(before).use(rehypePlugins as PluggableList);
  const out = (await processor.run(tree, file)) as Root;
  return { html: toHtml(out), headings: (file.data.toc as Heading[]) ?? [] };
}

// Markdown outside posts, such as a book's review, rendered like a post's.
export async function renderMarkdown(markdown: string, path: string): Promise<string> {
  const file = new VFile({ path, value: markdown });
  const out = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkSmartypants, smartypants)
    .use(remarkMath)
    .use(remarkRehype)
    .use(rehypePlugins as PluggableList)
    .use(rehypeStringify)
    .process(file);
  return String(out);
}
