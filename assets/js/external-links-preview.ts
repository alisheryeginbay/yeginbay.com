// Opens links to other sites in a new tab under `hugo server`, which skips the
// post-build scripts. Production builds use scripts/external-links.ts.
// `a.hostname` instead of link-icons.ts's normalizeHost, which would bundle
// every Simple Icons logo along with it.
const bareHost = (host: string) => host.toLowerCase().replace(/^www\./, "");
const ownHost = bareHost(location.hostname);

document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
  if (!/^(https?:)?\/\//i.test(a.getAttribute("href")!)) return;
  const host = bareHost(a.hostname);
  if (!host || host === ownHost || host === "localhost") return;

  a.target = "_blank";
  a.rel = "noopener noreferrer";
});
