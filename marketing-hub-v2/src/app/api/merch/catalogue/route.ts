import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin, requireStaff } from "@/lib/api";
import {
  listMerchCatalogue,
  listMerchInventory,
  upsertMerchCatalogueImage,
} from "@/lib/data/repos";
import { clothingProductById } from "@/lib/merch/north-sails";
import { clothingProductsWithImages } from "@/lib/merch/product-images";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;
  const [catalogue, inventory] = await Promise.all([
    listMerchCatalogue(),
    listMerchInventory(),
  ]);
  return jsonOk({
    catalogue,
    products: clothingProductsWithImages(catalogue, inventory),
  });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const body = await request.json();
  const productId =
    typeof body.product_id === "string" ? body.product_id.trim() : "";
  if (!productId || !clothingProductById(productId)) {
    return jsonError("Unknown clothing product", 400);
  }
  const imageUrl = typeof body.image_url === "string" ? body.image_url : "";
  const item = await upsertMerchCatalogueImage(productId, imageUrl);
  const [catalogue, inventory] = await Promise.all([
    listMerchCatalogue(),
    listMerchInventory(),
  ]);
  return jsonOk({
    item,
    catalogue,
    products: clothingProductsWithImages(catalogue, inventory),
  });
}
