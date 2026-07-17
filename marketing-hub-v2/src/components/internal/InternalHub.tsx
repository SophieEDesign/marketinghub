"use client";

import { useState } from "react";
import { MerchClient } from "@/components/merch/MerchClient";
import { InventoryClient } from "@/components/merch/InventoryClient";
import { StaffRequestsClient } from "@/components/internal/StaffRequestsClient";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentFilter } from "@/components/ui/SegmentFilter";
import type {
  MerchInventoryItem,
  MerchOrder,
  StaffRequest,
  StaffRequestKind,
} from "@/lib/types";

type Tab = "merch" | "asset" | "social_form" | "other";
type MerchView = "orders" | "inventory";

const TABS: { id: Tab; label: string }[] = [
  { id: "merch", label: "Corporate clothing" },
  { id: "asset", label: "Asset request" },
  { id: "social_form", label: "Social form" },
  { id: "other", label: "Other" },
];

export function InternalHub({
  merch,
  inventory,
  requests,
  canManageAll = false,
  viewerName = "",
}: {
  merch: MerchOrder[];
  inventory: MerchInventoryItem[];
  requests: StaffRequest[];
  canManageAll?: boolean;
  viewerName?: string;
}) {
  const [tab, setTab] = useState<Tab>("merch");
  const [merchView, setMerchView] = useState<MerchView>("orders");

  const merchViews: { id: MerchView; label: string }[] = canManageAll
    ? [
        { id: "orders", label: "Orders" },
        { id: "inventory", label: "Stock inventory" },
      ]
    : [{ id: "orders", label: "My orders" }];

  return (
    <div>
      <PageHeader
        title="Internal requests"
        description={
          canManageAll
            ? "North Sails clothing orders and stock, asset asks, and social media form requests for the marketing team."
            : "Request corporate clothing and track your own orders. Asset and social form requests for the marketing team."
        }
      />

      <SegmentFilter
        label="Request type"
        value={tab}
        onChange={setTab}
        options={TABS}
        size="lg"
      />

      {tab === "merch" ? (
        <div>
          {merchViews.length > 1 ? (
            <SegmentFilter
              label="Clothing section"
              value={merchView}
              onChange={setMerchView}
              options={merchViews}
              size="md"
            />
          ) : null}
          {merchView === "inventory" && canManageAll ? (
            <InventoryClient initial={inventory} />
          ) : (
            <MerchClient
              initial={merch}
              hideHeader
              canManageAll={canManageAll}
              viewerName={viewerName}
            />
          )}
        </div>
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
