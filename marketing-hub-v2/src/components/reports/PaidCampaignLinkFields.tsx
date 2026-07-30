"use client";

import { useEffect, useState } from "react";
import type { FieldOption } from "@/lib/data/collections";
import { SearchSelect } from "@/components/ui/SearchSelect";

function labelFor(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = String(row[key] ?? "").trim();
    if (value) return value;
  }
  return String(row.id ?? "Untitled");
}

type LinkConfig = {
  url: string;
  listKey: string;
  labelKeys: string[];
};

const LINK_CONFIG: Record<"theme" | "content" | "event", LinkConfig> = {
  theme: { url: "/api/themes", listKey: "themes", labelKeys: ["title"] },
  content: { url: "/api/content", listKey: "content", labelKeys: ["title"] },
  event: { url: "/api/events", listKey: "events", labelKeys: ["title"] },
};

function PaidCampaignLinkSelect({
  kind,
  value,
  onChange,
  label,
}: {
  kind: "theme" | "content" | "event";
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
}) {
  const [options, setOptions] = useState<FieldOption[]>([
    { value: "", label: "— None —" },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cfg = LINK_CONFIG[kind];
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(cfg.url);
        if (!res.ok) return;
        const data = (await res.json()) as Record<string, unknown>;
        const rows = Array.isArray(data[cfg.listKey])
          ? (data[cfg.listKey] as Record<string, unknown>[])
          : [];
        if (cancelled) return;
        const next: FieldOption[] = [
          { value: "", label: "— None —" },
          ...rows
            .map((row) => {
              const id = String(row.id ?? "").trim();
              if (!id) return null;
              let text = labelFor(row, cfg.labelKeys);
              if (kind === "theme") {
                const quarter = String(row.quarter ?? "").trim();
                const year = row.year != null ? String(row.year) : "";
                if (quarter && year) text = `${quarter} ${year} — ${text}`;
              }
              return { value: id, label: text };
            })
            .filter((o): o is FieldOption => o !== null),
        ];
        setOptions(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return (
    <div>
      <label className="label">{label}</label>
      <SearchSelect
        className="field"
        value={value ?? ""}
        onChange={(next) => onChange(next || null)}
        options={options}
        disabled={loading}
      />
    </div>
  );
}

export function PaidCampaignLinkFields({
  themeId,
  contentId,
  eventId,
  onThemeChange,
  onContentChange,
  onEventChange,
}: {
  themeId: string | null;
  contentId: string | null;
  eventId: string | null;
  onThemeChange: (id: string | null) => void;
  onContentChange: (id: string | null) => void;
  onEventChange: (id: string | null) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <PaidCampaignLinkSelect
        kind="theme"
        label="Theme (optional)"
        value={themeId}
        onChange={onThemeChange}
      />
      <PaidCampaignLinkSelect
        kind="content"
        label="Content (optional)"
        value={contentId}
        onChange={onContentChange}
      />
      <PaidCampaignLinkSelect
        kind="event"
        label="Event (optional)"
        value={eventId}
        onChange={onEventChange}
      />
    </div>
  );
}
