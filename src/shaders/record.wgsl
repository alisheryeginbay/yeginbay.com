// The record on /music (src/scripts/record-shader.ts): black vinyl catching
// the light in broad beams, coloured by the cover where they fall, like the
// rainbow on a CD. The beams stay where the light is while the record turns
// under them; the fine streaks pressed into the vinyl turn with it. The
// middle is left clear for the label, the cover itself, underneath.
//
// The grooves follow the song: how loud it is, start to end, runs from the
// outside of the record in, and quiet passages show as glossy bands, as on
// a real pressing. The beams swell a little with the beat, and turn a
// little toward wherever the light is coming from.

struct Params {
  // The canvas, in pixels.
  res: vec2f,
  // How far the record has turned clockwise, in radians.
  rotation: f32,
  // The label's radius, as a fraction of the record's.
  label: f32,
  // From the last cover's colours (0) to this one's (1).
  blend: f32,
  // The beat, from 0 to 1.
  pulse: f32,
  // How far the beams have turned, anticlockwise, in radians.
  lamp: f32,
  // From plain grooves (0) to the song's (1).
  etch: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var from_cover: texture_2d<f32>;
@group(0) @binding(2) var to_cover: texture_2d<f32>;
@group(0) @binding(3) var cover_sampler: sampler;
// The song's loudness, from its start (left) to its end (right), 0 to 1.
@group(0) @binding(4) var grooves: texture_2d<f32>;

const TAU = 6.2831853;

fn hash(n: f32) -> f32 {
  return fract(sin(n) * 43758.5453);
}

// Smooth noise round the circle: x from 0 to n, wrapping at n.
fn ring(x: f32, n: f32) -> f32 {
  let i = floor(x);
  let f = fract(x);
  let s = f * f * (3.0 - 2.0 * f);
  let a = i - n * floor(i / n);
  let b = (i + 1.0) - n * floor((i + 1.0) / n);
  return mix(hash(a), hash(b), s);
}

// The colour of the light at angle th: the cover's colour on a ring round
// its middle at that angle (the covers are tiny, so this is soft), made
// brighter without changing its hue. A dark or grey cover gives silver.
fn tint(th: f32) -> vec3f {
  let q = vec2f(0.5 + 0.32 * cos(th), 0.5 - 0.32 * sin(th));
  let a = textureSampleLevel(from_cover, cover_sampler, q, 0.0).rgb;
  let b = textureSampleLevel(to_cover, cover_sampler, q, 0.0).rgb;
  let c = mix(a, b, params.blend);
  let bright = c / max(max(max(c.r, c.g), c.b), 0.08) * 0.92;
  let grey = dot(bright, vec3f(0.299, 0.587, 0.114));
  let vivid = clamp(mix(vec3f(grey), bright, 1.35), vec3f(0.0), vec3f(1.0));
  // A little of a CD's rainbow on top, turning twice round the circle, so
  // even a one-colour cover shifts in hue across the beams.
  let rainbow = 0.5 + 0.5 * cos(2.0 * th + vec3f(0.0, 2.1, 4.2));
  return mix(vivid, vivid * (0.55 + 0.9 * rainbow), 0.4);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  // p runs from -1 to 1 across the record, y up.
  let p = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let r = length(p);
  let px = 2.0 / params.res.x;
  let alpha = (1.0 - smoothstep(1.0 - 1.5 * px, 1.0, r)) * smoothstep(params.label - px, params.label + px, r);

  // What's under angle th now came from th + rotation on the record.
  let th = atan2(p.y, p.x);
  let a = (th + params.rotation) / TAU;

  // Streaks pressed into the vinyl, fine and coarse.
  let streak = 0.6 * ring(a * 140.0, 140.0) + 0.4 * ring(a * 29.0, 29.0);

  // Grooves, about every 2 pixels and faint; the smooth ring round the label; and
  // the bands between tracks.
  let groove = 0.5 + 0.5 * sin(r * params.res.x * 1.6);
  let wax = 1.0 - smoothstep(params.label + 0.06, params.label + 0.07, r);
  var bands = 0.0;
  bands += 1.0 - smoothstep(0.0, 0.004, abs(r - 0.6));
  bands += 1.0 - smoothstep(0.0, 0.003, abs(r - 0.68));
  bands += 1.0 - smoothstep(0.0, 0.004, abs(r - 0.77));
  bands += 1.0 - smoothstep(0.0, 0.003, abs(r - 0.85));
  bands += 1.0 - smoothstep(0.0, 0.004, abs(r - 0.92));
  bands = min(bands, 1.0);

  // The song, from just inside the rim to just outside the smooth ring,
  // where the music on a record ends. Its quiet passages are bands in
  // place of the made-up ones; its loud ones are dull with the needle's
  // wider swings.
  let inner = params.label + 0.08;
  let outer = 0.965;
  let music = step(inner, r) * step(r, outer);
  let t = clamp((outer - r) / (outer - inner), 0.0, 1.0);
  let loud = textureSampleLevel(grooves, cover_sampler, vec2f(t, 0.5), 0.0).r;
  let quiet = (1.0 - smoothstep(0.06, 0.2, loud)) * music;
  bands = mix(bands, quiet, params.etch);

  // The light: two pairs of beams across the record, one broad and one
  // narrow, as a lamp above it would make on the grooves.
  let lit = th - params.lamp;
  var light = pow(abs(cos(lit - 2.2)), 9.0) + 0.6 * pow(abs(cos(lit - 0.5)), 28.0);
  light *= mix(0.45, 1.4, streak);
  light *= mix(0.88, 1.0, groove) * (1.0 - 0.55 * wax) * (1.0 - 0.6 * bands);
  light *= 0.45 + 0.55 * smoothstep(params.label, 1.0, r);
  light *= mix(1.0, mix(0.75, 1.2, loud), params.etch * music);
  light *= 1.0 + 0.5 * params.pulse;

  let colour = tint(th);
  var c = vec3f(0.022 + 0.016 * streak);
  c += colour * light * 0.85;
  c += vec3f(0.025) * bands;
  c += vec3f(0.012) * loud * music * params.etch;

  // A thin rim, lit in the same colours.
  let rim = smoothstep(0.972, 0.986, r) * (1.0 - smoothstep(0.986, 1.0, r));
  c += (colour * 0.5 + 0.12) * rim * (0.4 + light + 0.6 * params.pulse);

  return vec4f(c * alpha, alpha);
}
