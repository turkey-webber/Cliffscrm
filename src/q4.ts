import type { CallResult, Company } from "./data";
import { OFFICE, resultLabel } from "./data";
import type { WrapUp } from "./wrapup";
import { formatFutureCopy, formatResultsCopy } from "./wrapup";

export type Q4Field = { label: string; value: string };

export function wrapUpCardCopy(w: WrapUp): { results: string; future: string; full: string } {
  const results = formatResultsCopy(w);
  const future = formatFutureCopy(w);
  return {
    results,
    future,
    full: `${w.companyName}\n${w.companyRep || ""}\n${w.phone || ""}\n\n${results}\n\n${future}\n`,
  };
}

export function companyRecordFields(c: Company): Q4Field[] {
  return [
    { label: "Company Name", value: c.name.replace(" (DEMO)", "") },
    { label: "Address", value: c.address || "" },
    { label: "City", value: c.city || "" },
    { label: "Phone", value: c.phone || "" },
    { label: "Company Rep 1 — Name", value: c.contactName || "" },
    { label: "Company Rep 1 — Title", value: c.contactTitle || "" },
    { label: "Notes", value: c.notes || "" },
  ];
}

export function callNoteFields(
  c: Company,
  result: CallResult | undefined,
  caller: string,
): Q4Field[] {
  const when = new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  });
  return [
    {
      label: "CRM Today — Contact note",
      value: [
        `${when} CT · ${caller}`,
        result ? `Result: ${resultLabel(result)}` : "Result: (in progress)",
        `Company: ${c.name.replace(" (DEMO)", "")}`,
        c.contactName ? `Spoke with / trying: ${c.contactName}` : "",
        "Goal: appointment",
        c.notes ? `Notes: ${c.notes}` : "Notes:",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];
}

export function jobOrderQuickEntryFields(c: Company): Q4Field[] {
  return [
    { label: "Company Name", value: c.name.replace(" (DEMO)", "") },
    { label: "Department", value: "" },
    { label: "Order Placer", value: c.contactName || "" },
    { label: "Phone", value: c.phone || "" },
    { label: "Job Title", value: "" },
    { label: "# needed", value: "" },
    { label: "Projected start", value: "" },
    { label: "Reason for opening", value: "" },
    { label: "Skills required", value: "" },
    { label: "Salary Low / Mid / Top", value: "" },
  ];
}

export function formatPasteBlock(title: string, fields: Q4Field[]): string {
  const lines = [`===== ${title} =====`, `Rep: ${OFFICE.agentName}`, ""];
  for (const f of fields) lines.push(`${f.label}: ${f.value}`);
  return lines.join("\n").trim() + "\n";
}
