"use client";

import { useState } from "react";
import { SponsorshipsClient } from "@/components/sponsorships/SponsorshipsClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentFilter } from "@/components/ui/SegmentFilter";
import type { PartnerKind, Sponsorship } from "@/lib/types";

type Tab = "all" | PartnerKind;

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "sponsorship", label: "Sponsorships" },
  { id: "membership", label: "Memberships" },
];

export function PartnersHub({ initial }: { initial: Sponsorship[] }) {
  const [tab, setTab] = useState<Tab>("all");

  return (
    <div>
      <PageHeader
        title="Partners"
        description="Sponsorships and industry memberships in one place — packages, renewals, and deliverables. Members can add and update memberships."
      />

      <SegmentFilter
        label="Partner type"
        value={tab}
        onChange={setTab}
        options={TABS}
        size="lg"
      />

      <SponsorshipsClient
        key={tab}
        initial={initial}
        kind={tab}
        hideHeader
      />
    </div>
  );
}
