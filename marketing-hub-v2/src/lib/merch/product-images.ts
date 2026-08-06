import type { MerchCatalogueImage, MerchInventoryItem } from "@/lib/types";
import {
  CLOTHING_PRODUCTS,
  clothingProductByLabel,
  type ClothingProduct,
} from "@/lib/merch/north-sails";

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
  const product = clothingProductByLabel(label);
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
  return CLOTHING_PRODUCTS.map((p) => ({
    ...p,
    image_url: resolveClothingProductImage(p, byId, byLabel),
  }));
}
