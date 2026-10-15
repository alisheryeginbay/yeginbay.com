// Settings for the whole site.

export const SITE = {
  url: "https://yeginbay.com",
  title: "Alisher Yeginbay",
  description: "Notes and writing.",
  // Posts without `authors` in their front matter are by this author.
  author: "Alisher Yeginbay",
  repo: "https://github.com/alisheryeginbay/yeginbay.com",
  // Dates are shown in this offset from UTC, in minutes: the one posts are
  // dated in, so a post written late in the evening keeps its day.
  utcOffset: 5 * 60,
};

// Where each author's name links to in a post's byline. A name that isn't
// here is shown without a link. Keys must match `authors` exactly.
export const AUTHOR_LINKS: Record<string, string> = {
  "Alisher Yeginbay": "/",
  "Claude Opus 5.5": "https://www.anthropic.com/claude",
};
