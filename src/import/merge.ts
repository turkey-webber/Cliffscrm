import { slugId, type Company, type CompanyBadge } from "../data";
import type { DropFileMeta, ImportBatchResult, ImportRole, ParsedTable, RecallFact } from "./types";
import { ROLE_LABEL } from "./classify";
import { selectNewestByRole } from "./newest";
import { parseBrowserFile, parseFileBytes } from "./parse";

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

function companiesFromTable(table: ParsedTable, fileName: string, role: ImportRole): { companies: Company[]; skipped: number } {
  if (!table.headers.length) return { companies: [], skipped: 0 };
  const companies: Company[] = [];
  let skipped = 0;
  for (const row of table.rows) {
    const name = col(table.headers, row, ["company", "company name", "account", "name", "stop", "business"]);
    if (!name || /^(company|name|account)$/i.test(name)) {
      skipped++;
      continue;
    }
    const phone = col(table.headers, row, ["phone", "main phone", "telephone", "mobile"]);
    const city = col(table.headers, row, ["city", "town"]);
    const address = col(table.headers, row, ["address", "street", "addr"]);
    const contactName = col(table.headers, row, ["contact", "contact name", "rep", "decision maker"]);
    const contactTitle = col(table.headers, row, ["title", "contact title"]);
    const territory = col(table.headers, row, ["territory", "terr", "zone"]) || "";
    const lastBilled = col(table.headers, row, ["last billed", "lastbilled", "last bill"]);
    const notes = col(table.headers, row, ["notes", "note", "comments"]);
    const researchFact = col(table.headers, row, ["research", "fact"]);
    companies.push({
      id: slugId(name),
      name,
      city,
      address,
      phone,
      contactName,
      contactTitle,
      territory,
      badges: badgesFromRow(table.headers, row),
      lastBilled: lastBilled || undefined,
      research: researchFact
        ? [{ source: fileName, date: new Date().toISOString().slice(0, 10), fact: researchFact }]
        : [],
      notes: notes
        ? `${notes}\nImported ${ROLE_LABEL[role]} · ${fileName}`
        : `Imported ${ROLE_LABEL[role]} · ${fileName}`,
      blitzState: "open",
    });
  }
  return { companies, skipped };
}

