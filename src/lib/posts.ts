// Posts from every section, in one shape for the layouts: posts written in
// MDX (content/posts/) and in Typst (content/proofs/).
import { getCollection, render, type CollectionEntry } from "astro:content";
import { SITE } from "../site.ts";
import { lastCommitDate } from "./git.ts";
import type { Heading } from "./markdown/index.ts";
import type { TypstMetadata } from "./typst.ts";

export type Section = "posts" | "proofs";

export type Post = {
  section: Section;
  entry: CollectionEntry<Section>;
  // Without a trailing slash: /about, /proofs/ladr.
  url: string;
  title: string;
  date: Date;
  lastmod: Date;
  status: "notes" | "draft" | "finished";
  tags: string[];
  authors: string[];
  noindex: boolean;
  aliases: string[];
  description?: string;
  // The source file, relative to the repo root, and where it's published.
  source: string;
  sourceUrl: string;
};

// Posts in the section's URL space: posts at the root, others under their
// section's name.
const prefix = (section: Section) => (section === "posts" ? "" : `/${section}`);

function toPost(section: Section, entry: CollectionEntry<Section>): Post {
  const { data } = entry;
  const source = entry.filePath!;
  const url = `${prefix(section)}/${entry.id}`;
  return {
    section,
    entry,
    url,
    title: data.title,
    date: data.date,
    lastmod: (section === "posts" ? lastCommitDate(source) : undefined) ?? data.lastmod ?? data.date,
    status: data.status,
    tags: data.tags,
    authors: data.authors ?? [SITE.author],
    noindex: data.noindex,
    aliases: data.aliases,
    description: data.description,
    source,
    sourceUrl: url + source.slice(source.lastIndexOf(".")),
  };
}

let cache: Promise<Post[]> | undefined;

// Every post, newest first. Drafts (`draft: true`) only under `astro dev`.
export function allPosts(): Promise<Post[]> {
  cache ??= (async () => {
    const sections: Section[] = ["posts", "proofs"];
    const posts = (
      await Promise.all(sections.map(async (section) => (await getCollection(section)).map((entry) => toPost(section, entry))))
    ).flat();
    return posts.filter((p) => import.meta.env.DEV || !p.entry.data.draft).sort((a, b) => b.date.getTime() - a.date.getTime());
  })();
  return cache;
}

// The posts that are listed: everything but `noindex: true` ones, which are
// built but kept out of the writings list, tag pages, feeds and the sitemap.
export async function listedPosts(): Promise<Post[]> {
  return (await allPosts()).filter((p) => !p.noindex);
}

export type Rendered = {
  Content: Awaited<ReturnType<typeof render>>["Content"];
  headings: Heading[];
  // Front matter remark-post-info.ts works out from the text.
  startsWithLetter: boolean;
  hasMath: boolean;
  summary: string;
  typstCss?: string;
};

export async function renderPost(post: Post): Promise<Rendered> {
  const { Content, headings, remarkPluginFrontmatter: fm } = await render(post.entry);
  if (post.section === "posts") {
    return {
      Content,
      headings: fm.toc as Heading[],
      startsWithLetter: Boolean(fm.startsWithLetter),
      hasMath: Boolean(fm.hasMath),
      summary: String(fm.summary ?? ""),
    };
  }
  const meta = post.entry.rendered?.metadata as TypstMetadata | undefined;
  const html = post.entry.rendered?.html ?? "";
  const paragraphs = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(([, p]) => p.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  const summary: string[] = [];
  for (const p of paragraphs) {
    if (summary.join(" ").split(" ").length >= 70) break;
    summary.push(p);
  }
  return {
    Content,
    headings,
    startsWithLetter: /^\s*(<[^>]+>\s*)*[A-Za-z]/.test(html),
    hasMath: false,
    summary: summary.join(" "),
    typstCss: meta?.css,
  };
}

// A post opens with a floriated initial, which only has the letters A to Z.
export function hasDropCap(post: Post, rendered: Rendered): boolean {
  return post.entry.data.dropcap && rendered.startsWithLetter;
}

export async function tags(): Promise<Map<string, Post[]>> {
  const byTag = new Map<string, Post[]>();
  for (const post of await listedPosts()) {
    for (const tag of post.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), post]);
  }
  return byTag;
}

// A tag as a title: "k-pop" becomes "K-Pop".
export function tagTitle(tag: string): string {
  return tag.replace(/(^|[\s-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
}
