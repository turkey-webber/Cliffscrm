import {
  applyCliffMoverDayPlan,
  buildDailyReportText,
  buildGoneQuiet,
  buildHitList,
  buildHotSheet,
} from "../src/tools.ts";

const sample = [
  {
    id: "a",
    name: "Stifel",
    city: "Montgomery",
    address: "7460 Halcyon",
    phone: "(334) 263-3892",
    contactName: "Chappell Hill",
    contactTitle: "BM",
    territory: "T3",
    badges: ["missing"],
    lastContacted: "2026-01-15",
    research: [],
    notes: "",
    blitzState: "open",
  },
  {
    id: "b",
    name: "Hensel Phelps",
    city: "Montgomery",
    address: "",
    phone: "",
    contactName: "Ryan",
    contactTitle: "",
    territory: "1",
    badges: ["jackpot", "active"],
    lastBilled: "2026-01-07",
    research: [
      { source: "Job posting", date: "2026-10-04", fact: "Carpenter and Laborer postings open." },
    ],
    notes: "",
    blitzState: "open",
    hitList: true,
  },
];

const quiet = buildGoneQuiet(sample, 60);
if (!quiet.some((r) => r.company.id === "a")) throw new Error("Gone quiet missed Stifel");

const hot = buildHotSheet(sample);
if (!hot.some((r) => r.company.id === "b")) throw new Error("Hot Sheet missed Hensel");

const hits = buildHitList(sample);
if (hits.length !== 1) throw new Error("Hit List count");

const csv = `company,contact,phone,address,territory,last contact,last billed,notes,date,time,type
Stifel,Chappell Hill,(334) 263-3892,"7460 Halcyon",T3,Jan 15,missing,Callback overdue,2026-11-10,09:30,visit
`;
const plan = applyCliffMoverDayPlan(sample, csv);
if (plan.imported !== 1) throw new Error("day plan import count");
if (plan.companies.find((c) => c.id === "a")?.plannerOrder !== 1) throw new Error("planner order");

const report = buildDailyReportText({
  companies: sample,
  wrapUps: [],
  captures: [],
  callsDone: 0,
  visitsDone: 0,
  myScore: 0,
  date: "2026-11-10",
});
if (!report.includes("Daily Report")) throw new Error("report header");

console.log("tools checks ok");
