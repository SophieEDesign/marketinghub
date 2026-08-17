export type BudgetAmount = number | null;

export type BudgetChild = {
  name: string;
  amount: BudgetAmount;
  note?: string;
};

export type BudgetLine = {
  id: string;
  name: string;
  code: string;
  marketing: BudgetAmount;
  sponsorship: BudgetAmount;
  travel: BudgetAmount;
  total: number;
  priorYear: BudgetAmount;
  variance: BudgetAmount;
  notes: string;
  children?: BudgetChild[];
};

export type BudgetNote = {
  title: string;
  body: string;
};

export type BudgetQuarterLine = {
  name: string;
  code: string;
  section?: boolean;
  marketing?: BudgetAmount;
  total?: BudgetAmount;
};

export type BudgetQuarter = {
  id: "Q1" | "Q2" | "Q3" | "Q4";
  title: string;
  lines: BudgetQuarterLine[];
};

export type MarketingBudget = {
  year: number;
  title: string;
  source: string;
  currency: "GBP";
  committedTotal: number;
  uncommittedTotal: number;
  committedPriorYearTotal: number;
  uncommittedPriorYearTotal: number;
  grandTotal: number;
  priorYearTotal: number;
  variance: number;
  committed: BudgetLine[];
  uncommitted: BudgetLine[];
  notes: BudgetNote[];
  extraEvents: {
    name: string;
    when: string;
    detail: string;
    people: string;
    cap: string;
  }[];
  quarters: BudgetQuarter[];
};

const QUARTER_TEMPLATE: BudgetQuarterLine[] = [
  { name: "Committed", code: "", section: true },
  { name: "ARC World Cruising", code: "MS1" },
  { name: "Antigua Sailing Week", code: "MS2" },
  { name: "SEO & PPC and Website Hosting & Maintenance (Uppcy)", code: "MP2" },
  { name: "Google Performance max campaigns", code: "MP3" },
  { name: "Press Services", code: "" },
  { name: "Video / Photography", code: "" },
  { name: "Google Ad Spend", code: "MP3" },
  { name: "Memberships", code: "MM" },
  { name: "Boat Show Attendance", code: "", section: true },
  { name: "Sales Trips Offices", code: "", section: true },
  { name: "USA", code: "MTX" },
  { name: "UK", code: "" },
  { name: "Italy", code: "" },
  { name: "France", code: "" },
  { name: "Netherlands", code: "" },
  { name: "Germany", code: "" },
  { name: "HQ", code: "" },
  { name: "Dubai", code: "" },
  { name: "Spain", code: "" },
  { name: "Asia", code: "" },
  { name: "Commercial Travel", code: "" },
  { name: "Commercial Shipyard Visits", code: "" },
  { name: "Racing", code: "" },
  { name: "FF & CEC Paul!", code: "" },
  { name: "Targeted Marketing", code: "", section: true },
  { name: "Marine", code: "MTG" },
  { name: "Racing", code: "" },
  { name: "Commercial", code: "" },
  { name: "Freight Forwarding & CEC", code: "" },
  { name: "Group", code: "" },
  { name: "Merchandise & Clothing", code: "", section: true },
  { name: "Merchandise", code: "MC" },
  { name: "Clothing", code: "" },
  { name: "Branded Stationery, Brochures", code: "" },
  { name: "Event Reserve", code: "", section: true },
  { name: "Group Event Winter 2026", code: "ME", marketing: 6000, total: 6000 },
];

function quarter(
  id: BudgetQuarter["id"],
  inserts: Record<string, BudgetQuarterLine[]> = {}
): BudgetQuarter {
  const lines: BudgetQuarterLine[] = [];
  for (const line of QUARTER_TEMPLATE) {
    lines.push(line);
    const extra = inserts[line.name];
    if (extra) lines.push(...extra);
  }
  return {
    id,
    title: `Budget Quarter ${id.slice(1)}`,
    lines,
  };
}

