"use client";

import type { FieldOption } from "@/lib/data/collections";
import { cn } from "@/lib/utils";

/** Checkbox multi-select for content channels / platforms. */
export function ChannelMultiSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: string[];
  options: FieldOption[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  const selected = new Set(value.map((v) => v.trim()).filter(Boolean));
  const extras = value.filter(
    (v) => v.trim() && !options.some((o) => o.value === v)
  );

  function toggle(optionValue: string) {
    if (selected.has(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
      return;
    }
    onChange([...value, optionValue]);
  }

  return (
    <div
      className={cn(
        "field flex max-h-40 flex-wrap gap-1.5 overflow-y-auto py-2",
        className
      )}
    >
      {[...options, ...extras.map((v) => ({ value: v, label: v }))].map(
        (o) => {
          const checked = selected.has(o.value);
          return (
            <label
              key={o.value}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition",
                checked
                  ? "border-brand/40 bg-brand/10 text-foreground"
                  : "border-border bg-white text-muted hover:border-brand/25"
              )}
            >
              <input
                type="checkbox"
                className="accent-[var(--brand)]"
                checked={checked}
                onChange={() => toggle(o.value)}
              />
              {o.label}
            </label>
          );
        }
      )}
    </div>
  );
}
