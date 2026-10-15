import { vitePreprocess } from "@astrojs/svelte";

export default {
  preprocess: vitePreprocess(),
  // Figures bring their styles with them when they're drawn, so pages
  // without figures don't carry them.
  compilerOptions: { css: "injected" },
};
