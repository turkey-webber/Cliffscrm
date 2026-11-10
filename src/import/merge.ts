import {
  matchCompany,
  normalizeCompanyName,
  slugId,
  type Company,
  type CompanyBadge,
} from "../data";
import type { DropFileMeta, ImportBatchResult, ImportRole, ParsedTable, RecallFact } from "./types";
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
  const typeBlob = col(headers, row, ["type", "status", "badge", "category"]).toLowerCase();
  const notesBlob = col(headers, row, ["notes"]).toLowerCase();
  const countsAsNew = col(headers, row, ["counts as new", "counts"]).toLowerCase();
  const blob = `${typeBlob} ${notesBlob}`;
  if (/first.?year|new client/.test(blob)) badges.push("first-year");
  if (/missing/.test(blob)) badges.push("missing");
  if (/jackpot|flagged/.test(blob) || /^yes$/i.test(col(headers, row, ["flagged (**)", "flagged"]))) {
    badges.push("jackpot");
  }
  if (/prospect/.test(blob)) badges.push("prospect");
  if (/customer|active/.test(blob) && !badges.includes("first-year") && !badges.includes("missing")) {
    badges.push("active");
  }
  // 2x path: New first-year, or Missing with Counts as new = Yes (6+ months unbilled)
  if (/^yes$/i.test(countsAsNew) || badges.includes("first-year")) {
    if (!badges.includes("first-year") && badges.includes("missing")) {
      /* keep missing; is2x() treats first-year + missing specially via lastBilled */
    }
  }
  if (!badges.length) badges.push("prospect");
  return badges;
}

function parseContactsBlob(blob: string): { contactName: string; contactTitle: string; phone: string } {
  // cliffs-crm-companies: "Jason Hamond; General Manager; (334) 264-7336; email"
  const parts = blob
    .split("|")[0]
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  const contactName = parts[0] || "";
  const contactTitle = parts[1] || "";
  const phonePart = parts.find((p) => /\(?\d{3}\)?/.test(p)) || "";
  return { contactName, contactTitle, phone: phonePart };
}

function parseSiteCity(site: string): { address: string; city: string } {
  // "3013 Hayneville Rd Montgomery" → address + city guess
  const m = site.match(/^(.*)\s+(Montgomery|Prattville|Wetumpka|Tallassee|Millbrook|Hope Hull|Chapman|Elmore|Maplesville|Greeley|Clanton|Troy|Tuskegee|Selma)\s*$/i);
  if (m) return { address: m[1].trim(), city: m[2] };
  return { address: site, city: "" };
}

