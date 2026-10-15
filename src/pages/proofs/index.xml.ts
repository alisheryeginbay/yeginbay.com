import { feed } from "../../lib/feed.ts";
import { listedPosts } from "../../lib/posts.ts";

export const GET = async () =>
  feed({ title: "Proofs", path: "/proofs", posts: (await listedPosts()).filter((p) => p.section === "proofs") });
