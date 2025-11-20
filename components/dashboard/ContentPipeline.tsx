"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

interface StatusCount {
  status: string;
  count: number;
}

export default function ContentPipeline() {
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("content").select("status");

      if (data) {
        // Count by status
        const counts: Record<string, number> = {};
        data.forEach((item) => {
          const status = item.status || "Uncategorized";
          counts[status] = (counts[status] || 0) + 1;
        });

        // Convert to array and sort by count
        const sorted = Object.entries(counts)
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 6); // Top 6 statuses

        setStatusCounts(sorted);
      }
      setLoading(false);
    }

    load();
  }, []);

  const maxCount = statusCounts.length > 0 ? Math.max(...statusCounts.map((s) => s.count)) : 1;

  const handleStatusClick = (status: string) => {
    router.push(`/content/grid?status=${encodeURIComponent(status)}`);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-heading text-brand-blue mb-4">Content Pipeline</h2>
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-lg font-heading text-brand-blue mb-4">Content Pipeline</h2>
      <div className="space-y-3">
        {statusCounts.map(({ status, count }) => {
          const percentage = (count / maxCount) * 100;
          const barWidth = Math.max(percentage, 10); // Minimum 10% width for visibility

          return (
            <div
              key={status}
              className="cursor-pointer hover:opacity-80 transition"
              onClick={() => handleStatusClick(status)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {status}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">({count})</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-red h-2 rounded-full transition-all"
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

