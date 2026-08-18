import { NextRequest } from "next/server";
import { jsonError, jsonOk, requireAdmin, requireStaff } from "@/lib/api";
import {
  listMerchCatalogue,
  listMerchInventory,
  upsertMerchCatalogue,
} from "@/lib/data/repos";
import { clothingProductById } from "@/lib/merch/north-sails";
import { clothingProductsWithImages } from "@/lib/merch/product-images";

function parseColourList(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((c) => (typeof c === "string" ? c.trim() : ""))
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return undefined;
}

export async function GET(request: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;
  const includeHidden =
    request.nextUrl.searchParams.get("include_hidden") === "1";
  const [catalogue, inventory] = await Promise.all([
    listMerchCatalogue(),
    listMerchInventory(),
  ]);
  return jsonOk({
    catalogue,
    products: clothingProductsWithImages(catalogue, inventory, {
      includeHidden,
    }),
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

  const label =
    typeof body.label === "string" ? body.label.trim() : undefined;
  if (label !== undefined && !label) {
    return jsonError("Item name cannot be empty", 400);
  }

  const item = await upsertMerchCatalogue(productId, {
    image_url:
      typeof body.image_url === "string" ? body.image_url : undefined,
    label,
    brand: typeof body.brand === "string" ? body.brand : undefined,
    material: typeof body.material === "string" ? body.material : undefined,
    colours: parseColourList(body.colours),
    default_colour:
      typeof body.default_colour === "string"
        ? body.default_colour
        : undefined,
    hidden: typeof body.hidden === "boolean" ? body.hidden : undefined,
  });
  const [catalogue, inventory] = await Promise.all([
    listMerchCatalogue(),
    listMerchInventory(),
  ]);
  return jsonOk({
    item,
    catalogue,
    products: clothingProductsWithImages(catalogue, inventory, {
      includeHidden: true,
    }),
  });
}
