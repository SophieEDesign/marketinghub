import type { MerchCatalogueImage, MerchInventoryItem } from "@/lib/types";
import {
  CLOTHING_PRODUCTS,
  clothingProductByLabel,
  type ClothingBrand,
  type ClothingProduct,
} from "@/lib/merch/north-sails";

/** Map product id → catalogue row. */
export function catalogueByProductId(
  catalogue: MerchCatalogueImage[]
): Record<string, MerchCatalogueImage> {
  const map: Record<string, MerchCatalogueImage> = {};
  for (const row of catalogue) {
    if (row.product_id) map[row.product_id] = row;
  }
  return map;
}

/** Map product id → catalogue image url. */
export function catalogueImageMap(
  catalogue: MerchCatalogueImage[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of catalogue) {
    const url = row.image_url?.trim();
    if (row.product_id && url) map[row.product_id] = url;
  }
  return map;
}

/** Apply stored catalogue overrides onto a built-in product. */
export function applyCatalogueOverrides(
  product: ClothingProduct,
  row?: MerchCatalogueImage | null
): ClothingProduct {
  if (!row) return product;
  const label = row.label?.trim();
  const brand = row.brand?.trim();
  const material = row.material?.trim();
  const colours = (row.colours ?? [])
    .map((c) => c.trim())
    .filter(Boolean);
  const defaultColour = row.default_colour?.trim();
  return {
    ...product,
    ...(label ? { label } : {}),
    ...(brand ? { brand: brand as ClothingBrand } : {}),
    ...(material ? { material } : {}),
    ...(colours.length ? { colours } : {}),
    ...(defaultColour ? { defaultColour } : {}),
  };
}

/** Built-in products with any catalogue name/brand/colour overrides applied. */
export function resolvedClothingProducts(
  catalogue: MerchCatalogueImage[]
): ClothingProduct[] {
  const byId = catalogueByProductId(catalogue);
  return CLOTHING_PRODUCTS.map((p) =>
    applyCatalogueOverrides(p, byId[p.id] ?? null)
  );
}

/** Effective display label for a product id (override or built-in). */
export function effectiveProductLabel(
  productId: string,
  catalogue: MerchCatalogueImage[]
): string | undefined {
  const base = CLOTHING_PRODUCTS.find((p) => p.id === productId);
  if (!base) return undefined;
  const row = catalogueByProductId(catalogue)[productId];
  return applyCatalogueOverrides(base, row ?? null).label;
}

/** First inventory photo found per item label. */
export function inventoryImageByItemLabel(
  inventory: MerchInventoryItem[]
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const row of inventory) {
    const label = row.item.trim();
    const url = row.image_url?.trim();
    if (!label || !url || map[label]) continue;
    map[label] = url;
  }
  return map;
}

/**
 * Prefer catalogue product photo, then any inventory photo for that item.
 */
export function resolveClothingProductImage(
  product: ClothingProduct,
  catalogueById: Record<string, string>,
  inventoryByLabel: Record<string, string>
): string {
  return (
    catalogueById[product.id]?.trim() ||
    inventoryByLabel[product.label]?.trim() ||
    ""
  );
}

export function clothingProductImageForLabel(
  label: string,
  catalogue: MerchCatalogueImage[],
  inventory: MerchInventoryItem[]
): string {
  const products = resolvedClothingProducts(catalogue);
  const product = clothingProductByLabel(label, products);
  if (!product) {
    return inventoryImageByItemLabel(inventory)[label.trim()] ?? "";
  }
  return resolveClothingProductImage(
    product,
    catalogueImageMap(catalogue),
    inventoryImageByItemLabel(inventory)
  );
}

export function clothingProductsWithImages(
  catalogue: MerchCatalogueImage[],
  inventory: MerchInventoryItem[]
): Array<ClothingProduct & { image_url: string }> {
  const byId = catalogueImageMap(catalogue);
  const byLabel = inventoryImageByItemLabel(inventory);
  return resolvedClothingProducts(catalogue).map((p) => ({
    ...p,
    image_url: resolveClothingProductImage(p, byId, byLabel),
  }));
}
