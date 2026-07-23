"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { ContentClient } from "@/components/content/ContentClient";
import { SocialClient } from "@/components/social/SocialClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentFilter } from "@/components/ui/SegmentFilter";
import { useHubView } from "@/lib/hub-view";
import type { FieldOption } from "@/lib/data/collections";
import type { ContentItem } from "@/lib/types";

type Scope = "all" | "content" | "social";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "content", label: "Content" },
  { id: "social", label: "Social" },
];

const PLANABLE_CALENDAR_URL =
  "https://app.planable.io/calendar/25GtzkN5qqaTuMfEH";

export function ContentSocialHub({
  initialContent,
  fieldOptions,
}: {
  initialContent: ContentItem[];
  fieldOptions?: Record<string, FieldOption[]>;
}) {
  const { view } = useHubView();
  const isMemberView = view !== "admin";
  const [scope, setScope] = useState<Scope>("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  async function syncFromPlanable() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await fetch("/api/planable/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSyncMessage(data.error || "Planable sync failed");
      } else {
        setSyncMessage(
          `Planable sync: ${data.created ?? 0} new, ${data.updated ?? 0} updated`
        );
      }
    } catch (e) {
      setSyncMessage(e instanceof Error ? e.message : "Planable sync failed");
    }
    setSyncing(false);
  }

  if (isMemberView) {
    return (
      <div>
        <PageHeader
          title="Social calendar"
          description="Scheduled and published posts only — drafts stay with the marketing team."
          actions={
            <a
              href={PLANABLE_CALENDAR_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Open Planable
              <ExternalLink className="h-4 w-4" />
            </a>
          }
        />
        <SocialClient hideHeader memberView />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Content & Social"
        description="Draft in the Hub; approve and publish in Planable. Published posts lock in the Hub."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={syncing}
              onClick={() => void syncFromPlanable()}
            >
              {syncing ? "Syncing…" : "Sync from Planable"}
            </button>
            <a
              href={PLANABLE_CALENDAR_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-primary"
            >
              Open Planable
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        }
      />

      {syncMessage ? (
        <p className="mb-4 text-xs text-muted">{syncMessage}</p>
      ) : null}

      <SegmentFilter
        label="Content or social"
        value={scope}
        onChange={setScope}
        options={SCOPES}
        size="lg"
      />

      {scope === "social" ? (
        <SocialClient hideHeader />
      ) : (
        <ContentClient
          initial={initialContent}
          hideHeader
          scope={scope === "all" ? "all" : "content"}
          fieldOptions={fieldOptions}
        />
      )}
    </div>
  );
}
