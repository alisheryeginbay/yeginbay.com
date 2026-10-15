// Each post's source, published next to it: /about.mdx for /about, and
// /proofs/ladr.typ for /proofs/ladr. public/_headers serves them as text.
import { readFile } from "node:fs/promises";
import type { APIRoute } from "astro";
import { allPosts } from "../lib/posts.ts";

export async function getStaticPaths() {
  return (await allPosts()).map((post) => ({ params: { source: post.sourceUrl.slice(1) }, props: { file: post.source } }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(await readFile(props.file as string, "utf8"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
