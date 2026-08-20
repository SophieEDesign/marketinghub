import { cn } from "@/lib/utils";
import { statusChipClass } from "@/lib/ui/statusTokens";

export function StatusPill({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full border px-2 py-0.5 text-[10px] font-medium",
        statusChipClass(status),
        className
      )}
    >
      {label ?? status}
    </span>
  );
}
