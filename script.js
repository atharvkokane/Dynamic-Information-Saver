const STORAGE_KEY = "savedTable";

const elements = {
  rows: document.getElementById("rows"),
  columns: document.getElementById("columns"),
  search: document.getElementById("search"),
  generateBtn: document.getElementById("generateBtn"),
  resetBtn: document.getElementById("resetBtn"),
  saveBtn: document.getElementById("saveBtn"),
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
    const score = Math.round(((completeness * 0.48) + ((numericWeight / Math.max(fields.filter((field) => field.type === "numeric").length, 1)) * 0.34) + ((textWeight / Math.max(fields.filter((field) => field.type === "text").length, 1)) * 0.18)) * 100);

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
  insights.push(`Best record: ${report.bestRecord ? `${report.bestRecord.label} at ${report.bestRecord.score}` : "none yet"}.`);

  if (topRecords[0]) {
    insights.push(`Top performer: ${topRecords[0].label} with a score of ${topRecords[0].score}.`);
  }

  if (topRecords[1]) {
    insights.push(`Next strongest record: ${topRecords[1].label} at ${topRecords[1].score}.`);
  }

  if (report.numericFieldCount > 0) {
    insights.push(`${report.numericFieldCount} numeric field(s) contribute to the chart logic.`);
  }

  insights.push(`${report.uniqueCount} unique value(s) appear across the dataset.`);

  elements.reportInsights.innerHTML = insights.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
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
    destroyGraphCharts();
    return;
  }

  destroyGraphCharts();

  const sortedRecords = getSortedRecords(report);
  if (focusedRecordIndex === null || !report.records.some((record) => record.index === focusedRecordIndex)) {
    focusedRecordIndex = report.bestRecord?.index ?? sortedRecords[0]?.index ?? null;
  }

  const focusRecord = getFocusRecord(report, sortedRecords);
  elements.reportStatus.textContent = `${report.rows} person record(s), ${report.columns} field(s), ${formatPercent(report.completionRate)} data filled.`;
  elements.reportMetrics.innerHTML = renderRecordOverview(report, focusRecord);

  renderInsights(report, sortedRecords);
  renderFocusPanel(report, focusRecord);
  renderFocusedChart(focusRecord, sortedRecords.findIndex((record) => record.index === focusRecord?.index));
  renderComparisonChart(report, sortedRecords);
  renderGraphCards(report, sortedRecords);
}

