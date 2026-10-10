#!/usr/bin/env bun
// `hugo server` with drafts, alongside the Svelte compiler in watch mode, so
// edits to figures in assets/js/viz/ show up live. Extra arguments go to Hugo.
export {};

const svelte = Bun.spawn(["bun", "scripts/compile-svelte.ts", "--watch"], { stdio: ["ignore", "inherit", "inherit"] });
// Let the first compile finish so Hugo starts with every figure in place.
await Bun.spawn(["bun", "scripts/compile-svelte.ts"], { stdio: ["ignore", "ignore", "inherit"] }).exited;
const hugo = Bun.spawn(["hugo", "server", "-D", ...process.argv.slice(2)], { stdio: ["inherit", "inherit", "inherit"] });

const stop = () => { svelte.kill(); hugo.kill(); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const code = await hugo.exited;
svelte.kill();
process.exit(code);
