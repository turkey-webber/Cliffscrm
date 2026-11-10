/** External research sources + Montgomery territory prospect pack (from Drive notes). */

export type ResearchLink = { label: string; url: string };

export type ProspectSeed = {
  name: string;
  city: string;
  phone?: string;
  address?: string;
  industries: string[];
  keywords: string[];
  fact: string;
  source: string;
};

export function researchLinksFor(company: string, trade = ""): ResearchLink[] {
  const q = encodeURIComponent([company, "Montgomery AL", trade].filter(Boolean).join(" "));
  const companyQ = encodeURIComponent(company);
  return [
    { label: "Google", url: `https://www.google.com/search?q=${q}` },
    { label: "LinkedIn jobs", url: `https://www.linkedin.com/jobs/search/?keywords=${q}` },
    { label: "Talent.com", url: `https://www.talent.com/jobs?k=${q}` },
    { label: "Indeed", url: `https://www.indeed.com/jobs?q=${q}&l=Montgomery%2C+AL` },
    { label: "AIDT careers", url: `https://careers.aidt.edu/jobs?keywords=${companyQ}` },
    { label: "Amazon.jobs", url: `https://www.amazon.jobs/en/search?base_query=${q}` },
    { label: "The Muse", url: `https://www.themuse.com/search/jobs?query=${q}` },
    {
      label: "Montgomery Chamber",
      url: `https://www.montgomerychamber.com/list/ql/find?q=${companyQ}`,
    },
    {
      label: "Manufacture Alabama",
      url: `https://business.manufacturealabama.org/list/ql/find?q=${companyQ}`,
    },
    { label: "AL WARN list", url: "https://workforce.alabama.gov/warn-list/" },
    {
      label: "Gov. announcements",
      url: "https://governor.alabama.gov/newsroom/",
    },
    {
      label: "Maps",
      url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${company} Montgomery AL`)}`,
    },
  ];
}

