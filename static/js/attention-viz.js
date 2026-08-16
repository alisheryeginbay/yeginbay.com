(function () {
  var cache = {};

  function loadData(src) {
    if (!cache[src]) {
      cache[src] = fetch(src).then(function (res) { return res.json(); });
    }
    return cache[src];
  }

  function parseFields(raw) {
    return raw.split(",").map(function (pair) {
      var parts = pair.split(":");
      var label = parts[0].trim();
      var key = (parts[1] || parts[0]).trim();
      return { label: label, key: key };
    });
  }

  function headKeys(data) {
    return Object.keys(data)
      .filter(function (k) { return /^L\d+H\d+$/.test(k); })
      .sort(function (a, b) {
        var pa = a.match(/^L(\d+)H(\d+)$/), pb = b.match(/^L(\d+)H(\d+)$/);
        var la = +pa[1], ha = +pa[2], lb = +pb[1], hb = +pb[2];
        return la - lb || ha - hb;
      });
  }

  function color(value, maxAbs) {
    var t = maxAbs > 0 ? Math.max(-1, Math.min(1, value / maxAbs)) : 0;
    var bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#fdfdfc";
    var from = bg, to;
    var mag = Math.abs(t);
    if (t >= 0) {
      to = "215, 69, 69";
    } else {
      to = "59, 111, 214";
    }
    return "color-mix(in srgb, rgb(" + to + ") " + Math.round(mag * 85) + "%, " + from + ")";
  }

  function render(root, data) {
    var src = root.dataset.src;
    var fields = parseFields(root.dataset.fields);
    var rowLabel = root.dataset.rowLabel || "row";
    var colLabel = root.dataset.colLabel || "col";
    var heads = headKeys(data);
    var tokens = data.tokens || [];

    var layerSel = root.querySelector(".attn-viz-layer");
    var headSel = root.querySelector(".attn-viz-head");
    var fieldSel = root.querySelector(".attn-viz-field");
    var grid = root.querySelector(".attn-viz-grid");
    var caption = root.querySelector(".attn-viz-caption");

    var layers = [];
    heads.forEach(function (k) {
      var l = +k.match(/^L(\d+)H\d+$/)[1];
      if (layers.indexOf(l) === -1) layers.push(l);
    });

    layers.forEach(function (l) {
      var opt = document.createElement("option");
      opt.value = l;
      opt.textContent = "Layer " + l;
      layerSel.appendChild(opt);
    });

    if (fields.length > 1) {
      fields.forEach(function (f) {
        var opt = document.createElement("option");
        opt.value = f.key;
        opt.textContent = f.label;
        fieldSel.appendChild(opt);
      });
    } else {
      fieldSel.hidden = true;
    }

    function headsForLayer(l) {
      return heads.filter(function (k) { return k.indexOf("L" + l + "H") === 0; });
    }

    function populateHeads() {
      var l = layerSel.value;
      headSel.innerHTML = "";
      headsForLayer(l).forEach(function (k) {
        var h = k.match(/^L\d+H(\d+)$/)[1];
        var opt = document.createElement("option");
        opt.value = k;
        opt.textContent = "Head " + h;
        headSel.appendChild(opt);
      });
    }

    function draw() {
      var headKey = headSel.value;
      var fieldKey = fieldSel.hidden ? fields[0].key : fieldSel.value;
      var matrix = data[headKey] && data[headKey][fieldKey];
      if (!matrix) return;

      var maxAbs = 0;
      matrix.forEach(function (row) {
        row.forEach(function (v) { maxAbs = Math.max(maxAbs, Math.abs(v)); });
      });

      var n = matrix.length;
      var html = '<table class="attn-viz-table"><thead><tr><th></th>';
      for (var c = 0; c < n; c++) {
        html += '<th title="' + colLabel + ': ' + (tokens[c] || c) + '">' + (tokens[c] || c).toString().trim() + "</th>";
      }
      html += "</tr></thead><tbody>";
      for (var r = 0; r < n; r++) {
        html += '<tr><th title="' + rowLabel + ': ' + (tokens[r] || r) + '">' + (tokens[r] || r).toString().trim() + "</th>";
        for (var c2 = 0; c2 < n; c2++) {
          var v = matrix[r][c2];
          html += '<td style="background:' + color(v, maxAbs) + '" title="' + v.toFixed(3) + '"></td>';
        }
        html += "</tr>";
      }
      html += "</tbody></table>";
      grid.innerHTML = html;
      caption.textContent = headKey + (fields.length > 1 ? " · " + fields.find(function (f) { return f.key === fieldKey; }).label : "");
    }

    layerSel.addEventListener("change", function () { populateHeads(); draw(); });
    headSel.addEventListener("change", draw);
    fieldSel.addEventListener("change", draw);

    populateHeads();
    draw();
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll(".attn-viz").forEach(function (root) {
      loadData(root.dataset.src).then(function (data) { render(root, data); });
    });
  });
})();
