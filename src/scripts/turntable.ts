// Plays the songs on /music (src/pages/music.astro) on the page: choosing one
// puts its cover on the record's label and plays its 30-second preview,
// with the ring round the record filling as it goes. The buttons under the
// record play and pause, and move to the song before or after; when one
// song ends the next begins. A song without a preview, or a click with a
// modifier key, still opens Apple Music.
//
// It goes like a belt-driven turntable: on play the record starts turning
// and the arm swings over, and the music begins as the needle lands; on
// pause the music stops, the arm lifts, and the record coasts to a stop.
import type { RecordShader } from "./record-shader.ts";

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
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  let current = 0;

  // The vinyl drawn with WebGPU, once it's ready, if it can be. Its middle
  // is clear for the label, which takes up 0.44 of the record across
  // (style.css). Until then, or without it, the CSS record shows.
  const canvas = $<HTMLCanvasElement>(".record-canvas");
  // vgpu is most of this page's script, so it's only fetched where WebGPU
  // can run, after the player itself is ready.
  let shader: RecordShader | null = null;
  const loadShader = async () =>
    "gpu" in navigator ? (await import("./record-shader.ts")).recordShader(canvas, 0.44) : null;
  loadShader().then(
    (s) => {
      if (!s) return;
      shader = s;
      recolor(links[current]?.dataset.swatch, 0);
    },
    (e) => console.error(e),
  );

  // How long the arm takes to swing onto the record, as its transition in
  // style.css does, and how long to wait after it lifts before the motor
  // stops.
  const NEEDLE_MS = 900;
  const LIFT_MS = 400;

  // The motor. 33⅓ turns a minute at full speed. Getting up to speed, the
  // belt pulls hard at first and then settles, most of the way there in two
  // seconds; switched off, the platter coasts, slowed by friction and drag,
  // to a stop in about three.
  const spin = record.animate([{ rotate: "0turn" }, { rotate: "1turn" }], { duration: 1800, iterations: Infinity });
  spin.pause();
  let speed = 0;
  let target = 0;
  let frame = 0;
  let last = 0;

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (target > speed) speed += (target - speed) * (1 - Math.exp(-dt / 0.7));
    else speed = Math.max(0, speed - (0.1 + speed / 1.4) * dt);
    if (Math.abs(target - speed) < 0.002) speed = target;
    spin.playbackRate = speed;
    frame = 0;
    if (speed === 0) spin.pause();
    else if (speed !== target) frame = requestAnimationFrame(tick);
  };

  const motor = (run: boolean) => {
    target = run && !still.matches ? 1 : 0;
    if (target) spin.play();
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
    paint();
  };

  // Frames of the WebGL record, drawn while it turns or its colours change,
  // each at the angle the label has reached.
  let painting = 0;
  const angle = () => ((Number(spin.currentTime ?? 0) % 1800) / 1800) * 2 * Math.PI;
  const paintFrame = () => {
    painting = 0;
    shader!.draw(angle());
    if (speed > 0 || target > 0 || shader!.blending()) painting = requestAnimationFrame(paintFrame);
  };
  const paint = () => {
    if (shader && !painting) painting = requestAnimationFrame(paintFrame);
  };
  new ResizeObserver(paint).observe(canvas);

  // The record takes on each song's colours, over `ms`. A cover still
  // loading when another song is chosen is dropped. The first one shows the
  // WebGPU record, so it never appears uncoloured.
  let recoloring = "";
  const recolor = (url: string | undefined, ms: number) => {
    const s = shader;
    if (!s || !url) return;
    recoloring = url;
    s.setCover(url, ms, () => recoloring === url).then(
      () => {
        turntable.classList.add("shaded");
        paint();
      },
      (e) => console.error(e),
    );
  };

  // Whether the turntable is on, and whether the needle is down on it.
  let on = false;
  let down = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  // If the browser won't play it, the turntable stops rather than turning
  // in silence. Changing songs cuts the last one short, which is expected.
  const playAudio = () =>
    audio.play().catch((e: DOMException) => {
      if (e.name !== "AbortError" && on) stop();
    });

  const start = () => {
    if (!loaded()) return;
    clearTimeout(timer);
    on = true;
    turntable.classList.add("playing");
    play.setAttribute("aria-label", "Pause preview");
    motor(true);
    if (down) return void playAudio();
    timer = setTimeout(
      () => {
        down = true;
        playAudio();
      },
      still.matches ? 0 : NEEDLE_MS,
    );
  };

  const stop = () => {
    clearTimeout(timer);
    on = false;
    down = false;
    audio.pause();
    turntable.classList.remove("playing");
    play.setAttribute("aria-label", "Play preview");
    timer = setTimeout(() => motor(false), still.matches ? 0 : LIFT_MS);
  };

  const toggle = () => (on ? stop() : start());
  const loaded = () => audio.hasAttribute("src");

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
    recolor(song.swatch, 700);
    label.style.backgroundColor = song.bg ?? "";
    label.decode().then(
      () => label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: "ease-out" }),
      () => {},
    );
    title.textContent = song.title!;
    artist.replaceChildren(`${song.artist} · `, Object.assign(document.createElement("i"), { textContent: song.album }));
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

  // Moves to a song, playing it from the start if the turntable is on.
  const go = (index: number) => {
    if (index === -1) return;
    select(index);
    if (on) start();
  };

  for (const [i, a] of links.entries()) {
    a.addEventListener("click", (e) => {
      if (!a.dataset.preview || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      if (i === current && loaded()) return void toggle();
      select(i);
      start();
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

  // Played or paused from outside the page, as with the keyboard's media
  // keys: the turntable follows at once. A pause while changing songs
  // passes, since the next song is already playing by the time it's seen.
  audio.addEventListener("play", () => {
    if (on) return;
    on = down = true;
    turntable.classList.add("playing");
    play.setAttribute("aria-label", "Pause preview");
    motor(true);
  });

  audio.addEventListener("pause", () => {
    setTimeout(() => {
      if (on && down && audio.paused && !audio.ended) stop();
    }, 50);
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
    else stop();
  });

  controls.hidden = !links.some((a) => a.dataset.preview);
  showControls(!!links[0]?.dataset.preview);
}
