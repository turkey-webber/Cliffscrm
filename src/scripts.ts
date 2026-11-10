import type { Company } from "./data";

/** Openers sourced from Call form replies + Express Manual / Weinberg decks. */
export function openerFor(c: Company, agentFirst = "Cliff"): string {
  const who = c.contactName ? c.contactName.split(" ")[0] : "there";
  if (c.badges.includes("missing")) {
    return `Hey ${who}, it's ${agentFirst} with Express Employment Professionals in Montgomery. Why are we currently not doing business with your company? What could we do to improve? We have a great associate who would fit in your organization — will you look at their résumé? Can I stop by?`;
  }
  if (c.badges.includes("first-year") || c.badges.includes("active")) {
    return `Hey ${who}, ${agentFirst} with Express in Montgomery. Thank you for treating our associates so well. I'd like to set a short business review to hear what you're forecasting and whether another department or service line could use us.`;
  }
  if (c.badges.includes("jackpot") || c.badges.includes("prospect")) {
    return `Hey ${who}, it's ${agentFirst} with Express Employment Professionals, the locally owned Montgomery office. What proves to be your company's biggest staffing challenge right now? Can I come to your facility and meet you?`;
  }
  return `Hey ${who}, this is ${agentFirst} with Express Employment Professionals in Montgomery. Can I come to your facility and meet you? Can I bring along one of my recruiters to see the type of role you're needing?`;
}

export const OBJECTION_LINES: { id: string; label: string; reply: string }[] = [
  {
    id: "have-staffing",
    label: "Already have a staffing company",
    reply:
      "I'm not asking you to abandon that relationship. What makes them successful for you? What's your most difficult skill set to secure? Where do you see Express providing you the most value?",
  },
  {
    id: "not-hiring",
    label: "Not hiring",
    reply:
      "Is that your standard situation or just your current situation? When is your busy season? If it's a freeze: is it across the board or for certain positions, and how long do you expect it to last?",
  },
  {
    id: "burned",
    label: "Burned before",
    reply:
      "I'm sorry to hear that. Tell me more. What happened, and how could it have been better? So the problem was mainly [their words]? Let me explain how Express handles that.",
  },
  {
    id: "internal",
    label: "Hire internally",
    reply:
      "Great! What is that process? Most of my clients have their own process and still find it beneficial to work with me. What happens when a special project needs skills your team doesn't have?",
  },
  {
    id: "price",
    label: "Price",
    reply:
      "What specific rates are you concerned about — hourly bill rate or overall cost? Our pricing is all inclusive: wages, payroll taxes, benefits, unemployment, workers' comp, plus recruiting and onboarding time. We don't have a standard mark-up; we price by the job, the skills, and local conditions.",
  },
  {
    id: "check-team",
    label: "Check with my team",
    reply:
      "Who else in your organization do we need to meet and explain our process that could make a decision? Is he or she available now?",
  },
];

export const WEINBERG_CARDS = [
  {
    title: "Weinberg — Purpose",
    body: "State who you are, why you're calling, and ask for a short appointment. Goal of every call is the appointment — not just an order.",
  },
  {
    title: "Challenge opener",
    body: "What proves to be your company's biggest staffing challenge right now? Listen. Then: Can I come to your facility and meet you?",
  },
  {
    title: "Missing client",
    body: "Why are we currently not doing business with your company? What could we do to improve? Offer an MPC: We have a great associate who would fit — will you look at their résumé?",
  },
  {
    title: "Discovery — HR challenges",
    body: "What are your top three human resource challenges? Which positions have unusually high turnover? What's changed in your business over the last 6–12 months?",
  },
  {
    title: "Discovery — fill path",
    body: "When you are hiring, what usually slows things down? If you received a surge in orders, how would you fill those? What do you do when you can't find qualified people?",
  },
  {
    title: "Close — tour",
    body: "When can we arrange for a facility tour? Is there a question I haven't asked that I should ask? If no appointment: Would you be open to a call when we have interviewed a strong candidate with those skills?",
  },
  {
    title: "Express — Local proof",
    body: "Locally owned Montgomery office. Say associates, never temps. Evaluation Hire is 520 hours. Professional Staffing is direct hire only. Never say \"just checking in.\"",
  },
];