/** High-signal employers near Montgomery — used when matching MPCs outside the book. */
export const TERRITORY_PROSPECTS: ProspectSeed[] = [
  {
    name: "DAS North America",
    city: "Montgomery",
    phone: "(334) 284-2574",
    address: "840 Industrial Park Blvd",
    industries: ["auto", "manufacturing", "production"],
    keywords: ["assembly", "production", "forklift", "warehouse", "operator"],
    fact: "$77.6M expansion / ~101 jobs · plant mgr Patrick Kurdziel",
    source: "AL.com / Chamber 2026",
  },
  {
    name: "HD Hyundai Power Transformers USA",
    city: "Montgomery",
    phone: "(334) 481-2000",
    address: "215 Folmar Pkwy",
    industries: ["manufacturing", "electrical", "production"],
    keywords: ["electrical", "production", "manufacturing", "engineer", "operator"],
    fact: "$200M expansion / 200 jobs · second plant due 2027",
    source: "Chamber / PR Newswire 2026",
  },
  {
    name: "Owens Corning Prattville",
    city: "Prattville",
    industries: ["manufacturing", "construction", "production"],
    keywords: ["production", "operator", "warehouse", "maintenance", "shingle"],
    fact: "New shingle plant · ~100 jobs · production 2027",
    source: "Owens Corning / Autauga 2025-26",
  },
  {
    name: "Lockheed Martin Troy",
    city: "Troy",
    industries: ["manufacturing", "defense", "quality"],
    keywords: ["manufacturing", "inspector", "supervisor", "quality", "assembly"],
    fact: "$35-50M munitions center · ~300 jobs",
    source: "ADECA / WSFA 2026",
  },
  {
    name: "CPT America",
    city: "Tuskegee",
    industries: ["auto", "manufacturing", "production"],
    keywords: ["production", "operator", "machinist", "quality"],
    fact: "$163M / 187 jobs industrial development",
    source: "ADECA 2026",
  },
  {
    name: "Samkwang",
    city: "Tuskegee",
    industries: ["auto", "manufacturing"],
    keywords: ["production", "operator", "warehouse"],
    fact: "REAL Park Bldg 100 · 114 jobs",
    source: "Yellowhammer 2026",
  },
  {
    name: "Koch Foods",
    city: "Montgomery",
    phone: "(334) 387-1700",
    address: "3500 West Blvd",
    industries: ["food", "production", "warehouse"],
    keywords: ["production", "warehouse", "maintenance", "hr", "line"],
    fact: "~1,250 employees · ongoing production hiring",
    source: "Montgomery Chamber 2025",
  },
  {
    name: "US Foods",
    city: "Montgomery",
    address: "2850 Selma Hwy",
    industries: ["warehouse", "logistics", "cdl", "driver"],
    keywords: ["warehouse", "selector", "cdl", "driver", "forklift"],
    fact: "Night warehouse / CDL delivery roles",
    source: "Workday careers 2026",
  },
  {
    name: "DG Fresh Distribution",
    city: "Montgomery",
    address: "6080 Mobile Hwy",
    industries: ["warehouse", "logistics", "cold storage"],
    keywords: ["warehouse", "supervisor", "forklift", "cold"],
    fact: "Dollar General perishable DC · ~235 emp",
    source: "Chamber / DG careers",
  },
  {
    name: "Glovis Alabama",
    city: "Montgomery",
    address: "250 Hyundai Blvd",
    industries: ["logistics", "auto", "warehouse"],
    keywords: ["warehouse", "logistics", "driver", "inventory"],
    fact: "~830 emp VPC · Hyundai ecosystem",
    source: "Chamber 2025",
  },
  {
    name: "MOBIS of Alabama",
    city: "Montgomery",
    phone: "(334) 387-4800",
    address: "1395 Mitchell Young Rd",
    industries: ["auto", "manufacturing", "production"],
    keywords: ["production", "maintenance", "operator", "ehs"],
    fact: "~1,500 emp · ongoing production hiring",
    source: "Chamber / iSolved",
  },
  {
    name: "Lear Corporation Montgomery",
    city: "Montgomery",
    phone: "(334) 280-5500",
    address: "200 Folmar Pkwy",
    industries: ["auto", "manufacturing", "production"],
    keywords: ["production", "supervisor", "assembly", "quality"],
    fact: "~373 emp · Folmar Parkway plant",
    source: "Chamber / Lear jobs",
  },
  {
    name: "Hager Companies",
    city: "Montgomery",
    phone: "(334) 284-4704",
    address: "150 Folmar Pkwy",
    industries: ["manufacturing", "machining", "production"],
    keywords: ["machining", "tool", "die", "production", "maintenance"],
    fact: "~212 emp · production / machining hiring",
    source: "Hager careers 2026",
  },
  {
    name: "James Hardie Prattville",
    city: "Prattville",
    industries: ["manufacturing", "production", "construction"],
    keywords: ["production", "plant", "operator", "maintenance"],
    fact: "Capacity expansion · Project Mayfield",
    source: "James Hardie 2026",
  },
  {
    name: "Medline Industries Prattville",
    city: "Prattville",
    phone: "(334) 361-6444",
    address: "735 County Rd 4 E",
    industries: ["warehouse", "logistics", "healthcare"],
    keywords: ["warehouse", "driver", "forklift", "maintenance"],
    fact: "Warehouse / Class A driver openings",
    source: "Medline Workday",
  },
  {
    name: "Wayne-Sanderson Farms",
    city: "Union Springs",
    industries: ["food", "production", "warehouse"],
    keywords: ["poultry", "line", "production", "hatchery", "supervisor"],
    fact: "Expansion + ongoing line associate hiring",
    source: "Wayne Farms Workday",
  },
  {
    name: "Retem Steel",
    city: "Tallassee",
    industries: ["manufacturing", "steel", "welding"],
    keywords: ["welder", "welding", "steel", "fabricat", "cnc"],
    fact: "Hwy 229 plant · recruiting again Oct 2026",
    source: "Tallassee Times",
  },
  {
    name: "Adient Clanton",
    city: "Clanton",
    industries: ["auto", "manufacturing", "production"],
    keywords: ["production", "assembly", "operator", "quality"],
    fact: "703+ emp · Nissan P42 launch Mar 2026",
    source: "Clanton Advertiser",
  },
  {
    name: "Viscofan",
    city: "Montgomery",
    phone: "(334) 396-0092",
    address: "50 County Court Ln",
    industries: ["food", "manufacturing", "production"],
    keywords: ["production", "forklift", "operator", "warehouse"],
    fact: "~200 emp · general production / forklift posts",
    source: "Jobsparx / Chamber",
  },
  {
    name: "Genpak Hope Hull",
    city: "Hope Hull",
    phone: "(334) 612-0314",
    address: "7621 Bill Joseph Pkwy",
    industries: ["manufacturing", "packaging", "production"],
    keywords: ["production", "packaging", "operator", "maintenance"],
    fact: "$9.2M expansion announced",
    source: "DCOM / Chamber",
  },
];
