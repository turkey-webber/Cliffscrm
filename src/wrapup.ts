/** Q4 Edit Scheduled Contact field map — exact goal order and call types. */

export const Q4_GOALS = [
  "Appointment Set",
  "Business Review",
  "Client Facility Tour",
  "Client/Prospect Lunch",
  "Company Safety Tour",
  "Express Facility Tour",
  "Marketing Program",
  "MPC",
  "Order Producing",
  "Proposal Presentation",
  "Proposal Submitted",
  "Q/C Check",
  "Recruiting",
] as const;

export type Q4Goal = (typeof Q4_GOALS)[number];

export const CALL_TYPES = [
  "Other call - telephone",
  "Appointment call - face to face",
  "Discovery call - face to face",
  "Other call - face to face",
  "Other contact - electronic",
  "Other contact - mail",
  "Planned call - face to face",
] as const;

export type CallType = (typeof CALL_TYPES)[number];

export type WrapOutcome = "got_them" | "voicemail" | "skip" | "capture";

export type WrapUp = {
  id: string;
  companyId: string;
  companyName: string;
  phone: string;
  createdAt: string;
  outcome: WrapOutcome;
  resultGoals: string[];
  otherResults: string;
  companyRep: string;
  decisionMaker: "yes" | "no" | "";
  leftMessage: "yes" | "no" | "";
  callType: CallType | string;
  resultDate: string;
  futureGoals: string[];
  otherGoals: string;
  futureCallType: CallType | string;
  futureDate: string;
  futureRep: string;
  doneInQ4: boolean;
  /** When opened from Capture inbox */
  captureId?: string;
};

export type CaptureItem = {
  id: string;
  createdAt: number;
  mode: "voice" | "photo" | "type";
  text: string;
  companyId?: string;
  companyGuess?: string;
  status: "inbox" | "done";
};

export type TimelineEvent = {
  id: string;
  at: string;
  kind: "call" | "visit" | "note" | "capture" | "wrapup" | "research" | "mpc";
  summary: string;
  detail?: string;
};

export function todayIso(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
}

export function addDaysIso(days: number, from = new Date()): string {
  const base = new Date(
    from.toLocaleString("en-US", { timeZone: "America/Chicago" }),
  );
  base.setDate(base.getDate() + days);
  return base.toLocaleDateString("en-CA");
}

export function newWrapId(): string {
  return `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function blankWrapUp(partial: Partial<WrapUp> & Pick<WrapUp, "companyId" | "companyName">): WrapUp {
  const day = todayIso();
  return {
    id: newWrapId(),
    phone: "",
    createdAt: day,
    outcome: "got_them",
    resultGoals: [],
    otherResults: "",
    companyRep: "",
    decisionMaker: "",
    leftMessage: "",
    callType: "Other call - telephone",
    resultDate: day,
    futureGoals: [],
    otherGoals: "",
    futureCallType: "Other call - telephone",
    futureDate: addDaysIso(7),
    futureRep: "",
    doneInQ4: false,
    ...partial,
  };
}

export function wrapUpValid(w: WrapUp): string | null {
  if (w.outcome === "skip") return null;
  if (!w.resultDate) return "Add a Results date";
  if (!w.futureDate) return "Add a Future Contact date";
  return null;
}

export function formatResultsCopy(w: WrapUp): string {
  const goals = w.resultGoals.length ? w.resultGoals.map((g) => `☑ ${g}`).join("\n") : "(none checked)";
  return [
    "RESULTS",
    goals,
    `Call Type: ${w.callType}`,
    `Decision Maker Reached: ${w.decisionMaker || "(blank)"}`,
    `Left Message: ${w.leftMessage || "(blank)"}`,
    `Date: ${w.resultDate}`,
    `Company Rep: ${w.companyRep || "(blank)"}`,
    "",
    "Other Results:",
    w.otherResults || "(blank)",
  ].join("\n");
}

export function formatFutureCopy(w: WrapUp): string {
  const goals = w.futureGoals.length ? w.futureGoals.map((g) => `☑ ${g}`).join("\n") : "(none checked)";
  return [
    "FUTURE CONTACT",
    goals,
    `Call Type: ${w.futureCallType}`,
    `Date: ${w.futureDate}`,
    `Company Rep: ${w.futureRep || w.companyRep || "(blank)"}`,
    "",
    "Other Goals:",
    w.otherGoals || "(blank)",
  ].join("\n");
}

export function toggleGoal(list: string[], goal: string): string[] {
  return list.includes(goal) ? list.filter((g) => g !== goal) : [...list, goal];
}
