// What a <Var> in the prose holds before the reader touches it, worked out
// from its props: shared by components/Var.astro, which shows it to readers
// without JavaScript, and remark-viz.ts, which gives <Show>s of it the same
// text.

export type VarProps = {
  name: string;
  value?: unknown;
  min?: unknown;
  max?: unknown;
  format?: string;
  options?: string;
  labels?: string;
  [prop: string]: unknown;
};

export type VarState = {
  kind: "number" | "choice" | "toggle";
  value: string | number | boolean;
  text: string;
};

export function varState(props: VarProps): VarState {
  const { name, value, labels, format } = props;
  if (!name) throw new Error("Var: needs a name");
  if (labels !== undefined) {
    const on = String(value) === "true";
    const [onLabel, offLabel] = labels.split(",").map((l) => l.trim());
    return { kind: "toggle", value: on, text: (on ? onLabel : offLabel) ?? "" };
  }
  if (props.min !== undefined || props.max !== undefined) {
    const n = Number(value);
    const digits = format?.match(/^\.(\d+)f$/)?.[1];
    return { kind: "number", value: n, text: digits === undefined ? String(n) : n.toFixed(Number(digits)) };
  }
  if (props.options === undefined) throw new Error(`Var: "${name}" needs options, min and max, or labels`);
  return { kind: "choice", value: String(value), text: String(value) };
}

// The shared value a prop like `head="$qk_head"` is bound to.
export function boundName(v: unknown): string | undefined {
  return typeof v === "string" && v.startsWith("$") ? v.slice(1) : undefined;
}
