// Copies the link to a section when the button after its heading is clicked
// (layouts/partials/heading-anchors.html), and shows a check mark for a moment.
const COPIED_FOR_MS = 1500;
const timers = new WeakMap<HTMLButtonElement, number>();

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
