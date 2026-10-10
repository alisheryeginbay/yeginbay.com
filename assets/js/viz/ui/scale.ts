// Colour scales for figures. Colours are mixed in CSS from the --viz-*
// tokens in style.css, so figures follow the site's colours.

// A value in [-max, max] as a colour running from --viz-neg through the
// page background to --viz-pos.
export function diverging(max: number): (v: number) => string {
  return (v) => {
    const t = max > 0 ? Math.max(-1, Math.min(1, v / max)) : 0;
    const to = t >= 0 ? "var(--viz-pos)" : "var(--viz-neg)";
    return `color-mix(in oklab, ${to} ${Math.round(Math.abs(t) * 85)}%, var(--bg))`;
  };
}

export function maxAbs(matrix: number[][]): number {
  let m = 0;
  for (const row of matrix) for (const v of row) m = Math.max(m, Math.abs(v));
  return m;
}
