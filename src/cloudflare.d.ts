// The parts of the Workers runtime the site uses: the static files the
// Worker serves (wrangler.toml), for pages rendered on request, and the
// secrets set with `wrangler secret put` (in .dev.vars for `astro dev`).
declare module "cloudflare:workers" {
  export const env: {
    ASSETS: { fetch(input: Request | URL | string): Promise<Response> };
    // The MusicKit key that signs Apple Music requests (src/lib/music.ts).
    APPLE_MUSIC_TEAM_ID?: string;
    APPLE_MUSIC_KEY_ID?: string;
    APPLE_MUSIC_PRIVATE_KEY?: string;
  };
}