function exportGraphPdf() {
  const report = getReportData();

  if (!report || !window.jspdf || !window.jspdf.jsPDF) {
    return;
  }

  const sortedRecords = getSortedRecords(report);
  const focusRecord = getFocusRecord(report, sortedRecords) || sortedRecords[0];
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 34;
  const contentWidth = pageWidth - margin * 2;

  const drawHeader = (title, subtitleLines) => {
    doc.setFillColor(9, 17, 31);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.setTextColor(255, 255, 255);
    doc.text(title, margin, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(180, 198, 255);
    subtitleLines.forEach((line, index) => {
      doc.text(line, margin, 62 + (index * 14));
    });
  };

  const drawSummaryCard = (x, y, width, label, value, accent) => {
    doc.setFillColor(17, 24, 39);
    doc.setDrawColor(accent[0], accent[1], accent[2]);
    doc.roundedRect(x, y, width, 60, 10, 10, "FD");
    doc.setTextColor(accent[0], accent[1], accent[2]);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(String(label).toUpperCase(), x + 10, y + 16);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text(String(value), x + 10, y + 42);
  };

  const drawRecordGrid = (records, startY) => {
    const cardWidth = (contentWidth - 14) / 2;
    const cardHeight = 110;
    let cardIndex = 0;
    let currentY = startY;

    while (cardIndex < records.length) {
      if (currentY + cardHeight > pageHeight - 34) {
        doc.addPage();
        doc.setFillColor(9, 17, 31);
        doc.rect(0, 0, pageWidth, pageHeight, "F");
        currentY = 34;
      }

      for (let column = 0; column < 2 && cardIndex < records.length; column += 1, cardIndex += 1) {
        const record = records[cardIndex];
        const x = margin + (column * (cardWidth + 14));
        doc.setFillColor(14, 22, 39);
        doc.setDrawColor(37, 99, 235);
        doc.roundedRect(x, currentY, cardWidth, cardHeight, 10, 10, "FD");
        doc.setTextColor(125, 211, 252);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text(record.label, x + 10, currentY + 20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(234, 240, 255);
        doc.text(`Score ${record.score} • ${formatPercent(record.completion)} complete`, x + 10, currentY + 37);

        const chips = record.fields.slice(0, 3).map((field) => `${field.label}: ${field.value || "—"}`);
        doc.setTextColor(180, 198, 255);
        chips.forEach((chip, index) => {
          const lines = doc.splitTextToSize(chip, cardWidth - 20);
          doc.text(lines.slice(0, 2), x + 10, currentY + 52 + (index * 16));
        });
      }

      currentY += cardHeight + 14;
    }
  };

  drawHeader("Dynamic Information Saver - Graph PDF", [
    `Focus record: ${focusRecord ? focusRecord.label : "none"}`,
    `Records: ${report.rows}`,
    `Fields: ${report.columns}`,
    `Filled: ${report.filledCount}`,
  ]);

  const summaryLabels = ["People", "Fields", "Score", "Rate"];
  const summaryValues = [report.rows, report.columns, report.bestRecord ? report.bestRecord.score : 0, formatPercent(report.completionRate)];
  const summaryAccents = [[15, 118, 110], [37, 99, 235], [124, 58, 237], [249, 115, 22]];
  summaryLabels.forEach((label, index) => {
    const x = margin + (index * ((contentWidth - 42) / 4));
    drawSummaryCard(x, 88, (contentWidth - 42) / 4, label, summaryValues[index], summaryAccents[index]);
  });

  const focusImage = canvasToImageData(elements.focusChart);
  if (focusImage) {
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(37, 99, 235);
    doc.roundedRect(margin, 158, contentWidth, 176, 12, 12, "FD");
    doc.addImage(focusImage, "PNG", margin + 10, 168, contentWidth - 20, 156);
  }

  doc.addPage();
  drawHeader("Person Score Comparison", [
    `Best record: ${report.bestRecord ? report.bestRecord.label : "none"}`,
    `Unique values: ${report.uniqueCount}`,
    `Numeric fields: ${report.numericFieldCount}`,
  ]);

  const comparisonImage = canvasToImageData(elements.comparisonChart);
  if (comparisonImage) {
    doc.setFillColor(15, 23, 42);
    doc.setDrawColor(37, 99, 235);
    doc.roundedRect(margin, 88, contentWidth, 196, 12, 12, "FD");
    doc.addImage(comparisonImage, "PNG", margin + 10, 98, contentWidth - 20, 176);
  }

  doc.addPage();
  drawHeader("Person Record Cards", ["Each card mirrors the entered user data in a compact PDF layout."]);
  drawRecordGrid(sortedRecords, 88);

  doc.save("dynamic-information-saver-graph.pdf");
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
  updateGraphSortControl();
}

elements.generateBtn.addEventListener("click", generateTable);
elements.resetBtn.addEventListener("click", resetTable);
elements.saveBtn.addEventListener("click", saveToExcel);
elements.downloadBtn.addEventListener("click", downloadPDF);
elements.saveGraphBtn.addEventListener("click", exportGraphPdf);
elements.reportBtn.addEventListener("click", openReport);
elements.closeReportBtn.addEventListener("click", closeReport);
elements.addRowBtn.addEventListener("click", addRow);
elements.addColumnBtn.addEventListener("click", addColumn);
elements.deleteRowBtn.addEventListener("click", deleteRow);
elements.deleteColumnBtn.addEventListener("click", deleteColumn);
elements.search.addEventListener("input", applySearchFilter);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && reportVisible) {
    closeReport();
  }
});

initialize();
