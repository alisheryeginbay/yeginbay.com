// Every page but those of `noindex: true` posts, with when each changed.
import { isoDateTime } from "../lib/dates.ts";
import { listedPosts, tags } from "../lib/posts.ts";
import { SITE } from "../site.ts";

export async function GET() {
  const posts = await listedPosts();
  const newest = (ps: typeof posts) => ps.reduce<Date | undefined>((max, p) => (!max || p.lastmod > max ? p.lastmod : max), undefined);
  const pages: [string, Date | undefined][] = [
    ["/", newest(posts)],
    ["/writings", newest(posts)],
    ["/books", undefined],
    ["/posts", newest(posts.filter((p) => p.section === "posts"))],
    ["/proofs", newest(posts.filter((p) => p.section === "proofs"))],
    ["/tags", newest(posts)],
    ...[...(await tags())].map(([tag, ps]): [string, Date | undefined] => [`/tags/${tag}`, newest(ps)]),
    ...posts.map((p): [string, Date | undefined] => [p.url, p.lastmod]),
  ];
  const urls = pages.map(
    ([path, lastmod]) =>
      `  <url>\n    <loc>${new URL(path, SITE.url).href}</loc>${lastmod ? `\n    <lastmod>${isoDateTime(lastmod)}</lastmod>` : ""}\n  </url>`,
  );
  const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
