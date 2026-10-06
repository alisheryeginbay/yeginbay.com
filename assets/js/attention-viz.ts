type Matrix = number[][];

interface Field {
  label: string;
  key: string;
}

// Head entries are keyed like "L0H3"; each maps field keys to square matrices.
interface AttnData {
  tokens?: string[];
  [key: string]: Record<string, Matrix> | string[] | undefined;
}

const HEAD_RE = /^L(\d+)H(\d+)$/;

const cache: Record<string, Promise<AttnData>> = {};

function loadData(src: string): Promise<AttnData> {
  cache[src] ??= fetch(src).then((res) => res.json());
  return cache[src];
}

function parseFields(raw: string): Field[] {
  return raw.split(",").map((pair) => {
    const parts = pair.split(":");
    const label = parts[0].trim();
    const key = (parts[1] || parts[0]).trim();
    return { label, key };
  });
}

function headKeys(data: AttnData): string[] {
  return Object.keys(data)
    .filter((k) => HEAD_RE.test(k))
    .sort((a, b) => {
      const [, la, ha] = a.match(HEAD_RE)!.map(Number);
      const [, lb, hb] = b.match(HEAD_RE)!.map(Number);
      return la - lb || ha - hb;
    });
}

function color(value: number, maxAbs: number): string {
  const t = maxAbs > 0 ? Math.max(-1, Math.min(1, value / maxAbs)) : 0;
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#fdfdfc";
  const mag = Math.abs(t);
  const to = t >= 0 ? "215, 69, 69" : "59, 111, 214";
  return "color-mix(in srgb, rgb(" + to + ") " + Math.round(mag * 85) + "%, " + bg + ")";
}

function render(root: HTMLElement, data: AttnData) {
  const fields = parseFields(root.dataset.fields!);
  const rowLabel = root.dataset.rowLabel || "row";
  const colLabel = root.dataset.colLabel || "col";
  const heads = headKeys(data);
  const tokens = data.tokens || [];

  const layerSel = root.querySelector<HTMLSelectElement>(".attn-viz-layer")!;
  const headSel = root.querySelector<HTMLSelectElement>(".attn-viz-head")!;
  const fieldSel = root.querySelector<HTMLSelectElement>(".attn-viz-field")!;
  const grid = root.querySelector<HTMLElement>(".attn-viz-grid")!;
  const caption = root.querySelector<HTMLElement>(".attn-viz-caption")!;

  const layers: number[] = [];
  heads.forEach((k) => {
    const l = +k.match(HEAD_RE)![1];
    if (!layers.includes(l)) layers.push(l);
  });

  layers.forEach((l) => {
    const opt = document.createElement("option");
    opt.value = String(l);
    opt.textContent = "Layer " + l;
    layerSel.appendChild(opt);
  });

  if (fields.length > 1) {
    fields.forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.key;
      opt.textContent = f.label;
      fieldSel.appendChild(opt);
    });
  } else {
    fieldSel.hidden = true;
  }

  function headsForLayer(l: string): string[] {
    return heads.filter((k) => k.startsWith("L" + l + "H"));
  }

  function populateHeads() {
    headSel.innerHTML = "";
    headsForLayer(layerSel.value).forEach((k) => {
      const h = k.match(HEAD_RE)![2];
      const opt = document.createElement("option");
      opt.value = k;
      opt.textContent = "Head " + h;
      headSel.appendChild(opt);
    });
  }

  function tokenLabel(i: number): string {
    return (tokens[i] || i).toString();
  }

  function draw() {
    const headKey = headSel.value;
    const fieldKey = fieldSel.hidden ? fields[0].key : fieldSel.value;
    const head = data[headKey] as Record<string, Matrix> | undefined;
    const matrix = head && head[fieldKey];
    if (!matrix) return;

    let maxAbs = 0;
    matrix.forEach((row) => {
      row.forEach((v) => { maxAbs = Math.max(maxAbs, Math.abs(v)); });
    });

    const n = matrix.length;
    let html = '<table class="attn-viz-table"><thead><tr><th></th>';
    for (let c = 0; c < n; c++) {
      html += '<th title="' + colLabel + ": " + tokenLabel(c) + '">' + tokenLabel(c).trim() + "</th>";
    }
    html += "</tr></thead><tbody>";
    for (let r = 0; r < n; r++) {
      html += '<tr><th title="' + rowLabel + ": " + tokenLabel(r) + '">' + tokenLabel(r).trim() + "</th>";
      for (let c = 0; c < n; c++) {
        const v = matrix[r][c];
        html += '<td style="background:' + color(v, maxAbs) + '" title="' + v.toFixed(3) + '"></td>';
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    grid.innerHTML = html;
    caption.textContent = headKey + (fields.length > 1 ? " · " + fields.find((f) => f.key === fieldKey)!.label : "");
  }

  layerSel.addEventListener("change", () => { populateHeads(); draw(); });
  headSel.addEventListener("change", draw);
  fieldSel.addEventListener("change", draw);

  populateHeads();
  draw();
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll<HTMLElement>(".attn-viz").forEach((root) => {
    loadData(root.dataset.src!).then((data) => render(root, data));
  });
});
