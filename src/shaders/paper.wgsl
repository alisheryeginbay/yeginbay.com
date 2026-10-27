// The portrait on the home page (src/scripts/portrait-shader.ts), printed
// on paper: grain and fibres, folds, wrinkles and crumples lit from one
// side, with the photo soaking into the sheet and bending with it. A port
// of Paper's paper-texture shader (shaders.paper.design/paper-texture).
//
// Every derivative is taken at the top of fs_main, before any branch, so
// they all run in uniform control flow.

struct Params {
  // Behind the sheet, the sheet, and the shading on it.
  back: vec4f,
  paper: vec4f,
  shadow: vec4f,
  // The canvas, in pixels.
  res: vec2f,
  // The image's width over its height.
  aspect: f32,
  // How much of the paper shows through the photo (0 to 1).
  blending: f32,
  // How much the photo bends with the paper (-1 to 1).
  distortion: f32,
  // Where the light comes from, in degrees (0 to 360).
  angle: f32,
  // Picks a different sheet (0 to 1000).
  seed: f32,
  // Fine grain all over (0 to 1), how coarse (0 to 1), and how much it
  // lines up in rows like laid paper (0 to 1).
  roughness: f32,
  roughness_size: f32,
  roughness_rows: f32,
  // Curly threads all over (0 to 1), and how coarse (0 to 1).
  fiber: f32,
  fiber_size: f32,
  // Straight folds across and down (0 to 1), their spacing and shift.
  folds: f32,
  fold_size_x: f32,
  fold_size_y: f32,
  fold_offset_x: f32,
  fold_offset_y: f32,
  // Small crumpled facets repeating everywhere (0 to 1), and how big.
  wrinkles: f32,
  wrinkle_size: f32,
  // A few big irregular creases (0 to 1), and how many facets (2 to 15).
  crumples: f32,
  crumple_count: f32,
  // Speckles that darken the photo (0 to 1).
  drops: f32,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var image: texture_2d<f32>;
@group(0) @binding(2) var image_sampler: sampler;
// Paper's random noise, 128 pixels square (src/shaders/paper-noise.png).
@group(0) @binding(3) var noise: texture_2d<f32>;
@group(0) @binding(4) var noise_sampler: sampler;

const TWO_PI = 6.28318530718;
const MAX_CRUMPLES = 15;

fn lst(edge0: f32, edge1: f32, x: f32) -> f32 {
  return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

fn hash21(q: vec2f) -> f32 {
  var p = fract(q * vec2f(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

fn hash22(q: vec2f) -> vec2f {
  var p = fract(q * vec2f(0.3183099, 0.3678794)) + 0.1;
  p += dot(p, p.yx + 19.19);
  return fract(vec2f(p.x * p.y, p.x + p.y));
}

fn noise_at(uv: vec2f) -> vec4f {
  return textureSampleLevel(noise, noise_sampler, uv, 0.0);
}

// 1 inside the image, fading out over a pixel at its edges; `fw` is how far
// uv moves across one pixel.
fn uv_frame(uv: vec2f, fw: vec2f) -> f32 {
  let inv_aa = 0.5 / clamp(fw, vec2f(1e-5), vec2f(0.02));
  let lo = clamp(uv * inv_aa + 0.5, vec2f(0.0), vec2f(1.0));
  let hi = clamp((1.0 - uv) * inv_aa + 0.5, vec2f(0.0), vec2f(1.0));
  return lo.x * hi.x * lo.y * hi.y;
}

fn roughness_at(p: vec2f, light_dir: vec2f, seed_shift: vec2f, base_pixel: f32) -> f32 {
  let u = p / vec2f(2.0, 4.0);
  let w = 100.0 * base_pixel;
  let eps = 4.0 * w;

  let size = mix(3.2, 0.8, params.roughness_size);
  let log_lac = log2(2.1);
  let level = -log2(w + 1e-8) / log_lac;
  let base_level = floor(level) - 2.0;
  let fade = fract(level);

  let px = (u.x + vec2f(eps, -eps)) * 0.1;
  let py = u.y * 0.1;

  var sum = vec2f(0.0);
  var norm = 0.0;
  var amp = 0.5;
  var freq = exp2(base_level * log_lac);
  for (var i = 0; i < 4; i++) {
    let abs_idx = base_level + f32(i);
    let qx = size * px * freq;
    let qy = size * py * freq;

    var wi = 1.0;
    if (i == 0) { wi = 1.0 - fade; }
    if (i == 3) { wi = fade; }

    let fx = fract(qx);
    let fy = fract(qy);
    let shift = 0.5 + abs_idx * 0.3 + seed_shift;
    let uv_y = floor(qy) / 50.0 + shift.y;
    let s0a = noise_at(fract(vec2f(floor(qx.x) / 50.0 + shift.x, uv_y))).rg;
    let s1a = noise_at(fract(vec2f(ceil(qx.x) / 50.0 + shift.x, uv_y))).rg;
    let s0b = noise_at(fract(vec2f(floor(qx.y) / 50.0 + shift.x, uv_y))).rg;
    let s1b = noise_at(fract(vec2f(ceil(qx.y) / 50.0 + shift.x, uv_y))).rg;
    let ny0 = mix(vec2f(s0a.r, s0b.r), vec2f(s0a.g, s0b.g), fy);
    let ny1 = mix(vec2f(s1a.r, s1b.r), vec2f(s1a.g, s1b.g), fy);
    let n = mix(ny0, ny1, fx);

    sum += amp * wi * n;
    norm += amp * wi;
    amp *= 0.8;
    freq *= 2.1;
  }

  let r = sum / norm;
  let dx = 0.5 + r.x - r.y;
  let grain = 3.0 * dx * dx - 0.7;

  let row_band = fract(dot(p, light_dir) * 0.05 * size);
  return grain + 0.6 * params.roughness_rows * (row_band - 0.5);
}

fn fiber_at(p: vec2f, seed_shift: vec2f, base_pixel: f32) -> f32 {
  let size = mix(4.0, 1.0, params.fiber_size);
  let w = 50.0 * base_pixel;
  let level = -log2(w + 1e-8);
  let base_level = floor(level) - 3.0;
  let fade = fract(level);

  var grad = vec2f(0.0);
  var scale = 1.0;
  var amp = 1.0;
  var freq = pow(1.7, base_level);
  for (var i = 0; i < 5; i++) {
    let abs_idx = base_level + f32(i);
    var q = size * p * freq;

    let an = abs_idx * 0.8;
    let rc = cos(an);
    let rs = sin(an);
    q = vec2f(rc * q.x - rs * q.y, rs * q.x + rc * q.y);

    var wi = 1.0;
    if (i == 0) { wi = 1.0 - fade; }
    if (i == 4) { wi = fade; }

    let iq = floor(q);
    let fq = fract(q);
    let shift = abs_idx * 0.3;
    let uv = fract(vec4f(iq, iq + 1.0) / 50.0 + 0.5 + shift + seed_shift.xyxy);
    let a = noise_at(uv.xy).b;
    let b = noise_at(uv.zy).b;
    let c = noise_at(uv.xw).b;
    let d = noise_at(uv.zw).b;
    let s = fq * fq * (3.0 - 2.0 * fq);
    let ds = 8.0 * fq * (1.0 - fq);
    let dx = ds.x * mix(b - a, d - c, s.y);
    let dy = ds.y * mix(c - a, d - b, s.x);
    grad += wi * amp * scale * vec2f(rc * dx + rs * dy, -rs * dx + rc * dy);
    scale *= 1.7;
    amp *= 0.5;
    freq *= 1.7;
  }

  return clamp(0.333 * length(grad), 0.0, 1.0);
}

fn smooth_noise(p: vec2f) -> vec2f {
  let t = p * 50.0 - 0.5;
  let i = floor(t);
  var f = fract(t);
  f = f * f * (3.0 - 2.0 * f);
  return noise_at(fract((i + f + 0.5) / vec2f(50.0))).rg;
}

fn drops_at(uv: vec2f, seed_shift: vec2f) -> f32 {
  let i_uv = floor(uv);
  let f_uv = fract(uv);
  var min_dist = 1.0;
  for (var y = -1; y < 2; y++) {
    for (var x = -1; x < 2; x++) {
      let neighbor = vec2f(f32(y), f32(x));
      let offset = hash22(i_uv + neighbor + 50.0 * seed_shift);
      let pos = neighbor + offset - f_uv;
      min_dist *= min(1.0, dot(pos, pos));
    }
  }
  return 0.5 * lst(0.09, 0.08, sqrt(sqrt(min_dist)));
}

fn cell_tilt(idx: f32, radius: f32) -> vec2f {
  let rand = hash22(vec2f(idx + 31.0, idx * params.seed + 17.0));
  let an = rand.x * TWO_PI;
  return vec2f(cos(an), sin(an)) * mix(0.3, 1.7, rand.y * rand.y) * mix(0.7, 1.0, radius);
}

// One layer of wrinkles: the slope of the facet under uv (xy) and how deep
// into it uv is (z).
fn crumple_detail(uv: vec2f, freq: f32, shift: f32, base_pixel: f32) -> vec3f {
  let v = uv * freq;
  let pixel = 0.9 * freq * base_pixel;
  let base = floor(v);
  var n1 = 9.0;
  var n2 = 9.0;
  var s1 = vec2f(0.0);
  var s2 = vec2f(0.0);
  var q1 = vec2f(0.0);
  var q2 = vec2f(0.0);

  for (var y = -1; y <= 1; y++) {
    for (var x = -1; x <= 1; x++) {
      let cell = base + vec2f(f32(x), f32(y));
      let q = hash22(vec2f(cell.y * 1.9 + 3.1 + shift, cell.x * 1.3 + 0.11 * params.seed));
      if (q.y > 0.8) { continue; }

      let r = hash22(vec2f(cell.x + 0.37 * params.seed + shift + 11.1, cell.y - 0.21 * params.seed + 5.7));
      let s = cell + 0.06 + 0.88 * r;

      let d = v - s;
      let dsq = dot(d, d);
      if (dsq < n1) {
        n2 = n1;
        s2 = s1;
        q2 = q1;
        n1 = dsq;
        s1 = s;
        q1 = q;
      } else if (dsq < n2) {
        n2 = dsq;
        s2 = s;
        q2 = q;
      }
    }
  }

  if (n1 > 8.0) { return vec3f(0.0); }

  let an1 = q1.x * TWO_PI;
  let mag1 = q1.y / 0.8;
  let t1 = vec2f(cos(an1), sin(an1)) * mix(0.3, 1.7, mag1 * mag1);
  let an2 = q2.x * TWO_PI;
  let mag2 = q2.y / 0.8;
  let t2 = vec2f(cos(an2), sin(an2)) * mix(0.3, 1.7, mag2 * mag2);

  let span = s1 - s2;
  let span_len = max(length(span), 1e-4);
  let to_edge = (n2 - n1) / (2.0 * span_len);

  let pair = hash21(s1 + s2 + 1.7 * abs(s1 - s2));
  let pair_soft = 0.05 + 0.1 * step(pair, 0.4);
  var b = clamp(to_edge / max(1.5 * pixel, 0.5 * pair_soft), 0.0, 1.0);
  b = b * b * (3.0 - 2.0 * b);
  let d1 = max(sqrt(n1), 1e-4);
  let depth = 0.2 * d1;
  let shoulder_amt = max(0.0, 1.0 - to_edge / 0.42) * b;
  var shoulder = vec2f(0.0);
  if (shoulder_amt > 0.0) {
    let d2 = max(sqrt(n2), 1e-4);
    shoulder = shoulder_amt * ((v - s2) / d2 - (v - s1) / d1);
  }

  let mid = 0.5 * (t1 + t2);
  return vec3f(mid + (t1 - mid) * b + 0.9 * shoulder, depth);
}

fn crumples_at(uv: vec2f) -> vec4f {
  let count = max(2.0, floor(params.crumple_count + 0.5));
  var near = 60000.0;
  var near_b = 60000.0;
  var idx = 0.0;
  var rad = 0.0;
  var near_p = vec2f(0.0);
  var near_pb = vec2f(0.0);
  var seeds: array<vec4f, MAX_CRUMPLES>;
  for (var i = 0; i < MAX_CRUMPLES; i++) {
    if (f32(i) >= count) { break; }
    let rand = hash22(vec2f(f32(i), f32(i) * params.seed));
    let an = rand.x * TWO_PI;
    let p = vec2f(cos(an), sin(an)) * rand.y;
    seeds[i] = vec4f(p, rand);

    let d = uv - p;
    let dsq = dot(d, d);
    if (dsq < near) {
      near_b = near;
      near_pb = near_p;
      near = dsq;
      idx = f32(i);
      rad = rand.y;
      near_p = p;
    } else if (dsq < near_b) {
      near_b = dsq;
      near_pb = p;
    }
  }
  let l = sqrt(near);
  let lb = sqrt(near_b);
  let dir = (uv - near_p) / max(l, 1e-4);
  let edge = lst(0.0, 0.5, lb - l);

  let shoulder_limit = l + 0.5;

  var tilt = cell_tilt(idx, rad);
  var tilt_sum = 1.0;
  var wide = vec2f(0.0);
  var wide_sum = 0.0;
  var to_edge = 9.0;
  var edge_soft = 0.0;

  for (var i = 0; i < MAX_CRUMPLES; i++) {
    if (f32(i) >= count) { break; }
    if (f32(i) == idx) { continue; }
    let seed = seeds[i];
    let p = seed.xy;
    let rand = seed.zw;

    let d = uv - p;
    let dsq = dot(d, d);

    if (dsq < shoulder_limit * shoulder_limit) {
      let di = sqrt(dsq);
      let shoulder = lst(0.5, 0.0, di - l);
      wide += shoulder * (d / max(di, 1e-4) - dir);
      wide_sum += shoulder;
    }

    let pair_soft = 0.01 + 0.05 * step(0.2, rand.x) + 0.3 * rand.y;
    let to_bisector = (dsq - near) / (0.2 * max(length(p - near_p), 1e-4));
    if (to_bisector < to_edge) {
      to_edge = to_bisector;
      edge_soft = pair_soft;
    }

    var w = 1.0 - to_bisector / pair_soft;
    if (w > 0.0) {
      w *= w;
      tilt += w * cell_tilt(f32(i), rand.y);
      tilt_sum += w;
    }
  }

  let blend = clamp(to_edge / edge_soft, 0.0, 1.0);
  let sharp = (1.0 - edge) * ((uv - near_pb) / max(lb, 1e-4) - dir);
  let rounding = mix(sharp, wide / max(wide_sum, 1.0), min(2.0 * edge_soft, 1.0));
  let radial = l / max(l + to_edge, 1e-4);

  return vec4f(tilt / tilt_sum + rounding * blend * radial, 0.2 * l, edge);
}

struct Folds {
  slope: vec2f,
  dark: vec2f,
  lift: vec2f,
}

fn folds_at(coord: vec2f, offset: vec2f, count: vec2f, n: vec2f, base_fwidth: vec2f) -> Folds {
  let g = coord * count + 0.5 * offset + n;
  let dx = fract(g) - 0.5;
  let adx = abs(dx);
  let t = clamp(adx / 0.3, vec2f(0.0), vec2f(1.0));
  let dark = t * t * (3.0 - 2.0 * t);
  var lift = 1.0 - t;
  lift *= lift;

  let crease = clamp(dx / max(count * base_fwidth, vec2f(1e-5)), vec2f(-1.0), vec2f(1.0));
  var slope = crease * (1.0 - dark);

  let line_width = 0.02 * count * mix(vec2f(2.5), vec2f(0.8), dark.yx) + 0.1 * n;
  slope -= 1.0 - smoothstep(vec2f(0.0), line_width, adx);
  return Folds(slope, dark, lift);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  var pattern_uv = (uv - 0.5) * vec2f(params.aspect, 1.0);
  let base_pixel = max(length(dpdx(pattern_uv)), length(dpdy(pattern_uv)));
  let base_fwidth = fwidth(pattern_uv);
  let uv_fwidth = fwidth(uv);

  var pattern = 0.0;
  var crumple_depth = 0.0;
  var wrinkle_depth = 0.0;
  var fold_depth = 0.0;
  var roughness = 0.0;
  var fiber = 0.0;
  var drops = 0.0;

  let grazing = 0.7;
  let light_rad = radians(params.angle);
  let light_dir = vec2f(sin(light_rad), -cos(light_rad));
  let fold_angle_in_sector = params.angle - 90.0 * floor(params.angle / 90.0);
  let fold_light_rad = radians(params.angle - fold_angle_in_sector + mix(12.0, 78.0, fold_angle_in_sector / 90.0));
  let fold_light_dir = vec2f(sin(fold_light_rad), -cos(fold_light_rad));
  var relief = vec2f(0.0);
  var fold_slope = vec2f(0.0);
  var relief_amount = 0.0;
  var fold_ink = 1.0;
  var crumple_flow = vec2f(0.0);

  var warp_noise = vec2f(0.0);
  if (params.crumples > 0.0 || params.folds > 0.0 || params.wrinkles > 0.0) {
    warp_noise = smooth_noise(pattern_uv * 0.1 + 0.2 + 0.6 * fract(0.017 * params.seed)) - 0.5;
  }
  let crumples_uv = pattern_uv * 0.9 + 0.012 * warp_noise;

  if (params.crumples > 0.0) {
    let crumples = crumples_at(crumples_uv);

    var tilt = 0.5 * params.crumples * crumples.xy;
    tilt -= 0.1 * max(dot(tilt, light_dir), 0.0) * light_dir;
    relief += tilt;
    relief_amount += 0.6 * params.crumples;
    crumple_flow = crumples.w * tilt;

    crumple_depth = clamp(5.0 * crumples.z, 0.0, 1.0);
  }

  if (params.wrinkles > 0.0) {
    var freq = mix(10.0, 1.0, params.wrinkle_size);
    var amp = 0.2;
    var grad = vec2f(0.0);
    var depth = 0.0;
    var depth_sum = 0.0;
    for (var i = 0; i < 3; i++) {
      let layer = crumple_detail(crumples_uv, freq, 31.0 * f32(i), base_pixel);
      grad += amp * layer.xy;
      depth += amp * layer.z;
      depth_sum += amp;
      amp *= 0.5 + 0.2 * grad.x;
      freq *= 2.1;
    }

    var tilt = 1.5 * params.wrinkles * grad;
    tilt -= 0.65 * max(dot(tilt, light_dir), 0.0) * light_dir;
    relief += tilt;
    relief_amount += 0.6 * params.wrinkles;

    wrinkle_depth = clamp(5.0 * depth / max(depth_sum, 1e-4), 0.0, 1.0);
  }

  if (params.folds > 0.0) {
    let offset = vec2f(1.0 - 2.0 * params.fold_offset_x, 1.0 - 2.0 * params.fold_offset_y);
    let count = vec2f(mix(3.0, 0.5, params.fold_size_x), mix(3.0, 0.5, params.fold_size_y));
    let n = 0.005 * warp_noise * count;
    let f = folds_at(pattern_uv + 0.03 * crumple_flow, offset, count, n, base_fwidth);

    fold_slope = params.folds * f.slope;
    relief_amount += params.folds;
    let ink = mix(vec2f(0.96), vec2f(1.0), f.dark);
    let flatness = f.dark.x * f.dark.y;
    fold_ink *= mix(1.0, ink.x * ink.y * mix(0.5, 0.3, flatness), params.folds);

    fold_depth = params.folds * (f.lift.y * fold_light_dir.y - f.lift.x * fold_light_dir.x);
  }

  let unlit = cos(grazing);
  if (relief_amount > 0.0) {
    let falloff = clamp(0.5 + dot(uv - 0.5, light_dir), 0.0, 1.0);
    let power = mix(0.5, 1.0, falloff);
    let slope = clamp(dot(relief, light_dir) + dot(fold_slope, fold_light_dir), -1.2, 1.2);
    let lit = max(cos(slope + grazing), 0.0);
    pattern += (clamp(relief_amount, 0.0, 1.0) * unlit + (lit - unlit)) * fold_ink * power;
  }

  pattern_uv += 0.04 * crumple_flow;

  let seed_shift = floor(fract(params.seed * vec2f(0.7548776662, 0.5698402909)) * 50.0) / 50.0;

  if (params.roughness > 0.0) {
    roughness = params.roughness * roughness_at(1000.0 * pattern_uv, light_dir, seed_shift, base_pixel);
    pattern += roughness;
  }
  if (params.fiber > 0.0) {
    fiber = params.fiber * fiber_at(50.0 * pattern_uv, seed_shift, base_pixel);
    pattern += fiber;
  }
  if (params.drops > 0.0) {
    drops = params.drops * drops_at(pattern_uv * 10.0, seed_shift);
  }

  pattern = clamp(pattern, 0.0, 1.0);

  let back = params.back.rgb * params.back.a;
  let paper = params.paper.rgb * params.paper.a;
  let shadow = params.shadow.rgb * params.shadow.a;

  // The photo bends with the paper: pushed in and out by its relief, and
  // rippled a little by its grain.
  let centered = uv - 0.5;
  let edge_dist = 2.0 * max(abs(centered.x), abs(centered.y));
  let wrinkle_distortion = mix(0.38, 0.0175, smoothstep(0.0, 1.0, edge_dist));
  let scale_distortion = 0.15 * params.crumples * (crumple_depth - 0.5) + wrinkle_distortion * params.wrinkles * (wrinkle_depth - 0.5) + 0.05 * fold_depth;
  let linear_distortion = 0.002 * light_dir * drops;
  let radial_distortion = 0.02 * (roughness + fiber);
  var bent = centered * (1.0 - params.distortion * scale_distortion);
  bent -= params.distortion * linear_distortion;
  let image_uv = 0.5 + bent * (1.0 - abs(params.distortion) * radial_distortion * dot(bent, bent));

  var colour = shadow * pattern;
  var alpha = params.shadow.a * pattern;
  colour += paper * (1.0 - alpha);
  alpha += params.paper.a * (1.0 - alpha);

  // The photo soaks into the paper: its shading shows through, and the
  // most coloured and darkest parts fade a little where the ink runs thin.
  let tex = textureSampleLevel(image, image_sampler, image_uv, 0.0);
  let frame = uv_frame(image_uv, uv_fwidth) * tex.a;
  let max_c = max(max(tex.r, tex.g), tex.b);
  let min_c = min(min(tex.r, tex.g), tex.b);
  let sat = select(0.0, (max_c - min_c) / max_c, max_c > 0.0);
  let mid_c = tex.r + tex.g + tex.b - max_c - min_c;
  let secondaryness = select(0.0, (mid_c - min_c) / (max_c - min_c), max_c > min_c);
  let sat_dampen = sat * (1.0 - 0.5 * secondaryness);
  let dark_dampen = 1.0 - dot(vec3f(0.2126, 0.7152, 0.0722), tex.rgb);
  let dampen = mix(0.0, 0.7, params.blending) * max(sat_dampen, dark_dampen);

  let sheet = vec3f(1.0) - alpha + colour;
  var pic = tex.rgb * sheet * params.blending + tex.rgb * (1.0 - params.blending);
  pic = mix(pic, vec3f(1.0), 0.6 * pow(dampen, 2.0 + 3.0 * pattern));

  colour = mix(colour, pic, frame);
  alpha = frame + alpha * (1.0 - frame);

  colour *= mix(vec3f(1.0), 0.5 * params.shadow.rgb, drops * params.shadow.a);

  colour += back * (1.0 - alpha);
  alpha += params.back.a * (1.0 - alpha);

  return vec4f(colour, alpha);
}
