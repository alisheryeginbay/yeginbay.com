// Opens a photo from the grid on /photos (src/pages/photos/index.astro) over
// the page, without leaving it. Arrow keys, the arrow buttons and swipes move
// to the photo either side; Escape, the close button or a click beside the
// photo closes it. A click with a modifier key still opens the photo's page.
const dialog = document.querySelector<HTMLDialogElement>("dialog.lightbox");

if (dialog) {
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".photo-grid a[data-srcset]")];
  const img = dialog.querySelector<HTMLImageElement>(".lightbox-stage img")!;
  const title = dialog.querySelector<HTMLElement>(".lightbox-title")!;
  const ai = dialog.querySelector<HTMLElement>(".lightbox-ai")!;
  const caption = dialog.querySelector<HTMLElement>(".lightbox-caption")!;
  const page = dialog.querySelector<HTMLAnchorElement>(".lightbox-page")!;
  const prev = dialog.querySelector<HTMLButtonElement>(".lightbox-prev")!;
  const next = dialog.querySelector<HTMLButtonElement>(".lightbox-next")!;
  let current = -1;

  // The full photo for a link, loaded ahead so moving to it is instant.
  const preload = (link: HTMLAnchorElement | undefined) => {
    if (!link) return;
    const ahead = new Image();
    ahead.sizes = "100vw";
    ahead.srcset = link.dataset.srcset!;
  };

  const show = (index: number) => {
    const link = links[index];
    if (!link) return;
    current = index;
    const thumb = link.querySelector("img")!;
    const { srcset, ratio, caption: text, ai: note } = link.dataset;

    // The thumbnail, already loaded, stands in until the full photo arrives.
    img.removeAttribute("srcset");
    img.style.setProperty("--ratio", ratio!);
    img.style.backgroundImage = `url("${thumb.currentSrc || thumb.src}")`;
    img.alt = thumb.alt;
    img.srcset = srcset!;

    title.textContent = link.dataset.title!;
    ai.hidden = !note;
    ai.querySelector("a")!.textContent = note ?? "";
    caption.hidden = !text;
    caption.textContent = text ?? "";
    page.href = link.href;
    prev.hidden = index === 0;
    next.hidden = index === links.length - 1;

    preload(links[index - 1]);
    preload(links[index + 1]);
  };

  const step = (by: number) => show(Math.min(links.length - 1, Math.max(0, current + by)));

  links.forEach((link, i) =>
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      show(i);
      dialog.showModal();
    }),
  );

  prev.addEventListener("click", () => step(-1));
  next.addEventListener("click", () => step(1));
  dialog.querySelector(".lightbox-close")!.addEventListener("click", () => dialog.close());

  // Escape closes the dialog on its own.
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") step(-1);
    else if (event.key === "ArrowRight") step(1);
  });

  // A click on the backdrop or the empty stage around the photo closes it.
  dialog.addEventListener("click", (event) => {
    const target = event.target as Element;
    if (target === dialog || target.classList.contains("lightbox-stage")) dialog.close();
  });

  // Keep the photo that was open in view in the grid, and focus on it.
  dialog.addEventListener("close", () => {
    links[current]?.focus({ preventScroll: true });
    links[current]?.scrollIntoView({ block: "nearest" });
  });

  // A horizontal swipe moves to the photo either side.
  let startX = 0;
  let startY = 0;
  dialog.addEventListener("touchstart", (e) => ([startX, startY] = [e.touches[0].clientX, e.touches[0].clientY]), { passive: true });
  dialog.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  });
}
