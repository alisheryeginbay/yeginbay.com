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
//
// The record can be held, too: under a hand it turns only as the hand
// turns it, and the music with it, forward or back (src/scripts/
// scratch.ts). Let go, it's picked up by the motor again, from however
// fast it was going, or spun the wrong way, and the music comes up to
// speed with it.
//
// Where the record is drawn with WebGPU, its grooves are cut from the
// song's loudness, its light swells a little with the beat, and the light
// turns a little as the pointer moves, or the phone tilts.
import { GROOVES, type RecordShader } from "./record-shader.ts";
import { scratcher, type Scratch } from "./scratch.ts";
import type { SleeveShader } from "./sleeve-shader.ts";

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
  const disc = $(".disc");
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
      engrave(links[current]?.dataset.preview);
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
  // The record and the needle are each in one state at a time, moving
  // only between the states their tables allow; the page's classes follow
  // them (sync, further down).
  //
  // The record: on the platter; under a hand, which has got to `angle`
  // round its middle, and turned it by `turned` since the last frame;
  // away, taken off while the song changes, and still; or landing, back on
  // the platter and turning, but not yet settled. `change` is which change
  // of song took it off.
  type Place =
    | { at: "platter" }
    | { at: "hand"; angle: number; turned: number }
    | { at: "away"; change: number }
    | { at: "landing"; change: number };
  const PLACES: Record<Place["at"], Place["at"][]> = {
    platter: ["hand", "away"],
    hand: ["platter", "away"],
    away: ["away", "landing"],
    landing: ["platter", "away"],
  };
  let place: Place = { at: "platter" };

  // The needle: up, the arm at its rest; lowering, the arm swinging on
  // until the needle lands; down, playing; winding, still in the groove
  // while the record changes speed, so the music follows it (switched
  // off, or switched on again before it stopped); or held, the arm in a
  // hand.
  type Needle = "up" | "lowering" | "down" | "winding" | "held";
  const NEEDLES: Record<Needle, Needle[]> = {
    up: ["lowering", "down", "held"],
    lowering: ["down", "up", "held"],
    down: ["winding", "up", "held"],
    winding: ["down", "up", "held"],
    held: ["lowering", "up"],
  };
  let needle: Needle = "up";
  // In the groove, and so playing, whether at speed or not.
  const grooved = () => needle === "down" || needle === "winding";

  // A move the tables don't allow is a mistake here; it's made anyway,
  // and said so while developing.
  const allowed = <T extends string>(moves: Record<T, T[]>, from: T, to: T) => {
    if (import.meta.env.DEV && from !== to && !moves[from].includes(to)) console.warn(`turntable: ${from} → ${to}`);
  };
  const moveNeedle = (to: Needle) => {
    allowed(NEEDLES, needle, to);
    needle = to;
    sync();
  };
  const moveRecord = (to: Place) => {
    allowed(PLACES, place.at, to.at);
    place = to;
    sync();
  };
  let speed = 0;
  let target = 0;
  // How quickly the record comes up to speed, in seconds: pulled by the
  // belt from a standstill, or caught up almost at once when it's set down
  // on a platter that's already turning.
  const BELT = 0.7;
  const CATCH = 0.12;
  let grip = BELT;
  let frame = 0;
  let last = 0;

  // While the needle's down under a hand on the record (further down), the
  // music comes from the scratch rather than the deck, until the record's
  // back up to speed.
  let scratching = false;

  // Winding, the music follows the record's speed, fading as it slows,
  // until the arm lifts. Below about a third of the speed it's too slow to
  // hear.
  const QUIET = 0.3;
  for (const deck of decks) deck.preservesPitch = false;

  // Each deck's volume, set through Web Audio, since iOS ignores a media
  // element's own. The previews are served to any site (CORS), so the
  // decks can be wired in; that's done on the first click, as a browser
  // only lets sound start from one. Without Web Audio, songs don't fade
  // into each other, and change when they end.
  // Both decks go through `analyser` too, which hears the beat.
  let context: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  const gains = new Map<HTMLAudioElement, GainNode>();
  const wire = () => {
    if (!context && "AudioContext" in window) {
      context = new AudioContext();
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.5;
      analyser.connect(context.destination);
      for (const deck of decks) {
        const gain = context.createGain();
        context.createMediaElementSource(deck).connect(gain).connect(analyser);
        gains.set(deck, gain);
      }
      // The record under a hand. Without it, a held record is silent.
      scratcher(context, analyser).then(
        (s) => {
          voice = s;
          cut(links[current].dataset.preview);
        },
        (e) => console.error(e),
      );
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

  // Under a hand, the record turns as it's turned, and neither the motor
  // nor friction has a say.
  const tick = (now: number) => {
    frame = 0;
    if (place.at === "hand") return;
    // Off the platter while the song changes, the record keeps still.
    if (place.at === "away") {
      speed = 0;
      spin.pause();
      return;
    }
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    if (target > speed) speed += (target - speed) * (1 - Math.exp(-dt / grip));
    else speed = Math.max(0, speed - (0.1 + speed / 1.4) * dt);
    if (Math.abs(target - speed) < 0.002) {
      speed = target;
      grip = BELT;
    }
    // An animation can't run backward for ever, so a record spun the wrong
    // way is turned by hand here until it's going forward again.
    if (speed < 0) {
      spin.pause();
      turn(speed * dt);
    } else {
      spin.playbackRate = speed;
      if (speed > 0 && spin.playState !== "running") spin.play();
    }
    if (scratching) follow();
    if (needle === "winding") {
      if (target === 0 && speed <= QUIET) lift();
      else if (speed === 1) moveNeedle("down");
      if (needle === "winding") {
        audio.playbackRate = Math.max(speed, QUIET);
        level(audio, Math.min(1, (speed - QUIET) / 0.5));
      } else {
        audio.playbackRate = 1;
        level(audio, 1);
      }
    }
    if (speed === 0) spin.pause();
    else if (speed !== target) frame = requestAnimationFrame(tick);
  };

  const run = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const motor = (on: boolean) => {
    target = on && !still.matches ? 1 : 0;
    if (target && speed >= 0 && place.at !== "away") spin.play();
    run();
    paint();
  };

  // Turns the record by `turns` without the animation, the way it's
  // turning or the other.
  const TURN_MS = 1800;
  const turn = (turns: number) => {
    const t = Number(spin.currentTime ?? 0) + turns * TURN_MS;
    spin.currentTime = ((t % TURN_MS) + TURN_MS) % TURN_MS;
  };

  // The beat: the bass, below about 190 Hz, against its own recent
  // average, so a kick drum stands out from a held bass note. It rises at
  // once and dies away over a fifth of a second or so.
  let bins: Uint8Array<ArrayBuffer> | null = null;
  let bass = 0;
  let pulse = 0;
  const listen = (dt: number) => {
    let hit = 0;
    if (analyser && on && !still.matches) {
      bins ??= new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);
      const top = Math.max(2, Math.round((190 / context!.sampleRate) * analyser.fftSize));
      let sum = 0;
      for (let i = 1; i <= top; i++) sum += bins[i];
      const now = sum / top / 255;
      bass += (now - bass) * (1 - Math.exp(-dt / 0.6));
      hit = Math.min(1, Math.max(0, (now - bass) * 4));
    }
    pulse = Math.max(hit, pulse * Math.exp(-dt / 0.18));
    if (pulse < 0.005) pulse = 0;
  };

  // The light: where it's coming from turns the beams, by up to about a
  // fifth of a turn each way, following the pointer (or the phone's tilt)
  // across the window, easing after it.
  let lamp = 0;
  let lampTo = 0;
  // Moves smaller than about half a degree are let pass, so a phone's
  // sensor, which never quite settles, doesn't keep the record drawing.
  const aim = (x: number, y: number) => {
    const to = 0.45 * (-0.8 * Math.max(-1, Math.min(1, x)) + 0.5 * Math.max(-1, Math.min(1, y)));
    if (Math.abs(to - lampTo) < 0.01) return;
    lampTo = to;
    paint();
  };
  if (matchMedia("(pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => aim((2 * e.clientX) / innerWidth - 1, (2 * e.clientY) / innerHeight - 1), {
      passive: true,
    });
  } else {
    // Held upright and level, a phone is at 0; tipped 40 degrees, at the
    // most. iOS asks before it tells a page this, so there it stays still.
    window.addEventListener("deviceorientation", (e) => {
      if (e.gamma === null || e.beta === null) return;
      aim(e.gamma / 40, (e.beta - 45) / 40);
    });
  }

  // Frames of the WebGPU record, drawn while it turns, its colours or
  // grooves change, the beat dies away or the light moves, each at the
  // angle the label has reached. None while it's scrolled out of sight; it
  // catches up when it's back.
  let seen = true;
  new IntersectionObserver(([entry]) => {
    seen = entry.isIntersecting;
    paint();
  }).observe(canvas);
  let painting = 0;
  let painted = 0;
  const angle = () => ((Number(spin.currentTime ?? 0) % 1800) / 1800) * 2 * Math.PI;
  const paintFrame = (now: number) => {
    painting = 0;
    const dt = painted ? Math.min((now - painted) / 1000, 0.1) : 0;
    painted = now;
    listen(dt);
    lamp += (lampTo - lamp) * (1 - Math.exp(-dt / 0.3));
    if (Math.abs(lampTo - lamp) < 0.0005) lamp = lampTo;
    shader!.draw(angle(), pulse, lamp);
    if (seen && (speed !== 0 || target > 0 || place.at === "hand" || pulse > 0 || lamp !== lampTo || shader!.blending()))
      painting = requestAnimationFrame(paintFrame);
    else painted = 0;
  };
  const paint = () => {
    if (shader && seen && !painting) painting = requestAnimationFrame(paintFrame);
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

  // Whether the turntable is switched on.
  let on = false;
  const power = (yes: boolean) => {
    on = yes;
    play.setAttribute("aria-label", yes ? "Pause preview" : "Play preview");
    playing(yes);
    sync();
  };

  // The page's classes, from the power, the needle and the record
  // (style.css).
  const sync = () => {
    const c = turntable.classList;
    c.toggle("playing", on);
    c.toggle("cued", needle === "lowering" || grooved());
    c.toggle("holding", needle === "held");
    c.toggle("scratching", place.at === "hand");
    c.toggle("changing", place.at === "away" || place.at === "landing");
  };

  // The needle drops when the arm's done swinging on (`timer`), and the
  // motor stops a moment after the arm lifts.
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
    power(true);
    motor(true);
    if (grooved()) return void playAudio();
    moveNeedle("lowering");
    timer = setTimeout(
      () => {
        moveNeedle("down");
        playAudio();
      },
      still.matches || there ? 0 : Math.max(0, changeEnds - performance.now()) + NEEDLE_MS,
    );
  };

  // In a hidden tab there are no frames to slow the music down with, so it
  // just stops.
  const stop = () => {
    clearTimeout(timer);
    unscratch();
    settle();
    power(false);
    if (grooved() && !audio.paused && !still.matches && !document.hidden) {
      moveNeedle("winding");
      motor(false);
    } else {
      lift();
      timer = setTimeout(() => motor(false), still.matches ? 0 : LIFT_MS);
    }
  };

  // The needle comes up and the arm goes back to its rest.
  const lift = () => {
    moveNeedle("up");
    audio.pause();
    audio.playbackRate = 1;
    level(audio, 1);
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
    select(index, true);
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

  // The preview's file, fetched once for both its grooves and its scratch.
  // Decoding takes the bytes, so each gets a copy.
  const files = new Map<string, Promise<ArrayBuffer>>();
  const file = async (url: string) => {
    if (!files.has(url)) {
      const bytes = fetch(url, { mode: "cors", priority: "low" }).then((r) => r.arrayBuffer());
      files.set(url, bytes);
      bytes.catch(() => files.delete(url));
    }
    return (await files.get(url)!).slice(0);
  };

  // The song's loudness, for the grooves: the preview, fetched and decoded
  // (which a browser does even before anything's been clicked), cut into
  // GROOVES pieces, each piece's loudness against the loudest's. Kept for
  // each song once it's been worked out. Plain grooves until it's in, or if
  // it can't be.
  const loudness = new Map<string, Promise<Uint8Array>>();
  const measure = async (url: string) => {
    const sound = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(await file(url));
    const channels = Array.from({ length: sound.numberOfChannels }, (_, c) => sound.getChannelData(c));
    const n = channels[0].length;
    const rms = new Float32Array(GROOVES);
    for (let g = 0; g < GROOVES; g++) {
      const from = Math.floor((g * n) / GROOVES);
      const to = Math.floor(((g + 1) * n) / GROOVES);
      let sum = 0;
      for (const data of channels) for (let i = from; i < to; i += 4) sum += data[i] * data[i];
      rms[g] = Math.sqrt(sum / Math.max(1, ((to - from) / 4) * channels.length));
    }
    const loudest = Math.max(...rms, 1e-6);
    return Uint8Array.from(rms, (v) => Math.round(255 * Math.pow(v / loudest, 0.8)));
  };

  const engrave = (url: string | undefined) => {
    const s = shader;
    if (!s) return;
    s.setGrooves(null);
    paint();
    if (!url) return;
    if (!loudness.has(url)) loudness.set(url, measure(url));
    loudness.get(url)!.then(
      (levels) => {
        if (links[current].dataset.preview !== url) return;
        s.setGrooves(levels);
        paint();
      },
      (e) => {
        loudness.delete(url);
        console.error(e);
      },
    );
  };

  // The song, decoded for the scratch, once there's somewhere to play it.
  // `scratchable` is the song it's ready for.
  let voice: Scratch | null = null;
  let scratchable: string | null = null;
  const cut = (url: string | undefined) => {
    const v = voice;
    if (!v || !context || url === scratchable) return;
    scratchable = null;
    v.load(null);
    if (!url) return;
    file(url)
      .then((bytes) => context!.decodeAudioData(bytes))
      .then(
        (sound) => {
          if (links[current].dataset.preview !== url) return;
          v.load(sound);
          scratchable = url;
        },
        (e) => console.error(e),
      );
  };

  // The record for a song: its cover on the label, which fades in once
  // it's loaded, so it never shows half-drawn, and its colours and grooves.
  const dress = (song: DOMStringMap) => {
    label.src = song.art!;
    recolor(song.swatch, 700);
    engrave(song.preview);
    cut(song.preview);
    label.style.backgroundColor = song.bg ?? "";
    label.decode().then(
      () => label.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, easing: "ease-out" }),
      () => {},
    );
    printLabel(song.art!);
  };

  // Changes the label under a copy of how it was, which fades away over
  // `ms` once the new one's ready, so it never shows half-drawn or blank.
  const relabel = (apply: () => void, ms: number) => {
    const was = label.cloneNode() as HTMLImageElement;
    label.after(was);
    apply();
    label
      .decode()
      .catch(() => {})
      .then(() => was.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "ease-in-out" }).finished)
      .finally(() => was.remove());
  };

  // Where WebGPU works, the label is the cover printed on matte paper (src/
  // scripts/sleeve-shader.ts), swapped in once it's ready.
  const printLabel = (art: string) =>
    sleeveShader?.label(art).then(
      (src) => {
        const printed = new Image();
        printed.src = src;
        return printed.decode().then(() => {
          if (links[current].dataset.art === art && label.src !== src) relabel(() => (label.src = src), 400);
        });
      },
      (e) => console.error(e),
    );

  // Changing records, seen from further back: the arm lifts and the
  // player zooms out as the record's taken off, and the new song's sleeve
  // comes up in front of it. The new record is drawn out of the sleeve's
  // open side, to the right, as the sleeve is pulled to the left; then the
  // sleeve drops away and the record goes onto the player as it zooms back
  // in. Changed again on the way, everything goes on from wherever it's
  // got to.
  const platter = $(".platter");
  const sleeve = $(".sleeve");
  const sleeveArt = sleeve.querySelector("img")!;
  // Where WebGPU works, the sleeve's cover is printed on board (src/
  // scripts/sleeve-shader.ts), shown once it's drawn ("printed").
  let sleeveShader: SleeveShader | null = null;
  if ("gpu" in navigator)
    import("./sleeve-shader.ts")
      .then((m) => m.sleeveShader(sleeve.querySelector("canvas")!))
      .then((s) => {
        sleeveShader = s;
        printLabel(links[current].dataset.art!);
      }, (e) => console.error(e));
  let printing = "";
  const print = (url: string) => {
    sleeve.classList.remove("printed");
    printing = url;
    sleeveShader?.setCover(url, () => printing === url).then(
      (drawn) => drawn && sleeve.classList.add("printed"),
      (e) => console.error(e),
    );
  };
  const ZOOM = 0.55;
  const CHANGE_MS = 2280;
  // How far apart the sleeve and the record are pulled, each way: far
  // enough that the record is all the way out before the sleeve goes.
  const PULL = 0.47;
  // As it's drawn out it rolls along the sleeve's edge, clockwise: the
  // distance over the record's round, which is 0.92 of the deck across.
  const ROLL = PULL / (0.92 * Math.PI);

  // Turns the record by `turns` over `ms`, easing in and out with the
  // slide, unless it's set down or the song changes again first.
  const roll = (turns: number, ms: number, id: number) =>
    new Promise<void>((done) => {
      const from = performance.now();
      let at = 0;
      const step = (now: number) => {
        if (place.at !== "away" || place.change !== id) return done();
        const t = Math.min(1, (now - from) / ms);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        turn((eased - at) * turns);
        at = eased;
        paint();
        if (t < 1) requestAnimationFrame(step);
        else done();
      };
      requestAnimationFrame(step);
    });
  const easeIn = "cubic-bezier(0.5, 0, 0.75, 0)";
  const easeOut = "cubic-bezier(0.2, 0.8, 0.3, 1)";
  const easeInOut = "cubic-bezier(0.65, 0, 0.35, 1)";
  // How many changes of song there have been, so one cut short by the
  // next can tell.
  let changes = 0;
  const changing = (id: number) => (place.at === "away" || place.at === "landing") && place.change === id;
  // When the record will be back on the player.
  let changeEnds = 0;

  // Each of these also moves --lift, how high it's held over what's under
  // it, which spreads and softens its shadow, and the sleeve --light, the
  // sheen across its coating (style.css).
  //
  // Animates an element from where it is now (or `from`) to `target`, and
  // holds it there. What it's been moved to so far stays put, in its style,
  // until `rest` puts it back as it was.
  const to = (el: HTMLElement, target: Keyframe, ms: number, easing: string, from?: Keyframe) => {
    for (const a of el.getAnimations()) {
      a.commitStyles();
      a.cancel();
    }
    const style = getComputedStyle(el);
    const start: Keyframe = from ?? {};
    if (!from) for (const k in target) start[k] = style.getPropertyValue(k);
    return el.animate([start, target], { duration: ms, easing, fill: "forwards" }).finished;
  };
  const rest = (el: HTMLElement) => {
    for (const a of el.getAnimations()) a.cancel();
    for (const k of ["opacity", "translate", "scale", "--lift", "--light", "--shade"]) el.style.removeProperty(k);
  };

  const change = async (song: DOMStringMap) => {
    const id = ++changes;
    const d = platter.offsetWidth;
    changeEnds = performance.now() + CHANGE_MS;
    // Taken off, the record stops, and set down again it's brought up to
    // speed, as when the turntable's started.
    moveRecord({ at: "away", change: id });
    speed = 0;
    spin.pause();
    // Printed while the record's taken off, so it's ready when the sleeve
    // comes up.
    const printed = Number(getComputedStyle(sleeve).opacity) > 0;
    if (!printed) print(song.art!);
    sleeveShader?.label(song.art!).catch(() => {});
    try {
      // Zoom out, and take the record off. A sleeve still out from a
      // change cut short goes away first.
      const zoom = to(platter, { scale: String(ZOOM) }, 650, easeInOut);
      await Promise.all([
        to(disc, { opacity: 0, translate: `0 ${0.12 * d}px`, "--lift": 0.6 }, 280, easeIn),
        Number(getComputedStyle(sleeve).opacity) > 0 &&
          to(sleeve, { opacity: 0, translate: `${-0.3 * d}px ${0.4 * d}px`, "--lift": 1 }, 220, easeIn),
      ]);
      if (!changing(id)) return;

      // The new sleeve comes up, with the new record in it.
      if (printed) print(song.art!);
      sleeveArt.src = song.art!;
      sleeve.style.backgroundColor = song.bg ?? "";
      dress(song);
      await Promise.all([
        to(sleeve, { opacity: 1, translate: "0 0", "--lift": 0.35, "--light": 0.3 }, 420, easeOut, {
          opacity: 0,
          translate: `0 ${0.3 * d}px`,
          "--lift": 1,
          "--light": 0,
        }),
        zoom,
      ]);
      if (!changing(id)) return;

      // All the way out of the sleeve.
      // Inside the sleeve it has no shadow of its own; coming out, it casts
      // one from the same height as the sleeve.
      to(disc, { opacity: 1, translate: "0 0", "--lift": 0.35, "--shade": 0 }, 0, "linear");
      await Promise.all([
        to(sleeve, { translate: `${-PULL * d}px 0`, "--light": 0.65 }, 620, easeInOut),
        to(disc, { translate: `${PULL * d}px 0`, "--shade": 1 }, 620, easeInOut),
        roll(ROLL, 620, id),
      ]);
      if (!changing(id)) return;

      // The sleeve goes back down the way it came up, and once it's gone
      // the record goes onto the player.
      await to(sleeve, { opacity: 0, translate: `${-PULL * d}px ${0.3 * d}px`, "--lift": 1 }, 360, easeIn);
      if (!changing(id)) return;
      const landed = Promise.all([
        to(disc, { translate: "0 0", "--lift": 0 }, 600, easeOut),
        to(platter, { scale: "1" }, 600, easeOut),
      ]);
      // It touches the platter a little before it's settled, and the
      // platter, already turning, takes it up to speed at once.
      await new Promise((r) => setTimeout(r, 300));
      if (!changing(id)) return;
      moveRecord({ at: "landing", change: id });
      grip = CATCH;
      run();
      await landed;
      if (!changing(id)) return;
      for (const el of [platter, disc, sleeve]) rest(el);
      moveRecord({ at: "platter" });
    } catch {
      // Cut short by the next change, which carries on from here.
    }
  };

  // `mixed`, the record stays on, playing, and only its label changes.
  const select = (index: number, mixed = false) => {
    unscratch();
    settle();
    if (needle === "winding") lift();
    seek = null;
    const song = links[index].dataset;
    const changed = index !== current;
    links[current].removeAttribute("aria-current");
    links[index].setAttribute("aria-current", "true");
    current = index;

    if (changed && mixed && !still.matches) relabel(() => dress(song), 900);
    else if (changed && !still.matches) change(song);
    else dress(song);
    title.textContent = song.title!;
    artist.replaceChildren(`${song.artist} · `, Object.assign(document.createElement("i"), { textContent: song.album }));
    note.textContent = song.note ?? "";
    note.hidden = !song.note;
    describe(song);
    showControls(!!song.preview);
    // Setting src to "" would point it at the page itself.
    if (song.preview) audio.src = song.preview;
    else audio.removeAttribute("src");
    turntable.style.setProperty("--progress", "0");
    elapsed.textContent = "0:00";
    // The next cover, so the label changes at once when this song ends.
    const after = links[index + 1]?.dataset.art;
    if (after) {
      new Image().src = after;
      sleeveShader?.label(after).catch(() => {});
    }
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
  // Changing records by hand, the needle comes up first, and the music
  // with it; the next song starts once the new record's on and the arm's
  // back down (start). The mix at the end of a song doesn't do this: it
  // fades the next one in over the last.
  const switchTo = (index: number) => {
    if (index !== current && grooved() && !still.matches) {
      // The song that's on dies away on the spare deck as the needle comes
      // up, rather than cutting off; the new one loads on the other.
      const old = audio;
      audio = spare;
      spare = old;
      hush(old);
      lift();
    }
    select(index);
  };

  // Fades a deck out over a moment and stops it; at once without Web Audio.
  const HUSH = 0.12;
  const hush = (deck: HTMLAudioElement) => {
    const gain = gains.get(deck)?.gain;
    if (!gain || !context) return deck.pause();
    gain.cancelScheduledValues(context.currentTime);
    gain.setValueAtTime(gain.value, context.currentTime);
    gain.linearRampToValueAtTime(0, context.currentTime + HUSH);
    setTimeout(() => {
      if (deck === audio) return;
      deck.pause();
      level(deck, 1);
    }, HUSH * 1000 + 20);
  };

  const go = (index: number) => {
    if (index === -1) return;
    switchTo(index);
    if (on) start();
  };

  for (const [i, a] of links.entries()) {
    a.addEventListener("click", (e) => {
      if (!a.dataset.preview || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      wire();
      if (i === current && loaded()) return void toggle();
      switchTo(i);
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
    moveNeedle("down");
    power(true);
    motor(true);
  });

  heed("pause", () => {
    setTimeout(() => {
      if (on && grooved() && !scratching && audio.paused && !audio.ended) stop();
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
    position();
    // Time to bring in the next song, unless this is the last.
    if (context && on && needle === "down" && !scratching && !fading && audio.duration - audio.currentTime <= FADE) {
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
  // so it doesn't jump to wherever along it it was picked up. Set only
  // while the needle's held.
  let held: { deg: number; offset: number } | null = null;

  grab.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !links[current].dataset.preview || place.at === "away" || place.at === "landing") return;
    e.preventDefault();
    wire();
    if (!loaded()) select(current);
    clearTimeout(timer);
    unscratch();
    settle();
    if (needle === "winding") lift();
    else if (needle === "down") {
      // Held before pausing, so the pause isn't taken for a stop.
      moveNeedle("held");
      audio.pause();
    }
    const deg = parseFloat(getComputedStyle(arm).rotate) || REST;
    held = { deg, offset: deg - pointing(e) };
    moveNeedle("held");
    grab.setPointerCapture(e.pointerId);
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
    arm.style.rotate = "";
    if (deg >= ON - LEAD) {
      seekTo(at(deg));
      start(true);
    } else if (on) stop();
    // Put back at its rest, or anywhere it couldn't play from.
    if (needle === "held") moveNeedle("up");
  };

  grab.addEventListener("pointerup", letGo);
  grab.addEventListener("pointercancel", letGo);

  // The record under a hand. Held, it turns as far as the pointer goes
  // round its middle, and its speed is how fast that is, eased over a few
  // hundredths of a second as a heavy platter would; caught while turning,
  // it's brought to a stop. Let go, the motor takes it from there (tick).
  const scratchReady = () => !!voice && scratchable === links[current].dataset.preview;
  const songAt = () => (scratching && scratchReady() ? voice!.position() : audio.currentTime);

  const around = (e: PointerEvent) => {
    const r = disc.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
  };

  // The ring, the arm and the time, at `seconds` into the song.
  const show = (seconds: number) => {
    if (!audio.duration) return;
    turntable.style.setProperty("--progress", String(seconds / audio.duration));
    elapsed.textContent = format(seconds);
  };

  let feeling = 0;
  let felt = 0;
  const feel = (t: number) => {
    const hand = place;
    if (hand.at !== "hand") return;
    const dt = Math.max((t - felt) / 1000, 1 / 240);
    felt = t;
    const turning = clamp((hand.turned * TURN_MS) / 1000 / dt, -8, 8);
    hand.turned = 0;
    speed += (turning - speed) * (1 - Math.exp(-dt / 0.04));
    if (scratching) {
      if (scratchReady()) voice!.speed(speed);
      show(songAt());
    }
    feeling = requestAnimationFrame(feel);
  };

  disc.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || place.at !== "platter") return;
    e.preventDefault();
    wire();
    settle();
    if (needle === "winding") lift();
    // A needle on its way down lands now.
    if (on && needle === "lowering" && loaded()) {
      clearTimeout(timer);
      moveNeedle("down");
    }
    if (on && needle === "down" && !scratching) {
      scratching = true;
      if (scratchReady()) {
        voice!.seek(audio.currentTime);
        voice!.speed(speed);
        voice!.fade(1, 0.01);
      }
      audio.pause();
    }
    moveRecord({ at: "hand", angle: around(e), turned: 0 });
    spin.pause();
    disc.setPointerCapture(e.pointerId);
    felt = performance.now();
    feeling = requestAnimationFrame(feel);
    paint();
  });

  disc.addEventListener("pointermove", (e) => {
    const hand = place;
    if (hand.at !== "hand") return;
    const a = around(e);
    let d = a - hand.angle;
    d -= 2 * Math.PI * Math.round(d / (2 * Math.PI));
    hand.angle = a;
    hand.turned += d / (2 * Math.PI);
    turn(d / (2 * Math.PI));
    paint();
  });

  const release = () => {
    if (place.at !== "hand") return;
    moveRecord({ at: "platter" });
    cancelAnimationFrame(feeling);
    if (still.matches) {
      speed = 0;
      handBack();
    }
    run();
    paint();
  };

  disc.addEventListener("pointerup", release);
  disc.addEventListener("pointercancel", release);

  // Let go, the scratch follows the record as it comes back up to speed
  // (tick), and then hands back to the deck, from where it's got to: the
  // deck starts there, and the two cross over in a moment, so there's no
  // gap while the deck gets going.
  function follow() {
    if (scratchReady()) voice!.speed(speed);
    show(songAt());
    if (speed === target && target === 1) handBack();
  }

  function handBack() {
    if (!scratching) return;
    const v = scratchReady() ? voice : null;
    scratching = false;
    if (v) audio.currentTime = v.position();
    if (!on || !grooved()) return void v?.fade(0, 0.05);
    const gain = gains.get(audio);
    if (gain && context) gain.gain.setValueAtTime(0, context.currentTime);
    audio.play().then(
      () => {
        if (scratching) return;
        v?.fade(0, 0.06);
        if (!gain || !context) return;
        gain.gain.cancelScheduledValues(context.currentTime);
        gain.gain.setValueAtTime(0, context.currentTime);
        gain.gain.linearRampToValueAtTime(1, context.currentTime + 0.06);
      },
      (e: DOMException) => {
        if (gain) level(audio, 1);
        v?.fade(0, 0.05);
        if (e.name !== "AbortError" && on) stop();
      },
    );
  }

  // Stops the scratch at once: the deck is left where it had got to, paused.
  function unscratch() {
    if (!scratching) return;
    scratching = false;
    if (scratchReady()) {
      audio.currentTime = voice!.position();
      voice!.fade(0, 0.05);
    }
  }

  // The lock screen, Control Centre, headphones and media keys: the song
  // and its cover shown there, and their buttons working the turntable as
  // the ones on the page do. Its state is set here, not left to the audio,
  // since the music goes on for a moment after a pause as the record winds
  // down.
  const session = "mediaSession" in navigator ? navigator.mediaSession : null;
  function describe(song: DOMStringMap) {
    if (!session || !song.preview) return;
    session.metadata = new MediaMetadata({
      title: song.title,
      artist: song.artist,
      album: song.album,
      artwork: [{ src: song.art!, sizes: "400x400", type: "image/jpeg" }],
    });
  }
  function playing(yes: boolean) {
    if (session) session.playbackState = yes ? "playing" : "paused";
  }
  function position() {
    if (!session?.setPositionState || !Number.isFinite(audio.duration)) return;
    try {
      session.setPositionState({ duration: audio.duration, position: Math.min(audio.currentTime, audio.duration) });
    } catch {}
  }
  if (session) {
    const handle = (action: MediaSessionAction, fn: MediaSessionActionHandler) => {
      try {
        session.setActionHandler(action, fn);
      } catch {}
    };
    handle("play", () => {
      wire();
      if (!loaded()) select(current);
      if (!on) start();
    });
    handle("pause", () => on && stop());
    handle("previoustrack", () => prev.click());
    handle("nexttrack", () => go(nearest(1)));
    handle("seekto", ({ seekTime }) => {
      if (seekTime === undefined || !audio.duration) return;
      audio.currentTime = Math.min(seekTime, audio.duration);
      position();
    });
    describe(links[current].dataset);
  }

  controls.hidden = !links.some((a) => a.dataset.preview);
  showControls(!!links[0]?.dataset.preview);
}
