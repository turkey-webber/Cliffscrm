import { slugId, type Company, type CompanyBadge } from "./data";

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

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(splitCsvLine);
  return { headers, rows };
}

function col(headers: string[], row: string[], names: string[]): string {
  for (const name of names) {
    const idx = headers.findIndex((h) => h === name || h.includes(name));
    if (idx >= 0 && row[idx]) return row[idx].trim();
  }
  return "";
}

function badgesFromRow(headers: string[], row: string[]): CompanyBadge[] {
  const badges: CompanyBadge[] = [];
  const blob = `${col(headers, row, ["type", "status", "badge", "category"])} ${col(headers, row, ["notes"])}`.toLowerCase();
  if (/first.?year|new client/.test(blob)) badges.push("first-year");
  if (/missing/.test(blob)) badges.push("missing");
  if (/jackpot/.test(blob)) badges.push("jackpot");
  if (/prospect/.test(blob)) badges.push("prospect");
  if (/customer|active|client/.test(blob) && !badges.includes("first-year")) badges.push("active");
  if (!badges.length) badges.push("prospect");
  return badges;
}

/** Map flexible Express-style export columns into companies. Never invent phones. */
export function companiesFromCsv(text: string, fileName: string): { companies: Company[]; imported: number; skipped: number } {
  const { headers, rows } = parseCsv(text);
  if (!headers.length) return { companies: [], imported: 0, skipped: 0 };
  const companies: Company[] = [];
  let skipped = 0;
  for (const row of rows) {
    const name = col(headers, row, ["company", "company name", "account", "name"]);
    if (!name) {
      skipped++;
      continue;
    }
    const phone = col(headers, row, ["phone", "main phone", "telephone", "mobile"]);
    const city = col(headers, row, ["city", "town"]);
    const address = col(headers, row, ["address", "street", "addr"]);
    const contactName = col(headers, row, ["contact", "contact name", "rep", "decision maker"]);
    const contactTitle = col(headers, row, ["title", "contact title"]);
    const territory = col(headers, row, ["territory", "terr", "zone"]) || "";
    const lastBilled = col(headers, row, ["last billed", "lastbilled", "last bill"]);
    const notes = col(headers, row, ["notes", "note", "comments"]);
    const researchFact = col(headers, row, ["research", "fact"]);
    companies.push({
      id: slugId(name),
      name,
      city,
      address,
      phone, // only if present in file
      contactName,
      contactTitle,
      territory,
      badges: badgesFromRow(headers, row),
      lastBilled: lastBilled || undefined,
      research: researchFact
        ? [
            {
              source: fileName,
              date: new Date().toISOString().slice(0, 10),
              fact: researchFact,
            },
          ]
        : [],
      notes: notes ? `${notes}\nImported from ${fileName} by Cliff` : `Imported from ${fileName} by Cliff`,
      blitzState: "open",
    });
  }
  return { companies, imported: companies.length, skipped };
}
