"use client";

import { cn } from "@/lib/utils";
import { isImageUrl } from "@/lib/social/platforms";
import type { ClothingProduct } from "@/lib/merch/north-sails";

export type ClothingProductCardItem = ClothingProduct & { image_url: string };

function ProductThumb({
  src,
  label,
  size = "md",
}: {
  src: string;
  label: string;
  size?: "sm" | "md";
}) {
  const box =
    size === "sm"
      ? "h-10 w-10 rounded-lg"
      : "aspect-[4/5] w-full rounded-lg";
  if (src && isImageUrl(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        className={cn(box, "shrink-0 border border-border object-cover bg-sand/40")}
      />
    );
  }
  return (
    <div
      className={cn(
        box,
        "flex shrink-0 items-center justify-center border border-dashed border-border bg-sand/50 text-[10px] font-medium uppercase tracking-wide text-muted"
      )}
      aria-hidden
    >
      {size === "sm" ? "—" : "No photo"}
    </div>
  );
}

/** Compact 5-across product picker for clothing orders. */
export function ClothingProductCards({
  products,
  value,
  onChange,
}: {
  products: ClothingProductCardItem[];
  value: string;
  onChange: (itemLabel: string) => void;
}) {
  return (
    <div className="md:col-span-2">
      <label className="label">Item preview</label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {products.map((product) => {
          const selected = product.label === value;
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onChange(product.label)}
              className={cn(
                "flex flex-col gap-1.5 rounded-xl border p-2 text-left transition",
                selected
                  ? "border-brand bg-brand/5 ring-1 ring-brand"
                  : "border-border bg-white hover:border-brand/40"
              )}
              aria-pressed={selected}
              title={product.label}
            >
              <ProductThumb src={product.image_url} label={product.label} />
              <span className="line-clamp-2 text-[11px] font-medium leading-snug text-foreground">
                {product.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ClothingThumb({
  src,
  label,
  className,
}: {
  src: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ProductThumb src={src} label={label ?? ""} size="sm" />
    </div>
  );
}
