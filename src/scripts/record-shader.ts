// The record on /music drawn with WebGPU through vgpu (src/shaders/
// record.wgsl), lit in the colours of the song's cover. Where WebGPU isn't
// available this gives nothing, and the record keeps its CSS drawing.
import { effect, frame, sampler, surface, texture, type Texture } from "vgpu";
import { gpu as sharedGpu } from "./gpu.ts";
import recordWgsl from "../shaders/record.wgsl";

export interface RecordShader {
  // Draws a frame with the record turned `rotation` radians clockwise, the
  // beat at `pulse` (0 to 1), and the beams turned `lamp` radians
  // anticlockwise.
  draw(rotation: number, pulse?: number, lamp?: number): void;
  // Changes to a cover's colours over `ms`, unless `wanted` says, once it's
  // loaded, that another has been chosen since.
  setCover(url: string, ms: number, wanted?: () => boolean): Promise<void>;
  // Cuts the song's loudness, GROOVES values from 0 to 255 from its start
  // to its end, into the grooves, fading them in; or, given null, goes
  // back to plain grooves at once.
  setGrooves(levels: Uint8Array | null): void;
  // True while the colours or the grooves are still changing.
  blending(): boolean;
}

// How many points of the song's loudness the grooves are cut from.
export const GROOVES = 256;
// How long new grooves take to fade in.
const ETCH_MS = 900;

// The covers are read at this size: small enough that their colours come
// out soft, which is how light on the grooves looks.
const SIZE = 24;

// `label` is the label's radius as a fraction of the record's.
export async function recordShader(canvas: HTMLCanvasElement, label: number): Promise<RecordShader | null> {
  const gpu = await sharedGpu();
  if (!gpu) return null;

  const out = surface(gpu, canvas, { dpr: [1, 2], clearColor: [0, 0, 0, 0] });
  const cover = () =>
    texture(gpu, {
      kind: "2d",
      size: [SIZE, SIZE],
      format: "rgba8unorm",
      usage: ["texture_binding", "copy_dst", "render_attachment"],
    });

  // Silver until the first cover is in.
  const silver = new Uint8Array(SIZE * SIZE * 4).fill(200);
  const fill = (t: Texture) => gpu.gpu.queue.writeTexture({ texture: t.gpu }, silver, { bytesPerRow: SIZE * 4 }, [SIZE, SIZE]);
  let from = cover();
  let to = cover();
  fill(from);
  fill(to);

  const grooves = texture(gpu, {
    kind: "2d",
    size: [GROOVES, 1],
    format: "r8unorm",
    usage: ["texture_binding", "copy_dst"],
  });

  const record = effect(gpu, recordWgsl, {
    label: "record",
    set: {
      params: { res: [1, 1], rotation: 0, label, blend: 1, pulse: 0, lamp: 0, etch: 0 },
      from_cover: from,
      to_cover: to,
      cover_sampler: sampler(gpu, { minFilter: "linear", magFilter: "linear" }),
      grooves,
    },
  });
  out.onResize(({ width, height }) => record.set({ params: { res: [width, height] } }));

  let started = 0;
  let duration = 1;
  const blend = () => {
    const t = Math.min(1, (performance.now() - started) / duration);
    return t * t * (3 - 2 * t);
  };

  // 0 until a song's grooves are in, then rising to 1.
  let etched = -Infinity;
  const etch = () => {
    const t = Math.min(1, (performance.now() - etched) / ETCH_MS);
    return t * t * (3 - 2 * t);
  };

  return {
    draw(rotation, pulse = 0, lamp = 0) {
      record.set({ params: { rotation, blend: blend(), pulse, lamp, etch: etch() } });
      frame(gpu, (f) => f.pass(out, record));
    },

    async setCover(url, ms, wanted = () => true) {
      const blob = await (await fetch(url, { mode: "cors" })).blob();
      const bitmap = await createImageBitmap(blob, { resizeWidth: SIZE, resizeHeight: SIZE, resizeQuality: "high" });
      if (!wanted()) return void bitmap.close();
      // The cover shown now becomes the one blended from.
      [from, to] = [to, from];
      gpu.gpu.queue.copyExternalImageToTexture({ source: bitmap }, { texture: to.gpu }, [SIZE, SIZE]);
      bitmap.close();
      record.set({ from_cover: from, to_cover: to });
      started = performance.now();
      duration = Math.max(ms, 1);
    },

    setGrooves(levels) {
      if (!levels) return void (etched = -Infinity);
      gpu.gpu.queue.writeTexture({ texture: grooves.gpu }, levels, { bytesPerRow: GROOVES }, [GROOVES, 1]);
      etched = performance.now();
    },

    blending() {
      const now = performance.now();
      return now - started < duration || now - etched < ETCH_MS;
    },
  };
}
