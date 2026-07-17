import { cn } from "@/lib/utils";

export function BrandMark({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label="Peters & May Marketing Hub"
    >
      <rect width="40" height="40" rx="8" fill="#0b3a4a" />
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="15"
        fontWeight="700"
        fill="#ffffff"
        letterSpacing="-0.6"
      >
        MH
      </text>
    </svg>
  );
}

export function BrandLockup({
  className,
  size = 36,
  titleClassName,
  subtitleClassName,
}: {
  className?: string;
  size?: number;
  titleClassName?: string;
  subtitleClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark size={size} />
      <div className="min-w-0">
        <p
          className={cn(
            "font-display text-lg tracking-tight text-brand",
            titleClassName
          )}
        >
          Peters &amp; May
        </p>
        <p className={cn("text-xs text-muted", subtitleClassName)}>
          Marketing Hub
        </p>
      </div>
    </div>
  );
}
