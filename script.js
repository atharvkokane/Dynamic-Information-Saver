const STORAGE_KEY = "savedTable";

const elements = {
  rows: document.getElementById("rows"),
  columns: document.getElementById("columns"),
  search: document.getElementById("search"),
  generateBtn: document.getElementById("generateBtn"),
  resetBtn: document.getElementById("resetBtn"),
  saveBtn: document.getElementById("saveBtn"),
  saveDbBtn: document.getElementById("saveDbBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  saveGraphBtn: document.getElementById("saveGraphBtn"),
  reportBtn: document.getElementById("reportBtn"),
  addRowBtn: document.getElementById("addRowBtn"),
  addColumnBtn: document.getElementById("addColumnBtn"),
  deleteRowBtn: document.getElementById("deleteRowBtn"),
  deleteColumnBtn: document.getElementById("deleteColumnBtn"),
  tableContainer: document.getElementById("table-container"),
  statusText: document.getElementById("statusText"),
  reportDrawer: document.getElementById("reportDrawer"),
  closeReportBtn: document.getElementById("closeReportBtn"),
  reportStatus: document.getElementById("reportStatus"),
  reportMetrics: document.getElementById("reportMetrics"),
  focusCard: document.querySelector(".report-focus-card"),
  comparisonCard: document.querySelector(".report-comparison-card"),
  insightsCard: document.querySelector(".report-insights-card"),
  previewCard: document.querySelector(".report-preview-card"),
  focusKicker: document.getElementById("focusKicker"),
  focusTitle: document.getElementById("focusTitle"),
  focusMeta: document.getElementById("focusMeta"),
  focusStats: document.getElementById("focusStats"),
  focusChips: document.getElementById("focusChips"),
  focusChart: document.getElementById("focusChart"),
  comparisonChart: document.getElementById("comparisonChart"),
  reportInsights: document.getElementById("reportInsights"),
  reportPreview: document.getElementById("reportPreview"),
};

let tableState = loadState();
let reportVisible = false;
let graphCharts = {
  records: [],
  focus: null,
  comparison: null,
};
let focusedRecordIndex = null;

const GRAPH_PALETTE = [
  { base: "#0f766e", glow: "rgba(15, 118, 110, 0.16)", deep: "#0b4f4a" },
  { base: "#2563eb", glow: "rgba(37, 99, 235, 0.16)", deep: "#1e40af" },
  { base: "#7c3aed", glow: "rgba(124, 58, 237, 0.16)", deep: "#5b21b6" },
  { base: "#f97316", glow: "rgba(249, 115, 22, 0.16)", deep: "#c2410c" },
  { base: "#ef4444", glow: "rgba(239, 68, 68, 0.16)", deep: "#b91c1c" },
  { base: "#14b8a6", glow: "rgba(20, 184, 166, 0.16)", deep: "#0f766e" },
];

const GRAPH_BOARD_SIZE = {
  width: 1600,
  height: 1000,
};

const GRAPH_BOARD_COLORS = {
  ink: "#1f2937",
  muted: "#64748b",
  border: "#d5dee9",
  surface: "#ffffff",
  pale: "#f5fbfa",
  teal: "#14b8a6",
  tealDark: "#0f766e",
  tealLight: "#7dd3fc",
  mint: "#bff7e6",
  mintSoft: "#dffcf3",
  navy: "#334155",
  blue: "#38bdf8",
  gray: "#e5e7eb",
  graySoft: "#f3f4f6",
  amber: "#f59e0b",
  coral: "#fb7185",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function shortenText(value, maxLength = 18) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function computeGraphModel(report, records) {
  const rowCompletionSeries = records.map((record) => Math.round(record.completion || 0));
  const scoreSeries = records.map((record) => record.score || 0);
  const filledSeries = records.map((record) => record.filledFields || 0);
  const columnFillRates = report.columnProfiles.map((profile) => {
    if (!report.rows) {
      return 0;
    }

    return Math.round((profile.nonEmptyCount / report.rows) * 100);
  });

  const topColumns = [...report.columnProfiles]
    .map((profile, index) => ({
      label: profile.label || `Field ${index + 1}`,
      value: columnFillRates[index],
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 4);

  return {
    rowCompletionSeries,
    scoreSeries,
    filledSeries,
    columnFillRates,
    topColumns,
  };
}

function setupBoardCanvas(canvas) {
  if (!canvas) {
    return null;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = GRAPH_BOARD_SIZE.width * dpr;
  canvas.height = GRAPH_BOARD_SIZE.height * dpr;
  canvas.style.width = "100%";
  canvas.style.height = "auto";
  canvas.style.aspectRatio = `${GRAPH_BOARD_SIZE.width} / ${GRAPH_BOARD_SIZE.height}`;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function ensureGraphBoardCanvas() {
  let canvas = elements.reportPreview.querySelector("canvas");

  if (!canvas) {
    elements.reportPreview.innerHTML = '<div class="graph-board-shell"><canvas id="graphBoardCanvas"></canvas></div>';
    canvas = elements.reportPreview.querySelector("canvas");
  }

  return canvas;
}

function roundRect(context, x, y, width, height, radius, fillStyle, strokeStyle = null, shadow = null) {
  context.save();
  if (shadow) {
    context.shadowColor = shadow.color;
    context.shadowBlur = shadow.blur;
    context.shadowOffsetY = shadow.offsetY || 0;
  }

  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();

  if (fillStyle) {
    context.fillStyle = fillStyle;
    context.fill();
  }

  if (strokeStyle) {
    context.strokeStyle = strokeStyle;
    context.lineWidth = 1;
    context.stroke();
  }

  context.restore();
}

function drawText(context, text, x, y, options = {}) {
  const {
    font = "16px Segoe UI",
    color = GRAPH_BOARD_COLORS.ink,
    align = "left",
    baseline = "alphabetic",
    maxWidth = null,
  } = options;

  context.save();
  context.font = font;
  context.fillStyle = color;
  context.textAlign = align;
  context.textBaseline = baseline;
  if (maxWidth) {
    context.fillText(String(text), x, y, maxWidth);
  } else {
    context.fillText(String(text), x, y);
  }
  context.restore();
}

function drawGrid(context, x, y, width, height, columns, rows, color) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 1;

  for (let column = 1; column < columns; column += 1) {
    const lineX = x + (width / columns) * column;
    context.beginPath();
    context.moveTo(lineX, y);
    context.lineTo(lineX, y + height);
    context.stroke();
  }

  for (let row = 1; row < rows; row += 1) {
    const lineY = y + (height / rows) * row;
    context.beginPath();
    context.moveTo(x, lineY);
    context.lineTo(x + width, lineY);
    context.stroke();
  }

  context.restore();
}

function drawDonut(context, cx, cy, radius, value, color, label, valueText) {
  const start = -Math.PI / 2;
  const end = start + ((clamp(value, 0, 100) / 100) * Math.PI * 2);

  context.save();
  context.lineWidth = 10;
  context.strokeStyle = "#dbe3ed";
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.stroke();

  context.strokeStyle = color;
  context.beginPath();
  context.arc(cx, cy, radius, start, end);
  context.stroke();

  context.fillStyle = GRAPH_BOARD_COLORS.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 30px Segoe UI";
  context.fillText(String(Math.round(value)), cx, cy - 8);
  context.font = "600 15px Segoe UI";
  context.fillStyle = GRAPH_BOARD_COLORS.muted;
  context.fillText(label, cx, cy + 18);
  context.font = "700 13px Segoe UI";
  context.fillStyle = color;
  context.fillText(valueText, cx, cy + 38);
  context.restore();
}

function drawAreaChart(context, x, y, width, height, values, color, lineColor) {
  const safeValues = values.length ? values : [0];
  const maxValue = Math.max(100, ...safeValues);
  const step = safeValues.length > 1 ? width / (safeValues.length - 1) : width;

  context.save();
  const gradient = context.createLinearGradient(0, y, 0, y + height);
  gradient.addColorStop(0, `${color}E6`);
  gradient.addColorStop(1, `${color}00`);

  context.beginPath();
  safeValues.forEach((value, index) => {
    const pointX = x + (index * step);
    const normalized = value / maxValue;
    const pointY = y + height - (normalized * (height - 8)) - 4;
    if (index === 0) {
      context.moveTo(pointX, pointY);
    } else {
      const previousX = x + ((index - 1) * step);
      const previousValue = safeValues[index - 1] / maxValue;
      const previousY = y + height - (previousValue * (height - 8)) - 4;
      const controlX = previousX + (step / 2);
      context.bezierCurveTo(controlX, previousY, controlX, pointY, pointX, pointY);
    }
  });
  context.lineTo(x + width, y + height);
  context.lineTo(x, y + height);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();

  context.beginPath();
  safeValues.forEach((value, index) => {
    const pointX = x + (index * step);
    const normalized = value / maxValue;
    const pointY = y + height - (normalized * (height - 8)) - 4;
    if (index === 0) {
      context.moveTo(pointX, pointY);
    } else {
      const previousX = x + ((index - 1) * step);
      const previousValue = safeValues[index - 1] / maxValue;
      const previousY = y + height - (previousValue * (height - 8)) - 4;
      const controlX = previousX + (step / 2);
      context.bezierCurveTo(controlX, previousY, controlX, pointY, pointX, pointY);
    }
  });
  context.lineWidth = 4;
  context.strokeStyle = lineColor;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.stroke();

  safeValues.forEach((value, index) => {
    const pointX = x + (index * step);
    const normalized = value / maxValue;
    const pointY = y + height - (normalized * (height - 8)) - 4;
    context.beginPath();
    context.fillStyle = GRAPH_BOARD_COLORS.surface;
    context.arc(pointX, pointY, 5, 0, Math.PI * 2);
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = lineColor;
    context.stroke();
  });

  context.restore();
}

function drawColumnChart(context, x, y, width, height, values, color, labelColor) {
  const safeValues = values.length ? values : [0];
  const maxValue = Math.max(100, ...safeValues);
  const gap = 10;
  const barWidth = Math.max(8, (width - gap * (safeValues.length - 1)) / safeValues.length);

  safeValues.forEach((value, index) => {
    const barHeight = (value / maxValue) * (height - 20);
    const barX = x + index * (barWidth + gap);
    const barY = y + height - barHeight;
    const gradient = context.createLinearGradient(0, barY, 0, y + height);
    gradient.addColorStop(0, `${color}E8`);
    gradient.addColorStop(1, GRAPH_BOARD_COLORS.mintSoft);

    roundRect(context, barX, barY, barWidth, barHeight, 10, gradient, null, null);

    context.save();
    context.fillStyle = labelColor;
    context.font = "600 11px Segoe UI";
    context.textAlign = "center";
    context.fillText(String(value), barX + (barWidth / 2), barY - 8);
    context.restore();
  });
}

function drawHorizontalBars(context, x, y, width, items) {
  const rowHeight = 44;
  items.forEach((item, index) => {
    const rowY = y + index * rowHeight;
    const labelWidth = 140;
    drawText(context, shortenText(item.label, 16), x, rowY + 16, {
      font: "700 13px Segoe UI",
      color: GRAPH_BOARD_COLORS.ink,
    });
    roundRect(context, x + labelWidth, rowY + 3, width - labelWidth, 14, 7, GRAPH_BOARD_COLORS.graySoft, null, null);
    roundRect(context, x + labelWidth, rowY + 3, (width - labelWidth) * (item.value / 100), 14, 7, GRAPH_BOARD_COLORS.teal, null, null);
    drawText(context, `${item.value}%`, x + width, rowY + 16, {
      font: "700 12px Segoe UI",
      color: GRAPH_BOARD_COLORS.muted,
      align: "right",
    });
  });
}

function drawHeatmap(context, x, y, width, height, rows, columns) {
  const cellWidth = width / Math.max(columns.length, 1);
  const cellHeight = height / Math.max(rows.length, 1);

  rows.forEach((row, rowIndex) => {
    columns.forEach((column, columnIndex) => {
      const cellX = x + columnIndex * cellWidth;
      const cellY = y + rowIndex * cellHeight;
      const cellValue = row[columnIndex] ?? 0;
      const mix = clamp(cellValue / 100, 0, 1);
      const fillColor = mix > 0.65 ? GRAPH_BOARD_COLORS.teal : mix > 0.35 ? GRAPH_BOARD_COLORS.blue : GRAPH_BOARD_COLORS.graySoft;
      roundRect(context, cellX + 2, cellY + 2, cellWidth - 4, cellHeight - 4, 8, fillColor, GRAPH_BOARD_COLORS.surface, null);
      drawText(context, String(cellValue), cellX + (cellWidth / 2), cellY + (cellHeight / 2) + 4, {
        font: "700 12px Segoe UI",
        color: mix > 0.35 ? "#ffffff" : GRAPH_BOARD_COLORS.ink,
        align: "center",
        baseline: "middle",
      });
    });
  });
}

function drawMiniBadge(context, x, y, diameter, outerColor, innerColor, title, value) {
  context.save();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.arc(x + diameter / 2, y + diameter / 2, diameter / 2, 0, Math.PI * 2);
  context.fill();

  context.lineWidth = 8;
  context.strokeStyle = outerColor;
  context.beginPath();
  context.arc(x + diameter / 2, y + diameter / 2, diameter / 2 - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.5);
  context.stroke();

  context.lineWidth = 4;
  context.strokeStyle = innerColor;
  context.beginPath();
  context.arc(x + diameter / 2, y + diameter / 2, diameter / 2 - 18, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = GRAPH_BOARD_COLORS.ink;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "800 22px Segoe UI";
  context.fillText(String(value), x + diameter / 2, y + diameter / 2 - 8);
  context.font = "600 11px Segoe UI";
  context.fillStyle = GRAPH_BOARD_COLORS.muted;
  context.fillText(title, x + diameter / 2, y + diameter / 2 + 12);
  context.restore();
}

function renderGraphBoard(canvas, report, records) {
  const context = setupBoardCanvas(canvas);
  if (!context) {
    return;
  }

  const width = GRAPH_BOARD_SIZE.width;
  const height = GRAPH_BOARD_SIZE.height;
  const model = computeGraphModel(report, records);
  const left = 36;
  const top = 30;
  const gap = 18;
  const tileWidth = (width - left * 2 - gap * 2) / 3;
  const tileHeight = (height - 130 - top - gap * 2) / 3;

  context.clearRect(0, 0, width, height);

  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#ffffff");
  background.addColorStop(1, "#f8fbff");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  context.fillStyle = "rgba(20, 184, 166, 0.12)";
  context.beginPath();
  context.arc(width * 0.1, height * 0.1, 110, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "rgba(37, 99, 235, 0.10)";
  context.beginPath();
  context.arc(width * 0.9, height * 0.06, 150, 0, Math.PI * 2);
  context.fill();

  roundRect(context, 16, 16, width - 32, height - 32, 28, "#ffffff", "#d9e3ef", {
    color: "rgba(15, 23, 42, 0.08)",
    blur: 28,
    offsetY: 8,
  });

  drawText(context, "Dynamic Information Saver", left, top + 6, {
    font: "800 40px Segoe UI",
    color: GRAPH_BOARD_COLORS.ink,
  });
  drawText(context, "Graph View", left, top + 42, {
    font: "700 16px Segoe UI",
    color: GRAPH_BOARD_COLORS.muted,
  });
  drawText(context, `Rows ${report.rows}  •  Columns ${report.columns}  •  Filled ${formatPercent(report.completionRate)}`, width - 42, top + 10, {
    font: "700 16px Segoe UI",
    color: GRAPH_BOARD_COLORS.tealDark,
    align: "right",
  });
  drawText(context, `Best record: ${report.bestRecord ? report.bestRecord.label : "None"}`, width - 42, top + 36, {
    font: "600 14px Segoe UI",
    color: GRAPH_BOARD_COLORS.muted,
    align: "right",
  });

  const tileTop = 94;

  const tiles = [
    { x: left, y: tileTop, w: tileWidth, h: tileHeight, title: "Completion rings" },
    { x: left + tileWidth + gap, y: tileTop, w: tileWidth, h: tileHeight, title: "Record trend" },
    { x: left + (tileWidth + gap) * 2, y: tileTop, w: tileWidth, h: tileHeight, title: "Best record" },
    { x: left, y: tileTop + tileHeight + gap, w: tileWidth, h: tileHeight, title: "Record line" },
    { x: left + tileWidth + gap, y: tileTop + tileHeight + gap, w: tileWidth, h: tileHeight, title: "Field heatmap" },
    { x: left + (tileWidth + gap) * 2, y: tileTop + tileHeight + gap, w: tileWidth, h: tileHeight, title: "Field balance" },
    { x: left, y: tileTop + (tileHeight + gap) * 2, w: tileWidth, h: tileHeight, title: "Filled counts" },
    { x: left + tileWidth + gap, y: tileTop + (tileHeight + gap) * 2, w: tileWidth, h: tileHeight, title: "Dual series" },
    { x: left + (tileWidth + gap) * 2, y: tileTop + (tileHeight + gap) * 2, w: tileWidth, h: tileHeight, title: "Summary badge" },
  ];

  const drawTile = (tile, subtitle, paint) => {
    roundRect(context, tile.x, tile.y, tile.w, tile.h, 20, GRAPH_BOARD_COLORS.surface, GRAPH_BOARD_COLORS.border, {
      color: "rgba(15, 23, 42, 0.08)",
      blur: 14,
      offsetY: 8,
    });
    drawText(context, tile.title, tile.x + 18, tile.y + 28, {
      font: "800 16px Segoe UI",
      color: GRAPH_BOARD_COLORS.ink,
    });
    if (subtitle) {
      drawText(context, subtitle, tile.x + 18, tile.y + 48, {
        font: "600 12px Segoe UI",
        color: GRAPH_BOARD_COLORS.muted,
      });
    }
    paint(tile);
  };

  drawTile(tiles[0], "Same color theme, same board style", (tile) => {
    const completion = Math.round(report.completionRate || 0);
    const best = report.bestRecord ? report.bestRecord.score : 0;
    drawDonut(context, tile.x + 92, tile.y + 110, 54, completion, GRAPH_BOARD_COLORS.teal, "Filled", `${completion}%`);
    drawDonut(context, tile.x + 238, tile.y + 110, 54, best, GRAPH_BOARD_COLORS.navy, "Best", `${best}%`);
  });

  drawTile(tiles[1], "Row completion values", (tile) => {
    const chartX = tile.x + 16;
    const chartY = tile.y + 66;
    const chartW = tile.w - 32;
    const chartH = tile.h - 84;
    drawAreaChart(context, chartX, chartY, chartW, chartH, model.scoreSeries, GRAPH_BOARD_COLORS.teal, GRAPH_BOARD_COLORS.tealDark);
    drawGrid(context, chartX, chartY, chartW, chartH, 6, 4, "rgba(148, 163, 184, 0.16)");
  });

  drawTile(tiles[2], "One highlighted record", (tile) => {
    const record = report.bestRecord || records[0] || null;
    const badgeX = tile.x + 52;
    const badgeY = tile.y + 76;
    roundRect(context, badgeX, badgeY, tile.w - 104, tile.h - 108, 28, "#f4fbf9", null, null);
    drawText(context, record ? shortenText(record.label, 20) : "No data", tile.x + tile.w / 2, tile.y + 128, {
      font: "800 28px Segoe UI",
      color: GRAPH_BOARD_COLORS.ink,
      align: "center",
    });
    drawText(context, record ? `Score ${record.score}%` : "Generate a table to begin", tile.x + tile.w / 2, tile.y + 170, {
      font: "700 14px Segoe UI",
      color: GRAPH_BOARD_COLORS.tealDark,
      align: "center",
    });
    drawMiniBadge(context, tile.x + tile.w / 2 - 52, tile.y + 188, 104, "#16a39c", "#b9f3e4", "Focus", record ? record.score : 0);
  });

  drawTile(tiles[3], "Completion per person", (tile) => {
    const chartX = tile.x + 20;
    const chartY = tile.y + 64;
    const chartW = tile.w - 40;
    const chartH = tile.h - 84;
    drawAreaChart(context, chartX, chartY, chartW, chartH, model.rowCompletionSeries, GRAPH_BOARD_COLORS.blue, GRAPH_BOARD_COLORS.navy);
  });

  drawTile(tiles[4], "Field coverage across the grid", (tile) => {
    const chartX = tile.x + 14;
    const chartY = tile.y + 68;
    const chartW = tile.w - 28;
    const chartH = tile.h - 88;
    const rows = records.slice(0, 5).map((record) => record.fields.slice(0, 5).map((field) => Math.round((field.weight || 0) * 100)));
    const cols = report.columnProfiles.map((profile) => profile.label).slice(0, 5);
    drawHeatmap(context, chartX, chartY, chartW, chartH, rows.length ? rows : [[0]], cols.length ? cols : ["A"]);
    drawGrid(context, chartX, chartY, chartW, chartH, Math.max(cols.length, 1), Math.max(rows.length, 1), "rgba(255, 255, 255, 0.65)");
  });

  drawTile(tiles[5], "Most complete fields", (tile) => {
    const items = (model.topColumns.length ? model.topColumns : report.columnProfiles.slice(0, 4).map((profile, index) => ({ label: profile.label || `Field ${index + 1}`, value: report.rows ? Math.round((profile.nonEmptyCount / report.rows) * 100) : 0 }))).slice(0, 4);
    drawHorizontalBars(context, tile.x + 18, tile.y + 70, tile.w - 36, items);
  });

  drawTile(tiles[6], "Filled counts by record", (tile) => {
    const chartX = tile.x + 18;
    const chartY = tile.y + 70;
    const chartW = tile.w - 36;
    const chartH = tile.h - 92;
    drawColumnChart(context, chartX, chartY, chartW, chartH, model.filledSeries.map((value) => Math.round((value / Math.max(report.columns, 1)) * 100)), GRAPH_BOARD_COLORS.teal, GRAPH_BOARD_COLORS.muted);
  });

  drawTile(tiles[7], "Two connected curves", (tile) => {
    const chartX = tile.x + 18;
    const chartY = tile.y + 68;
    const chartW = tile.w - 36;
    const chartH = tile.h - 92;
    drawAreaChart(context, chartX, chartY, chartW, chartH, model.scoreSeries, GRAPH_BOARD_COLORS.mint, GRAPH_BOARD_COLORS.tealDark);
    drawAreaChart(context, chartX, chartY + 4, chartW, chartH - 10, model.rowCompletionSeries, GRAPH_BOARD_COLORS.blue, GRAPH_BOARD_COLORS.navy);
  });

  drawTile(tiles[8], "Key totals", (tile) => {
    const centerX = tile.x + tile.w / 2;
    const centerY = tile.y + 118;
    drawMiniBadge(context, centerX - 80, centerY - 58, 90, "#14b8a6", "#b7f3e5", "Rows", report.rows);
    drawMiniBadge(context, centerX + 18, centerY - 58, 90, "#2563eb", "#cfe8ff", "Fields", report.columns);
    drawText(context, `${report.uniqueCount} unique values`, centerX, tile.y + 206, {
      font: "800 18px Segoe UI",
      color: GRAPH_BOARD_COLORS.ink,
      align: "center",
    });
    drawText(context, `PDF export uses the same board image`, centerX, tile.y + 232, {
      font: "600 12px Segoe UI",
      color: GRAPH_BOARD_COLORS.muted,
      align: "center",
    });
  });
}

function createEmptyState(rows, columns) {
  const headers = Array.from({ length: columns }, () => "");
  const rowsData = Array.from({ length: rows }, () => Array.from({ length: columns }, () => ""));
  return { rows, columns, headers, rowsData };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return null;
  }

  try {
    return JSON.parse(saved);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function saveState() {
  if (!tableState) {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(tableState));
  updateStatus();
}
 

function updateStatus(message) {
  if (message) {
    elements.statusText.textContent = message;
    return;
  }

  if (!tableState) {
    elements.statusText.textContent = "No table loaded yet.";
    return;
  }

  elements.statusText.textContent = `${tableState.rows} row(s) x ${tableState.columns} column(s) saved locally.`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderTable() {
  if (!tableState) {
    elements.tableContainer.innerHTML = '<p class="empty-state">Generate a table to begin editing.</p>';
    updateActionButtons();
    updateStatus();
    if (reportVisible) {
      renderGraph();
    }
    return;
  }

  let html = '<table id="editableTable"><thead><tr><th class="corner-cell">#</th>';

  tableState.headers.forEach((header, index) => {
    html += `<th contenteditable="true" data-type="header" data-index="${index}">${escapeHtml(header)}</th>`;
  });

  html += "</tr></thead><tbody>";

  tableState.rowsData.forEach((row, rowIndex) => {
    html += `<tr data-row-index="${rowIndex}">`;
    html += `<th class="row-header" scope="row">${rowIndex + 1}</th>`;

    row.forEach((cell, columnIndex) => {
      html += `<td contenteditable="true" data-type="cell" data-row="${rowIndex}" data-column="${columnIndex}">${escapeHtml(cell)}</td>`;
    });

    html += "</tr>";
  });

  html += "</tbody></table>";
  elements.tableContainer.innerHTML = html;
  updateActionButtons();
  wireTableEvents();
  applySearchFilter();
  updateStatus();
  if (reportVisible) {
    renderGraph();
  }
}

function updateActionButtons() {
  elements.saveBtn.disabled = !tableState;
  if (elements.saveDbBtn) {
    elements.saveDbBtn.disabled = !tableState;
  }
  elements.downloadBtn.disabled = !tableState;
  elements.reportBtn.disabled = false;
  if (elements.saveGraphBtn) {
    elements.saveGraphBtn.disabled = !tableState;
  }
}

function wireTableEvents() {
  const editableCells = elements.tableContainer.querySelectorAll('[contenteditable="true"]');

  editableCells.forEach((cell) => {
    cell.addEventListener("keydown", handleArrowNavigation);
    cell.addEventListener("input", syncStateFromTable);
  });
}

function handleArrowNavigation(event) {
  const allowedKeys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Tab"];
  if (!allowedKeys.includes(event.key)) {
    return;
  }

  event.preventDefault();

  const headerCells = Array.from(elements.tableContainer.querySelectorAll('thead [contenteditable="true"]'));
  const dataCells = Array.from(elements.tableContainer.querySelectorAll('tbody [contenteditable="true"]'));
  const rowCount = tableState ? tableState.rows : 0;
  const columnCount = tableState ? tableState.columns : 0;
  const target = event.currentTarget;

  const currentRow = target.dataset.type === "header" ? 0 : Number(target.dataset.row) + 1;
  const currentColumn = target.dataset.type === "header" ? Number(target.dataset.index) : Number(target.dataset.column);

  let nextRow = currentRow;
  let nextColumn = currentColumn;

  if (event.key === "ArrowRight" || event.key === "Tab") {
    nextColumn += 1;
  } else if (event.key === "ArrowLeft") {
    nextColumn -= 1;
  } else if (event.key === "ArrowDown") {
    nextRow += 1;
  } else if (event.key === "ArrowUp") {
    nextRow -= 1;
  }

  if (nextColumn < 0 || nextColumn >= columnCount) {
    return;
  }

  if (nextRow < 0 || nextRow > rowCount) {
    return;
  }

  const nextElement = nextRow === 0
    ? headerCells[nextColumn]
    : dataCells[(nextRow - 1) * columnCount + nextColumn];

  nextElement?.focus();
}

function syncStateFromTable() {
  const table = document.getElementById("editableTable");
  if (!table || !tableState) {
    return;
  }

  const headers = Array.from(table.querySelectorAll('thead th[contenteditable="true"]')).map((header) => header.textContent.trim());

  const rowsData = Array.from(table.querySelectorAll("tbody tr")).map((row) =>
    Array.from(row.querySelectorAll("td[data-type='cell']")).map((cell) => cell.textContent)
  );

  tableState.headers = headers;
  tableState.rowsData = rowsData;
  tableState.rows = rowsData.length;
  tableState.columns = headers.length;

  saveState();
  applySearchFilter();
}

function generateTable() {
  const rows = Math.max(1, Number.parseInt(elements.rows.value, 10) || 1);
  const columns = Math.max(1, Number.parseInt(elements.columns.value, 10) || 1);

  tableState = createEmptyState(rows, columns);
  elements.rows.value = String(rows);
  elements.columns.value = String(columns);

  saveState();
  renderTable();
}

function addRow() {
  if (!tableState) {
    generateTable();
    return;
  }

  tableState.rows += 1;
  tableState.rowsData.push(Array.from({ length: tableState.columns }, () => ""));
  saveState();
  renderTable();
}

function addColumn() {
  if (!tableState) {
    generateTable();
    return;
  }

  tableState.columns += 1;
  tableState.headers.push(`Column ${tableState.columns}`);
  tableState.rowsData.forEach((row) => row.push(""));
  saveState();
  renderTable();
}

function deleteRow() {
  if (!tableState || tableState.rows <= 1) {
    return;
  }

  tableState.rows -= 1;
  tableState.rowsData.pop();
  saveState();
  renderTable();
}

function deleteColumn() {
  if (!tableState || tableState.columns <= 1) {
    return;
  }

  tableState.columns -= 1;
  tableState.headers.pop();
  tableState.rowsData.forEach((row) => row.pop());
  saveState();
  renderTable();
}

function applySearchFilter() {
  const query = elements.search.value.trim().toLowerCase();
  const table = document.getElementById("editableTable");

  if (!table) {
    return;
  }

  const rows = Array.from(table.querySelectorAll("tbody tr"));
  rows.forEach((row) => {
    const match = !query || row.textContent.toLowerCase().includes(query);
    row.style.display = match ? "" : "none";
  });
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function buildExportRows() {
  if (!tableState) {
    return [];
  }

  return [
    ["#", ...tableState.headers.map((header, index) => header || `Column ${index + 1}`)],
    ...tableState.rowsData.map((row, rowIndex) => [String(rowIndex + 1), ...row.map((cell) => cell || "")]),
  ];
}

function calculatePdfColumnWidths(doc, tableRows, availableWidth) {
  const columnCount = tableRows[0]?.length || 0;

  if (!columnCount) {
    return [];
  }

  const rawWidths = Array.from({ length: columnCount }, (_, columnIndex) => {
    const widestCell = tableRows.reduce((widest, row) => {
      const text = String(row[columnIndex] || "");
      return Math.max(widest, text.length);
    }, 4);

    return widestCell;
  });

  const totalWidth = rawWidths.reduce((sum, width) => sum + width, 0) || 1;
  return rawWidths.map((width) => Math.max(24, (width / totalWidth) * availableWidth));
}

function drawSimplePdfTable(doc, tableRows) {
  const marginLeft = 40;
  const marginRight = 40;
  const topOffset = 54;
  const bottomMargin = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const availableWidth = pageWidth - marginLeft - marginRight;
  const columnWidths = calculatePdfColumnWidths(doc, tableRows, availableWidth);
  const headerFill = [0, 123, 255];
  const headerText = [255, 255, 255];
  const borderColor = [0, 0, 0];
  const textColor = [31, 41, 55];
  const paddingX = 6;
  const paddingY = 6;
  const lineHeight = 12;

  const drawRow = (row, startY, isHeader) => {
    let rowHeight = 0;
    const cellLines = row.map((cell, columnIndex) => {
      const cellWidth = Math.max(columnWidths[columnIndex] - paddingX * 2, 12);
      const lines = doc.splitTextToSize(String(cell || ""), cellWidth);
      rowHeight = Math.max(rowHeight, lines.length * lineHeight + paddingY * 2);
      return lines;
    });

    let currentX = marginLeft;

    row.forEach((cell, columnIndex) => {
      const cellWidth = columnWidths[columnIndex];
      const lines = cellLines[columnIndex];

      doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
      doc.setLineWidth(0.8);

      if (isHeader) {
        doc.setFillColor(headerFill[0], headerFill[1], headerFill[2]);
        doc.rect(currentX, startY, cellWidth, rowHeight, "FD");
        doc.setTextColor(headerText[0], headerText[1], headerText[2]);
        doc.setFont("helvetica", "bold");
      } else {
        doc.setFillColor(255, 255, 255);
        doc.rect(currentX, startY, cellWidth, rowHeight, "S");
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.setFont("helvetica", "normal");
      }

      doc.text(lines, currentX + paddingX, startY + paddingY + 4);
      currentX += cellWidth;
    });

    return rowHeight;
  };

  doc.setFontSize(16);
  doc.setTextColor(31, 41, 55);
  doc.setFont("helvetica", "bold");
  doc.text("Dynamic Information Saver", marginLeft, 28);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Exported on ${new Date().toLocaleString()}`, marginLeft, 40);

  let currentY = topOffset;
  currentY += drawRow(tableRows[0], currentY, true);

  for (let rowIndex = 1; rowIndex < tableRows.length; rowIndex += 1) {
    const row = tableRows[rowIndex];
    const previewLines = row.map((cell, columnIndex) => doc.splitTextToSize(String(cell || ""), Math.max(columnWidths[columnIndex] - paddingX * 2, 12)));
    const nextRowHeight = previewLines.reduce((height, lines) => Math.max(height, lines.length * lineHeight + paddingY * 2), 0);

    if (currentY + nextRowHeight > pageHeight - bottomMargin) {
      doc.addPage();
      currentY = topOffset;
      currentY += drawRow(tableRows[0], currentY, true);
    }

    currentY += drawRow(row, currentY, false);
  }
}

function saveToExcel() {
  if (!tableState || !window.XLSX) {
    return;
  }

  const workbook = window.XLSX.utils.book_new();
  const worksheet = window.XLSX.utils.aoa_to_sheet(buildExportRows());
  const columnWidths = [
    { wch: 8 },
    ...tableState.headers.map((header, index) => {
      const headerWidth = String(header || `Column ${index + 1}`).length;
      const cellWidth = tableState.rowsData.reduce((maxWidth, row) => Math.max(maxWidth, String(row[index] || "").length), 0);
      return { wch: Math.max(12, headerWidth, cellWidth) };
    }),
  ];

  worksheet["!cols"] = columnWidths;
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "Table Data");
  window.XLSX.writeFile(workbook, "dynamic-information-saver.xlsx");
}

function saveToDatabase() {
  if (!tableState) {
    alert('No table to save. Generate or edit a table first.');
    return;
  }

  // Placeholder: frontend-only save button. Integration with Supabase
  // auth and backend persistence will be added later.
  alert('Save is a placeholder right now — will integrate Supabase auth later.');
}

function getNonEmptyValue(value) {
  return String(value || "").trim();
}

function getSafeNumber(value) {
  const normalized = getNonEmptyValue(value);
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getWordCount(value) {
  const normalized = getNonEmptyValue(value);
  if (!normalized) {
    return 0;
  }

  return normalized.split(/\s+/).filter(Boolean).length;
}

function detectColumnProfiles(rowsData, headers) {
  return headers.map((header, columnIndex) => {
    const values = rowsData.map((row) => getNonEmptyValue(row[columnIndex])).filter(Boolean);
    const numericValues = values.map((value) => getSafeNumber(value)).filter((value) => value !== null);
    const dateValues = values.filter((value) => !Number.isNaN(Date.parse(value)));
    const textValues = values.length - numericValues.length - dateValues.length;
    let type = "text";

    if (numericValues.length >= Math.max(1, Math.ceil(values.length * 0.6))) {
      type = "numeric";
    } else if (dateValues.length >= Math.max(1, Math.ceil(values.length * 0.6))) {
      type = "date";
    }

    const min = numericValues.length ? Math.min(...numericValues) : null;
    const max = numericValues.length ? Math.max(...numericValues) : null;

    return {
      label: header && header.trim() ? header.trim() : `Field ${columnIndex + 1}`,
      type,
      nonEmptyCount: values.length,
      numericCount: numericValues.length,
      textCount: textValues,
      min,
      max,
    };
  });
}

function getPrimaryLabelColumnIndex() {
  if (!tableState) {
    return 0;
  }

  const labelMatchers = [/^name$/i, /student/i, /person/i, /full\s*name/i, /title/i];
  const headerMatchIndex = tableState.headers.findIndex((header) =>
    labelMatchers.some((matcher) => matcher.test(String(header || "")))
  );

  return headerMatchIndex >= 0 ? headerMatchIndex : 0;
}

function looksNumericField(header, value) {
  const normalized = getNonEmptyValue(value);

  if (!normalized) {
    return false;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    return false;
  }

  const safeHeader = String(header || "").toLowerCase();
  if (/phone|mobile|contact|id|zip|pin|code/.test(safeHeader) && normalized.length > 4) {
    return false;
  }

  return true;
}

function getReportData() {
  if (!tableState) {
    return null;
  }

  const primaryLabelColumnIndex = getPrimaryLabelColumnIndex();
  const columnProfiles = detectColumnProfiles(tableState.rowsData, tableState.headers);
  // Detect columns that use a "X / Y" pattern (e.g. "18 / 20") so we can compute
  // real percentages from totals instead of relying on normalization.
  const fractionPattern = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/;
  const columnFractionInfo = columnProfiles.map((profile, columnIndex) => {
    const values = tableState.rowsData.map((r) => (r[columnIndex] || "").toString().trim());
    const parsed = values
      .map((v) => {
        const m = v.match(fractionPattern);
        return m ? { obtained: Number(m[1]), outOf: Number(m[2]) } : null;
      })
      .filter(Boolean);

    if (!parsed.length) return null;

    // If multiple outOf values appear, use the max (fallback) — commonly it's the same.
    const outOf = Math.max(...parsed.map((p) => p.outOf));
    return { outOf };
  });

  const records = tableState.rowsData.map((row, rowIndex) => {
    const fields = tableState.headers.map((header, columnIndex) => {
      const rawValue = row[columnIndex];
      const value = getNonEmptyValue(rawValue);
      const profile = columnProfiles[columnIndex];
      const numericValue = getSafeNumber(rawValue);
      const wordCount = getWordCount(rawValue);

      return {
        label: header && header.trim() ? header.trim() : `Field ${columnIndex + 1}`,
        value,
        type: profile.type,
        isNumeric: profile.type === "numeric" && numericValue !== null,
        numericValue,
        wordCount,
        weight: profile.type === "numeric"
          ? (numericValue !== null && profile.min !== null && profile.max !== null && profile.max !== profile.min
            ? (numericValue - profile.min) / (profile.max - profile.min)
            : numericValue !== null ? 1 : 0)
          : profile.type === "date"
            ? value ? 0.7 : 0
            : Math.min(1, wordCount / 6),
      };
    });

    const labelValue = getNonEmptyValue(row[primaryLabelColumnIndex]) || getNonEmptyValue(row[0]) || `Record ${rowIndex + 1}`;
    const filledFields = fields.filter((field) => field.value).length;
    const numericFields = fields.filter((field) => field.isNumeric && Number.isFinite(field.numericValue));
    const textWeight = fields.reduce((sum, field) => sum + (field.type === "text" ? field.weight : 0), 0);
    const numericWeight = fields.reduce((sum, field) => sum + (field.type === "numeric" ? field.weight : 0), 0);
    const completeness = fields.length ? filledFields / fields.length : 0;

    // If there are fraction-style columns (e.g. "18 / 20"), compute a real percentage
    // from totals (sum obtained / sum outOf). This gives an intuitive score for marks.
    let score = null;
    let obtainedSum = 0;
    let outOfSum = 0;

    for (let col = 0; col < tableState.columns; col += 1) {
      const info = columnFractionInfo[col];
      if (!info) continue;
      const cell = (row[col] || "").toString().trim();
      const m = cell.match(fractionPattern);
      if (m) {
        obtainedSum += Number(m[1]);
        outOfSum += Number(m[2]);
      }
    }

    if (outOfSum > 0) {
      score = Math.round((obtainedSum / outOfSum) * 100);
    } else {
      // Fallback: use previous blended scoring approach
      score = Math.round(((completeness * 0.48) + ((numericWeight / Math.max(fields.filter((field) => field.type === "numeric").length, 1)) * 0.34) + ((textWeight / Math.max(fields.filter((field) => field.type === "text").length, 1)) * 0.18)) * 100);
    }

    return {
      index: rowIndex,
      label: labelValue,
      fields,
      filledFields,
      numericFields,
      completion: tableState.columns ? (filledFields / tableState.columns) * 100 : 0,
      score,
    };
  });

  const flattenedCells = records.flatMap((record) => record.fields.map((field) => field.value));
  const filledCells = flattenedCells.filter((cell) => getNonEmptyValue(cell));
  const uniqueValues = new Set(filledCells.map((cell) => cell.toLowerCase()));
  const totalCells = tableState.rows * tableState.columns;
  const filledCount = filledCells.length;
  const emptyCount = totalCells - filledCount;
  const completionRate = totalCells ? (filledCount / totalCells) * 100 : 0;
  const numericFieldCount = records.reduce((count, record) => count + record.numericFields.length, 0);
  const bestRecord = records.reduce((best, current) => (current.score > (best?.score ?? -1) ? current : best), null);

  return {
    rows: tableState.rows,
    columns: tableState.columns,
    totalCells,
    filledCount,
    emptyCount,
    completionRate,
    uniqueCount: uniqueValues.size,
    numericFieldCount,
    bestRecord,
    columnProfiles,
    records,
  };
}

function renderMetricCard(label, value, accentClass = "") {
  return `
    <article class="metric-card ${accentClass}">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(value)}</strong>
    </article>
  `;
}

function createVerticalGradient(context, topColor, bottomColor) {
  const gradient = context.createLinearGradient(0, 0, 0, 240);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);
  return gradient;
}

function canvasToImageData(canvas) {
  if (!canvas) {
    return null;
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = Math.max(canvas.width, 1) * 2;
  exportCanvas.height = Math.max(canvas.height, 1) * 2;

  const exportContext = exportCanvas.getContext("2d");
  if (!exportContext) {
    return null;
  }

  exportContext.fillStyle = "#09111f";
  exportContext.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  exportContext.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
  return exportCanvas.toDataURL("image/png", 1);
}

function getGraphPalette(recordIndex, isFocused = false) {
  const palette = GRAPH_PALETTE[recordIndex % GRAPH_PALETTE.length];

  return {
    border: isFocused ? palette.deep : palette.base,
    glow: isFocused ? "rgba(15, 118, 110, 0.28)" : palette.glow,
    fillStart: isFocused ? "rgba(15, 118, 110, 0.42)" : `${palette.base}33`,
    fillEnd: `${palette.base}10`,
    chip: palette.base,
  };
}

function destroyGraphCharts() {
  graphCharts.records.forEach((chart) => {
    if (chart) {
      chart.destroy();
    }
  });

  if (graphCharts.focus) {
    graphCharts.focus.destroy();
  }

  if (graphCharts.comparison) {
    graphCharts.comparison.destroy();
  }

  graphCharts = {
    records: [],
    focus: null,
    comparison: null,
  };
}

function getSortedRecords(report) {
  return [...report.records];
}

function renderRecordOverviewCard(label, value, accentClass = "") {
  return `
    <article class="metric-card record-overview-card ${accentClass}">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderRecordOverview(report, record) {
  if (!record) {
    return renderMetricCard("Record overview", "No record selected", "metric-accent-1");
  }

  const fields = record.fields.slice(0, 3);
  const cards = [
    renderRecordOverviewCard("Selected record", record.label, "metric-accent-1"),
    renderRecordOverviewCard("Score", `${record.score}%`, "metric-accent-2"),
    renderRecordOverviewCard("Completion", formatPercent(record.completion), "metric-accent-3"),
  ];

  fields.forEach((field, index) => {
    cards.push(renderRecordOverviewCard(field.label || `Field ${index + 1}`, field.value || "—", `metric-accent-${index + 4}`));
  });

  while (cards.length < 6) {
    cards.push(renderRecordOverviewCard("Field", "—", `metric-accent-${cards.length + 1}`));
  }

  return cards.join("");
}

function setFocusedRecord(recordIndex) {
  focusedRecordIndex = recordIndex;

  if (reportVisible) {
    renderGraph();
  }
}

function getFocusRecord(report, sortedRecords) {
  if (!sortedRecords.length) {
    return null;
  }

  const byCurrentSelection = sortedRecords.find((record) => record.index === focusedRecordIndex);
  if (byCurrentSelection) {
    return byCurrentSelection;
  }

  const best = report.bestRecord ? sortedRecords.find((record) => record.index === report.bestRecord.index) : null;
  return best || sortedRecords[0];
}

function getRecordChartConfig(record, recordIndex, isFocused = false, chartContext = null) {
  const labels = record.fields.map((field) => field.label);
  const values = record.fields.map((field) => Math.round((field.weight || 0) * 100));
  const hasAnyValue = values.some((value) => value > 0);
  const palette = getGraphPalette(recordIndex, isFocused);
  const gradient = chartContext ? createVerticalGradient(chartContext, palette.fillStart, palette.fillEnd) : palette.fillStart;

  if (hasAnyValue) {
    return {
      type: "radar",
      data: {
        labels,
        datasets: [{
          label: record.label,
          data: values,
          borderColor: palette.border,
          backgroundColor: gradient,
          pointBackgroundColor: palette.border,
          pointRadius: isFocused ? 4 : 3,
          borderWidth: isFocused ? 3 : 2,
          fill: true,
          tension: 0.35,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.96)",
            titleColor: "#fff",
            bodyColor: "#fff",
          },
        },
        scales: {
          r: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: { color: "#c7d7ff", backdropColor: "transparent", font: { size: 12, weight: "700" } },
            angleLines: { color: "rgba(125, 211, 252, 0.14)" },
            grid: { color: "rgba(96, 165, 250, 0.14)" },
            pointLabels: { color: "#f8fbff", font: { size: 14, weight: "800" } },
          },
        },
      },
    };
  }

  return {
    type: "doughnut",
    data: {
      labels: ["Filled fields", "Empty fields"],
      datasets: [{
        data: [record.filledFields, Math.max(record.fields.length - record.filledFields, 0)],
        backgroundColor: [palette.border, "#dbeafe"],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "72%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#eaf2ff", usePointStyle: true, pointStyle: "circle", font: { size: 12, weight: "700" } },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.96)",
          titleColor: "#fff",
          bodyColor: "#fff",
        },
      },
    },
  };
}

function renderComparisonChart(report, records) {
  if (!window.Chart || !elements.comparisonChart) {
    return;
  }

  if (graphCharts.comparison) {
    graphCharts.comparison.destroy();
  }

  const context = elements.comparisonChart.getContext("2d");
  const activeIndex = records.findIndex((record) => record.index === focusedRecordIndex);

  graphCharts.comparison = new window.Chart(context, {
    type: "bar",
    data: {
      labels: records.map((record) => record.label),
      datasets: [{
        label: "Record score",
        data: records.map((record) => record.score),
        borderSkipped: false,
        borderRadius: 14,
        backgroundColor: records.map((record, index) => {
          if (index === activeIndex) {
            return "rgba(15, 118, 110, 0.98)";
          }

          return GRAPH_PALETTE[index % GRAPH_PALETTE.length].base;
        }),
        barThickness: 18,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      onClick: (_, elementsAtEvent) => {
        const first = elementsAtEvent[0];
        if (first) {
          const record = records[first.index];
          if (record) {
            setFocusedRecord(record.index);
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.96)",
          titleColor: "#fff",
          bodyColor: "#fff",
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          suggestedMax: 100,
          ticks: { color: "#c7d7ff", font: { size: 12, weight: "700" } },
          grid: { color: "rgba(96, 165, 250, 0.12)" },
        },
        y: {
          ticks: { color: "#f8fbff", font: { size: 13, weight: "800" } },
          grid: { display: false },
        },
      },
    },
  });
}

function renderFocusPanel(report, record) {
  if (!record) {
    elements.focusKicker.textContent = "Selected person";
    elements.focusTitle.textContent = "No data selected";
    elements.focusMeta.textContent = "Generate a table to focus a record.";
    elements.focusStats.innerHTML = "";
    elements.focusChips.innerHTML = "";
    return;
  }

  const filledPercent = formatPercent(record.completion);
  const scorePercent = `${record.score}%`;
  elements.focusKicker.textContent = `Record ${record.index + 1}`;
  elements.focusTitle.textContent = record.label;
  elements.focusMeta.textContent = `${filledPercent} complete, ranked score ${scorePercent}.`;
  elements.focusStats.innerHTML = [
    `<span class="focus-stat"><strong>${record.score}</strong><em>Score</em></span>`,
    `<span class="focus-stat"><strong>${record.filledFields}</strong><em>Filled</em></span>`,
    `<span class="focus-stat"><strong>${record.fields.length}</strong><em>Fields</em></span>`,
  ].join("");

  elements.focusChips.innerHTML = record.fields
    .map((field) => `
      <span class="focus-chip ${field.type === "numeric" ? "is-numeric" : field.type === "date" ? "is-date" : "is-text"}">
        ${escapeHtml(field.label)}: ${escapeHtml(field.value || "—")}
      </span>
    `)
    .join("");
}

function renderFocusedChart(record, recordIndex) {
  if (!window.Chart || !elements.focusChart || !record) {
    return;
  }

  if (graphCharts.focus) {
    graphCharts.focus.destroy();
  }

  const context = elements.focusChart.getContext("2d");
  graphCharts.focus = new window.Chart(context, getRecordChartConfig(record, recordIndex, true, context));
}

function renderGraphCards(report, records) {
  if (!report || !tableState || !tableState.rowsData.length) {
    elements.reportPreview.innerHTML = '<p class="report-empty">No records available to preview.</p>';
    return;
  }

  const cardsHtml = records
    .map((record, recordIndex) => {
      const chartId = `person-chart-${record.index}`;
      const fieldsHtml = record.fields
        .map((field) => `
          <div class="preview-field">
            <span class="preview-field-label">${escapeHtml(field.label)}</span>
            <span class="preview-field-value">${escapeHtml(field.value || "—")}</span>
          </div>
        `)
        .join("");

      const activeClass = record.index === focusedRecordIndex ? "is-active" : "";

      return `
        <article class="preview-record graph-record ${activeClass}" data-record-index="${record.index}" role="button" tabindex="0" aria-label="Focus ${escapeHtml(record.label)}">
          <div class="preview-record-head">
            <div>
              <p class="preview-record-kicker">Record ${record.index + 1}</p>
              <h4>${escapeHtml(record.label)}</h4>
            </div>
            <div class="record-badges">
              <span class="preview-record-badge">Score ${record.score}</span>
              <span class="preview-record-badge">${formatPercent(record.completion)}</span>
            </div>
          </div>
          <div class="chart-wrap chart-wrap-person">
            <canvas id="${chartId}"></canvas>
          </div>
          <div class="preview-field-grid">${fieldsHtml}</div>
        </article>
      `;
    })
    .join("");

  elements.reportPreview.innerHTML = cardsHtml;

  const cardElements = Array.from(elements.reportPreview.querySelectorAll(".graph-record"));
  cardElements.forEach((card) => {
    const recordIndex = Number(card.dataset.recordIndex);
    card.addEventListener("click", () => setFocusedRecord(recordIndex));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setFocusedRecord(recordIndex);
      }
    });
  });

  if (!window.Chart) {
    return;
  }

  records.forEach((record, recordIndex) => {
    const canvas = document.getElementById(`person-chart-${record.index}`);
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    const chart = new window.Chart(context, getRecordChartConfig(record, recordIndex, record.index === focusedRecordIndex, context));
    graphCharts.records.push(chart);
  });
}

function renderInsights(report, records) {
  if (!report || !tableState) {
    elements.reportInsights.innerHTML = '<li>No report data available yet.</li>';
    return;
  }

  const topRecords = [...records].sort((left, right) => right.score - left.score).slice(0, 3);
  const insights = [];

  insights.push(`${report.rows} person record(s) loaded with ${report.columns} field(s) each.`);
  insights.push(`Best record: ${report.bestRecord ? `${report.bestRecord.label} at ${report.bestRecord.score}%` : "none yet"}.`);

  if (topRecords[0]) {
    insights.push(`Top performer: ${topRecords[0].label} with a score of ${topRecords[0].score}%.`);
  }

  if (topRecords[1]) {
    insights.push(`Next strongest record: ${topRecords[1].label} at ${topRecords[1].score}%.`);
  }

  if (report.numericFieldCount > 0) {
    insights.push(`${report.numericFieldCount} numeric field(s) contribute to the chart logic.`);
  }

  insights.push(`${report.uniqueCount} unique value(s) appear across the dataset.`);

  elements.reportInsights.innerHTML = insights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderPieChart(report) {
  if (!window.Chart || !elements.focusChart) {
    return;
  }

  if (graphCharts.focus) {
    graphCharts.focus.destroy();
  }

  const context = elements.focusChart.getContext("2d");
  graphCharts.focus = new window.Chart(context, {
    type: "doughnut",
    data: {
      labels: ["Filled", "Empty"],
      datasets: [{
        data: [report.filledCount, report.emptyCount],
        backgroundColor: ["#14b8a6", "#dbeafe"],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#eaf2ff", usePointStyle: true, pointStyle: "circle", font: { size: 12, weight: "700" } },
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.96)",
          titleColor: "#fff",
          bodyColor: "#fff",
        },
      },
    },
  });
}

function renderBarChart(records) {
  if (!window.Chart || !elements.comparisonChart) {
    return;
  }

  if (graphCharts.comparison) {
    graphCharts.comparison.destroy();
  }

  const context = elements.comparisonChart.getContext("2d");
  const activeIndex = records.findIndex((record) => record.index === focusedRecordIndex);

  graphCharts.comparison = new window.Chart(context, {
    type: "bar",
    data: {
      labels: records.map((record) => shortenText(record.label, 18)),
      datasets: [{
        label: "Record score",
        data: records.map((record) => record.score),
        borderSkipped: false,
        borderRadius: 12,
        backgroundColor: records.map((record, index) => {
          if (index === activeIndex) {
            return "#14b8a6";
          }

          return GRAPH_PALETTE[index % GRAPH_PALETTE.length].base;
        }),
        barThickness: 18,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      onClick: (_, elementsAtEvent) => {
        const first = elementsAtEvent[0];
        if (first) {
          const record = records[first.index];
          if (record) {
            setFocusedRecord(record.index);
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.96)",
          titleColor: "#fff",
          bodyColor: "#fff",
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          suggestedMax: 100,
          ticks: { color: "#c7d7ff", font: { size: 12, weight: "700" } },
          grid: { color: "rgba(96, 165, 250, 0.12)" },
        },
        y: {
          ticks: { color: "#f8fbff", font: { size: 13, weight: "800" } },
          grid: { display: false },
        },
      },
    },
  });
}

function ensurePictographCanvas() {
  let canvas = elements.reportPreview.querySelector("canvas");

  if (!canvas) {
    elements.reportPreview.innerHTML = '<div class="pictograph-shell"><canvas id="pictographCanvas"></canvas></div>';
    canvas = elements.reportPreview.querySelector("canvas");
  }

  return canvas;
}

function renderPictographCanvas(report, records) {
  const canvas = ensurePictographCanvas();
  if (!canvas) {
    return;
  }

  const width = 1200;
  const rowHeight = 64;
  const height = Math.max(220, 110 + records.length * rowHeight);
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = "100%";
  canvas.style.height = `${Math.round(height / 2)}px`;

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  context.fillStyle = "#0f766e";
  context.font = "800 28px Segoe UI";
  context.fillText("Pictograph", 24, 40);
  context.fillStyle = "#64748b";
  context.font = "600 14px Segoe UI";
  context.fillText("Each dot shows one 10% step of a record score", 24, 64);

  const startX = 220;
  const dotSize = 16;
  const gap = 12;

  if (!records.length) {
    context.fillStyle = "#64748b";
    context.font = "600 16px Segoe UI";
    context.fillText("No records available.", 24, 110);
    return;
  }

  records.forEach((record, rowIndex) => {
    const y = 100 + rowIndex * rowHeight;
    context.fillStyle = "#1f2937";
    context.font = "700 16px Segoe UI";
    context.fillText(shortenText(record.label, 20), 24, y + 12);

    const filledDots = Math.max(0, Math.min(10, Math.round(record.score / 10)));

    for (let index = 0; index < 10; index += 1) {
      const x = startX + index * (dotSize + gap);
      context.beginPath();
      context.arc(x, y, dotSize / 2, 0, Math.PI * 2);
      context.fillStyle = index < filledDots ? (index % 2 === 0 ? "#14b8a6" : "#2563eb") : "#dbeafe";
      context.fill();
    }

    context.fillStyle = "#0f766e";
    context.font = "700 14px Segoe UI";
    context.fillText(`${record.score}%`, startX + 10 * (dotSize + gap) + 10, y + 5);
  });
}

function renderGraph() {
  const report = getReportData();

  if (!report) {
    elements.reportStatus.textContent = "Create a table first to generate a graph.";
    elements.reportMetrics.innerHTML = "";
    elements.focusKicker.textContent = "Selected person";
    elements.focusTitle.textContent = "No data selected";
    elements.focusMeta.textContent = "Generate a table to focus a record.";
    elements.focusStats.innerHTML = "";
    elements.focusChips.innerHTML = "";
    elements.reportInsights.innerHTML = "<li>No table data available.</li>";
    elements.reportPreview.innerHTML = '<p class="report-empty">No records available to preview.</p>';
    return;
  }

  const sortedRecords = getSortedRecords(report);
  const focusRecord = report.bestRecord ? sortedRecords.find((r) => r.index === report.bestRecord.index) : sortedRecords[0] || null;

  // If there are no records (empty table rows), show a clear message and avoid rendering empty graph areas.
  if (!sortedRecords.length) {
    elements.reportStatus.textContent = `${report.rows} record(s) • ${report.columns} field(s) • ${formatPercent(report.completionRate)} filled`;
    elements.reportMetrics.innerHTML = renderRecordOverview(report, null);
    renderInsights(report, sortedRecords);
    renderFocusPanel(report, null);
    elements.reportPreview.innerHTML = '<p class="report-empty">No records available to preview.</p>';
    return;
  }

  elements.reportStatus.textContent = `${report.rows} record(s) • ${report.columns} field(s) • ${formatPercent(report.completionRate)} filled`;
  elements.reportMetrics.innerHTML = renderRecordOverview(report, focusRecord);
  renderInsights(report, sortedRecords);

  elements.focusKicker.textContent = "Table summary";
  elements.focusTitle.textContent = focusRecord ? focusRecord.label : "No data selected";
  elements.focusMeta.textContent = focusRecord
    ? `${formatPercent(focusRecord.completion)} complete · Score ${focusRecord.score}%`
    : "Generate a table to see the chart.";
  elements.focusStats.innerHTML = `
    <span class="focus-stat"><strong>${report.filledCount}</strong><em>Filled cells</em></span>
    <span class="focus-stat"><strong>${report.emptyCount}</strong><em>Empty cells</em></span>
    <span class="focus-stat"><strong>${report.uniqueCount}</strong><em>Unique values</em></span>
  `;
  elements.focusChips.innerHTML = "";

  renderPieChart(report);
  renderBarChart(sortedRecords);
  renderPictographCanvas(report, sortedRecords);
}

async function exportGraphPdf() {
  const report = getReportData();

  if (!report) {
    alert('Generate a table first, then open Graph View and try Save Graph PDF again.');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert('PDF library is not loaded. Please check the page scripts and reload.');
    return;
  }

  if (!window.html2canvas) {
    alert('Graph capture library is not loaded. Please reload the page and try again.');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const reportPanel = elements.reportDrawer.querySelector(".report-panel");

  try {
    const canvas = await window.html2canvas(reportPanel, {
      backgroundColor: null,
      scale: Math.max(window.devicePixelRatio || 1, 2),
      useCORS: true,
      logging: false,
      onclone: (clonedDocument) => {
        const clonedBody = clonedDocument.body;
        const clonedPanel = clonedDocument.querySelector(".report-panel");
        const clonedDrawer = clonedDocument.querySelector(".report-drawer");

        if (clonedBody) {
          clonedBody.style.margin = "0";
          clonedBody.style.background = "#f8fbff";
        }

        if (clonedDrawer) {
          clonedDrawer.style.position = "static";
          clonedDrawer.style.inset = "auto";
          clonedDrawer.style.padding = "0";
          clonedDrawer.style.background = "transparent";
          clonedDrawer.style.opacity = "1";
          clonedDrawer.style.pointerEvents = "none";
          clonedDrawer.style.overflow = "visible";
          clonedDrawer.style.justifyContent = "flex-start";
          clonedDrawer.style.alignItems = "flex-start";
        }

        if (clonedPanel) {
          clonedPanel.style.width = "1120px";
          clonedPanel.style.maxWidth = "1120px";
          clonedPanel.style.marginTop = "0";
          clonedPanel.style.padding = "14px";
          clonedPanel.style.transform = "scale(0.74)";
          clonedPanel.style.transformOrigin = "top left";
          clonedPanel.style.boxShadow = "none";
          clonedPanel.style.background = "linear-gradient(180deg, #08101f, #0d1730 58%, #0a1326)";
          clonedPanel.style.borderRadius = "0";
          clonedPanel.style.overflow = "visible";

          const compactStyles = clonedDocument.createElement("style");
          compactStyles.textContent = `
            .report-panel .eyebrow { margin-bottom: 4px !important; }
            .report-header { margin-bottom: 8px !important; }
            .graph-toolbar { margin-top: 8px !important; padding: 8px 10px !important; }
            .report-status { margin-top: 10px !important; padding: 8px 10px !important; }
            .report-metrics { margin-top: 10px !important; gap: 8px !important; }
            .metric-card { padding: 10px 12px !important; min-height: 72px !important; }
            .report-focus-card,
            .report-comparison-card,
            .report-insights-card,
            .report-preview-card { margin-top: 10px !important; }
            .report-card { padding: 12px !important; }
            .report-card-header { margin-bottom: 10px !important; }
            .focus-layout { gap: 12px !important; }
            .focus-summary { padding: 0 !important; }
            .focus-title { font-size: 1.3rem !important; }
            .focus-meta { margin-top: 6px !important; font-size: 0.92rem !important; }
            .focus-stats { margin-top: 10px !important; gap: 8px !important; }
            .focus-stat { padding: 8px 10px !important; min-width: 76px !important; }
            .focus-chips { margin-top: 10px !important; gap: 6px !important; }
            .focus-chip { padding: 6px 8px !important; font-size: 0.84rem !important; }
            .chart-wrap-focus { min-height: 190px !important; }
            .chart-wrap-comparison { min-height: 180px !important; }
            .report-preview-card .report-card-header span,
            .report-comparison-card .report-card-header span,
            .report-focus-card .report-card-header span { font-size: 0.82rem !important; }
            .report-insights { gap: 6px !important; }
            .report-preview { display: block !important; }
            .pictograph-shell { padding: 10px !important; }
          `;
          clonedDocument.head.appendChild(compactStyles);

          clonedPanel.style.marginTop = "0";
          clonedPanel.style.transform = "none";
        }
      },
    });

    const imageData = canvas.toDataURL("image/png");
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const scale = Math.min(usableWidth / canvas.width, usableHeight / canvas.height);
    const imageWidth = canvas.width * scale;
    const imageHeight = canvas.height * scale;
    const offsetX = (pageWidth - imageWidth) / 2;
    const offsetY = (pageHeight - imageHeight) / 2;

    doc.setFillColor(248, 251, 255);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.addImage(imageData, "PNG", offsetX, offsetY, imageWidth, imageHeight);
    doc.save("dynamic-information-saver-graph.pdf");
  } catch (error) {
    console.error("PDF export failed", error);
    alert("Unable to generate PDF. Please try again.");
  }
}

function setReportVisible(isVisible) {
  reportVisible = isVisible;
  elements.reportDrawer.classList.toggle("is-open", isVisible);
  elements.reportDrawer.setAttribute("aria-hidden", String(!isVisible));

  if (isVisible) {
    renderGraph();
  }
}

function openReport() {
  setReportVisible(true);
}

function closeReport() {
  setReportVisible(false);
}

function downloadPDF() {
  if (!tableState || !window.jspdf || !window.jspdf.jsPDF) {
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: tableState.columns > 5 ? "landscape" : "portrait",
    unit: "pt",
    format: "a4",
  });

  try {
    drawSimplePdfTable(doc, buildExportRows());
  } catch {
    doc.setFontSize(12);
    doc.text("Unable to render table layout, but the export file was still created.", 40, 60);
  }

  doc.save("dynamic-information-saver.pdf");
}

function resetTable() {
  tableState = null;
  localStorage.removeItem(STORAGE_KEY);
  elements.rows.value = 3;
  elements.columns.value = 3;
  closeReport();
  renderTable();
}

function initialize() {
  if (tableState && tableState.rows && tableState.columns) {
    elements.rows.value = String(tableState.rows);
    elements.columns.value = String(tableState.columns);
  }

  renderTable();
}

elements.generateBtn.addEventListener("click", generateTable);
elements.resetBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to reset this data? This will delete the current table.")) {
    resetTable();
  }
});
if (elements.saveDbBtn) {
  elements.saveDbBtn.addEventListener("click", saveToDatabase);
}
elements.saveBtn.addEventListener("click", saveToExcel);
elements.downloadBtn.addEventListener("click", downloadPDF);
elements.saveGraphBtn.addEventListener("click", exportGraphPdf);
elements.reportBtn.addEventListener("click", openReport);
elements.closeReportBtn.addEventListener("click", closeReport);
elements.addRowBtn.addEventListener("click", addRow);
elements.addColumnBtn.addEventListener("click", addColumn);
elements.deleteRowBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete the last row?")) {
    deleteRow();
  }
});
elements.deleteColumnBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to delete the last column?")) {
    deleteColumn();
  }
});
elements.search.addEventListener("input", applySearchFilter);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && reportVisible) {
    closeReport();
  }
});

initialize();
