// Plays the songs on /music (src/pages/music.astro) on the page: choosing one
// puts its cover on the record's label and plays its 30-second preview,
// with the ring round the record filling as it goes. The buttons under the
// record play and pause, and move to the song before or after. The record turns while
// a song plays, getting up to speed and running down like a turntable; when
// one ends the next begins. A song without a preview, or a click with a
// modifier key, still opens Apple Music.
const turntable = document.querySelector<HTMLElement>(".turntable");

if (turntable) {
  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".tracks a")];
  const audio = turntable.querySelector("audio")!;
  const record = $(".record");
  const label = $<HTMLImageElement>(".record-label");
  const controls = $(".now-controls");
  const play = $<HTMLButtonElement>(".now-play");
  const prev = $<HTMLButtonElement>(".now-prev");
  const next = $<HTMLButtonElement>(".now-next");
  const time = $(".now-time");
  const elapsed = $(".now-elapsed");
  const length = $(".now-length");
  const title = $(".now-title");
  const artist = $(".now-artist");
  const link = $<HTMLAnchorElement>(".now-link");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let current = 0;

  // 33⅓ turns a minute. The speed goes up or down a little each frame, from
  // standing to full in about two-thirds of a second, and back in about one.
  const spin = record.animate([{ rotate: "0turn" }, { rotate: "1turn" }], { duration: 1800, iterations: Infinity });
  spin.pause();
  let speed = 0;
  let target = 0;
  let frame = 0;

  const setSpinning = (on: boolean) => {
    target = on && !still.matches ? 1 : 0;
    cancelAnimationFrame(frame);
    if (target) spin.play();
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      speed = target > speed ? Math.min(target, speed + 1.5 * dt) : Math.max(target, speed - dt);
      spin.playbackRate = speed;
      if (speed === 0) spin.pause();
      else if (speed !== target) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  };

  const format = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  // A song without a preview can't be played here, so has no time either.
  const showControls = (on: boolean) => {
    play.disabled = !on;
    time.hidden = !on;
  };

  const select = (index: number) => {
    const song = links[index].dataset;
    links[current].removeAttribute("aria-current");
    links[index].setAttribute("aria-current", "true");
    current = index;

    // The new label fades in once it's loaded, so it never shows half-drawn.
    label.src = song.art!;
    label.style.backgroundColor = song.bg ?? "";
    label.decode().then(
      () => label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: "ease-out" }),
      () => {},
    );
    title.textContent = song.title!;
    artist.replaceChildren(`${song.artist} · `, Object.assign(document.createElement("i"), { textContent: song.album }));
    link.href = links[index].href;
    showControls(!!song.preview);
    // Setting src to "" would point it at the page itself.
    if (song.preview) audio.src = song.preview;
    else audio.removeAttribute("src");
    turntable.style.setProperty("--progress", "0");
    elapsed.textContent = "0:00";
    // The next cover, so the label changes at once when this song ends.
    const after = links[index + 1]?.dataset.art;
    if (after) new Image().src = after;
  };

  // The nearest song with a preview before (-1) or after (1) this one,
  // going round from one end of the list to the other.
  const nearest = (by: 1 | -1) => {
    for (let k = 1; k < links.length; k++) {
      const i = (current + by * k + links.length) % links.length;
      if (links[i].dataset.preview) return i;
    }
    return -1;
  };

  // Plays a song from the start, keeping the turntable going between songs.
  const go = (index: number) => {
    if (index === -1) return;
    select(index);
    audio.play();
  };

  const loaded = () => audio.hasAttribute("src");
  const toggle = () => (audio.paused ? audio.play() : audio.pause());

  for (const [i, a] of links.entries()) {
    a.addEventListener("click", (e) => {
      if (!a.dataset.preview || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (i === current && loaded()) return void toggle();
      select(i);
      audio.play();
    });
  }

  play.addEventListener("click", () => {
    if (!loaded()) select(current);
    toggle();
  });

  // A few seconds in, "previous" goes back to the start of this song first.
  prev.addEventListener("click", () => {
    if (loaded() && audio.currentTime > 3) audio.currentTime = 0;
    else go(nearest(-1));
  });

  next.addEventListener("click", () => go(nearest(1)));

  audio.addEventListener("play", () => {
    turntable.classList.add("playing");
    play.setAttribute("aria-label", "Pause preview");
    setSpinning(true);
  });

  audio.addEventListener("pause", () => {
    turntable.classList.remove("playing");
    play.setAttribute("aria-label", "Play preview");
    setSpinning(false);
  });

  audio.addEventListener("loadedmetadata", () => {
    length.textContent = format(audio.duration);
  });

  audio.addEventListener("timeupdate", () => {
    if (!audio.duration) return;
    turntable.style.setProperty("--progress", String(audio.currentTime / audio.duration));
    elapsed.textContent = format(audio.currentTime);
  });

  // At the end of the list it stops rather than going round.
  audio.addEventListener("ended", () => {
    const after = nearest(1);
    if (after > current) go(after);
  });

  controls.hidden = !links.some((a) => a.dataset.preview);
  showControls(!!links[0]?.dataset.preview);
}
