// A value as text. For numbers, `spec` is ".2f" for two decimals, ".1%" for
// a percentage with one, or empty for three significant figures. Negative
// numbers get a true minus sign.
export function format(v: unknown, spec = ""): string {
  if (typeof v !== "number") return v == null ? "" : String(v);
  const m = spec.match(/^\.(\d+)([f%])$/);
  const text = m
    ? m[2] === "%" ? (v * 100).toFixed(+m[1]) + "%" : v.toFixed(+m[1])
    : String(Number(v.toPrecision(3)));
  return text.replace(/^-/, "−");
}
