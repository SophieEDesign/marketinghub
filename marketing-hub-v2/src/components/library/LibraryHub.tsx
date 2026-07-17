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
  const isExternal = view === "external";
  const isMember = view === "member";
  const canManage = view === "admin";

  if (isExternal) {
    return (
      <div>
        <PageHeader
          title="Library"
          description="External view — logos, presentations, and gallery, matching the public media gallery."
        />
        <MediaGallery
          title="Media gallery"
          description="Browse logos, presentations, and gallery — view freely, sign in to download."
          showStaffChrome={false}
          initialCanDownload
          hideHeader
          scope="public"
          allowManage={false}
        />
      </div>
    );
  }

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
          description="Logos, presentations, gallery, and other brand assets."
          initialCanDownload
          hideHeader
          scope="all"
          allowManage={canManage}
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
          allowManage={canManage}
        />
      ) : null}
    </div>
  );
}
