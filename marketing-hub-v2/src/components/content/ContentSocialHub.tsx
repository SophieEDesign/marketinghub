"use client";

import { useState } from "react";
import { ContentClient } from "@/components/content/ContentClient";
import { SocialClient } from "@/components/social/SocialClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentFilter } from "@/components/ui/SegmentFilter";
import type { ContentItem } from "@/lib/types";

type Scope = "all" | "content" | "social";

const SCOPES: { id: Scope; label: string }[] = [
  { id: "all", label: "All" },
  { id: "content", label: "Content" },
  { id: "social", label: "Social" },
];

export function ContentSocialHub({
  initialContent,
}: {
  initialContent: ContentItem[];
}) {
  const [scope, setScope] = useState<Scope>("all");

  return (
    <div>
      <PageHeader
        title="Content & Social"
        description="Pipeline planning and the social calendar in one place. Use the filter to focus."
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
        />
      )}
    </div>
  );
}
