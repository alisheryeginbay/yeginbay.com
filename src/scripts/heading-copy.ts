// Puts a button after each linked heading's text (src/lib/markdown/
// rehype-headings.ts) that copies the link to its section, and shows a
// check mark for a moment once it has. The buttons are added here rather
// than written in the HTML: they need this script to work, and anything
// reading the HTML without running it is better off without them.
const COPY = `<button type="button" class="heading-copy" aria-label="Copy link to this section"><svg class="heading-copy-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><svg class="heading-copied-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></button>`;
const COPIED_FOR_MS = 1500;
const timers = new WeakMap<HTMLButtonElement, number>();

for (const heading of document.querySelectorAll(":is(h2, h3, h4, h5, h6)[id]:has(> .heading-link, > .heading-anchor)")) {
  heading.insertAdjacentHTML("beforeend", COPY);
}

document.addEventListener("click", async (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>("button.heading-copy");
  if (!button) return;
  const heading = button.closest<HTMLElement>("h2, h3, h4, h5, h6")!;
  const url = new URL(`#${heading.id}`, location.href).href;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    return;
  }

  button.dataset.copied = "";
  button.setAttribute("aria-label", "Link copied");
  clearTimeout(timers.get(button));
  timers.set(button, window.setTimeout(() => {
    delete button.dataset.copied;
    button.setAttribute("aria-label", "Copy link to this section");
  }, COPIED_FOR_MS));
});
