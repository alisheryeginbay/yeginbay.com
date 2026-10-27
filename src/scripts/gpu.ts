// One WebGPU context for the page, shared by everything drawn with vgpu on
// it (src/scripts/record-shader.ts, src/scripts/sleeve-shader.ts), since
// each context is a device of its own, and some phones allow only a few.
// Null where WebGPU can't run.
import { init, type Gpu } from "vgpu";

let shared: Promise<Gpu | null> | undefined;

export const gpu = () =>
  (shared ??= "gpu" in navigator ? init().catch(() => null) : Promise.resolve(null));
