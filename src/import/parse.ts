import * as XLSX from "xlsx";
import mammoth from "mammoth";
import type { ParsedTable } from "./types";

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function parseCsvText(text: string): ParsedTable {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim());
  if (!lines.length) return { headers: [], rows: [], text };
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(splitCsvLine);
  return { headers, rows, text };
}

function sheetToTable(wb: XLSX.WorkBook): ParsedTable {
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return parseCsvText(csv);
}

async function parsePdf(buffer: ArrayBuffer): Promise<ParsedTable> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(
        content.items
          .map((it) => ("str" in it ? String((it as { str: string }).str) : ""))
          .join(" "),
      );
    }
    const text = parts.join("\n");
    const table = parseCsvText(text);
    if (table.headers.length >= 2) return { ...table, text };
    return { headers: [], rows: [], text };
  } catch {
    return { headers: [], rows: [], text: "" };
  }
}

export async function parseFileBytes(
  name: string,
  mimeType: string,
  buffer: ArrayBuffer,
): Promise<ParsedTable> {
  const lower = name.toLowerCase();
  const mime = mimeType.toLowerCase();

  if (lower.endsWith(".csv") || mime.includes("csv") || mime === "text/plain") {
    return parseCsvText(new TextDecoder().decode(buffer));
  }
  if (lower.endsWith(".md") || mime.includes("markdown")) {
    const text = new TextDecoder().decode(buffer);
    return { headers: [], rows: [], text };
  }
  if (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    mime.includes("spreadsheet") ||
    mime.includes("excel")
  ) {
    const wb = XLSX.read(buffer, { type: "array" });
    return sheetToTable(wb);
  }
  if (lower.endsWith(".docx") || mime.includes("wordprocessingml") || mime.includes("msword")) {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    const text = result.value || "";
    // Word planners often use line/tab tables — try CSV heuristic
    const asCsv = parseCsvText(
      text
        .split(/\n+/)
        .map((l) => l.replace(/\t+/g, ",").trim())
        .filter(Boolean)
        .join("\n"),
    );
    if (asCsv.headers.length >= 2 && asCsv.rows.length) return { ...asCsv, text };
    return { headers: [], rows: [], text };
  }
  if (lower.endsWith(".pdf") || mime.includes("pdf")) {
    return parsePdf(buffer);
  }
  // Fallback: treat as text
  try {
    const text = new TextDecoder().decode(buffer);
    return parseCsvText(text);
  } catch {
    return { headers: [], rows: [], text: "" };
  }
}

export async function parseBrowserFile(file: File): Promise<ParsedTable> {
  const buffer = await file.arrayBuffer();
  return parseFileBytes(file.name, file.type, buffer);
}
