import type { CompanyRecord } from "./types";

/** CliffsCRM-compatible import row — never invents phone. */
export function toCrmImportRow(c: CompanyRecord): Record<string, string> {
  const verifiedPhone =
    c.contacts.find((x) => x.phone?.trust === "verified" && x.phone.value)?.phone?.value ?? "";
  const contact =
    c.contacts.find((x) => x.name?.trust === "verified" && x.name.value)?.name?.value ?? "";
  const address = c.physicalAddress?.trust === "verified" ? c.physicalAddress.value : "";
  return {
    company: c.name,
    contact,
    phone: verifiedPhone,
    address,
    territory: c.fence,
    notes: c.summaryParagraphs.join(" "),
    "last contact": "",
    "last billed": "",
    date: "",
    time: "",
    type: "",
  };
}

export function toCrmCsv(rows: Record<string, string>[]): string {
  const headers = [
    "company",
    "contact",
    "phone",
    "address",
    "territory",
    "last contact",
    "last billed",
    "notes",
    "date",
    "time",
    "type",
  ];
  const esc = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h] ?? "")).join(","))].join(
    "\n",
  );
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