function companiesFromContactSummary(table: ParsedTable, fileName: string): { companies: Company[]; skipped: number } {
  if (!table.headers.length) return { companies: [], skipped: 0 };
  const companies: Company[] = [];
  let skipped = 0;
  const headerBlob = table.headers.join(" ").toLowerCase();
  const isTerritoryLeads = /hiring signal|call reason|talking point|in system/.test(headerBlob);

  for (const row of table.rows) {
    const name = col(table.headers, row, [
      "company name",
      "company",
      "client name",
      "account",
      "account name",
      "name",
      "business",
      "customer",
    ]);
    if (!name || /^(company|name|account|company name)$/i.test(name)) {
      skipped++;
      continue;
    }

    let phone = col(table.headers, row, [
      "company phone",
      "phone",
      "main phone",
      "telephone",
      "mobile",
      "primary phone",
      "hq phone",
    ]);
    let city = col(table.headers, row, ["city", "town"]);
    let address = col(table.headers, row, [
      "site address",
      "address",
      "street",
      "addr",
      "address 1",
    ]);
    let contactName = col(table.headers, row, [
      "company rep name",
      "decision maker name",
      "contact",
      "contact name",
      "rep",
      "decision maker",
      "primary contact",
    ]);
    let contactTitle = col(table.headers, row, [
      "company rep title",
      "title",
      "contact title",
      "job title",
    ]);
    const territory = col(table.headers, row, ["territory", "terr", "zone", "area", "county"]) || "";
    const lastBilled = col(table.headers, row, [
      "date last billed",
      "date last bill",
      "last billed",
      "lastbilled",
      "last bill",
      "last activity",
    ]);
    const lastContacted = col(table.headers, row, [
      "last contacted",
      "date last contacted",
      "last contact",
    ]);
    const nextTouch = col(table.headers, row, ["next scheduled", "scheduled date", "scheduled date/time"]);
    const notes =
      col(table.headers, row, [
        "notes (sales planner goals)",
        "talking point / ask",
        "call reason",
        "hiring signal + date",
        "notes",
        "note",
        "comments",
        "goals",
      ]) || "";

    const contactsBlob = col(table.headers, row, ["contacts (name", "contacts"]);
    if (contactsBlob && (!contactName || !phone)) {
      const parsed = parseContactsBlob(contactsBlob);
      contactName = contactName || parsed.contactName;
      contactTitle = contactTitle || parsed.contactTitle;
      phone = phone || parsed.phone;
    }
    if (!city && address) {
      const site = parseSiteCity(address);
      address = site.address || address;
      city = site.city;
    }
    if (!city) city = col(table.headers, row, ["city"]) || "";

    const research: Company["research"] = [];
    if (isTerritoryLeads) {
      const fact = [
        col(table.headers, row, ["hiring signal + date", "hiring signal"]),
        col(table.headers, row, ["talking point / ask", "talking point"]),
        col(table.headers, row, ["call reason"]),
      ]
        .filter(Boolean)
        .join(" · ");
      const source = col(table.headers, row, ["sources", "source"]) || fileName;
      if (fact) {
        research.push({
          source: source.split(";")[0].trim().slice(0, 120),
          date: new Date().toISOString().slice(0, 10),
          fact: fact.slice(0, 500),
        });
      }
    }

    const openContact = col(table.headers, row, ["open contact"]).toLowerCase();
    const badges = badgesFromRow(table.headers, row);
    if (/^(y|yes|true|1|open)$/i.test(openContact) && !badges.includes("missing")) {
      badges.push("missing");
    }
    const inSystem = col(table.headers, row, ["in system"]).toLowerCase();
    if (inSystem === "new" && !badges.includes("prospect")) {
      // Territory NEW leads stay prospects unless already in book badges
      if (!badges.includes("first-year") && !badges.includes("missing") && !badges.includes("active")) {
        badges.length = 0;
        badges.push("prospect");
      }
    }

    companies.push({
      id: slugId(name),
      name,
      city,
      address,
      phone,
      contactName,
      contactTitle,
      territory,
      badges: badges.length ? badges : (["prospect"] as CompanyBadge[]),
      lastBilled: lastBilled || undefined,
      lastContacted: lastContacted || undefined,
      nextTouch: nextTouch || undefined,
      research,
      notes: notes || `Import · ${fileName}`,
      blitzState: "open",
      inBook: true,
      fromContactSummary: !isTerritoryLeads,
    });
  }
  return { companies, skipped };
}

/** Ordered stops from Sales Planner Word/table text. */
function stopsFromPlanner(table: ParsedTable, fileName: string): Company[] {
  const fromTable = companiesFromPlannerTable(table, fileName);
  if (fromTable.length) return fromTable;
  return companiesFromPlannerText(table.text, fileName);
}

function companiesFromPlannerTable(table: ParsedTable, fileName: string): Company[] {
  if (!table.headers.length) return [];
  const companies: Company[] = [];
  let order = 0;
  for (const row of table.rows) {
    const name = col(table.headers, row, ["company", "company name", "account", "name", "stop", "business", "customer"]);
    if (!name || /^(company|name|account|stop)$/i.test(name)) continue;
    order += 1;
    const city = col(table.headers, row, ["city", "town"]);
    const address = col(table.headers, row, ["address", "street", "addr"]);
    const phone = col(table.headers, row, ["phone", "telephone", "mobile"]);
    const contactName = col(table.headers, row, ["contact", "contact name", "rep"]);
    const contactTitle = col(table.headers, row, ["title", "contact title"]);
    const territory = col(table.headers, row, ["territory", "terr", "zone"]) || "";
    companies.push({
      id: slugId(name),
      name,
      city,
      address,
      phone,
      contactName,
      contactTitle,
      territory,
      badges: ["prospect"],
      research: [],
      notes: `Sales Planner · ${fileName}`,
      blitzState: "open",
      plannerOrder: order,
      fromPlanner: true,
      inBook: false,
    });
  }
  return companies;
}

