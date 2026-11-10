import type { Company } from "./data";

/**
 * Openers from Call form replies + “How to Write an Express Call Opening”.
 * Evaluation Hire = 520 hours (Cliff confirmed; some decks still say 720).
 */
export function openerFor(c: Company, agentFirst = "Cliff"): string {
  const who = c.contactName ? c.contactName.split(" ")[0] : "there";
  if (c.badges.includes("missing")) {
    return `Hey ${who}, it's ${agentFirst} with Express Employment Professionals, the locally owned office in Montgomery. You've worked with our associates before, so I'd like to ask: why are we currently not doing business with your company, and what could we do to improve? We have a great associate who would fit in your organization. Will you look at their résumé? Can I come by and meet you?`;
  }
  if (c.badges.includes("first-year") || c.badges.includes("active")) {
    return `Hey ${who}, ${agentFirst} with Express. I'd like to come by in person and make sure what you expect from our associates is what we're delivering. What does the next quarter look like for you, and when is your busiest time of year? Would later this week work for a short visit?`;
  }
  if (c.badges.includes("jackpot") || c.badges.includes("prospect")) {
    return `Hey ${who}, this is ${agentFirst} with Express Employment Professionals, the locally owned office in Montgomery. When hiring ramps up quickly, teams typically feel pressure with onboarding and retention. How is your team handling that right now? Can I come to your facility and meet you?`;
  }
  return `Hey ${who}, this is ${agentFirst} with Express Employment Professionals, the locally owned Montgomery office. Can I come to your facility and meet you? Can I bring along one of my recruiters to see the type of role you're needing?`;
}

export const OBJECTION_LINES: { id: string; label: string; reply: string }[] = [
  {
    id: "have-staffing",
    label: "Already have a staffing company",
    reply:
      "I see where we might be able to complement what you're currently doing. Where do you see Express providing you the most value?",
  },
  {
    id: "not-hiring",
    label: "Not hiring",
    reply: "When is your busy season for production?",
  },
  {
    id: "burned",
    label: "Burned before",
    reply:
      "Can you explain your experience and what made it negative? How could we make your experience different?",
  },
  {
    id: "internal",
    label: "Hire internally",
    reply: "How much time do you spend going through applications and interviews?",
  },
  {
    id: "price",
    label: "Price",
    reply:
      "Will you share more about why you think the pricing is too high? Our rate replaces HR time, onboarding, payroll taxes, benefits, unemployment, and workers' comp risk — we price by the job, the skills, and local conditions.",
  },
  {
    id: "check-team",
    label: "Check with my team",
    reply:
      "Who else in your organization do we need to meet and explain our process that could make a decision? Is he or she available now?",
  },
];

export const FRONT_DESK_LINE =
  "How would a guy like me get to talk to a decision-maker?";

export const WEINBERG_CARDS = [
  {
    title: "Weinberg — Purpose",
    body: "State who you are, why you're calling, and ask for a short appointment. Goal of every call is the appointment — not just an order.",
  },
  {
    title: "Relevant · Relatable · Results",
    body: "Why now (trigger) → pressure they feel → ask their biggest challenge → then: Can I come to your facility and meet you?",
  },
  {
    title: "Missing client",
    body: "Ask why we're not doing business and what would improve. Offer an MPC résumé. Ask to stop by. Never invent a name, phone, or pay.",
  },
  {
    title: "Active / first-year",
    body: "Face-to-face care: make sure associates deliver what they expect. Ask next-quarter forecast and peak season. Grow toward Total Client Care.",
  },
  {
    title: "Discovery — HR challenges",
    body: "What are your top three human resource challenges? Which positions have unusually high turnover? What's changed in the last 6–12 months?",
  },
  {
    title: "Discovery — fill path",
    body: "How many associates? Temporary, Evaluation Hire (520 hours), or Direct Hire? Skills? Peak seasons? Who decides? Only partner or one of several?",
  },
  {
    title: "Front desk",
    body: FRONT_DESK_LINE + " Be friendly, use their name, recognize if they're busy.",
  },
  {
    title: "Express — Local proof",
    body: "Locally owned Montgomery office. Say associates, never temps. Never say “just checking in” or “I was just in the area.” Professional Staffing = direct hire only.",
  },
];
