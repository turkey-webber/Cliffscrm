import type { Company } from "./data";

export function openerFor(c: Company, agentFirst = "Cliff"): string {
  const who = c.contactName ? c.contactName.split(" ")[0] : "there";
  if (c.badges.includes("missing")) {
    return `Hey ${who}, it's ${agentFirst} with Express in Montgomery. You've worked with our associates before, and I don't want to skip past the relationship — what's changed on your hiring side?`;
  }
  if (c.badges.includes("first-year")) {
    return `Hey ${who}, ${agentFirst} with Express. We started together this year and I want to grow the hours with you — what's the next role you're trying to fill?`;
  }
  if (c.badges.includes("jackpot")) {
    return `Hey ${who}, it's ${agentFirst} with Express Employment Professionals in Montgomery. If a seat is hurting you, I'd rather earn a short visit than pitch over the phone — what role is open?`;
  }
  return `Hey ${who}, this is ${agentFirst} with Express Employment Professionals in Montgomery. The reason for the call is to understand how you hire — not to pitch. Do you have two minutes?`;
}

export const WEINBERG_CARDS = [
  {
    title: "Weinberg — Purpose",
    body: "State who you are, why you're calling, and ask for a short appointment. Goal of every call is the appointment.",
  },
  {
    title: "Weinberg — Probing",
    body: "Ask how they fill roles today, who decides, and which roles they hire most. Discovery needs 5+ fields including one of those two.",
  },
  {
    title: "Express — Local proof",
    body: "Locally owned Montgomery office. Talk associates, selection process, and showing up on their floor — not temps.",
  },
];
