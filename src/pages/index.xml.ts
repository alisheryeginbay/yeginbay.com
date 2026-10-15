import { feed } from "../lib/feed.ts";
import { listedPosts } from "../lib/posts.ts";

export const GET = async () => feed({ path: "/", posts: await listedPosts() });
