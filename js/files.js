// LUXION AI - file analysis.
// Everything here runs in YOUR browser. A file is read and turned into text (or a resized image)
// locally. Nothing is sent anywhere until you press Send, and uploaded files are never executed
// or stored by LUXION.

export const MAX_CHARS = 30000; // max characters of file text sent to the AI
const MB = 1024 * 1024;
const MAX_PDF_PAGES = 60;
const IMAGE_MAX_SIDE = 1568;

// pdf.js is loaded only when a PDF is attached (pinned version from jsDelivr)
export const pdfConfig = {
  base: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/"
};

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "log", "js", "mjs", "ts", "tsx", "jsx", "py", "java", "c", "h", "cpp", "hpp",
  "cs", "go", "rs", "php", "rb", "swift", "kt", "html", "htm", "css", "sql", "sh", "xml", "yaml", "yml", "toml", "ini"
]);
const IMAGE_EXT = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

const LIMITS = { text: 2 * MB, csv: 5 * MB, json: 5 * MB, pdf: 15 * MB, image: 10 * MB };

export const ACCEPT = [
  ".txt,.md,.markdown,.log,.csv,.json,.pdf,.png,.jpg,.jpeg,.webp",
  ".js,.mjs,.ts,.tsx,.jsx,.py,.java,.c,.h,.cpp,.hpp,.cs,.go,.rs,.php,.rb,.swift,.kt",
  ".html,.htm,.css,.sql,.sh,.xml,.yaml,.yml,.toml,.ini"
].join(",");

export function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < MB) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / MB).toFixed(1) + " MB";
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

function cleanName(name) {
  return String(name).replace(/[\r\n]+/g, " ").slice(0, 100);
}

// Returns { ok: true, kind } or { ok: false, error }
export function validateFile(file) {
  const ext = extOf(file.name);
  let kind = null;
  if (ext === "csv") kind = "csv";
  else if (ext === "json") kind = "json";
  else if (ext === "pdf") kind = "pdf";
  else if (IMAGE_EXT[ext]) kind = "image";
  else if (TEXT_EXT.has(ext)) kind = "text";

  if (!kind) {
    return { ok: false, error: "Unsupported file type (." + (ext || "none") + "). Supported: text, Markdown, CSV, JSON, PDF, PNG/JPG/WebP images and common source-code files." };
  }
  if (file.size === 0) return { ok: false, error: "This file is empty." };
  if (file.size > LIMITS[kind]) {
    return { ok: false, error: "This file is too large (" + formatSize(file.size) + "). The limit for this type is " + formatSize(LIMITS[kind]) + "." };
  }
  return { ok: true, kind };
}

function looksBinary(s) {
  const head = s.slice(0, 4000);
  if (head.includes("\u0000")) return true;
  let bad = 0;
  for (let i = 0; i < head.length; i++) if (head[i] === "�") bad++;
  return head.length > 0 && bad / head.length > 0.1;
}

function clip(text, max, warnings) {
  if (text.length <= max) return text;
  warnings.push("Only the first " + max.toLocaleString() + " characters were used.");
  return text.slice(0, max);
}

// ---------------- CSV ----------------
export function detectDelimiter(text) {
  const firstLine = text.split("\n", 1)[0] || "";
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t", "|"]) {
    let count = 0;
    let inQ = false;
    for (const ch of firstLine) {
      if (ch === '"') inQ = !inQ;
      else if (ch === d && !inQ) count++;
    }
    if (count > bestCount) {
      best = d;
      bestCount = count;
    }
  }
  return best;
}

// Small RFC-4180 style parser (quoted fields, escaped quotes, newlines inside quotes)
export function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQ = false;
      } else field += ch;
    } else if (ch === '"' && field === "") inQ = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1].every((v) => v.trim() === "")) rows.pop();
  return { rows, unbalancedQuote: inQ };
}

