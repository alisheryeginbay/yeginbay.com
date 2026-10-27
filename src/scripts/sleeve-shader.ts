// The sleeve and the label on /music (src/scripts/turntable.ts), their
// covers printed with WebGPU through vgpu (src/shaders/paper.wgsl). The
// sleeve is SBS board: the smooth, bleached, coated card record sleeves
// are made of, with a fine grain and a few fibres and no folds or
// creases, the print sitting a little into it. It's drawn once for each
// cover, since it doesn't move. The label is matte, uncoated paper,
// rougher and more fibrous, printed once for each song to an image the
// record's label shows. Where WebGPU isn't available this gives nothing,
// and the plain covers show.
import { effect, frame, sampler, surface, texture, type Gpu, type Texture } from "vgpu";
import { gpu as sharedGpu } from "./gpu.ts";
import paperWgsl from "../shaders/paper.wgsl";
import noiseUrl from "../shaders/paper-noise.png?url";

export interface SleeveShader {
  // Prints a cover on the sleeve, unless `wanted` says, once it's loaded,
  // that another has been chosen since. Resolves once it's drawn.
  setCover(url: string, wanted?: () => boolean): Promise<boolean>;
  // The cover printed on a label, as an image's URL.
  label(url: string): Promise<string>;
}

// Paper's paper-texture, made smooth: a little grain, fewer fibres, and
// nothing folded, wrinkled, crumpled or spotted. The print is mostly ink,
// with the board showing through it a little.
const BOARD = {
  blending: 0.5,
  distortion: 0.2,
  angle: 300,
  roughness: 0.38,
  roughness_size: 0.25,
  roughness_rows: 0,
  fiber: 0.26,
  fiber_size: 0.35,
  folds: 0,
  fold_size_x: 1,
  fold_size_y: 1,
  fold_offset_x: 0,
  fold_offset_y: 0,
  wrinkles: 0,
  wrinkle_size: 0.65,
  crumples: 0,
  crumple_count: 6,
  drops: 0,
  // Clear behind it; a bright, faintly warm white; a grey in its grain.
  back: [0, 0, 0, 0],
  paper: [0.985, 0.98, 0.965, 1],
  shadow: [0.78, 0.77, 0.75, 1],
};

// A label: uncoated paper, so more grain and fibre, and the ink soaking
// further in.
const LABEL = {
  ...BOARD,
  blending: 0.85,
  roughness: 0.6,
  roughness_size: 0.45,
  fiber: 0.45,
  fiber_size: 0.5,
  paper: [0.975, 0.97, 0.95, 1],
  shadow: [0.72, 0.71, 0.68, 1],
};
// The label's size in pixels: about as sharp as it's shown on a phone.
const LABEL_SIZE = 384;

async function upload(gpu: Gpu, source: ImageBitmap): Promise<Texture> {
  const t = texture(gpu, {
    kind: "2d",
    size: [source.width, source.height],
    format: "rgba8unorm",
    usage: ["texture_binding", "copy_dst", "render_attachment"],
  });
  gpu.gpu.queue.copyExternalImageToTexture({ source }, { texture: t.gpu }, [source.width, source.height]);
  return t;
}

const bitmap = async (url: string) =>
  createImageBitmap(await (await fetch(url, { mode: "cors" })).blob(), {
    colorSpaceConversion: "none",
    premultiplyAlpha: "none",
  });

// A different sheet for each cover, so no two sleeves have the same grain.
const seedOf = (url: string) => [...url].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000, 7);

export async function sleeveShader(canvas: HTMLCanvasElement): Promise<SleeveShader | null> {
  const gpu = await sharedGpu();
  if (!gpu) return null;

  const noise = await upload(gpu, await bitmap(noiseUrl));
  // Blank until the first cover is in.
  let cover = texture(gpu, { kind: "2d", size: [1, 1], format: "rgba8unorm", usage: ["texture_binding", "copy_dst"] });
  const linear = sampler(gpu, { minFilter: "linear", magFilter: "linear" });
  const out = surface(gpu, canvas, { dpr: [1, 2], clearColor: [0, 0, 0, 0] });
  const board = effect(gpu, paperWgsl, {
    label: "sleeve",
    set: {
      params: { res: [1, 1], aspect: 1, seed: 4, ...BOARD },
      image: cover,
      image_sampler: linear,
      noise,
      noise_sampler: linear,
    },
  });

  // As in src/scripts/portrait-shader.ts, a resize can't draw straight
  // away, so drawing waits for the next animation frame.
  let queued: Promise<void> | null = null;
  const draw = () =>
    (queued ??= new Promise((resolve) =>
      requestAnimationFrame(() => {
        queued = null;
        frame(gpu, (f) => f.pass(out, board));
        resolve();
      }),
    ));
  out.onResize(({ width, height }) => {
    board.set({ params: { res: [width, height] } });
    draw();
  });

  // Labels are drawn off screen and copied out, one at a time, since they
  // share the canvas.
  const paper = new OffscreenCanvas(LABEL_SIZE, LABEL_SIZE);
  const paperOut = surface(gpu, paper, { dpr: [1, 1], clearColor: [0, 0, 0, 0] });
  let labelCover = texture(gpu, { kind: "2d", size: [1, 1], format: "rgba8unorm", usage: ["texture_binding", "copy_dst"] });
  const labelPaper = effect(gpu, paperWgsl, {
    label: "label",
    set: {
      params: { res: [LABEL_SIZE, LABEL_SIZE], aspect: 1, seed: 4, ...LABEL },
      image: labelCover,
      image_sampler: linear,
      noise,
      noise_sampler: linear,
    },
  });
  const printLabel = async (url: string) => {
    const image = await bitmap(url);
    const aspect = image.width / image.height || 1;
    const old = labelCover;
    labelCover = await upload(gpu, image);
    image.close();
    labelPaper.set({ image: labelCover, params: { res: [LABEL_SIZE, LABEL_SIZE], aspect, seed: seedOf(url) } });
    old.gpu.destroy();
    frame(gpu, (f) => f.pass(paperOut, labelPaper));
    const shot = paper.transferToImageBitmap();
    const copy = new OffscreenCanvas(LABEL_SIZE, LABEL_SIZE);
    copy.getContext("2d")!.drawImage(shot, 0, 0);
    shot.close();
    return URL.createObjectURL(await copy.convertToBlob({ type: "image/webp", quality: 0.92 }));
  };
  const labels = new Map<string, Promise<string>>();
  let queue: Promise<unknown> = Promise.resolve();

  return {
    label(url) {
      let made = labels.get(url);
      if (!made) {
        made = queue.then(() => printLabel(url));
        queue = made.catch(() => {});
        labels.set(url, made);
        made.catch(() => labels.delete(url));
      }
      return made;
    },

    async setCover(url, wanted = () => true) {
      const image = await bitmap(url);
      if (!wanted()) return image.close(), false;
      const old = cover;
      const aspect = image.width / image.height || 1;
      cover = await upload(gpu, image);
      image.close();
      board.set({ image: cover, params: { aspect, seed: seedOf(url) } });
      old.gpu.destroy();
      await draw();
      return wanted();
    },
  };
}
