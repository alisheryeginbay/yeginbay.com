// Plays the songs on /music (src/pages/music.astro) on the page: choosing one
// puts its cover on the record's label and plays its 30-second preview,
// with the ring round the record filling as it goes. The buttons under the
// record play and pause, and move to the song before or after. Near the end
// of one song the next fades in over it, so the list plays as one mix. A
// song without a preview, or a click with a modifier key, still opens
// Apple Music.
//
// It goes like a belt-driven turntable: on play the record starts turning
// and the arm swings over, and the music begins as the needle lands; on
// pause the motor stops and the music slows and sinks in pitch with the
// record, until the arm lifts and the record coasts to a stop.
//
// The arm can be picked up and put down anywhere on the record, to play
// from there: across the record is the whole preview, outside to inside.
// Lifting it stops the music; the record keeps turning.
import type { RecordShader } from "./record-shader.ts";

const turntable = document.querySelector<HTMLElement>(".turntable");

if (turntable) {
  const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
  const links = [...document.querySelectorAll<HTMLAnchorElement>(".tracks a")];
  // Two decks, so one song can fade out while the next fades in. `audio` is
  // the one that's on; `spare` is the other, playing only while it fades out.
  let audio = turntable.querySelector("audio")!;
  let spare = audio.cloneNode() as HTMLAudioElement;
  audio.after(spare);
  const decks = [audio, spare];
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
  const note = $(".now-note");
  const arm = turntable.querySelector<SVGGElement>(".tonearm-arm")!;
  const grab = turntable.querySelector<SVGPathElement>(".tonearm-grab")!;
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

  // Winding down: the needle still in the groove after the motor's switched
  // off, so the music follows the record's speed, fading as it goes, until
  // the arm lifts. Below about a third of the speed it's too slow to hear.
  let winding = false;
  const QUIET = 0.3;
  for (const deck of decks) deck.preservesPitch = false;

  // Each deck's volume, set through Web Audio, since iOS ignores a media
  // element's own. The previews are served to any site (CORS), so the
  // decks can be wired in; that's done on the first click, as a browser
  // only lets sound start from one. Without Web Audio, songs don't fade
  // into each other, and change when they end.
  let context: AudioContext | null = null;
  const gains = new Map<HTMLAudioElement, GainNode>();
  const wire = () => {
    if (!context && "AudioContext" in window) {
      context = new AudioContext();
      for (const deck of decks) {
        const gain = context.createGain();
        context.createMediaElementSource(deck).connect(gain).connect(context.destination);
        gains.set(deck, gain);
      }
    }
    if (context?.state === "suspended") context.resume().catch(() => {});
  };

  const level = (deck: HTMLAudioElement, v: number) => {
    const gain = gains.get(deck);
    if (!gain || !context) return void (deck.volume = v);
    gain.gain.cancelScheduledValues(context.currentTime);
    gain.gain.setValueAtTime(v, context.currentTime);
  };

  // Where to play from, once the preview's length is known.
  let seek: number | null = null;

  const tick = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (target > speed) speed += (target - speed) * (1 - Math.exp(-dt / 0.7));
    else speed = Math.max(0, speed - (0.1 + speed / 1.4) * dt);
    if (Math.abs(target - speed) < 0.002) speed = target;
    spin.playbackRate = speed;
    if (winding) {
      if (target === 0 && speed <= QUIET) lift();
      else if (speed === 1) winding = false;
      if (winding) {
        audio.playbackRate = Math.max(speed, QUIET);
        level(audio, Math.min(1, (speed - QUIET) / 0.5));
      } else {
        audio.playbackRate = 1;
        level(audio, 1);
      }
    }
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

  // `there`: the arm is already over the record, so the needle drops at
  // once. Started again while winding down, the music speeds back up with
  // the record.
  const start = (there = false) => {
    if (!loaded()) return;
    wire();
    clearTimeout(timer);
    on = true;
    turntable.classList.add("playing", "cued");
    play.setAttribute("aria-label", "Pause preview");
    motor(true);
    if (down) return void playAudio();
    timer = setTimeout(
      () => {
        down = true;
        playAudio();
      },
      still.matches || there ? 0 : NEEDLE_MS,
    );
  };

  // In a hidden tab there are no frames to slow the music down with, so it
  // just stops.
  const stop = () => {
    clearTimeout(timer);
    settle();
    on = false;
    turntable.classList.remove("playing");
    play.setAttribute("aria-label", "Play preview");
    if (down && !audio.paused && !still.matches && !document.hidden) {
      winding = true;
      motor(false);
    } else {
      lift();
      timer = setTimeout(() => motor(false), still.matches ? 0 : LIFT_MS);
    }
  };

  // The needle comes up and the arm goes back to its rest.
  const lift = () => {
    winding = false;
    down = false;
    audio.pause();
    audio.playbackRate = 1;
    level(audio, 1);
    turntable.classList.remove("cued");
  };

  // The mix: FADE seconds before a song ends, the next one starts on the
  // spare deck and the two cross over, the old one dying away as the new
  // one rises, at an even loudness all the way (an equal-power fade). The
  // record changes to the new song as it starts, and the arm goes back to
  // the outside of the record.
  const FADE = 4;
  let fading: HTMLAudioElement | null = null;
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;

  const curve = (rise: boolean) =>
    Float32Array.from({ length: 64 }, (_, i) => {
      const t = i / 63;
      return rise ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
    });

  const ramp = (deck: HTMLAudioElement, rise: boolean) => {
    const gain = gains.get(deck)!.gain;
    gain.cancelScheduledValues(context!.currentTime);
    gain.setValueCurveAtTime(curve(rise), context!.currentTime, FADE);
  };

  const mix = (index: number) => {
    const old = audio;
    audio = spare;
    spare = old;
    select(index);
    fading = old;
    level(audio, 0);
    playAudio();
    ramp(old, false);
    ramp(audio, true);
    fadeTimer = setTimeout(settle, FADE * 1000);
  };

  // Ends the mix at once: the old song stops and the new one is at full.
  // Pausing, holding the arm or choosing another song does this.
  const settle = () => {
    clearTimeout(fadeTimer);
    if (!fading) return;
    fading.pause();
    level(fading, 1);
    level(audio, 1);
    fading = null;
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
    settle();
    if (winding) lift();
    seek = null;
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
    note.textContent = song.note ?? "";
    note.hidden = !song.note;
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
      wire();
      if (i === current && loaded()) return void toggle();
      select(i);
      start();
    });
  }

  play.addEventListener("click", () => {
    wire();
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
  // Events from either deck, heeded only from the one that's on: the other
  // is only ever fading out.
  const heed = (type: string, fn: () => void) => {
    for (const deck of decks) deck.addEventListener(type, () => deck === audio && fn());
  };

  heed("play", () => {
    if (on) return;
    on = down = true;
    turntable.classList.add("playing", "cued");
    play.setAttribute("aria-label", "Pause preview");
    motor(true);
  });

  heed("pause", () => {
    setTimeout(() => {
      if (on && down && audio.paused && !audio.ended) stop();
    }, 50);
  });

  heed("loadedmetadata", () => {
    length.textContent = format(audio.duration);
    if (seek !== null) audio.currentTime = seek * audio.duration;
    seek = null;
  });

  heed("timeupdate", () => {
    if (!audio.duration) return;
    turntable.style.setProperty("--progress", String(audio.currentTime / audio.duration));
    elapsed.textContent = format(audio.currentTime);
    // Time to bring in the next song, unless this is the last.
    if (context && on && down && !winding && !held && !fading && audio.duration - audio.currentTime <= FADE) {
      const after = nearest(1);
      if (after > current) mix(after);
    }
  });

  // At the end of the list it stops rather than going round. A song that
  // runs out while winding down just stops.
  heed("ended", () => {
    if (!on) return lift();
    const after = nearest(1);
    if (after > current) go(after);
    else stop();
  });

  // The arm. Its angle (style.css) is REST off the record, and from ON at
  // the outside of the record to IN at the inside; let go within LEAD of
  // ON, it drops at the start. It turns about its pivot, at (92, 8) in the
  // tonearm's drawing, where at no angle the head is at (88.8, 70).
  const REST = -4;
  const ON = 16;
  const IN = 26;
  const LEAD = 3;
  const HEAD = Math.atan2(70 - 8, 88.8 - 92);
  const svg = grab.ownerSVGElement!;
  const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);
  const at = (deg: number) => clamp((deg - ON) / (IN - ON), 0, 1);

  // Where the pointer is, as an angle of the arm, in degrees.
  const pointing = (e: PointerEvent) => {
    const r = svg.getBoundingClientRect();
    const a = Math.atan2(e.clientY - (r.top + 0.08 * r.height), e.clientX - (r.left + 0.92 * r.width));
    return (((a - HEAD) * 180) / Math.PI + 540) % 360 - 180;
  };

  const seekTo = (p: number) => {
    turntable.style.setProperty("--progress", String(p));
    if (audio.duration) audio.currentTime = p * audio.duration;
    else seek = p;
  };

  // The arm's angle while it's held, and how far that is from the pointer,
  // so it doesn't jump to wherever along it it was picked up.
  let held: { deg: number; offset: number } | null = null;

  grab.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !links[current].dataset.preview) return;
    e.preventDefault();
    wire();
    if (!loaded()) select(current);
    clearTimeout(timer);
    settle();
    if (winding) lift();
    else if (down) {
      // Before pausing, so the pause isn't taken for a stop.
      down = false;
      audio.pause();
    }
    const deg = parseFloat(getComputedStyle(arm).rotate) || REST;
    held = { deg, offset: deg - pointing(e) };
    grab.setPointerCapture(e.pointerId);
    turntable.classList.add("holding");
    arm.style.rotate = `${deg}deg`;
  });

  grab.addEventListener("pointermove", (e) => {
    if (!held) return;
    held.deg = clamp(pointing(e) + held.offset, REST, IN + 2);
    arm.style.rotate = `${held.deg}deg`;
    // The time it would play from.
    if (audio.duration && held.deg >= ON - LEAD) elapsed.textContent = format(at(held.deg) * audio.duration);
  });

  const letGo = () => {
    if (!held) return;
    const { deg } = held;
    held = null;
    turntable.classList.remove("holding");
    arm.style.rotate = "";
    if (deg >= ON - LEAD) {
      seekTo(at(deg));
      start(true);
    } else if (on) stop();
    else turntable.classList.remove("cued");
  };

  grab.addEventListener("pointerup", letGo);
  grab.addEventListener("pointercancel", letGo);

  controls.hidden = !links.some((a) => a.dataset.preview);
  showControls(!!links[0]?.dataset.preview);
}
