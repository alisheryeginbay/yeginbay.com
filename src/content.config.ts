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

// A book on the reading list, in the front matter of content/pages/books.mdx:
//
//   - { title: Klara and the Sun, author: Kazuo Ishiguro, status: read, rating: 8, finished: 2026-04-14 }
const book = z
  .object({
    title: z.string().min(1),
    author: z.string().min(1),
    status: z.enum(["to-read", "reading", "read", "abandoned"]).default("to-read"),
    rating: z.number().int().min(1).max(10).optional(),
    // The day it was finished, or given up on.
    finished: z.coerce
      .date()
      .refine((d) => d <= new Date(), "is in the future")
      .optional(),
    favourite: z.boolean().default(false),
  })
  .refine((b) => b.status !== "to-read" || (!b.rating && !b.finished), "is to-read but has a rating or finished date");

export type Book = z.infer<typeof book>;

// A liner note on a song on /music, in the front matter of
// content/pages/music.mdx.
const note = z.object({ title: z.string().min(1), artist: z.string().min(1).optional(), note: z.string().min(1) });

export type Note = z.infer<typeof note>;

function noDuplicates(books: Book[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  books.forEach((b, i) => {
    const key = `${b.title}\0${b.author}`.toLowerCase();
    if (seen.has(key)) ctx.addIssue({ code: "custom", path: [i], message: `${b.title} by ${b.author} is listed twice` });
    seen.add(key);
  });
}

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
    schema: z.object({
      title: z.string(),
      books: z.array(book).superRefine(noDuplicates).optional(),
      notes: z.array(note).optional(),
    }),
  }),
};
