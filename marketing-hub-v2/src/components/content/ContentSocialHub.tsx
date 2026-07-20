"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { ContentClient } from "@/components/content/ContentClient";
import { SocialClient } from "@/components/social/SocialClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentFilter } from "@/components/ui/SegmentFilter";
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
  const [scope, setScope] = useState<Scope>("all");

  return (
    <div>
      <PageHeader
        title="Content & Social"
        description="Pipeline planning and the social calendar in one place. Use the filter to focus."
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