function companiesFromPlannerText(text: string, fileName: string): Company[] {
  const companies: Company[] = [];
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  let order = 0;
  for (const line of lines) {
    const m =
      line.match(/^\d+[.)]\s*([^—|]+)(?:[—|]\s*(.+))?/) ||
      line.match(/^(?:stop|company|visit|call)\s*[:-]\s*(.+)$/i) ||
      line.match(/^[-*•]\s*([A-Z][^–—|]{2,80})(?:\s*[–—|-]\s*(.+))?/);
    if (!m) continue;
    const name = (m[1] || "").trim().replace(/[,:;]+$/, "");
    if (!name || name.length < 3 || name.length > 80) continue;
    if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|notes?|route|planner)/i.test(name)) continue;
    order += 1;
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
      notes: `Sales Planner · ${fileName}`,
      blitzState: "open",
      plannerOrder: order,
      fromPlanner: true,
      inBook: false,
    });
  }
  return companies;
}

/** Expeditor Inbox / research CSV: Company Name + Notes (+ optional Source). */
function factsFromInboxTable(table: ParsedTable, fileName: string, role: ImportRole): RecallFact[] {
  if (!table.headers.length) return [];
  const facts: RecallFact[] = [];
  const date = new Date().toISOString().slice(0, 10);
  for (const row of table.rows) {
    const companyHint = col(table.headers, row, ["company name", "company", "account"]);
    const fact = col(table.headers, row, ["notes", "fact", "note", "comments", "hiring signal"]);
    const source = col(table.headers, row, ["source", "sources"]) || fileName;
    const checked = col(table.headers, row, ["date checked", "scheduled date", "scheduled date/time"]) || date;
    if (!companyHint || !fact || fact.length < 8) continue;
    facts.push({
      id: `fact-${Math.random().toString(36).slice(2, 9)}`,
      companyHint,
      fact: fact.slice(0, 500),
      source: source.split(";")[0].trim().slice(0, 160),
      date: checked.slice(0, 10),
      role,
    });
  }
  return facts;
}

