#!/usr/bin/env bun
// Starts a post in notes form, at content/posts/<name>.mdx:
//
//   bun run new <name>
//
// The title is the name in title case, and the date is now, in this
// machine's time zone.
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const name = process.argv[2];
if (!name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
  console.error("usage: bun run new <name>, in lowercase words joined by dashes");
  process.exit(1);
}

const file = path.join(import.meta.dirname, "..", "content", "posts", `${name}.mdx`);
if (existsSync(file)) {
  console.error(`new-post: ${path.relative(process.cwd(), file)} already exists`);
  process.exit(1);
}

const title = name.replace(/(^|-)(\w)/g, (_, dash, c) => (dash ? " " : "") + c.toUpperCase());

const now = new Date();
const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
const offset = -now.getTimezoneOffset();
const date =
  `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
  `T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}` +
  `${offset < 0 ? "-" : "+"}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;

await writeFile(
  file,
  `---
title: ${title}
date: ${date}
status: notes
tags: []
---

## Question

## Current understanding

## Open questions

## Sources
`,
);
console.log(`new-post: wrote ${path.relative(process.cwd(), file)}`);