function fmtNum(n) {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

export function summarizeCsv(rawText) {
  const warnings = [];
  const text = rawText.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const { rows, unbalancedQuote } = parseCsv(text, delimiter);
  if (rows.length === 0) throw new Error("This CSV file has no data.");
  if (unbalancedQuote) warnings.push("The CSV has an unclosed quote, so the last row may be wrong.");

  const header = rows[0].map((h, i) => (h.trim() ? h.trim() : "column " + (i + 1)));
  const data = rows.slice(1);
  const cols = header.length;
  let ragged = 0;
  for (const r of data) if (r.length !== cols) ragged++;
  if (ragged) warnings.push(ragged + " row(s) have a different number of columns than the header.");

  const lines = [];
  const delimName = { ",": "comma", ";": "semicolon", "\t": "tab", "|": "pipe" }[delimiter];
  lines.push("CSV summary: " + data.length.toLocaleString() + " data rows x " + cols + " columns (delimiter: " + delimName + ")");
  lines.push("Columns:");
  for (let c = 0; c < cols; c++) {
    let empty = 0;
    let numeric = 0;
    let nonEmpty = 0;
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    const counts = new Map();
    for (const r of data) {
      const v = (r[c] ?? "").trim();
      if (v === "") {
        empty++;
        continue;
      }
      nonEmpty++;
      const n = Number(v);
      if (Number.isFinite(n)) {
        numeric++;
        if (n < min) min = n;
        if (n > max) max = n;
        sum += n;
      }
      if (counts.size < 5000 || counts.has(v)) counts.set(v, (counts.get(v) || 0) + 1);
    }
    let desc;
    if (nonEmpty > 0 && numeric / nonEmpty >= 0.9) {
      desc = "number: min " + fmtNum(min) + ", max " + fmtNum(max) + ", mean " + fmtNum(sum / numeric);
    } else {
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => '"' + v.replace(/\s+/g, " ").slice(0, 30) + '" x' + n);
      desc = "text: " + counts.size + (counts.size >= 5000 ? "+" : "") + " unique" + (top.length ? ", most common " + top.join(", ") : "");
    }
    lines.push("- " + header[c] + " (" + desc + (empty ? "; " + empty + " empty" : "") + ")");
  }
  lines.push("");
  lines.push("First rows (cells separated by |):");
  const shown = rows.slice(0, 26);
  for (const r of shown) lines.push(r.map((v) => v.replace(/\s+/g, " ").slice(0, 80)).join(" | "));
  if (rows.length > shown.length) lines.push("... (" + (rows.length - shown.length) + " more rows not shown)");

  return {
    text: clip(lines.join("\n"), MAX_CHARS, warnings),
    label: data.length.toLocaleString() + " rows x " + cols + " columns",
    warnings
  };
}

// ---------------- JSON ----------------
function typeOf(v) {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function describe(v, depth, key, lines, pad) {
  const t = typeOf(v);
  const label = key === null ? "" : key + ": ";
  if (t === "object") {
    const keys = Object.keys(v);
    lines.push(pad + label + "object (" + keys.length + " keys)");
    if (depth >= 4) return;
    for (const k of keys.slice(0, 30)) describe(v[k], depth + 1, k, lines, pad + "  ");
    if (keys.length > 30) lines.push(pad + "  ... " + (keys.length - 30) + " more keys");
  } else if (t === "array") {
    lines.push(pad + label + "array (" + v.length + " items)");
    if (v.length && depth < 4) describe(v[0], depth + 1, "first item", lines, pad + "  ");
  } else {
    lines.push(pad + label + t);
  }
}

export function summarizeJson(rawText) {
  const warnings = [];
  let parsed;
  try {
    parsed = JSON.parse(rawText.replace(/^﻿/, ""));
  } catch (e) {
    throw new Error("This is not valid JSON: " + e.message);
  }
  const lines = [];
  describe(parsed, 0, null, lines, "");
  const outline = "JSON structure:\n" + lines.join("\n") + "\n\nContent:\n";
  const body = JSON.stringify(parsed, null, 2);
  const room = Math.max(1000, MAX_CHARS - outline.length);
  let excerpt = body;
  if (body.length > room) {
    excerpt = body.slice(0, room);
    warnings.push("Only the first part of the JSON content was used.");
  }
  const t = typeOf(parsed);
  const label = t === "array" ? "JSON array, " + parsed.length + " items" : t === "object" ? "JSON object, " + Object.keys(parsed).length + " keys" : "JSON " + t;
  return { text: outline + excerpt, label, warnings };
}

// ---------------- PDF ----------------
let pdfLib = null;

async function loadPdfjs() {
  if (pdfLib) return pdfLib;
  const lib = await import(/* webpackIgnore: true */ pdfConfig.base + "pdf.min.mjs");
  const workerUrl = pdfConfig.base + "pdf.worker.min.mjs";
  try {
    // Cross-origin workers are blocked, so wrap the worker script in a same-origin blob.
    const res = await fetch(workerUrl);
    if (!res.ok) throw new Error("worker fetch failed");
    const blob = new Blob([await res.text()], { type: "text/javascript" });
    lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  } catch {
    lib.GlobalWorkerOptions.workerSrc = workerUrl; // pdf.js falls back to running without a worker
  }
  pdfLib = lib;
  return lib;
}

async function extractPdf(file, onProgress) {
  const warnings = [];
  let lib;
  try {
    lib = await loadPdfjs();
  } catch {
    throw new Error("Could not load the PDF reader. PDF reading needs an internet connection.");
  }
  let pdf;
  try {
    pdf = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch (e) {
    if (e && e.name === "PasswordException") throw new Error("This PDF is password-protected. Remove the password and try again.");
    throw new Error("This file is not a valid PDF, or it is corrupted.");
  }
  const total = pdf.numPages;
  const pages = Math.min(total, MAX_PDF_PAGES);
  let text = "";
  for (let p = 1; p <= pages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items.map((it) => it.str + (it.hasEOL ? "\n" : " ")).join("").replace(/[ \t]+\n/g, "\n").trim();
    if (pageText) text += "\n--- Page " + p + " ---\n" + pageText + "\n";
    onProgress(p / pages, "Reading page " + p + " of " + pages);
    if (text.length > MAX_CHARS) break;
  }
  if (total > pages) warnings.push("Only the first " + pages + " of " + total + " pages were read.");
  text = text.trim();
  if (!text) {
    throw new Error("No selectable text was found in this PDF (it may be a scan). Try attaching a screenshot or photo of the page instead.");
  }
  return { text: clip(text, MAX_CHARS, warnings), label: total + " page" + (total === 1 ? "" : "s"), warnings };
}

// ---------------- Images ----------------
async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to <img> */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("bad image"));
    };
    img.src = url;
  });
}