function factsFromText(text: string, fileName: string, role: ImportRole): RecallFact[] {
  const facts: RecallFact[] = [];
  const date = new Date().toISOString().slice(0, 10);
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Title-like first heading as company hint for research md files
  let companyHint = fileName.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  const heading = lines.find((l) => /^#\s+/.test(l));
  if (heading) companyHint = heading.replace(/^#\s+/, "").trim();

  const bulletFacts = lines.filter((l) => /^[-*•]/.test(l) || /hiring|posted|opening|role|warehouse|order|callback/i.test(l));
  for (const line of bulletFacts.slice(0, 12)) {
    const fact = line.replace(/^[-*•]\s*/, "").trim();
    if (fact.length < 8) continue;
    facts.push({
      id: `fact-${Math.random().toString(36).slice(2, 9)}`,
      companyHint,
      fact,
      source: fileName,
      date,
      role,
    });
  }
  if (!facts.length && text.trim().length > 40) {
    facts.push({
      id: `fact-${Math.random().toString(36).slice(2, 9)}`,
      companyHint,
      fact: text.trim().slice(0, 400),
      source: fileName,
      date,
      role,
    });
  }
  return facts;
}

/** Planner Word docs: pull company-ish lines into light company stubs for Today. */
function companiesFromPlannerText(text: string, fileName: string): Company[] {
  const companies: Company[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    // "1. Acme Corp — Montgomery" or "Stop: Acme"
    const m =
      line.match(/^\d+[.)]\s*([^—|]+)(?:[—|]\s*(.+))?/) ||
      line.match(/^(?:stop|company|visit)\s*[:-]\s*(.+)$/i);
    if (!m) continue;
    const name = (m[1] || "").trim();
    if (!name || name.length < 3 || name.length > 80) continue;
    const city = (m[2] || "").trim();
    companies.push({
      id: slugId(name),
      name,
      city,
      address: "",
      phone: "",
      contactName: "",
      contactTitle: "",
      territory: "",
      badges: ["prospect"],
      research: [],
      notes: `Sales planner stop · ${fileName}`,
      blitzState: "open",
    });
  }
  return companies;
}

function mergeCompanies(prev: Company[], incoming: Company[]): Company[] {
  const byName = new Map(prev.map((c) => [c.name.toLowerCase().replace(/\s*\(demo\)\s*$/i, ""), c]));
  for (const c of incoming) {
    const key = c.name.toLowerCase().replace(/\s*\(demo\)\s*$/i, "");
    const existing = byName.get(key);
    if (existing) {
      byName.set(key, {
        ...existing,
        phone: c.phone || existing.phone,
        city: c.city || existing.city,
        address: c.address || existing.address,
        contactName: c.contactName || existing.contactName,
        contactTitle: c.contactTitle || existing.contactTitle,
        territory: c.territory || existing.territory,
        lastBilled: c.lastBilled || existing.lastBilled,
        notes: [existing.notes, c.notes].filter(Boolean).join("\n"),
        research: [...existing.research, ...c.research],
        badges: Array.from(new Set([...existing.badges, ...c.badges])),
      });
    } else {
      byName.set(key, c);
    }
  }
  return Array.from(byName.values());
}

function applyFacts(companies: Company[], facts: RecallFact[]): Company[] {
  return companies.map((c) => {
    const key = c.name.toLowerCase();
    const matched = facts.filter((f) => {
      const hint = f.companyHint.toLowerCase();
      return key.includes(hint) || hint.includes(key.replace(/\s*\(demo\)\s*$/i, "")) || hint.split(/\s+/).some((w) => w.length > 3 && key.includes(w));
    });
    if (!matched.length) return c;
    const research = [
      ...c.research,
      ...matched.map((f) => ({ source: f.source, date: f.date, fact: f.fact })),
    ];
    return { ...c, research };
  });
}

export type IngestItem = {
  meta: DropFileMeta;
  table: ParsedTable;
};

export function ingestParsed(
  items: IngestItem[],
  existingCompanies: Company[],
  existingFacts: RecallFact[],
): ImportBatchResult {
  const newest = selectNewestByRole(items.map((i) => i.meta));
  const newestIds = new Set(newest.map((f) => f.id));
  const pruned = items.map((i) => i.meta).filter((m) => !newestIds.has(m.id)).length;

  let companies: Company[] = [];
  let facts: RecallFact[] = [];
  let skipped = 0;
  const used: DropFileMeta[] = [];

  for (const item of items) {
    if (!newestIds.has(item.meta.id)) continue;
    used.push({ ...item.meta, kept: true });
    const { table, meta } = item;
    if (meta.role === "blitz_research" || meta.role === "script_library" || meta.role === "expeditor_inbox") {
      facts.push(...factsFromText(table.text, meta.name, meta.role));
    }
    if (meta.role === "sales_planner") {
      const fromTable = companiesFromTable(table, meta.name, meta.role);
      companies.push(...fromTable.companies);
      skipped += fromTable.skipped;
      if (!fromTable.companies.length) companies.push(...companiesFromPlannerText(table.text, meta.name));
      continue;
    }
    if (meta.role === "contact_summary" || meta.role === "blitz_list" || meta.role === "other") {
      const fromTable = companiesFromTable(table, meta.name, meta.role);
      companies.push(...fromTable.companies);
      skipped += fromTable.skipped;
      if (!fromTable.companies.length && table.text) {
        facts.push(...factsFromText(table.text, meta.name, meta.role));
      }
    }
  }

  const merged = applyFacts(mergeCompanies(existingCompanies, companies), [...existingFacts, ...facts]);
  const stamp = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
  const log = `Imported ${used.length} newest file(s) · ${companies.length} rows · ${facts.length} recall facts · pruned ${pruned} older · ${stamp} CT`;

  return {
    companies: merged,
    facts: [...existingFacts, ...facts],
    files: used,
    imported: companies.length,
    skipped,
    log,
    pruned,
  };
}

export async function ingestBrowserFiles(
  files: FileList | File[],
  existingCompanies: Company[],
  existingFacts: RecallFact[],
  classify: (name: string, mime: string, text: string) => ImportRole,
): Promise<ImportBatchResult> {
  const list = Array.from(files);
  const items: IngestItem[] = [];
  for (const file of list) {
    const table = await parseBrowserFile(file);
    const role = classify(file.name, file.type, table.text || table.headers.join(" "));
    items.push({
      meta: {
        id: `up-${file.name}-${file.lastModified}-${file.size}`,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        modifiedTime: file.lastModified || Date.now(),
        size: file.size,
        role,
        source: "upload",
        kept: true,
      },
      table,
    });
  }
  return ingestParsed(items, existingCompanies, existingFacts);
}

export async function ingestDrivePayload(
  files: {
    id: string;
    name: string;
    mimeType: string;
    modifiedTime: string;
    size?: number;
    contentBase64: string;
  }[],
  existingCompanies: Company[],
  existingFacts: RecallFact[],
  classify: (name: string, mime: string, text: string) => ImportRole,
): Promise<ImportBatchResult> {
  const items: IngestItem[] = [];
  for (const f of files) {
    const binary = Uint8Array.from(atob(f.contentBase64), (c) => c.charCodeAt(0));
    const table = await parseFileBytes(f.name, f.mimeType, binary.buffer);
    const role = classify(f.name, f.mimeType, table.text || table.headers.join(" "));
    items.push({
      meta: {
        id: `drv-${f.id}`,
        name: f.name,
        mimeType: f.mimeType,
        modifiedTime: Date.parse(f.modifiedTime) || Date.now(),
        size: f.size,
        role,
        source: "drive",
        driveFileId: f.id,
        kept: true,
      },
      table,
    });
  }
  return ingestParsed(items, existingCompanies, existingFacts);
}
