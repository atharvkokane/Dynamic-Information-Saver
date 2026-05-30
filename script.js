const STORAGE_KEY = "savedTable";

const elements = {
  rows: document.getElementById("rows"),
  columns: document.getElementById("columns"),
  search: document.getElementById("search"),
  generateBtn: document.getElementById("generateBtn"),
  resetBtn: document.getElementById("resetBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  addRowBtn: document.getElementById("addRowBtn"),
  addColumnBtn: document.getElementById("addColumnBtn"),
  deleteRowBtn: document.getElementById("deleteRowBtn"),
  deleteColumnBtn: document.getElementById("deleteColumnBtn"),
  tableContainer: document.getElementById("table-container"),
  statusText: document.getElementById("statusText"),
};

let tableState = loadState();

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
    elements.downloadBtn.hidden = true;
    updateStatus();
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
  elements.downloadBtn.hidden = false;
  wireTableEvents();
  applySearchFilter();
  updateStatus();
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

  // Build PDF table with a leading row-number column
  const pdfHeaders = ["#", ...tableState.headers.map((h) => h || "")];
  const pdfBody = tableState.rowsData.map((row, idx) => [String(idx + 1), ...row.map((cell) => cell || "")]);

  doc.text("Dynamic Information Saver", 40, 30);
  doc.autoTable({
    head: [pdfHeaders],
    body: pdfBody,
    startY: 45,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 4,
      lineColor: [0, 0, 0],
      lineWidth: 0.8,
    },
    headStyles: {
      fillColor: [0, 123, 255],
      textColor: 255,
      lineColor: [0, 0, 0],
      lineWidth: 0.8,
    },
    bodyStyles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.8,
    },
    columnStyles: {
      0: { fillColor: [0, 123, 255], textColor: 255, halign: 'center' },
    },
  });

  // Draw an emphasized outer border around the table to ensure it's visible
  const last = doc.lastAutoTable;
  if (last && last.table) {
    const startX = last.table.startX || 40;
    const tableWidth = last.table.width || (doc.internal.pageSize.getWidth() - startX - 40);
    const tableTop = 45;
    const tableBottom = last.finalY || (tableTop + (last.table.height || 0));
    doc.setLineWidth(1.8);
    doc.setDrawColor(0, 0, 0);
    doc.rect(startX, tableTop - 2, tableWidth, tableBottom - tableTop + 4);
  }

  doc.save("dynamic-information-saver.pdf");
}

function resetTable() {
  tableState = null;
  localStorage.removeItem(STORAGE_KEY);
  elements.rows.value = 3;
  elements.columns.value = 3;
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
elements.resetBtn.addEventListener("click", resetTable);
elements.downloadBtn.addEventListener("click", downloadPDF);
elements.addRowBtn.addEventListener("click", addRow);
elements.addColumnBtn.addEventListener("click", addColumn);
elements.deleteRowBtn.addEventListener("click", deleteRow);
elements.deleteColumnBtn.addEventListener("click", deleteColumn);
elements.search.addEventListener("input", applySearchFilter);

initialize();
