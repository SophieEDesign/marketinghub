"use client";

import { useState } from "react";
import { MerchClient } from "@/components/merch/MerchClient";
import { StaffRequestsClient } from "@/components/internal/StaffRequestsClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentFilter } from "@/components/ui/SegmentFilter";
import type { MerchOrder, StaffRequest, StaffRequestKind } from "@/lib/types";

type Tab = "merch" | "asset" | "social_form" | "other";

const TABS: { id: Tab; label: string }[] = [
  { id: "merch", label: "Corporate clothing" },
  { id: "asset", label: "Asset request" },
  { id: "social_form", label: "Social form" },
  { id: "other", label: "Other" },
];

export function InternalHub({
  merch,
  requests,
}: {
  merch: MerchOrder[];
  requests: StaffRequest[];
}) {
  const [tab, setTab] = useState<Tab>("merch");

  return (
    <div>
      <PageHeader
        title="Internal requests"
        description="North Sails clothing orders, asset asks, and social media form requests for the marketing team."
      />

      <SegmentFilter
        label="Request type"
        value={tab}
        onChange={setTab}
        options={TABS}
        size="lg"
      />

      {tab === "merch" ? (
        <MerchClient initial={merch} hideHeader />
      ) : (
        <StaffRequestsClient
          key={tab}
          initial={requests}
          kind={tab as StaffRequestKind}
          startWithForm
        />
      )}
    </div>
  );
}
