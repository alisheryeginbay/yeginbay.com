#!/usr/bin/env bun
// `hugo server` with drafts, alongside the Svelte and Typst compilers in watch
// mode, so edits to figures in assets/js/viz/ and to posts written in Typst
// show up live. Extra arguments go to Hugo.
export {};

const compilers = ["scripts/compile-svelte.ts", "scripts/compile-typst.ts"];
const watchers = compilers.map((script) => Bun.spawn(["bun", script, "--watch"], { stdio: ["ignore", "inherit", "inherit"] }));
// Let the first compiles finish so Hugo starts with every figure and post in place.
await Promise.all(compilers.map((script) => Bun.spawn(["bun", script], { stdio: ["ignore", "ignore", "inherit"] }).exited));
const hugo = Bun.spawn(["hugo", "server", "-D", ...process.argv.slice(2)], { stdio: ["inherit", "inherit", "inherit"] });

const stop = () => { watchers.forEach((w) => w.kill()); hugo.kill(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const code = await hugo.exited;
watchers.forEach((w) => w.kill());
process.exit(code);
