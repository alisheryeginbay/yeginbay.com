// Marks the entry in the table of contents (layouts/partials/toc.html) for the
// section being read, and keeps it in view when the list scrolls. A section is
// being read once its heading reaches the spot a link to it scrolls to, so the
// entry clicked is the one marked; at the bottom of the page, where the last
// headings may never get that high, the last heading on screen is marked. A
// page too short to scroll isn't at the bottom: nothing is read past yet.
const list = document.querySelector<HTMLOListElement>(".toc > ol");

if (list) {
  const entries = [...list.querySelectorAll<HTMLAnchorElement>("a[href^='#']")]
    .map((link) => ({ link, heading: document.getElementById(decodeURIComponent(link.hash.slice(1))) }))
    .filter((entry): entry is { link: HTMLAnchorElement; heading: HTMLElement } => entry.heading !== null);
  let current: HTMLAnchorElement | undefined;
  let queued = false;

  const update = () => {
    queued = false;
    const atBottom = scrollY > 0 && innerHeight + scrollY >= document.documentElement.scrollHeight - 1;
    let next: HTMLAnchorElement | undefined;
    for (const { link, heading } of entries) {
      const top = heading.getBoundingClientRect().top;
      const line = atBottom ? innerHeight : parseFloat(getComputedStyle(heading).scrollMarginTop) + 1;
      if (top > line) break;
      next = link;
    }
    if (next === current) return;
    current?.removeAttribute("aria-current");
    current = next;
    if (!current) return;
    current.setAttribute("aria-current", "location");

    // Scroll the list, not the page, so the entry clears the faded edges.
    const fade = parseFloat(getComputedStyle(list).paddingBottom);
    const listBox = list.getBoundingClientRect();
    const box = current.getBoundingClientRect();
    if (box.top < listBox.top + fade) {
      list.scrollTop -= listBox.top + fade - box.top;
    } else if (box.bottom > listBox.bottom - fade) {
      list.scrollTop += box.bottom - (listBox.bottom - fade);
    }
  };

  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  addEventListener("scroll", queue, { passive: true });
  addEventListener("resize", queue);
  update();
}
