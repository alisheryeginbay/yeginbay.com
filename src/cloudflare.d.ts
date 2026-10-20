// The parts of the Workers runtime the site uses: the static files the
// Worker serves (wrangler.toml), for pages rendered on request.
declare module "cloudflare:workers" {
  export const env: {
    ASSETS: { fetch(input: Request | URL | string): Promise<Response> };
  };
}
