"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

interface Campaign {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  colour: string | null;
}

export default function CampaignTimeline() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const today = new Date().toISOString().split("T")[0];

      const { data } = await supabase
        .from("campaigns")
        .select("id, name, start_date, end_date, colour")
        .or(`end_date.gte.${today},end_date.is.null`)
        .order("start_date", { ascending: true });

      if (data) {
        setCampaigns(data);
      }
      setLoading(false);
    }

    load();
  }, []);

  const handleCampaignClick = (campaignId: string) => {
    router.push(`/campaigns/grid`);
  };

  // Calculate timeline range
  const allDates = campaigns
    .flatMap((c) => [c.start_date, c.end_date])
    .filter(Boolean) as string[];

  let minDate = dayjs();
  let maxDate = dayjs().add(6, "month");

  if (allDates.length > 0) {
    const dateObjects = allDates.map((d) => dayjs(d));
    const timestamps = dateObjects.map((d) => d.valueOf());
    const minTimestamp = Math.min(...timestamps);
    const maxTimestamp = Math.max(...timestamps);
    minDate = dayjs(minTimestamp);
    maxDate = dayjs(maxTimestamp);
  }

  const totalDays = maxDate.diff(minDate, "day");
  const today = dayjs();

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-heading text-brand-blue mb-4">Active Campaigns</h2>
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-heading text-brand-blue mb-4">Active Campaigns</h2>
        <div className="text-gray-500 dark:text-gray-400 text-sm">No active campaigns</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-heading text-brand-blue mb-4">Active Campaigns</h2>
      <div className="overflow-x-auto">
        <div className="relative min-w-full" style={{ minWidth: `${Math.max(totalDays * 2, 600)}px` }}>
          {/* Timeline axis */}
          <div className="relative h-12 border-b border-gray-200 dark:border-gray-700 mb-4">
            <div className="absolute inset-0 flex">
              {Array.from({ length: Math.ceil(totalDays / 30) + 1 }).map((_, i) => {
                const date = minDate.add(i * 30, "day");
                return (
                  <div
                    key={i}
                    className="absolute border-l border-gray-200 dark:border-gray-700"
                    style={{ left: `${(i * 30 / totalDays) * 100}%` }}
                  >
                    <div className="absolute -top-4 left-0 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {date.format("MMM YY")}
                    </div>
                  </div>
                );
              })}
              {/* Today marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-brand-red z-10"
                style={{ left: `${(today.diff(minDate, "day") / totalDays) * 100}%` }}
              >
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-xs font-medium text-brand-red">
                  Today
                </div>
              </div>
            </div>
          </div>

          {/* Campaign bars */}
          <div className="space-y-3">
            {campaigns.map((campaign) => {
              const start = campaign.start_date ? dayjs(campaign.start_date) : minDate;
              const end = campaign.end_date ? dayjs(campaign.end_date) : maxDate;
              const startOffset = start.diff(minDate, "day");
              const duration = end.diff(start, "day");
              const leftPercent = (startOffset / totalDays) * 100;
              const widthPercent = (duration / totalDays) * 100;

              const color = campaign.colour || "#3B82F6"; // Default brand blue

              return (
                <div
                  key={campaign.id}
                  className="relative h-10 cursor-pointer hover:opacity-80 transition"
                  onClick={() => handleCampaignClick(campaign.id)}
                >
                  <div
                    className="absolute h-full rounded-md flex items-center px-3 text-sm font-medium text-white shadow-sm"
                    style={{
                      left: `${leftPercent}%`,
                      width: `${widthPercent}%`,
                      backgroundColor: color,
                      minWidth: "100px",
                    }}
                  >
                    <span className="truncate">{campaign.name}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

