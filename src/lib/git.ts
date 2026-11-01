// When a post was last changed, from the last commit that touched it.
//
// Commits listed in .git-blame-ignore-revs (one hash per line, # starts a
// comment) don't count, so a commit that changes every post at once, like a
// reformatting, doesn't show every post as just updated. Each post's history
// includes the .org file it was converted from, which shared its name.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

let ignored: Set<string> | undefined;
function ignoredRevs(): Set<string> {
  if (ignored) return ignored;
  const file = path.join(ROOT, ".git-blame-ignore-revs");
  const lines = existsSync(file) ? readFileSync(file, "utf8").split("\n") : [];
  ignored = new Set(lines.map((l) => l.replace(/#.*/, "").trim()).filter(Boolean));
  return ignored;
}

// Whether the full history is here. CI checkouts are often shallow (just the
// newest commit), and then that commit looks like the last change to every
// file, so every post would show the same date. Fetch the rest once; if that
// fails, there are no dates from git at all and posts fall back to the dates
// in their front matter.
let fullHistory: boolean | undefined;
function hasFullHistory(): boolean {
  if (fullHistory !== undefined) return fullHistory;
  const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: "pipe" }).trim();
  try {
    if (git("rev-parse", "--is-shallow-repository") === "true") {
      console.warn("git: shallow clone, fetching full history for post dates");
      git("fetch", "--unshallow", "--quiet");
    }
    fullHistory = true;
  } catch (err) {
    console.warn(`git: no full history, so posts use their front matter dates (${(err as Error).message.split("\n")[0]})`);
    fullHistory = false;
  }
  return fullHistory;
}

// `file` is relative to the repository root.
export function lastCommitDate(file: string): Date | undefined {
  if (!hasFullHistory()) return undefined;
  const paths = [file];
  if (/\.mdx$/.test(file)) {
    paths.push(file.replace(/\.mdx$/, ".org"));
    if (/\/index\.mdx$/.test(file)) paths.push(file.replace(/\/index\.mdx$/, ".org"));
  }
  let log: string;
  try {
    log = execFileSync("git", ["log", "--format=%H %cI", "--", ...paths], { cwd: ROOT, encoding: "utf8" });
  } catch {
    return undefined;
  }
  for (const line of log.split("\n")) {
    const [hash, date] = line.split(" ");
    if (hash && !ignoredRevs().has(hash)) return new Date(date);
  }
  return undefined;
}
