/**
 * Peters & May Brand Guidelines v2.0 (July 2026) — colour and type tokens.
 * Source: Group Marketing working draft. Red stays in logo artwork only.
 */

export const BRAND_VERSION = "2.0";
export const BRAND_ISSUED = "July 2026";

export const COLORS = {
  ensignNavy: {
    name: "Ensign Navy",
    hex: "#0B2545",
    rgb: "R11 G37 B69",
    cmyk: "C100 M85 Y45 K45",
    role: "Primary brand colour — leads marketing material",
  },
  deepNavy: {
    name: "Deep Navy",
    hex: "#071A2E",
    rgb: "R7 G26 B46",
    cmyk: "C100 M85 Y50 K65",
    role: "Darker navy for reversed layouts and deep photography",
  },
  slateNavy: {
    name: "Slate Navy",
    hex: "#1B3A5B",
    rgb: "R27 G58 B91",
    cmyk: "C95 M75 Y35 K25",
    role: "Secondary navy for hover and supporting surfaces",
  },
  pmBlue: {
    name: "P&M Blue",
    hex: "#007DC5",
    rgb: "R0 G125 B197",
    cmyk: "C100 M40 Y0 K0",
    role: "Single accent — the blue in the logo tile",
  },
  white: {
    name: "White",
    hex: "#FFFFFF",
    rgb: "R255 G255 B255",
    cmyk: "C0 M0 Y0 K0",
    role: "Working surface for documents and dashboards",
  },
  mist: {
    name: "Mist",
    hex: "#E3E6E9",
    rgb: "R227 G230 B233",
    cmyk: "C10 M6 Y5 K0",
    role: "Quiet fills, hairline panels, row banding",
  },
  harbourGrey: {
    name: "Harbour Grey",
    hex: "#8A9099",
    rgb: "R138 G144 B153",
    cmyk: "C48 M35 Y30 K5",
    role: "Artwork band and UI muted text",
  },
  ensignRed: {
    name: "Ensign Red",
    hex: "#ED1C24",
    rgb: "R237 G28 B36",
    cmyk: "C0 M100 Y100 K0",
    role: "Logo artwork only — never a layout colour",
  },
} as const;

/** Colours shown in the Brand tab palette (excludes red — logo only). */
export const PALETTE_SWATCHES = [
  COLORS.ensignNavy,
  COLORS.deepNavy,
  COLORS.slateNavy,
  COLORS.pmBlue,
  COLORS.mist,
  COLORS.harbourGrey,
] as const;

export const TYPOGRAPHY = {
  display: {
    family: "League Spartan",
    use: "Headlines, titles, social",
  },
  body: {
    family: "Archivo",
    use: "Body, labels, tables, interface",
  },
  fallback: {
    family: "Arial",
    use: "Quotations, bookings, customs paperwork, email",
  },
  logo: {
    family: "PT Sans",
    use: "Wordmark artwork only — never retype the logotype",
  },
} as const;

export const LOCK_UPS = [
  {
    name: "Peters & May — Bespoke Logistics",
    role: "Corporate default — company-wide and multi-division",
  },
  {
    name: "Peters & May Global Yacht Transport",
    role: "Sail, motor and superyacht movements",
  },
  {
    name: "Peters & May Global Freight Forwarding",
    role: "Multimodal freight, customs, documentation, warehousing",
  },
  {
    name: "Peters & May Commercial Marine Transport",
    role: "Workboats, energy, salvage and project cargo",
  },
] as const;

export const BRAND_PROMISE =
  "We bring experienced thinking to complex logistics";

export const PRINCIPLES = [
  "Expertise",
  "Consultation",
  "Foresight",
  "Control",
  "Confidence",
] as const;
