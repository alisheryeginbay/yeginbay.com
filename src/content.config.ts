import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { typstLoader } from "./lib/typst.ts";

// A post's front matter. In MDX:
//
//   ---
//   title: Operation K #3
//   date: 2026-10-14T02:04:28+05:00
//   status: notes                  # notes -> draft -> finished (the default)
//   tags: [korean]
//   authors: [Alisher Yeginbay, Claude Opus 5.5]   # default: SITE.author
//   noindex: true                  # built, but kept out of lists, feeds and the sitemap
//   aliases: [/k3]                 # old addresses that redirect here
//   dropcap: false                 # no floriated initial
//   description: …                 # default: the opening paragraphs
//   ---
//
// Posts written in Typst give the same fields in their #metadata.
const post = z.object({
  title: z.string(),
  date: z.coerce.date(),
  // When the post last changed, if git doesn't know (see src/lib/git.ts).
  lastmod: z.coerce.date().optional(),
  status: z.enum(["notes", "draft", "finished"]).default("finished"),
  tags: z.array(z.string()).default([]),
  authors: z.array(z.string()).optional(),
  noindex: z.boolean().default(false),
  aliases: z.array(z.string()).default([]),
  dropcap: z.boolean().default(true),
  description: z.string().optional(),
  // Left out of the built site, but shown by `astro dev`.
  draft: z.boolean().default(false),
});

// A post kept as a folder, with its images beside it, is index.mdx in the
// folder, and takes the folder's name.
const generateId = ({ entry }: { entry: string }) => entry.replace(/(\/index)?\.mdx$/, "");

export const collections = {
  posts: defineCollection({
    loader: glob({ pattern: "**/*.mdx", base: "./content/posts", generateId }),
    schema: post,
  }),
  proofs: defineCollection({
    loader: typstLoader({ base: "./content/proofs" }),
    schema: post,
  }),
  // Pages with prose of their own, such as the home page.
  pages: defineCollection({
    loader: glob({ pattern: "*.mdx", base: "./content/pages" }),
    schema: z.object({ title: z.string() }),
  }),
};