async function prepareImage(file) {
  let bmp;
  try {
    bmp = await loadBitmap(file);
  } catch {
    throw new Error("Could not read this image. It may be corrupted or in an unsupported format.");
  }
  const w = bmp.width;
  const h = bmp.height;
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // transparent PNGs become white
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  let dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  if (dataUrl.length > 4.5 * MB) dataUrl = canvas.toDataURL("image/jpeg", 0.6);
  if (dataUrl.length > 5 * MB) throw new Error("This image is too large even after resizing.");
  return { dataUrl, data: dataUrl.split(",")[1], width: canvas.width, height: canvas.height };
}

// ---------------- Main entry ----------------
// Returns an attachment: { name, size, kind, label, warnings, text?, image?, preview? }
export async function processFile(file, onProgress = () => {}) {
  const v = validateFile(file);
  if (!v.ok) throw new Error(v.error);
  const name = cleanName(file.name);
  const base = { name, size: file.size, kind: v.kind, warnings: [] };

  if (v.kind === "image") {
    onProgress(0.3, "Preparing image...");
    const img = await prepareImage(file);
    onProgress(1, "Ready");
    return { ...base, label: img.width + " x " + img.height + " image", image: { mimeType: "image/jpeg", data: img.data }, preview: img.dataUrl };
  }

  if (v.kind === "pdf") {
    const r = await extractPdf(file, onProgress);
    return { ...base, ...r };
  }

  onProgress(0.3, "Reading file...");
  const raw = await file.text(); // read as text only; never executed or rendered as HTML
  if (looksBinary(raw)) throw new Error("This file looks like binary data, not text.");
  onProgress(0.7, "Analyzing...");

  let result;
  if (v.kind === "csv") result = summarizeCsv(raw);
  else if (v.kind === "json") result = summarizeJson(raw);
  else {
    const warnings = [];
    const text = clip(raw, MAX_CHARS, warnings);
    result = { text, label: raw.split("\n").length.toLocaleString() + " lines", warnings };
  }
  onProgress(1, "Ready");
  return { ...base, ...result };
}

// ---------------- Message helpers ----------------
export function buildFileBlock(att) {
  if (att.kind === "image") return "[Image attached: " + att.name + "]";
  let block = "----- BEGIN ATTACHED FILE: " + att.name + " (" + att.kind + ") -----\n" + att.text + "\n----- END ATTACHED FILE -----";
  if (att.warnings && att.warnings.length) block += "\nNote: " + att.warnings.join(" ");
  return block;
}

// Short note saved in chat history instead of the file contents
export function attachmentMarker(att) {
  return (att.kind === "image" ? "[Image attached: " : "[File attached: ") + att.name + "]";
}
