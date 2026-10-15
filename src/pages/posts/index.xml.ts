import { feed } from "../../lib/feed.ts";
import { listedPosts } from "../../lib/posts.ts";

export const GET = async () =>
  feed({ title: "Posts", path: "/posts", posts: (await listedPosts()).filter((p) => p.section === "posts") });
