// RSS feeds of posts: the whole site's at /index.xml, and each tag's at
// /tags/<tag>/index.xml.
import { SITE } from "../site.ts";
import { rfc822 } from "./dates.ts";
import { renderPost, type Post } from "./posts.ts";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function feed({ title, path, posts }: { title?: string; path: string; posts: Post[] }): Promise<Response> {
  const link = new URL(path, SITE.url).href;
  const items = await Promise.all(
    posts.map(async (post) => {
      const url = new URL(post.url, SITE.url).href;
      const summary = post.description ?? (await renderPost(post)).summary;
      return `
    <item>
      <title>${escape(post.title)}</title>
      <link>${url}</link>
      <pubDate>${rfc822(post.date)}</pubDate>
      <guid>${url}</guid>
      <description>${escape(summary)}</description>
    </item>`;
    }),
  );
  const lastmod = posts.reduce<Date | undefined>((max, p) => (!max || p.lastmod > max ? p.lastmod : max), undefined);
  const xml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(title ? `${title} on ${SITE.title}` : SITE.title)}</title>
    <link>${link}</link>
    <description>Recent content ${title ? `in ${escape(title)} ` : ""}on ${escape(SITE.title)}</description>
    <language>en-us</language>${lastmod ? `\n    <lastBuildDate>${rfc822(lastmod)}</lastBuildDate>` : ""}
    <atom:link href="${new URL("index.xml", link.endsWith("/") ? link : link + "/").href}" rel="self" type="application/rss+xml" />${items.join("")}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
}
