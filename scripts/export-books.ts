#!/usr/bin/env bun
// Exports the reading list kept in ~/org/reading.org to data/books.json,
// which layouts/books.html renders. The org file lives outside the repo, so
// the JSON is committed and the site builds without it.
//
//   bun run books [path/to/reading.org]
//
// Each book is a top-level heading: a state keyword, the title and optional
// tags, then a property drawer with AUTHOR, RATING (1-10 or empty),
// DATE_ADDED, and optionally DATE_STARTED and DATE_READ. Only the body of the
// "** Review" subheading is published; "** Close Reading" stays private.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ROOT } from "./site.ts";

const DEFAULT_SOURCE = path.join(os.homedir(), "org", "reading.org");
const OUT_FILE = path.join(ROOT, "data", "books.json");

const STATUSES = {
  "TO-READ": "to-read",
  READING: "reading",
  READ: "read",
  ABANDONED: "abandoned",
} as const;

type Status = (typeof STATUSES)[keyof typeof STATUSES];

interface Book {
  title: string;
  author: string;
  status: Status;
  rating: number | null;
  added: string;
  started: string | null;
  finished: string | null;
  tags: string[];
  review: string | null;
}

const HEADING = /^\* (\S+) (.+?)(?:\s+:([\w@#%:]+):)?\s*$/;
const PROPERTY = /^:([A-Z_]+):(?:\s+(.*?))?\s*$/;
const TIMESTAMP = /^\[(\d{4}-\d{2}-\d{2})(?: \w+)?\]$/;

function parse(text: string) {
  const books: Book[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const lines = text.split("\n");
  const today = new Date().toISOString().slice(0, 10);

  // Line indexes of each top-level heading, plus the end of the file.
  const starts = lines.flatMap((line, i) => (line.startsWith("* ") ? [i] : []));
  starts.push(lines.length);

  for (let n = 0; n < starts.length - 1; n++) {
    const entry = lines.slice(starts[n], starts[n + 1]);
    const lineNo = starts[n] + 1;
    const at = (msg: string) => `line ${lineNo}: ${msg}`;

    const heading = entry[0].match(HEADING);
    const keyword = heading?.[1] ?? "";
    if (!heading || !(keyword in STATUSES)) {
      errors.push(at(`expected "* <${Object.keys(STATUSES).join("|")}> Title", got ${JSON.stringify(entry[0])}`));
      continue;
    }
    const title = heading[2];
    const tags = heading[3]?.split(":").filter(Boolean) ?? [];
    const label = `line ${lineNo} (${title})`;

    if (entry[1] !== ":PROPERTIES:") {
      errors.push(`${label}: missing property drawer`);
      continue;
    }
    const end = entry.indexOf(":END:");
    if (end === -1) {
      errors.push(`${label}: property drawer is not closed`);
      continue;
    }
    const props = new Map<string, string>();
    for (const line of entry.slice(2, end)) {
      const prop = line.match(PROPERTY);
      if (!prop) errors.push(`${label}: bad property line ${JSON.stringify(line)}`);
      else props.set(prop[1], prop[2] ?? "");
    }

    const date = (name: string) => {
      const value = props.get(name);
      if (!value) return null;
      const match = value.match(TIMESTAMP);
      if (!match) {
        errors.push(`${label}: ${name} must be an inactive timestamp like [2026-01-31 Sat], got ${JSON.stringify(value)}`);
        return null;
      }
      if (match[1] > today) errors.push(`${label}: ${name} ${match[1]} is in the future`);
      return match[1];
    };

    const author = props.get("AUTHOR") ?? "";
    if (!author) errors.push(`${label}: AUTHOR is empty`);

    const ratingText = props.get("RATING") ?? "";
    let rating: number | null = null;
    if (/^([1-9]|10)$/.test(ratingText)) rating = Number(ratingText);
    else if (ratingText) errors.push(`${label}: RATING must be 1-10 or empty, got ${JSON.stringify(ratingText)}`);

    const added = date("DATE_ADDED");
    if (!props.get("DATE_ADDED")) errors.push(`${label}: DATE_ADDED is missing`);
    const started = date("DATE_STARTED");
    const finished = date("DATE_READ");

    const status = STATUSES[keyword as keyof typeof STATUSES];
    if ((status === "read" || status === "abandoned") && !finished) {
      warnings.push(`${label}: ${keyword} without DATE_READ, listed as undated`);
    }
    if (status === "to-read" && (rating || finished)) {
      warnings.push(`${label}: TO-READ but has a RATING or DATE_READ`);
    }

    books.push({
      title,
      author,
      status,
      rating,
      added: added ?? "",
      started,
      finished,
      tags,
      review: section(entry.slice(end + 1), "Review"),
    });
  }

  const seen = new Set<string>();
  for (const book of books) {
    const key = `${book.title}\0${book.author}`.toLowerCase();
    if (seen.has(key)) errors.push(`duplicate book: ${book.title} by ${book.author}`);
    seen.add(key);
  }

  return { books, errors, warnings };
}

// The body of the "** <name>" subheading, or null when it is empty.
function section(lines: string[], name: string): string | null {
  const start = lines.findIndex((line) => line.trim() === `** ${name}`);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^\*{1,2} /.test(line));
  const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();
  return body || null;
}

async function main() {
  const source = process.argv[2] ?? DEFAULT_SOURCE;
  const { books, errors, warnings } = parse(await readFile(source, "utf8"));

  for (const warning of warnings) console.warn(`export-books: warning: ${warning}`);
  if (errors.length) {
    for (const error of errors) console.error(`export-books: ${source}: ${error}`);
    console.error(`export-books: ${errors.length} error(s), nothing written.`);
    process.exit(1);
  }

  // Newest first within each status; the layout groups them.
  books.sort((a, b) =>
    (b.finished ?? b.started ?? b.added).localeCompare(a.finished ?? a.started ?? a.added),
  );

  // The latest date in the list rather than today's date, so re-running the
  // export without changes leaves the file untouched.
  const updated = books
    .flatMap((book) => [book.added, book.started, book.finished])
    .reduce((max: string, d) => (d && d > max ? d : max), "");

  await mkdir(path.dirname(OUT_FILE), { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify({ updated, books }, null, 2) + "\n");

  const counts = Object.values(STATUSES)
    .map((status) => `${books.filter((b) => b.status === status).length} ${status}`)
    .join(", ");
  console.log(`export-books: wrote ${books.length} books (${counts}) to ${path.relative(ROOT, OUT_FILE)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
