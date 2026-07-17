"use client";

import { MediaGallery } from "@/components/media/MediaGallery";
import { BrandGuidelinesPanel } from "@/components/brand/BrandGuidelinesPanel";
import { ResourcesClient } from "@/components/resources/ResourcesClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentFilter } from "@/components/ui/SegmentFilter";
import { useHubView } from "@/lib/hub-view";
import type { ResourceLink } from "@/lib/types";
import { useState } from "react";

type Tab = "media" | "brand" | "resources";

const TABS: { id: Tab; label: string }[] = [
  { id: "media", label: "Media" },
  { id: "brand", label: "Brand" },
  { id: "resources", label: "Resources" },
];

export function LibraryHub({
  resources,
  logoUrl,
  guideUrl,
}: {
  resources: ResourceLink[];
  logoUrl: string;
  guideUrl: string;
}) {
  const [tab, setTab] = useState<Tab>("media");
  const { view } = useHubView();
  const isMember = view === "member";

  return (
    <div>
      <PageHeader
        title="Library"
        description={
          isMember
            ? "Browse and download brand assets, guidelines, and useful links."
            : "Brand assets, guidelines, and useful links — one place for the team."
        }
      />

      <SegmentFilter
        label="Library section"
        value={tab}
        onChange={setTab}
        options={TABS}
        size="lg"
      />

      {tab === "media" ? (
        <MediaGallery
          title="Media"
          description="Pixieset-style collections of logos and brand photos."
          initialCanDownload
          hideHeader
        />
      ) : null}

      {tab === "brand" ? (
        <BrandGuidelinesPanel
          logoUrl={logoUrl}
          guideUrl={guideUrl}
          showDownloads
        />
      ) : null}

      {tab === "resources" ? (
        <ResourcesClient
          initial={resources}
          hideHeader
          allowManage={!isMember}
        />
      ) : null}
    </div>
  );
}
