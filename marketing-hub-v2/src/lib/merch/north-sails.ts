/** North Sails corporate clothing catalogue (Peters & May). */

export type ClothingFit = "male" | "female";

export type ClothingProduct = {
  id: string;
  label: string;
  brand: "North Sails" | "Henbury";
  material?: string;
  colours: string[];
  defaultColour: string;
  /** Product page hints for staff */
  links?: { male?: string; female?: string };
};

export const CLOTHING_BRAND = "North Sails";

export const CLOTHING_FITS: { id: ClothingFit; label: string }[] = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
];

export const CLOTHING_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
] as const;

export const CLOTHING_PRODUCTS: ClothingProduct[] = [
  {
    id: "polo_regatta",
    label: "Polo — Regatta (polyester)",
    brand: "North Sails",
    material: "Polyester (recycled / recyclable)",
    colours: ["Navy", "White"],
    defaultColour: "Navy",
    links: {
      male: "https://www.northsails.com/en-uk/products/regatta-fast-dry-polo-27m110",
      female:
        "https://www.northsails.com/en-uk/products/regatta-fast-dry-polo-fw-27w108",
    },
  },
  {
    id: "polo_pique",
    label: "Polo — Pique (cotton)",
    brand: "North Sails",
    material: "Cotton (pique)",
    colours: ["Navy", "White"],
    defaultColour: "Navy",
    links: {
      male: "https://www.northsails.com/en-uk/products/pique-polo-27m105",
      female: "https://www.northsails.com/en-uk/products/pique-polo-fw-27w105",
    },
  },
  {
    id: "gilet",
    label: "Gilet — Marstrand (navy)",
    brand: "North Sails",
    colours: ["Navy"],
    defaultColour: "Navy",
    links: {
      male: "https://www.northsails.com/en-uk/products/marstrand-quilted-vest-27m084",
      female:
        "https://www.northsails.com/en-uk/products/women-27s-marstrand-quilted-vest-27w084",
    },
  },
  {
    id: "sailor_jacket",
    label: "Sailor jacket (navy)",
    brand: "North Sails",
    colours: ["Navy"],
    defaultColour: "Navy",
    links: {
      male: "https://www.northsails.com/en-uk/products/sailor-jacket-net-lined-27m085",
      female:
        "https://www.northsails.com/en-uk/products/sailor-jacket-net-lined-fw-27w085",
    },
  },
  {
    id: "collared_shirt",
    label: "Collared shirt (white)",
    brand: "Henbury",
    colours: ["White"],
    defaultColour: "White",
    links: {
      male: "https://www.promotional-store.com/en-GB/henbury/long-sleeve-classic-oxford-shirt",
      female:
        "https://www.promotional-store.com/en-GB/henbury/womens-classic-long-sleeve-oxford-shirt/",
    },
  },
];

export function clothingProductByLabel(label: string): ClothingProduct | undefined {
  return CLOTHING_PRODUCTS.find((p) => p.label === label);
}

export function clothingProductById(id: string): ClothingProduct | undefined {
  return CLOTHING_PRODUCTS.find((p) => p.id === id);
}

export function coloursForItem(itemLabel: string): string[] {
  return clothingProductByLabel(itemLabel)?.colours ?? ["Navy", "White"];
}

export function defaultColourForItem(itemLabel: string): string {
  return clothingProductByLabel(itemLabel)?.defaultColour ?? "Navy";
}
