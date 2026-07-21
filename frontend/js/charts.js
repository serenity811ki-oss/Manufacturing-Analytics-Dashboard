/* ==========================================================================
   Chart.js theming + factory helpers
   ========================================================================== */
const ChartTheme = {
  teal: "#12959F",
  amber: "#D98E1F",
  red: "#C4453D",
  green: "#3E9C5A",
  slate: "#607488",
  navy: "#16283B",
  grid: "#DCE3E9",
  palette: ["#12959F", "#D98E1F", "#3E9C5A", "#C4453D", "#607488", "#8CA0B3", "#2C3E50", "#0E7C86"],
};

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.font.size = 11.5;
Chart.defaults.color = "#607488";
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;

const _chartRegistry = {};

function destroyChart(canvasId) {
  if (_chartRegistry[canvasId]) {
    _chartRegistry[canvasId].destroy();
    delete _chartRegistry[canvasId];
  }
}

function baseGridOptions() {
  return {
    scales: {
      x: { grid: { display: false }, border: { color: ChartTheme.grid } },
      y: { grid: { color: ChartTheme.grid }, border: { display: false }, beginAtZero: true },
    },
    plugins: { legend: { display: true, position: "bottom" } },
    responsive: true,
    maintainAspectRatio: false,
  };
}

function renderLineChart(canvasId, labels, datasets, opts = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  _chartRegistry[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        tension: 0.35, fill: opts.fill || false, pointRadius: 2, pointHoverRadius: 4,
        borderWidth: 2, borderColor: ChartTheme.palette[i % ChartTheme.palette.length],
        backgroundColor: ChartTheme.palette[i % ChartTheme.palette.length] + "22",
        ...d,
      })),
    },
    options: { ...baseGridOptions(), ...opts },
  });
}

function renderBarChart(canvasId, labels, datasets, opts = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  _chartRegistry[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d, i) => ({
        borderRadius: 4, maxBarThickness: 36,
        backgroundColor: ChartTheme.palette[i % ChartTheme.palette.length],
        ...d,
      })),
    },
    options: { ...baseGridOptions(), ...opts },
  });
}

function renderPieChart(canvasId, labels, data, opts = {}) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId).getContext("2d");
  _chartRegistry[canvasId] = new Chart(ctx, {
    type: opts.donut === false ? "pie" : "doughnut",
    data: { labels, datasets: [{ data, backgroundColor: ChartTheme.palette, borderWidth: 2, borderColor: "#fff" }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "right" } }, cutout: "62%" },
  });
}

function renderAreaChart(canvasId, labels, datasets, opts = {}) {
  renderLineChart(canvasId, labels, datasets.map(d => ({ fill: "origin", ...d })), opts);
}

function renderHeatmap(containerId, rows, cols, matrix, opts = {}) {
  // Lightweight DOM/CSS heatmap (no extra chart.js plugin dependency).
  const el = document.getElementById(containerId);
  const max = Math.max(1, ...matrix.flat());
  let html = `<div class="heatmap-grid" style="display:grid;grid-template-columns:90px repeat(${cols.length},1fr);gap:3px;font-size:11px;">`;
  html += `<div></div>`;
  cols.forEach(c => html += `<div style="text-align:center;color:#607488;font-weight:600;">${c}</div>`);
  rows.forEach((r, ri) => {
    html += `<div style="color:#607488;font-weight:600;display:flex;align-items:center;">${r}</div>`;
    cols.forEach((c, ci) => {
      const v = matrix[ri][ci] || 0;
      const intensity = v / max;
      const bg = `rgba(18,149,159,${0.08 + intensity * 0.82})`;
      const textColor = intensity > 0.55 ? "#fff" : "#2C3E50";
      html += `<div title="${r} / ${c}: ${v}" style="background:${bg};color:${textColor};border-radius:4px;padding:8px 4px;text-align:center;font-family:'IBM Plex Mono',monospace;">${v}</div>`;
    });
  });
  html += `</div>`;
  el.innerHTML = html;
}
