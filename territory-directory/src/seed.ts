import type { CompanyRecord } from "./types";
import { computeScores } from "./scoring";

const OBS = "2026-11-10";

function phoneClaim(value: string, sourceLabel: string) {
  return { value, trust: "verified" as const, sourceLabel, observedAt: OBS, method: "extract" as const };
}
function addrClaim(value: string, sourceLabel: string) {
  return { value, trust: "verified" as const, sourceLabel, observedAt: OBS, method: "extract" as const };
}

const raw = [
  {
    id: "co-1",
    name: "DAS North America",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("840 Industrial Park Blvd, Montgomery, AL", "AL.com / Chamber 2026"),
    lat: 32.3783817,
    lng: -86.1105088,
    corridorTags: ["industrial-park"],
    fence: "in" as const,
    industryTags: ["auto", "manufacturing", "production"],
    sizeBand: "100-249" as const,
    headcountClaim: { value: 101, trust: "verified" as const, sourceLabel: "AL.com / Chamber 2026", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "dasnort-main",
      role: "other" as const,
      phone: phoneClaim("(334) 284-2574", "AL.com / Chamber 2026"),
    },
    {
      id: "dasnort-ops",
      role: "operations" as const,
      name: { value: "Patrick Kurdziel", trust: "verified" as const, sourceLabel: "AL.com / Chamber 2026", observedAt: OBS, method: "extract" as const },
      title: { value: "Plant Manager", trust: "verified" as const, sourceLabel: "AL.com / Chamber 2026", observedAt: OBS, method: "extract" as const },
    }
    ],
    activeRoles: [
    { id: "ar-0-0", title: "Production Operator", family: "production", seenAt: OBS, sourceLabel: "AL.com / Chamber 2026", trust: "verified" as const },
    { id: "ar-0-1", title: "Warehouse Associate", family: "warehouse", seenAt: OBS, sourceLabel: "AL.com / Chamber 2026", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-0-0", year: 2026, summary: "$77.6M expansion announced \u00b7 ~101 jobs", sourceLabel: "AL.com / Chamber", trust: "verified" as const }
    ],
    summaryParagraphs: ["DAS North America runs an automotive production footprint on Industrial Park Blvd in Montgomery. Public chamber and news coverage put a large expansion on the board with roughly a hundred new roles tied to the project.", "For Express, this is a growth account: verified main line on file, named plant leadership in press, and production/warehouse families you place. Not assumed in-book \u2014 treat as net-new until Contact Summary says otherwise."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-1-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-2",
    name: "HD Hyundai Power Transformers USA",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("215 Folmar Pkwy, Montgomery, AL", "Chamber / PR Newswire 2026"),
    lat: 32.2587705,
    lng: -86.3697116,
    corridorTags: ["folmar"],
    fence: "in" as const,
    industryTags: ["manufacturing", "electrical", "production"],
    sizeBand: "100-249" as const,
    headcountClaim: { value: 200, trust: "verified" as const, sourceLabel: "Chamber / PR Newswire 2026", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "hdhyund-main",
      role: "other" as const,
      phone: phoneClaim("(334) 481-2000", "Chamber / PR Newswire 2026"),
    }
    ],
    activeRoles: [
    { id: "ar-1-0", title: "Electrical Production", family: "production", seenAt: OBS, sourceLabel: "Chamber / PR Newswire 2026", trust: "verified" as const },
    { id: "ar-1-1", title: "Manufacturing Engineer", family: "production", seenAt: OBS, sourceLabel: "Chamber / PR Newswire 2026", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-1-0", year: 2026, summary: "$200M expansion / second plant targeted 2027", sourceLabel: "Chamber / PR Newswire", trust: "verified" as const }
    ],
    summaryParagraphs: ["HD Hyundai Power Transformers USA anchors Folmar Parkway with heavy electrical manufacturing. Chamber and wire coverage describe a $200M expansion and a second plant timeline into 2027.", "Opportunity is expansion-driven: maintenance and production hiring typically follow these builds. Verified plant phone is published; chase Ops/HR on site pages before trusting directory guesses."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-2-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-3",
    name: "Owens Corning Prattville",
    aliases: [],
    city: "Prattville",
    
    lat: 32.4600136,
    lng: -86.4753174,
    corridorTags: ["prattville"],
    fence: "edge" as const,
    industryTags: ["manufacturing", "construction", "production"],
    sizeBand: "50-99" as const,
    headcountClaim: { value: 100, trust: "verified" as const, sourceLabel: "Owens Corning / Autauga 2025-26", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-2-0", title: "Production Operator", family: "production", seenAt: OBS, sourceLabel: "Owens Corning / Autauga 2025-26", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-2-0", year: 2025, summary: "New shingle plant announced \u00b7 ~100 jobs \u00b7 production 2027", sourceLabel: "Owens Corning / Autauga", trust: "verified" as const }
    ],
    summaryParagraphs: ["Owens Corning\u2019s Prattville shingle project is a greenfield-style growth story for Autauga County with about 100 roles planned as production ramps toward 2027.", "Smaller than the Hyundai campus accounts but squarely in your growing-employer lane. Phone not verified in seed \u2014 enrich from company/careers before dialing."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-3-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-4",
    name: "Lockheed Martin Troy",
    aliases: [],
    city: "Troy",
    
    lat: 31.8087678,
    lng: -85.969951,
    corridorTags: ["troy"],
    fence: "edge" as const,
    industryTags: ["manufacturing", "defense", "quality"],
    sizeBand: "250-499" as const,
    headcountClaim: { value: 300, trust: "verified" as const, sourceLabel: "ADECA / WSFA 2026", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-3-0", title: "Quality Inspector", family: "quality", seenAt: OBS, sourceLabel: "ADECA / WSFA 2026", trust: "verified" as const },
    { id: "ar-3-1", title: "Manufacturing Associate", family: "production", seenAt: OBS, sourceLabel: "ADECA / WSFA 2026", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-3-0", year: 2026, summary: "$35-50M munitions center \u00b7 ~300 jobs", sourceLabel: "ADECA / WSFA", trust: "verified" as const }
    ],
    summaryParagraphs: ["Lockheed\u2019s Troy munitions investment is an ADECA-scale defense manufacturing play with hundreds of roles in the public announcement.", "Edge-of-territory drive but high signal. Quality and manufacturing titles match Express lanes; confirm visitor/security norms before drop-bys."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-4-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-5",
    name: "CPT America",
    aliases: [],
    city: "Tuskegee",
    
    lat: 32.4240535,
    lng: -85.6908715,
    corridorTags: ["tuskegee", "real-park"],
    fence: "edge" as const,
    industryTags: ["auto", "manufacturing", "production"],
    sizeBand: "100-249" as const,
    headcountClaim: { value: 187, trust: "verified" as const, sourceLabel: "ADECA 2026", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-4-0", title: "Production Operator", family: "production", seenAt: OBS, sourceLabel: "ADECA 2026", trust: "verified" as const },
    { id: "ar-4-1", title: "Machinist", family: "production", seenAt: OBS, sourceLabel: "ADECA 2026", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-4-0", year: 2026, summary: "$163M / 187 jobs industrial development", sourceLabel: "ADECA", trust: "verified" as const }
    ],
    summaryParagraphs: ["CPT America is part of the Tuskegee industrial build-out with a large ADECA-tagged investment and nearly 200 announced jobs.", "Auto supplier production work is core Express fit. Seed has no verified phone yet \u2014 careers and chamber roster are the scrub targets."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-5-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-6",
    name: "Samkwang",
    aliases: [],
    city: "Tuskegee",
    
    lat: 32.4240535,
    lng: -85.6908715,
    corridorTags: ["tuskegee", "real-park"],
    fence: "edge" as const,
    industryTags: ["auto", "manufacturing"],
    sizeBand: "100-249" as const,
    headcountClaim: { value: 114, trust: "verified" as const, sourceLabel: "Yellowhammer 2026", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-5-0", title: "Production Operator", family: "production", seenAt: OBS, sourceLabel: "Yellowhammer 2026", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-5-0", year: 2026, summary: "REAL Park Building 100 \u00b7 114 jobs", sourceLabel: "Yellowhammer", trust: "verified" as const }
    ],
    summaryParagraphs: ["Samkwang is listed with REAL Park Building 100 in Tuskegee and a public job count in the low hundreds.", "Neighbor to other Macon County auto suppliers \u2014 good blitz cluster with CPT. Verify main line before claiming a dial."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-6-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-7",
    name: "Koch Foods",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("3500 West Blvd, Montgomery, AL", "Montgomery Chamber 2025"),
    lat: 32.331267,
    lng: -86.356082,
    corridorTags: ["west-blvd"],
    fence: "in" as const,
    industryTags: ["food", "production", "warehouse"],
    sizeBand: "500+" as const,
    headcountClaim: { value: 1250, trust: "verified" as const, sourceLabel: "Montgomery Chamber 2025", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "kochfoo-main",
      role: "other" as const,
      phone: phoneClaim("(334) 387-1700", "Montgomery Chamber 2025"),
    }
    ],
    activeRoles: [
    { id: "ar-6-0", title: "Production Associate", family: "production", seenAt: OBS, sourceLabel: "Montgomery Chamber 2025", trust: "verified" as const },
    { id: "ar-6-1", title: "Maintenance Technician", family: "production", seenAt: OBS, sourceLabel: "Montgomery Chamber 2025", trust: "verified" as const },
    { id: "ar-6-2", title: "Warehouse", family: "warehouse", seenAt: OBS, sourceLabel: "Montgomery Chamber 2025", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-6-0", year: 2025, summary: "Chamber lists ~1,250 employees with ongoing production hiring", sourceLabel: "Montgomery Chamber", trust: "verified" as const }
    ],
    summaryParagraphs: ["Koch Foods is one of Montgomery\u2019s large food production employers on West Blvd, with chamber headcount around 1,250 and recurring line/warehouse demand.", "High volume staffing potential. Verified published phone. Watch for incumbent agency \u2014 capture that on the dossier when you learn it."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-7-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-8",
    name: "US Foods",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("2850 Selma Hwy, Montgomery, AL", "Workday careers 2026"),
    lat: 32.3115054,
    lng: -86.357536,
    corridorTags: ["selma-hwy"],
    fence: "in" as const,
    industryTags: ["warehouse", "logistics", "cdl"],
    sizeBand: "100-249" as const,
    
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-7-0", title: "Night Warehouse Selector", family: "warehouse", seenAt: OBS, sourceLabel: "Workday careers 2026", trust: "verified" as const },
    { id: "ar-7-1", title: "CDL Delivery", family: "cdl", seenAt: OBS, sourceLabel: "Workday careers 2026", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-7-0", year: 2026, summary: "Night warehouse and CDL delivery roles posted on Workday careers", sourceLabel: "Workday careers", trust: "verified" as const }
    ],
    summaryParagraphs: ["US Foods on Selma Highway is a classic DC account: selectors, forklift, and CDL delivery show up on public careers traffic.", "Strong Express warehouse/CDL fit. No seed phone \u2014 pull from careers/contact page on refresh. Good near-me stop from Carmichael."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-8-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-9",
    name: "DG Fresh Distribution",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("6080 Mobile Hwy, Montgomery, AL", "Chamber / DG careers"),
    lat: 32.2902562,
    lng: -86.3497545,
    corridorTags: ["mobile-hwy"],
    fence: "in" as const,
    industryTags: ["warehouse", "logistics"],
    sizeBand: "100-249" as const,
    headcountClaim: { value: 235, trust: "verified" as const, sourceLabel: "Chamber / DG careers", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-8-0", title: "Warehouse Supervisor", family: "warehouse", seenAt: OBS, sourceLabel: "Chamber / DG careers", trust: "verified" as const },
    { id: "ar-8-1", title: "Forklift Operator", family: "warehouse", seenAt: OBS, sourceLabel: "Chamber / DG careers", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-8-0", year: 2025, summary: "Chamber notes perishable DC footprint \u00b7 ~235 emp", sourceLabel: "Chamber / DG careers", trust: "verified" as const }
    ],
    summaryParagraphs: ["DG Fresh on Mobile Highway is the Dollar General perishable DC story \u2014 cold-chain warehouse work with a few hundred employees in public notes.", "Warehouse supervisor and forklift families are dial targets. Confirm phone on refresh; cluster with other south/west Montgomery DCs."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-9-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-10",
    name: "Glovis Alabama",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("250 Hyundai Blvd, Montgomery, AL", "Chamber 2025"),
    lat: 32.2776565,
    lng: -86.3122697,
    corridorTags: ["hyundai-blvd"],
    fence: "in" as const,
    industryTags: ["logistics", "auto", "warehouse"],
    sizeBand: "500+" as const,
    headcountClaim: { value: 830, trust: "verified" as const, sourceLabel: "Chamber 2025", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-9-0", title: "Warehouse Associate", family: "warehouse", seenAt: OBS, sourceLabel: "Chamber 2025", trust: "verified" as const },
    { id: "ar-9-1", title: "Logistics Coordinator", family: "logistics", seenAt: OBS, sourceLabel: "Chamber 2025", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-9-0", year: 2025, summary: "Chamber: ~830 emp vehicle processing / Hyundai ecosystem", sourceLabel: "Chamber", trust: "verified" as const }
    ],
    summaryParagraphs: ["Glovis Alabama sits on Hyundai Boulevard as a large VPC/logistics node in the OEM ecosystem with chamber headcount near 830.", "Hyundai-park dynamics apply for access; treat as parked for cold OEM politics until you have a path, but supplier logistics roles can still be workable."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-10-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-11",
    name: "MOBIS of Alabama",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("1395 Mitchell Young Rd, Montgomery, AL", "Chamber / iSolved"),
    lat: 32.3264889,
    lng: -86.4388746,
    corridorTags: ["mitchell-young"],
    fence: "in" as const,
    industryTags: ["auto", "manufacturing", "production"],
    sizeBand: "500+" as const,
    headcountClaim: { value: 1500, trust: "verified" as const, sourceLabel: "Chamber / iSolved", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "mobisof-main",
      role: "other" as const,
      phone: phoneClaim("(334) 387-4800", "Chamber / iSolved"),
    }
    ],
    activeRoles: [
    { id: "ar-10-0", title: "Production Associate", family: "production", seenAt: OBS, sourceLabel: "Chamber / iSolved", trust: "verified" as const },
    { id: "ar-10-1", title: "Maintenance", family: "production", seenAt: OBS, sourceLabel: "Chamber / iSolved", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-10-0", year: 2025, summary: "~1,500 emp with ongoing production hiring signals", sourceLabel: "Chamber / iSolved", trust: "verified" as const }
    ],
    summaryParagraphs: ["MOBIS of Alabama is a major auto supplier on Mitchell Young Road with roughly 1,500 employees and recurring production hiring in public channels.", "Verified phone on seed. Huge associate volume potential \u2014 log incumbent staffing as soon as you hear who owns the account."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-11-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-12",
    name: "Lear Corporation Montgomery",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("200 Folmar Pkwy, Montgomery, AL", "Chamber / Lear jobs"),
    lat: 32.26041,
    lng: -86.3686,
    corridorTags: ["folmar"],
    fence: "in" as const,
    industryTags: ["auto", "manufacturing", "production"],
    sizeBand: "250-499" as const,
    headcountClaim: { value: 373, trust: "verified" as const, sourceLabel: "Chamber / Lear jobs", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "learcor-main",
      role: "other" as const,
      phone: phoneClaim("(334) 280-5500", "Chamber / Lear jobs"),
    }
    ],
    activeRoles: [
    { id: "ar-11-0", title: "Production Supervisor", family: "production", seenAt: OBS, sourceLabel: "Chamber / Lear jobs", trust: "verified" as const },
    { id: "ar-11-1", title: "Assembly Associate", family: "production", seenAt: OBS, sourceLabel: "Chamber / Lear jobs", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-11-0", year: 2025, summary: "Chamber lists Folmar plant \u00b7 ~373 emp", sourceLabel: "Chamber / Lear jobs", trust: "verified" as const }
    ],
    summaryParagraphs: ["Lear\u2019s Folmar Parkway plant is a mid-size seating/auto manufacturer with a few hundred employees and regular assembly hiring patterns.", "Verified main line. Folmar corridor blitzes well with Hager, Transys, and HD Power Transformers."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-12-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-13",
    name: "Hager Companies",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("150 Folmar Pkwy, Montgomery, AL", "Hager careers 2026"),
    lat: 32.2629749,
    lng: -86.3664859,
    corridorTags: ["folmar"],
    fence: "in" as const,
    industryTags: ["manufacturing", "production"],
    sizeBand: "100-249" as const,
    headcountClaim: { value: 212, trust: "verified" as const, sourceLabel: "Hager careers 2026", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "hagerco-main",
      role: "other" as const,
      phone: phoneClaim("(334) 284-4704", "Hager careers 2026"),
    }
    ],
    activeRoles: [
    { id: "ar-12-0", title: "CNC / Machining", family: "production", seenAt: OBS, sourceLabel: "Hager careers 2026", trust: "verified" as const },
    { id: "ar-12-1", title: "Maintenance", family: "production", seenAt: OBS, sourceLabel: "Hager careers 2026", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-12-0", year: 2026, summary: "Careers show production and machining hiring", sourceLabel: "Hager careers", trust: "verified" as const }
    ],
    summaryParagraphs: ["Hager Companies on Folmar is a machining/production shop with about 200 employees and public careers activity in tool/production lanes.", "Sweet-spot size for relationship selling. Verified phone. Strong \u2018small-to-mid growing manufacturer\u2019 narrative."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-13-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-14",
    name: "James Hardie Prattville",
    aliases: [],
    city: "Prattville",
    
    lat: 32.4600136,
    lng: -86.4753174,
    corridorTags: ["prattville"],
    fence: "edge" as const,
    industryTags: ["manufacturing", "production", "construction"],
    sizeBand: "100-249" as const,
    
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-13-0", title: "Production Operator", family: "production", seenAt: OBS, sourceLabel: "James Hardie 2026", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-13-0", year: 2026, summary: "Capacity expansion referenced as Project Mayfield", sourceLabel: "James Hardie", trust: "verified" as const }
    ],
    summaryParagraphs: ["James Hardie in Prattville is tied to a capacity expansion narrative (Project Mayfield) in public company communications.", "Edge fence, construction-products manufacturing. Enrich phone before dial; pair with Owens Corning on Prattville days."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-14-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-15",
    name: "Medline Industries Prattville",
    aliases: [],
    city: "Prattville",
    physicalAddress: addrClaim("735 County Rd 4 E, Prattville, AL", "Medline Workday"),
    lat: 32.501,
    lng: -86.412,
    corridorTags: ["prattville"],
    fence: "edge" as const,
    industryTags: ["warehouse", "logistics", "healthcare"],
    sizeBand: "100-249" as const,
    
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "medline-main",
      role: "other" as const,
      phone: phoneClaim("(334) 361-6444", "Medline Workday"),
    }
    ],
    activeRoles: [
    { id: "ar-14-0", title: "Warehouse Associate", family: "warehouse", seenAt: OBS, sourceLabel: "Medline Workday", trust: "verified" as const },
    { id: "ar-14-1", title: "Class A Driver", family: "cdl", seenAt: OBS, sourceLabel: "Medline Workday", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-14-0", year: 2026, summary: "Workday shows warehouse and Class A driver openings", sourceLabel: "Medline Workday", trust: "verified" as const }
    ],
    summaryParagraphs: ["Medline\u2019s Prattville site posts warehouse and Class A driving roles \u2014 healthcare distribution with classic Express-shaped labor needs.", "Verified phone in seed from public listings. Good Autauga stop when you\u2019re already north of the river."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-15-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-16",
    name: "Wayne-Sanderson Farms",
    aliases: [],
    city: "Union Springs",
    
    lat: 32.1447494,
    lng: -85.7160956,
    corridorTags: ["union-springs"],
    fence: "edge" as const,
    industryTags: ["food", "production", "warehouse"],
    sizeBand: "250-499" as const,
    
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-15-0", title: "Line Associate", family: "production", seenAt: OBS, sourceLabel: "Wayne Farms Workday", trust: "verified" as const },
    { id: "ar-15-1", title: "Hatchery", family: "production", seenAt: OBS, sourceLabel: "Wayne Farms Workday", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-15-0", year: 2026, summary: "Expansion notes plus ongoing line associate hiring on Workday", sourceLabel: "Wayne Farms Workday", trust: "verified" as const }
    ],
    summaryParagraphs: ["Wayne-Sanderson in Union Springs is poultry production with public expansion chatter and ongoing line associate demand.", "Seasonal and shift-heavy \u2014 capture hiring history honestly when scrubbing. Phone not in seed."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-16-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-17",
    name: "Retem Steel",
    aliases: [],
    city: "Tallassee",
    
    lat: 32.5348568,
    lng: -85.8922974,
    corridorTags: ["tallassee"],
    fence: "edge" as const,
    industryTags: ["manufacturing", "steel"],
    sizeBand: "50-99" as const,
    
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-16-0", title: "Welder", family: "production", seenAt: OBS, sourceLabel: "Tallassee Times", trust: "verified" as const },
    { id: "ar-16-1", title: "CNC", family: "production", seenAt: OBS, sourceLabel: "Tallassee Times", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-16-0", year: 2026, summary: "Local press: recruiting again Oct 2026 at Hwy 229 plant", sourceLabel: "Tallassee Times", trust: "verified" as const }
    ],
    summaryParagraphs: ["Retem Steel\u2019s Tallassee plant resurfaced in local press for recruiting \u2014 welding and fabrication lanes.", "Smaller manufacturer, exactly the growing-account profile. Verify phone on refresh; high personal touch value."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-17-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-18",
    name: "Adient Clanton",
    aliases: [],
    city: "Clanton",
    
    lat: 32.8392013,
    lng: -86.6309229,
    corridorTags: ["clanton"],
    fence: "edge" as const,
    industryTags: ["auto", "manufacturing", "production"],
    sizeBand: "500+" as const,
    headcountClaim: { value: 703, trust: "verified" as const, sourceLabel: "Clanton Advertiser", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-17-0", title: "Production Operator", family: "production", seenAt: OBS, sourceLabel: "Clanton Advertiser", trust: "verified" as const },
    { id: "ar-17-1", title: "Quality", family: "quality", seenAt: OBS, sourceLabel: "Clanton Advertiser", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-17-0", year: 2026, summary: "Local press: 703+ emp \u00b7 Nissan P42 launch Mar 2026", sourceLabel: "Clanton Advertiser", trust: "verified" as const }
    ],
    summaryParagraphs: ["Adient Clanton is a large seating plant with public headcount over 700 and launch-related hiring around Nissan P42 timing.", "Edge of fence but worth the drive for volume. Confirm staffing incumbent before pitching."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-18-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-19",
    name: "Viscofan",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("50 County Court Ln, Montgomery, AL", "Jobsparx / Chamber"),
    lat: 32.392,
    lng: -86.165,
    corridorTags: ["east-montgomery"],
    fence: "in" as const,
    industryTags: ["food", "manufacturing", "production"],
    sizeBand: "100-249" as const,
    headcountClaim: { value: 200, trust: "verified" as const, sourceLabel: "Jobsparx / Chamber", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "viscofan-main",
      role: "other" as const,
      phone: phoneClaim("(334) 396-0092", "Jobsparx / Chamber"),
    }
    ],
    activeRoles: [
    { id: "ar-18-0", title: "General Production", family: "production", seenAt: OBS, sourceLabel: "Jobsparx / Chamber", trust: "verified" as const },
    { id: "ar-18-1", title: "Forklift", family: "warehouse", seenAt: OBS, sourceLabel: "Jobsparx / Chamber", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-18-0", year: 2025, summary: "~200 emp with general production and forklift posting patterns", sourceLabel: "Jobsparx / Chamber", trust: "verified" as const }
    ],
    summaryParagraphs: ["Viscofan\u2019s Montgomery casing plant is a mid-size food manufacturer with roughly 200 employees and recurring production/forklift posts.", "Verified phone. East-side stop that pairs with office-proximate blitzes."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-19-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-20",
    name: "Genpak Hope Hull",
    aliases: [],
    city: "Hope Hull",
    physicalAddress: addrClaim("7621 Bill Joseph Pkwy, Hope Hull, AL", "DCOM / Chamber"),
    lat: 32.248,
    lng: -86.365,
    corridorTags: ["bill-joseph", "hope-hull"],
    fence: "in" as const,
    industryTags: ["manufacturing", "packaging", "production"],
    sizeBand: "100-249" as const,
    
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "genpakh-main",
      role: "other" as const,
      phone: phoneClaim("(334) 612-0314", "DCOM / Chamber"),
    }
    ],
    activeRoles: [
    { id: "ar-19-0", title: "Production Operator", family: "production", seenAt: OBS, sourceLabel: "DCOM / Chamber", trust: "verified" as const },
    { id: "ar-19-1", title: "Maintenance", family: "production", seenAt: OBS, sourceLabel: "DCOM / Chamber", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-19-0", year: 2025, summary: "$9.2M expansion announced", sourceLabel: "DCOM / Chamber", trust: "verified" as const }
    ],
    summaryParagraphs: ["Genpak on Bill Joseph Parkway in Hope Hull publicly announced a multimillion-dollar expansion \u2014 packaging/production growth on the south industrial corridor.", "Verified phone. Cluster with Seoyon and other Bill Joseph employers for a single drive loop."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-20-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-21",
    name: "Hyundai Motor Manufacturing Alabama",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("700 Hyundai Blvd, Montgomery, AL", "Governor / HMMA careers Oct 2026"),
    lat: 32.2776581,
    lng: -86.3366405,
    corridorTags: ["hyundai-blvd"],
    fence: "in" as const,
    industryTags: ["auto", "manufacturing", "production"],
    sizeBand: "500+" as const,
    headcountClaim: { value: 4200, trust: "verified" as const, sourceLabel: "Governor / HMMA careers Oct 2026", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "hyundai-main",
      role: "other" as const,
      phone: phoneClaim("(334) 387-8000", "Governor / HMMA careers Oct 2026"),
    }
    ],
    activeRoles: [
    { id: "ar-20-0", title: "Production Team Member", family: "production", seenAt: OBS, sourceLabel: "Governor / HMMA careers Oct 2026", trust: "verified" as const },
    { id: "ar-20-1", title: "HR Leadership", family: "hr", seenAt: OBS, sourceLabel: "Governor / HMMA careers Oct 2026", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-20-0", year: 2026, summary: "Project Game Changer $412.9M \u00b7 HR leadership openings noted", sourceLabel: "Governor / HMMA careers", trust: "verified" as const }
    ],
    summaryParagraphs: ["HMMA is the OEM center of gravity \u2014 thousands of employees on Hyundai Boulevard with ongoing Game Changer investment coverage.", "Parked for cold OEM politics until you have a path in; still useful as ecosystem context for suppliers you can sell today."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-21-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-22",
    name: "Hyundai Transys",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("301 Folmar Pkwy, Montgomery, AL", "Hyundai Transys careers"),
    lat: 32.263558,
    lng: -86.3658856,
    corridorTags: ["folmar"],
    fence: "in" as const,
    industryTags: ["auto", "manufacturing", "production"],
    sizeBand: "100-249" as const,
    
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "hyundai-main",
      role: "other" as const,
      phone: phoneClaim("(706) 902-5500", "Hyundai Transys careers"),
    }
    ],
    activeRoles: [
    { id: "ar-21-0", title: "Maintenance", family: "production", seenAt: OBS, sourceLabel: "Hyundai Transys careers", trust: "verified" as const },
    { id: "ar-21-1", title: "Team Relations", family: "hr", seenAt: OBS, sourceLabel: "Hyundai Transys careers", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-21-0", year: 2026, summary: "Careers show maintenance and team-relations postings", sourceLabel: "Hyundai Transys careers", trust: "verified" as const }
    ],
    summaryParagraphs: ["Hyundai Transys on Folmar is an OEM supplier with public maintenance and team-relations posting activity.", "Verified phone (public careers). Folmar corridor account \u2014 easier relationship path than the OEM gate."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-22-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-23",
    name: "Acme Brick Montgomery",
    aliases: [],
    city: "Montgomery",
    
    lat: 32.3777111,
    lng: -86.3090775,
    corridorTags: ["montgomery"],
    fence: "in" as const,
    industryTags: ["manufacturing", "warehouse"],
    sizeBand: "50-99" as const,
    
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [

    ],
    hiringHistory: [
    { id: "hh-22-0", year: 2026, summary: "WARN: 53 closures reported \u00b7 plant closing 12/31/2026", sourceLabel: "AL WARN / AL.com", trust: "verified" as const }
    ],
    summaryParagraphs: ["Acme Brick Montgomery appears on the AL WARN list with a planned plant closure late 2026.", "Not a hiring growth play \u2014 keep for awareness / disqualify-out-of-business when closure completes. Opportunity should stay low."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-23-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-24",
    name: "The Andersons Montgomery",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("1500 Furnace St, Montgomery, AL", "AL WARN / AL.com Oct 2026"),
    lat: 32.403956,
    lng: -86.31471,
    corridorTags: ["furnace"],
    fence: "in" as const,
    industryTags: ["warehouse", "agriculture", "logistics"],
    sizeBand: "50-99" as const,
    
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [

    ],
    hiringHistory: [
    { id: "hh-23-0", year: 2026, summary: "WARN: 64 closures \u00b7 facility closing 12/2/2026", sourceLabel: "AL WARN / AL.com", trust: "verified" as const }
    ],
    summaryParagraphs: ["The Andersons\u2019 Furnace Street site is on WARN for a December 2026 facility closure.", "Monitor only; strong candidate for disqualify as out_of_business when the date hits. Do not spend dials chasing growth here."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-24-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-25",
    name: "Bella+Canvas Wetumpka",
    aliases: [],
    city: "Wetumpka",
    physicalAddress: addrClaim("3145 Elmore Rd, Wetumpka, AL", "Governor / Chamber"),
    lat: 32.5353458,
    lng: -86.2327068,
    corridorTags: ["wetumpka", "elmore"],
    fence: "edge" as const,
    industryTags: ["manufacturing", "apparel", "production"],
    sizeBand: "250-499" as const,
    headcountClaim: { value: 557, trust: "verified" as const, sourceLabel: "Governor / Chamber", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-24-0", title: "Production", family: "production", seenAt: OBS, sourceLabel: "Governor / Chamber", trust: "verified" as const },
    { id: "ar-24-1", title: "Cutting / Sewing", family: "production", seenAt: OBS, sourceLabel: "Governor / Chamber", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-24-0", year: 2025, summary: "High-tech fabric cutting investment \u00b7 ~557 jobs announced", sourceLabel: "Governor / Chamber", trust: "verified" as const }
    ],
    summaryParagraphs: ["Bella+Canvas in Wetumpka is an apparel manufacturing growth story with hundreds of announced roles tied to advanced fabric cutting.", "Edge fence, Elmore County. Production volume potential; verify phone on scrub."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-25-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-26",
    name: "Kimber Manufacturing Troy",
    aliases: [],
    city: "Troy",
    
    lat: 31.8087678,
    lng: -85.969951,
    corridorTags: ["troy"],
    fence: "edge" as const,
    industryTags: ["manufacturing", "defense", "production"],
    sizeBand: "250-499" as const,
    headcountClaim: { value: 475, trust: "verified" as const, sourceLabel: "Troy Messenger PROGRESS 2025", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [

    ],
    activeRoles: [
    { id: "ar-25-0", title: "Manufacturing Associate", family: "production", seenAt: OBS, sourceLabel: "Troy Messenger PROGRESS 2025", trust: "verified" as const },
    { id: "ar-25-1", title: "Machinist", family: "production", seenAt: OBS, sourceLabel: "Troy Messenger PROGRESS 2025", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-25-0", year: 2025, summary: "Troy Messenger: ~475 emp firearms plant", sourceLabel: "Troy Messenger PROGRESS", trust: "verified" as const }
    ],
    summaryParagraphs: ["Kimber\u2019s Troy plant is a defense/firearms manufacturer with local press headcount near 475.", "Pairs with Lockheed on Troy days. Confirm security/visitor rules; enrich phone before claiming a dial."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-26-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
  {
    id: "co-27",
    name: "Seoyon E-Hwa Montgomery",
    aliases: [],
    city: "Montgomery",
    physicalAddress: addrClaim("7851 Bill Joseph Pkwy, Montgomery, AL", "Chamber / LinkedIn"),
    lat: 32.245,
    lng: -86.368,
    corridorTags: ["bill-joseph", "hope-hull"],
    fence: "in" as const,
    industryTags: ["auto", "manufacturing", "production"],
    sizeBand: "250-499" as const,
    headcountClaim: { value: 300, trust: "verified" as const, sourceLabel: "Chamber / LinkedIn", observedAt: OBS, method: "extract" as const },
    incumbentStaffing: "unknown" as const,
    contacts: [
    {
      id: "seoyone-main",
      role: "other" as const,
      phone: phoneClaim("(334) 309-0500", "Chamber / LinkedIn"),
    },
    {
      id: "seoyone-hr-signal",
      role: "hr" as const,
      name: { value: "HR Team", trust: "signal" as const, sourceLabel: "LinkedIn / public posts — unconfirmed", observedAt: OBS, method: "extract" as const },
      title: { value: "HR", trust: "signal" as const, sourceLabel: "LinkedIn / public posts — unconfirmed", observedAt: OBS, method: "extract" as const },
    }
    ],
    activeRoles: [
    { id: "ar-26-0", title: "Production Operator", family: "production", seenAt: OBS, sourceLabel: "Chamber / LinkedIn", trust: "verified" as const },
    { id: "ar-26-1", title: "Door Trim Associate", family: "production", seenAt: OBS, sourceLabel: "Chamber / LinkedIn", trust: "verified" as const }
    ],
    hiringHistory: [
    { id: "hh-26-0", year: 2025, summary: "~300 emp door trim; HR team contacts noted in public professional posts", sourceLabel: "Chamber / LinkedIn", trust: "verified" as const }
    ],
    summaryParagraphs: ["Seoyon E-Hwa on Bill Joseph Parkway builds door trim with roughly 300 employees in chamber-facing notes.", "Verified main line. Signal-only HR naming from professional network posts stays in Signal until a primary page confirms. Cluster with Genpak."] as [string, string],
    summaryUpdatedAt: OBS,
    status: "active" as const,
    watchlist: false,
    lastEnrichedAt: OBS,
    bookStatus: "not_in_book" as const,
    enrichmentLog: [
      { id: "log-27-1", at: OBS, summary: "Wave-1 seed from territory research pack · claims cited · no invented phones" }
    ],
  },
];

export const SEED_COMPANIES: CompanyRecord[] = raw.map((r) => {
  const { breakdown, opportunity } = computeScores(r);
  return { ...r, scoreBreakdown: breakdown, opportunityScore: opportunity };
});

export function enrichmentHealth(companies: CompanyRecord[]) {
  const active = companies.filter((c) => c.status === "active");
  const n = active.length || 1;
  const verifiedPhone = active.filter((c) => c.contacts.some((x) => x.phone?.trust === "verified")).length;
  const namedDm = active.filter((c) => c.contacts.some((x) => x.name?.trust === "verified" && (x.role === "owner" || x.role === "operations" || x.role === "hr"))).length;
  const fresh = active.filter((c) => (Date.now() - Date.parse(c.lastEnrichedAt)) / 86400000 <= 14).length;
  return {
    total: active.length,
    verifiedPhonePct: Math.round((verifiedPhone / n) * 100),
    namedDmPct: Math.round((namedDm / n) * 100),
    freshPct: Math.round((fresh / n) * 100),
  };
}