import { cn } from "@/lib/utils";

export const BRAND_LOGO_SRC = "/pm-group-logo.png";

export function BrandMark({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND_LOGO_SRC}
      alt="Peters & May"
      width={Math.round(size * 2.6)}
      height={size}
      className={cn("h-auto w-auto shrink-0 object-contain", className)}
      style={{ height: size, width: "auto" }}
    />
  );
}

export function BrandLockup({
  className,
  size = 40,
  titleClassName,
  subtitleClassName,
}: {
  className?: string;
  size?: number;
  titleClassName?: string;
  subtitleClassName?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <BrandMark size={size} className="max-w-full" />
      <p
        className={cn(
          "text-xs font-medium text-muted",
          titleClassName,
          subtitleClassName
        )}
      >
        Marketing Hub
      </p>
    </div>
  );
}
