import { defineCollection, reference } from "astro:content";
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
//   people:                        # for <LinkList />, see src/components/LinkList.astro
//     - { name: Richard Feynman, url: https://en.wikipedia.org/wiki/Richard_Feynman }
//   references:                    # what the post draws on, cited as [@li2022]
//     - { key: li2022, title: Emergent World Representations, author: Kenneth Li et al., year: 2022, url: https://arxiv.org/abs/2210.13382 }
//     - https://gwern.net/silk-road   # a bare link, when that's all there is
//   further:                       # what to read next, not cited
//     - { title: Book of Proof, author: Richard Hammack, note: A gentle start on proofs. }
//   ---
//
// Both lists are shown after the post (src/components/Sources.astro).
// Posts written in Typst give the same fields in their #metadata.

// A row of <LinkList />: a name, an optional short note, and where it links.
const linkRow = z.object({ name: z.string().min(1), note: z.string().min(1).optional(), url: z.string().url() });

// A work in `references` or `further`: a link alone, or the work described.
// A reference with a `key` can be cited in the text (remark-citations.ts).
const link = z.string().url().transform((url) => ({ url }));
const described = z.object({
  title: z.string().min(1),
  author: z.string().min(1).optional(),
  year: z.union([z.number().int(), z.string().min(1)]).optional(),
  url: z.string().url().optional(),
  note: z.string().min(1).optional(),
});
const work = z.union([link, described]);
const citable = z.union([link, described.extend({ key: z.string().regex(/^[\w-]+$/, "is a key of letters, digits, _ and -").optional() })]);

export type Work = { key?: string; title?: string; author?: string; year?: number | string; url?: string; note?: string };

function uniqueKeys(refs: Work[], ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  refs.forEach((r, i) => {
    if (!r.key) return;
    if (seen.has(r.key)) ctx.addIssue({ code: "custom", path: [i, "key"], message: `${r.key} is used twice` });
    seen.add(r.key);
  });
}

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
  people: z.array(linkRow).optional(),
  references: z.array(citable).superRefine(uniqueKeys).default([]),
  further: z.array(work).default([]),
  // Left out of the built site, but shown by `astro dev`.
  draft: z.boolean().default(false),
});

// A book on the reading list, in the front matter of content/pages/books.mdx:
//
//   - { title: Klara and the Sun, author: Kazuo Ishiguro, status: read, rating: 8, finished: 2026-04-14 }
//
// A book with notes names the post they're in, by its id in content/posts/:
//
//   - { title: Linear Algebra Done Right, author: Sheldon Axler, status: reading, notes: linear-algebra-done-right }
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
    notes: reference("posts").optional(),
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
      projects: z.array(linkRow).optional(),
      selected: z.array(z.object({ post: z.string().min(1), note: z.string().min(1).optional() })).optional(),
    }),
  }),
};
