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

const ALL_TABS: { id: Tab; label: string }[] = [
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
  // Resources overlaps Media Links for now — admin-only until we merge them.
  const tabs = canManage
    ? ALL_TABS
    : ALL_TABS.filter((t) => t.id !== "resources");
  const activeTab = tab === "resources" && !canManage ? "media" : tab;

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
            ? "Browse and download brand assets and guidelines."
            : "Brand assets, guidelines, and useful links — one place for the team."
        }
      />

      <SegmentFilter
        label="Library section"
        value={activeTab}
        onChange={setTab}
        options={tabs}
        size="lg"
      />

      {activeTab === "media" ? (
        <MediaGallery
          title="Media"
          description="Logos, presentations, gallery, and other brand assets."
          initialCanDownload
          hideHeader
          scope="all"
          allowManage={canManage}
        />
      ) : null}

      {activeTab === "brand" ? (
        <BrandGuidelinesPanel
          logoUrl={logoUrl}
          guideUrl={guideUrl}
          showDownloads
        />
      ) : null}

      {activeTab === "resources" && canManage ? (
        <ResourcesClient
          initial={resources}
          hideHeader
          allowManage={canManage}
        />
      ) : null}
    </div>
  );
}
