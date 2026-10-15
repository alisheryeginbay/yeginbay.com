// The licence the writing is under, at /LICENSE.
import { readFile } from "node:fs/promises";

export const GET = async () =>
  new Response(await readFile("content/LICENSE", "utf8"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
