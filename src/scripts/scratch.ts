// The sound of the record on /music under a hand (src/scripts/turntable.ts):
// the song played from its decoded samples at whatever speed the record is
// turning, forward or back, which a media element can't do. At a standstill
// it's silent, and it fades in as the record gets going, so a hand resting
// on the record doesn't click.

// Runs on the audio thread. `rate` is the record's speed, 1 being the
// song's own; it's eased toward over about 12ms, so a jerky hand doesn't
// crackle.
const PROCESSOR = /* js */ `
class Scratch extends AudioWorkletProcessor {
  constructor() {
    super();
    this.channels = [];
    this.pos = 0;
    this.rate = 0;
    this.to = 0;
    this.seq = 0;
    this.blocks = 0;
    this.ease = 1 - Math.exp(-1 / (sampleRate * 0.012));
    this.port.onmessage = ({ data }) => {
      if (data.channels) this.channels = data.channels;
      if (data.at !== undefined) {
        this.pos = data.at * sampleRate;
        this.seq = data.seq;
      }
      if (data.rate !== undefined) this.to = data.rate;
    };
  }

  process(_, [out]) {
    const src = this.channels;
    const n = src.length ? src[0].length : 0;
    for (let i = 0; i < out[0].length; i++) {
      this.rate += (this.to - this.rate) * this.ease;
      const gain = Math.min(1, Math.abs(this.rate) * 4);
      const p = this.pos;
      const k = Math.floor(p);
      const f = p - k;
      for (let c = 0; c < out.length; c++) {
        const data = src[Math.min(c, src.length - 1)];
        out[c][i] = data && k >= 0 && k + 1 < n ? gain * (data[k] + (data[k + 1] - data[k]) * f) : 0;
      }
      this.pos = Math.min(Math.max(p + this.rate, 0), Math.max(n - 1, 0));
    }
    // Where it's got to, a few dozen times a second.
    if (++this.blocks % 8 === 0) this.port.postMessage({ at: this.pos / sampleRate, seq: this.seq });
    return true;
  }
}
registerProcessor("scratch", Scratch);
`;

export interface Scratch {
  // The song to play, decoded by the same AudioContext, or null for none.
  load(sound: AudioBuffer | null): void;
  // Moves to `seconds` into the song.
  seek(seconds: number): void;
  // The record's speed: 1 for the song's own, 0 stopped, below 0 backward.
  speed(rate: number): void;
  // Where in the song it is, in seconds.
  position(): number;
  // Turns it up to full, or down to silence, over `seconds`.
  fade(to: number, seconds: number): void;
}

export async function scratcher(context: AudioContext, out: AudioNode): Promise<Scratch> {
  const url = URL.createObjectURL(new Blob([PROCESSOR], { type: "text/javascript" }));
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const node = new AudioWorkletNode(context, "scratch", { numberOfInputs: 0, outputChannelCount: [2] });
  const gain = context.createGain();
  node.connect(gain).connect(out);

  // Reports from before the last seek are stale, so each seek is numbered.
  let seq = 0;
  let at = 0;
  node.port.onmessage = ({ data }) => {
    if (data.seq === seq) at = data.at;
  };

  return {
    load(sound) {
      const channels = sound ? Array.from({ length: sound.numberOfChannels }, (_, c) => sound.getChannelData(c).slice()) : [];
      node.port.postMessage({ channels }, channels.map((c) => c.buffer));
    },
    seek(seconds) {
      at = seconds;
      node.port.postMessage({ at: seconds, seq: ++seq });
    },
    speed(rate) {
      node.port.postMessage({ rate });
    },
    position: () => at,
    fade(to, seconds) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(to, now + seconds);
    },
  };
}