export const BUDGET_2026: MarketingBudget = {
  year: 2026,
  title: "Marketing Budget 2026",
  source: "Budget draft 2026.xlsx",
  currency: "GBP",
  committedTotal: 175676,
  uncommittedTotal: 151400,
  committedPriorYearTotal: 191478,
  uncommittedPriorYearTotal: 79000,
  grandTotal: 327076,
  priorYearTotal: 270478,
  variance: -56598,
  committed: [
    {
      id: "ms1",
      name: "ARC World Cruising",
      code: "MS1",
      marketing: 1800,
      sponsorship: 4000,
      travel: 5500,
      total: 11300,
      priorYear: 11300,
      variance: 0,
      notes:
        "Plus £1k credit on airfreight / FF sector. ARC+ Sundowner drinks included now, additional travel (contract includes ARC sundowner up to EUR 500. It was EUR 750 in 2025 for ARC Sundowner and in addition for ARC+ Sundowner).",
    },
    {
      id: "ms2",
      name: "Antigua Sailing Week",
      code: "MS2",
      marketing: null,
      sponsorship: null,
      travel: null,
      total: 0,
      priorYear: 23000,
      variance: 23000,
      notes: "Remove for 2026",
    },
    {
      id: "mp2",
      name: "SEO & PPC, web hosting + maintenance",
      code: "MP2",
      marketing: 19680,
      sponsorship: null,
      travel: null,
      total: 19680,
      priorYear: 19680,
      variance: 0,
      notes: "Uppcy Ltd £1,390 pm + website costs (plugins etc) approx. £250 a month",
    },
    {
      id: "nyyc",
      name: "NYYC RA",
      code: "",
      marketing: null,
      sponsorship: null,
      travel: null,
      total: 0,
      priorYear: 16100,
      variance: 16100,
      notes: "Not continued in 2026",
    },
    {
      id: "class31",
      name: "Class 31",
      code: "",
      marketing: null,
      sponsorship: null,
      travel: null,
      total: 0,
      priorYear: 8950,
      variance: 8950,
      notes: "Not continued in 2026",
    },
    {
      id: "saltwater",
      name: "Retainer Saltwater",
      code: "",
      marketing: null,
      sponsorship: null,
      travel: null,
      total: 0,
      priorYear: 49176,
      variance: 49176,
      notes: "Not continued in 2026",
    },
    {
      id: "press",
      name: "Press Service",
      code: "",
      marketing: 7500,
      sponsorship: null,
      travel: null,
      total: 7500,
      priorYear: null,
      variance: -7500,
      notes: "Distribution of our own press releases via an agency like Prowly",
    },
    {
      id: "video",
      name: "Video / Photography",
      code: "",
      marketing: 12000,
      sponsorship: null,
      travel: null,
      total: 12000,
      priorYear: null,
      variance: -12000,
      notes: "",
    },
    {
      id: "google-ads",
      name: "Google Ad Spend",
      code: "MP3",
      marketing: 84000,
      sponsorship: null,
      travel: null,
      total: 84000,
      priorYear: 42000,
      variance: -42000,
      notes: "Double Google ad spend",
    },
    {
      id: "pmax",
      name: "Google Performance Max campaigns",
      code: "",
      marketing: 12000,
      sponsorship: null,
      travel: null,
      total: 12000,
      priorYear: null,
      variance: -12000,
      notes: "",
    },
    {
      id: "memberships",
      name: "Memberships",
      code: "MM",
      marketing: null,
      sponsorship: 9196,
      travel: 20000,
      total: 29196,
      priorYear: 21272,
      variance: -7924,
      notes: "T&E covers membership-related travel. Named association fees below are part of this line.",
      children: [
        {
          name: "Port Everglades Association USD 1800",
          amount: 1600,
        },
        {
          name: "Marine Industries Associations USD 525",
          amount: 450,
        },
        {
          name: "Young Professionals in Yachting USD 150 pp",
          amount: 350,
        },
      ],
    },
  ],
  uncommitted: [
    {
      id: "mbx",
      name: "Boat Show Attendance",
      code: "MBX",
      marketing: 5000,
      sponsorship: 0,
      travel: 53860,
      total: 58860,
      priorYear: 40000,
      variance: -18860,
      notes: "",
      children: [
        { name: "Düsseldorf", amount: 7000 },
        { name: "Cannes", amount: 7000 },
        { name: "Miami", amount: 860 },
        { name: "FLIBS", amount: 2000 },
        { name: "Genoa", amount: 600 },
        { name: "Monaco", amount: 1000 },
        { name: "METS", amount: 1000 },
        { name: "La Rochelle", amount: 500 },
        { name: "Annapolis", amount: 3000 },
        { name: "West Palm Beach", amount: 2000 },
        { name: "Palma", amount: 1000 },
        { name: "Poland", amount: 1000 },
        {
          name: "Various Scandinavian",
          amount: 1000,
          note: "£750 Stockholm + Copenhagen",
        },
        {
          name: "Singapore boat show 23–26 (Darren, Ai Xing, Luke, agent's dinner)",
          amount: 6000,
        },
        { name: "Thailand Phuket January USD 800", amount: 600 },
        {
          name: "Shanghai China 29.03–01.04 USD 200",
          amount: 200,
        },
        {
          name: "Asia Pacific Superyacht Summit, Kobe, Japan 7–8 May 2026",
          amount: 2500,
        },
        { name: "Hong Kong December USD 800", amount: 600 },
        { name: "APM commercial Singapore", amount: 500 },
        { name: "Seawork — Charles, June", amount: 1000 },
        { name: "BBK Singapore", amount: 500 },
        { name: "Sanctuary Cove — Charles / Luke", amount: 4000 },
        { name: "Office local show attendance", amount: 2000 },
        { name: "Commercial Wind Energy HH", amount: 2000 },
        { name: "Commercial Interferry", amount: 4000 },
        { name: "Europort", amount: 2000 },
      ],
    },
    {
      id: "mtx",
      name: "Sales Trips Offices",
      code: "MTX",
      marketing: 0,
      sponsorship: 0,
      travel: 28500,
      total: 28500,
      priorYear: null,
      variance: -28500,
      notes: "",
      children: [
        { name: "USA", amount: 2500 },
        { name: "UK", amount: 1000 },
        { name: "Italy", amount: 1000 },
        { name: "France", amount: 1000 },
        { name: "Netherlands", amount: 1000 },
        { name: "Germany", amount: 1000 },
        { name: "HQ", amount: 2000 },
        { name: "Dubai", amount: 1000 },
        { name: "Spain", amount: 1000 },
        { name: "Asia", amount: 2000 },
        { name: "Commercial Travel", amount: 10000 },
        { name: "Commercial Shipyard Visits", amount: 2000 },
        { name: "Racing", amount: 3000 },
      ],
    },
    {
      id: "mtg",
      name: "Targeted Marketing",
      code: "MTG",
      marketing: 19040,
      sponsorship: 0,
      travel: 5000,
      total: 24040,
      priorYear: 10000,
      variance: -14040,
      notes: "",
      children: [
        {
          name: "Nautique Dealer Meeting Sponsorship US USD 2000",
          amount: 1800,
        },
        { name: "Oceanskies P&M Cannes Drinks Event", amount: 500 },
        { name: "Seahorse Ad £290 a month", amount: 3480 },
        { name: "Social Media Campaigns", amount: 600 },
        { name: "Yachtworld Ad or similar", amount: 1500 },
        {
          name: "HubSpot (replacing Campaign Monitor & Zoho) £90 a month / per user",
          amount: 2160,
        },
        {
          name: "Marine — seminars, displays, digital ads, event attendance, editorials",
          amount: 5000,
        },
        {
          name: "Racing — race attendance, goodie bags, champagne",
          amount: 2000,
        },
        { name: "Commercial — PR, marketing, brochures", amount: 2000 },
      ],
    },
    {
      id: "mc",
      name: "Merchandise & Clothing",
      code: "MC",
      marketing: 16000,
      sponsorship: 0,
      travel: 0,
      total: 16000,
      priorYear: 5000,
      variance: -11000,
      notes: "",
      children: [
        {
          name: "Merchandise: snoods, biscuits, diaries, keytags",
          amount: 6000,
        },
        {
          name: "Clothing: for sales staff — polo shirts, formal shirts, jackets, rucksacks",
          amount: 5000,
        },
        {
          name: "Branded stationery: name tags, business cards, brochures, leaflets",
          amount: 5000,
        },
      ],
    },
    {
      id: "me",
      name: "Event Reserve",
      code: "ME",
      marketing: 24000,
      sponsorship: 0,
      travel: 0,
      total: 24000,
      priorYear: 24000,
      variance: 0,
      notes: "Fixed £6,000 per quarter for Group Event Winter 2026",
    },
  ],
  notes: [
    {
      title: "Google Ads",
      body: "Double the budget — double the leads. Recommendation: double the monthly budget and use any remainder for LinkedIn, social media, and Performance Max campaigns (pop-up ads on other websites). Google Ads and digital presence is trial and error.",
    },
    {
      title: "Yachtworld Ad",
      body: "Sophie looking into where the clicks came from and possibly a digital ad there.",
    },
    {
      title: "HubSpot",
      body: "Replace Campaign Monitor and Zoho (online chat) with HubSpot.",
    },
    {
      title: "Posters",
      body: "Posters for marina offices and yacht clubs. Posters for guides, less salesy.",
    },
    {
      title: "AI / SEO",
      body: "We cannot control AI, but we need to ensure the website has question-based answers and more guides so AI finds us via SEO. German language page update.",
    },
    {
      title: "Saltwater editorials",
      body: "Any editorials / content Saltwater arranged did not provide clicks or conversions. Not measurable — simply brand awareness.",
    },
    {
      title: "E-shots",
      body: "E-shots increasing conversions.",
    },
    {
      title: "Yacht sponsorship",
      body: "Sponsor a yacht (Volvo)? Craig said not possible — GAC is official logistics supplier of The Ocean Race so they will not allow another sponsor like us.",
    },
    {
      title: "Ideas",
      body: "Webinars? Partner with someone? Add local sales trip for Italy (MC). Crew kit.",
    },
  ],
  extraEvents: [
    {
      name: "St. Petersburg, FL",
      when: "15–18 Jan 2026",
      detail:
        "Local FL market engagement. Connect with regional / local brokers and dealers. Strengthen our presence in West Florida.",
      people:
        "Atlas Yacht Sales, Bavaria, Black Label Marine Group, Coastal Marine, Clearwater Marine, East Marine Boats, Edgewater Yacht Sales",
      cap: "Max USD 1,500. Chris trying to reduce it by shortening the trip and driving.",
    },
    {
      name: "Antigua",
      when: "February",
      detail: "Racing team / Steve sales trip Antigua after RORC.",
      people: "Teams, flying P&M flag.",
      cap: "",
    },
  ],
  quarters: [
    quarter("Q1", {
      "Boat Show Attendance": [
        { name: "Düsseldorf", code: "MB1" },
        { name: "Miami", code: "MB6" },
        { name: "West Palm Beach", code: "MB8" },
        { name: "Singapore", code: "MB8" },
        { name: "Other Reserve", code: "MB8" },
      ],
    }),
    quarter("Q2"),
    quarter("Q3"),
    quarter("Q4"),
  ],
};
