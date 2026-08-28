let tabId;
let data = { header: [], rows: [] };

const $ = (id) => document.getElementById(id);
const setStatus = (text, error = false) => {
  $("status").textContent = text;
  $("status").style.color = error ? "#d33" : "";
};

async function send(type, extra = {}) {
  return browser.tabs.sendMessage(tabId, { type, ...extra });
}

function render() {
  const table = $("preview");
  table.replaceChildren();
  const header = document.createElement("tr");
  data.header.forEach((name, index) => {
    const cell = document.createElement("th");
    cell.contentEditable = "true";
    cell.textContent = name || `Spalte ${index + 1}`;
    cell.title = "Klicken zum Umbenennen";
    cell.addEventListener("input", () => { data.header[index] = cell.textContent.trim(); });
    header.append(cell);
  });
  table.append(header);
  data.rows.slice(0, 10).forEach((row) => {
    const tr = document.createElement("tr");
    data.header.forEach((_, index) => {
      const td = document.createElement("td");
      td.textContent = row[index] || "";
      tr.append(td);
    });
    table.append(tr);
  });
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const xmlValue = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&apos;");

function createXlsx(rows) {
  const allRows = [data.header, ...rows];
  const sheetRows = allRows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${String.fromCharCode(65 + (columnIndex % 26))}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t>${xmlValue(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const files = [
    ["[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`],
    ["_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Daten" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`],
    ["xl/worksheets/sheet1.xml", `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`]
  ];
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const crc32 = (bytes) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const u16 = (value) => new Uint8Array([value & 255, value >>> 8 & 255]);
  const u32 = (value) => new Uint8Array([value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255]);
  const concat = (parts) => {
    const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
    let position = 0;
    parts.forEach((part) => { result.set(part, position); position += part.length; });
    return result;
  };
  files.forEach(([name, content]) => {
    const nameBytes = encoder.encode(name);
    const bytes = encoder.encode(content);
    const header = concat([new Uint8Array([80, 75, 3, 4, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]), u32(crc32(bytes)), u32(bytes.length), u32(bytes.length), u16(nameBytes.length), u16(0), nameBytes, bytes]);
    chunks.push(header);
    central.push(concat([new Uint8Array([80, 75, 1, 2, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0]), u32(crc32(bytes)), u32(bytes.length), u32(bytes.length), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes]));
    offset += header.length;
  });
  const directory = concat(central);
  return concat([...chunks, directory, new Uint8Array([80, 75, 5, 6, 0, 0, 0, 0]), u16(files.length), u16(files.length), u32(directory.length), u32(offset), u16(0)]);
}

async function exportData(extension) {
  const rows = data.rows.slice(0, Math.max(1, Number($("limit").value) || 1000));
  let content;
  let mimeType;
  if (extension === "csv") {
    content = `\ufeff${[data.header, ...rows].map((row) => row.map(csvValue).join(",")).join("\r\n")}`;
    mimeType = "text/csv;charset=utf-8";
  } else {
    content = createXlsx(rows);
    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `instant-data-scraper-${new Date().toISOString().slice(0, 10)}.${extension === "csv" ? "csv" : "xlsx"}`;
  link.hidden = true;
  document.body.append(link);
  link.click();
  setStatus(`${rows.length} Zeilen exportiert.`);
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 10000);
}

async function detect() {
  try {
    const result = await send("detect");
    if (result?.error) throw new Error(result.error);
    data = { header: result.header || [], rows: result.rows || [] };
    render();
    $("next").disabled = !result.nextAvailable;
    setStatus(`${data.rows.length} Zeilen erkannt auf „${result.title || "Seite"}“.`);
  } catch (error) {
    setStatus(`Seite kann nicht gelesen werden: ${error.message}`, true);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  tabId = tabs[0]?.id;
  $("refresh").addEventListener("click", detect);
  $("scroll").addEventListener("click", async () => {
    setStatus("Lade weitere Inhalte ...");
    const result = await send("scroll", { wait: Number($("wait").value) || 1500 });
    const existing = new Set(data.rows.map((row) => JSON.stringify(row)));
    data.rows = [...data.rows, ...(result.rows || []).filter((row) => !existing.has(JSON.stringify(row)))];
    render();
    setStatus(`${data.rows.length} Zeilen gesammelt.`);
  });
  $("next").addEventListener("click", async () => {
    await send("next");
    setStatus("Nächste Seite wird geladen ...");
    setTimeout(detect, Number($("wait").value) || 1500);
  });
  $("exportCsv").addEventListener("click", () => exportData("csv"));
  $("exportXlsx").addEventListener("click", () => exportData("xls"));
  await detect();
});