function factsFromText(text: string, fileName: string, role: ImportRole): RecallFact[] {
  const facts: RecallFact[] = [];
  const date = new Date().toISOString().slice(0, 10);
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
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

function mergeBookRecord(existing: Company | undefined, incoming: Company): Company {
  if (!existing) return { ...incoming, inBook: true, fromContactSummary: true };
  return {
    ...existing,
    ...incoming,
    id: existing.id,
    phone: incoming.phone || existing.phone,
    city: incoming.city || existing.city,
    address: incoming.address || existing.address,
    contactName: incoming.contactName || existing.contactName,
    contactTitle: incoming.contactTitle || existing.contactTitle,
    territory: incoming.territory || existing.territory,
    lastBilled: incoming.lastBilled || existing.lastBilled,
    notes: [existing.notes, incoming.notes].filter(Boolean).join("\n"),
    research: [...existing.research, ...incoming.research],
    badges: Array.from(new Set([...existing.badges, ...incoming.badges])),
    blitzState: existing.blitzState,
    lockedBy: existing.lockedBy,
    lockUntil: existing.lockUntil,
    lastResult: existing.lastResult,
    lastScore: existing.lastScore,
    lastCaller: existing.lastCaller,
    plannerOrder: existing.plannerOrder,
    fromPlanner: existing.fromPlanner,
    inBook: true,
    fromContactSummary: true,
    lat: existing.lat ?? incoming.lat,
    lng: existing.lng ?? incoming.lng,
  };
}

/** Apply planner stops onto the Contact Summary book: enrich matches, stub the rest, set order. */
function applyPlannerToBook(book: Company[], stops: Company[]): Company[] {
  const byKey = new Map<string, Company>();
  for (const c of book) {
    byKey.set(normalizeCompanyName(c.name), { ...c, plannerOrder: undefined, fromPlanner: false });
  }

  let list = Array.from(byKey.values());
  for (const stop of stops) {
    const matched = matchCompany(list, stop.name);
    if (matched) {
      const key = normalizeCompanyName(matched.name);
      const next: Company = {
        ...matched,
        plannerOrder: stop.plannerOrder,
        fromPlanner: true,
        city: matched.city || stop.city,
        address: matched.address || stop.address,
        phone: matched.phone || stop.phone,
        contactName: matched.contactName || stop.contactName,
        contactTitle: matched.contactTitle || stop.contactTitle,
        notes: [matched.notes, stop.notes].filter(Boolean).join("\n"),
        blitzState: matched.blitzState === "called" || matched.blitzState === "dnc" ? matched.blitzState : "open",
      };
      byKey.set(key, next);
    } else {
      const key = normalizeCompanyName(stop.name);
      const stub: Company = { ...stop, inBook: false, fromPlanner: true };
      byKey.set(key, stub);
    }
    list = Array.from(byKey.values());
  }
  return Array.from(byKey.values());
}

function applyFacts(companies: Company[], facts: RecallFact[]): Company[] {
  return companies.map((c) => {
    const key = normalizeCompanyName(c.name);
    const matched = facts.filter((f) => {
      const hint = normalizeCompanyName(f.companyHint);
      return key.includes(hint) || hint.includes(key) || hint.split(/\s+/).some((w) => w.length > 3 && key.includes(w));
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
  const used = items.filter((i) => newestIds.has(i.meta.id)).map((i) => ({ ...i.meta, kept: true }));

  const byRole = new Map<ImportRole, IngestItem>();
  for (const item of items) {
    if (!newestIds.has(item.meta.id)) continue;
    byRole.set(item.meta.role, item);
  }

  let skipped = 0;
  let csCount = 0;
  let plannerCount = 0;
  let facts: RecallFact[] = [];

  // 1) Contact Summary = Book of record
  let book = existingCompanies.map((c) => ({ ...c }));
  const cs = byRole.get("contact_summary");
  if (cs) {
    const { companies, skipped: sk } = companiesFromContactSummary(cs.table, cs.meta.name);
    skipped += sk;
    csCount = companies.length;
    const byKey = new Map(book.map((c) => [normalizeCompanyName(c.name), c]));
    for (const row of companies) {
      const key = normalizeCompanyName(row.name);
      const prev = byKey.get(key);
      byKey.set(key, mergeBookRecord(prev, row));
    }
    book = Array.from(byKey.values());
  }

  // Also treat blitz_list rows as book enrichment (not backbone)
  const blitz = byRole.get("blitz_list");
  if (blitz) {
    const { companies, skipped: sk } = companiesFromContactSummary(blitz.table, blitz.meta.name);
    skipped += sk;
    const byKey = new Map(book.map((c) => [normalizeCompanyName(c.name), c]));
    for (const row of companies) {
      const key = normalizeCompanyName(row.name);
      const prev = byKey.get(key);
      byKey.set(key, mergeBookRecord(prev, { ...row, fromContactSummary: prev?.fromContactSummary }));
    }
    book = Array.from(byKey.values());
  }

  // 2) Sales Planner = Today's ordered queue (enrich from Book)
  const planner = byRole.get("sales_planner");
  if (planner) {
    const stops = stopsFromPlanner(planner.table, planner.meta.name);
    plannerCount = stops.length;
    book = applyPlannerToBook(book, stops);
  }

  // 3) Secondary files → recall facts (inbox rows preferred when structured)
  for (const role of ["blitz_research", "script_library", "expeditor_inbox", "other"] as ImportRole[]) {
    const item = byRole.get(role);
    if (!item) continue;
    const structured = factsFromInboxTable(item.table, item.meta.name, role);
    if (structured.length) facts.push(...structured);
    else if (item.table.text) facts.push(...factsFromText(item.table.text, item.meta.name, role));
  }

  const merged = applyFacts(book, [...existingFacts, ...facts]);
  const stamp = new Date().toLocaleString("en-US", { timeZone: "America/Chicago" });
  const parts = [
    cs ? `CS ${csCount}` : null,
    planner ? `Planner ${plannerCount}` : null,
    facts.length ? `${facts.length} facts` : null,
    pruned ? `pruned ${pruned}` : null,
  ].filter(Boolean);
  const log = `${parts.join(" · ") || "No backbone rows"} · ${stamp} CT`;

  return {
    companies: merged,
    facts: [...existingFacts, ...facts],
    files: used,
    imported: csCount + plannerCount,
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
