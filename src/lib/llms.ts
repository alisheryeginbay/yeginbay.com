// The site for language models: /llms.txt, an index of the writing in
// Markdown (https://llmstxt.org), and /llms-full.txt, every listed post's
// source in one file.
import { readFile } from "node:fs/promises";
import { SITE } from "../site.ts";
import { isoDate } from "./dates.ts";
import { listedPosts, renderPost, type Post } from "./posts.ts";

const abs = (path: string) => new URL(path, SITE.url).href;
const text = (body: string) => new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });

// What a post is about: its description, or else its opening paragraphs.
export async function postDescription(post: Post): Promise<string> {
  return post.description ?? (await renderPost(post)).summary;
}

const SECTIONS: { section: Post["section"]; heading: string; note: string }[] = [
  { section: "posts", heading: "Posts", note: "Essays and notes. Each links to its MDX source." },
  { section: "proofs", heading: "Proofs", note: "Worked proofs, written in Typst. Each links to its Typst source." },
];

const meta = (post: Post) =>
  [isoDate(post.date), post.status !== "finished" && post.status, post.tags.length > 0 && post.tags.join(", ")].filter(Boolean).join("; ");

export async function llmsTxt(): Promise<Response> {
  const posts = await listedPosts();
  const sections = await Promise.all(
    SECTIONS.map(async ({ section, heading, note }) => {
      const rows = await Promise.all(
        posts
          .filter((p) => p.section === section)
          .map(async (p) => {
            const description = (await postDescription(p)).replace(/\s+/g, " ").trim();
            return `- [${p.title}](${abs(p.sourceUrl)}) (${meta(p)})${description ? `: ${description}` : ""}`;
          }),
      );
      return rows.length ? `## ${heading}\n\n${note}\n\n${rows.join("\n")}` : "";
    }),
  );
  return text(`# ${SITE.title}

> ${SITE.description}

Every post is published as its source next to the page: ${abs("/about")} has its source at ${abs("/about.mdx")} (or ${abs("/about.md")}), and ${abs("/proofs/ladr")} at ${abs("/proofs/ladr.typ")}. Every listed post's source, in one file: ${abs("/llms-full.txt")}. The writing is under the licence at ${abs("/LICENSE")}.

${sections.filter(Boolean).join("\n\n")}

## Optional

- [Home](${abs("/")}): who I am and what I'm working on
- [Books](${abs("/books")}): what I've read and am reading
- [Music](${abs("/music")}): what I'm listening to
- [RSS feed](${abs("/index.xml")})
- [Sitemap](${abs("/sitemap.xml")})
`);
}

// A post's source, without its front matter, which the header restates.
async function body(post: Post): Promise<string> {
  const source = await readFile(post.source, "utf8");
  return source.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
}

export async function llmsFullTxt(): Promise<Response> {
  const posts = await listedPosts();
  const parts = await Promise.all(
    posts.map(async (p) => {
      const header = [
        `# ${p.title}`,
        "",
        `URL: ${abs(p.url)}`,
        `Source: ${abs(p.sourceUrl)}`,
        `Authors: ${p.authors.join(", ")}`,
        `Published: ${isoDate(p.date)}`,
        p.lastmod > p.date && `Updated: ${isoDate(p.lastmod)}`,
        p.status !== "finished" && `Status: ${p.status}`,
        p.tags.length > 0 && `Tags: ${p.tags.join(", ")}`,
      ].filter((line) => line !== false);
      return `${header.join("\n")}\n\n${await body(p)}`;
    }),
  );
  return text(`# ${SITE.title}: everything

> ${SITE.description} Every listed post, newest first, as its source (MDX or Typst). Posts are separated by a line of = signs.

${parts.join("\n\n" + "=".repeat(80) + "\n\n")}
`);
}
