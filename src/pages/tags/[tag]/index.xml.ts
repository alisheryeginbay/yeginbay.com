import type { APIRoute } from "astro";
import { feed } from "../../../lib/feed.ts";
import { tags, tagTitle, type Post } from "../../../lib/posts.ts";

export async function getStaticPaths() {
  return [...(await tags())].map(([tag, posts]) => ({ params: { tag }, props: { posts } }));
}

export const GET: APIRoute = ({ params, props }) =>
  feed({ title: tagTitle(params.tag!), path: `/tags/${params.tag}`, posts: props.posts as Post[] });
