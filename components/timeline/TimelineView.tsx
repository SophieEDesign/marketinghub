"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import dayjs from "dayjs";
import { getStatusColor } from "@/lib/statusColors";

export default function TimelineView() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("content")
        .select("id, title, status, created_at, publish_date, campaigns(name)")
        .order("created_at");

      if (!error && data) {
        setRows(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  // timeline window (60 days forward/backwards)
  const startWindow = dayjs().subtract(30, "day");
  const endWindow = dayjs().add(60, "day");
  const totalDays = endWindow.diff(startWindow, "day");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm overflow-x-auto">
      <div className="min-w-[1500px]">
        {/* Timeline header (day scale) */}
        <div className="flex border-b border-gray-300 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="w-48"></div>
          {Array.from({ length: totalDays }).map((_, i) => {
            const d = startWindow.add(i, "day");
            const isToday = d.isSame(dayjs(), "day");
            return (
              <div
                key={i}
                className={`w-12 text-[10px] text-center opacity-70 border-l border-gray-200 dark:border-gray-700 ${
                  isToday ? "bg-blue-100 dark:bg-blue-900" : ""
                }`}
              >
                {d.format("DD MMM")}
              </div>
            );
          })}
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-gray-400">No content found</div>
          </div>
        ) : (
          rows.map((row) => {
            const start = dayjs(row.created_at);
            const end = row.publish_date ? dayjs(row.publish_date) : dayjs().add(1, "day");

            // convert to offset
            const offsetDays = Math.max(0, start.diff(startWindow, "day"));
            const durationDays = Math.max(1, end.diff(start, "day"));

            const statusColor = getStatusColor(row.status);

            return (
              <div
                key={row.id}
                className="flex items-center border-b border-gray-200 dark:border-gray-800 h-12 relative hover:bg-gray-50 dark:hover:bg-gray-800/50"
              >
                {/* Title */}
                <div className="w-48 px-2 text-sm font-medium truncate flex-shrink-0">
                  {row.title || "Untitled"}
                </div>

                {/* Bar container */}
                <div className="flex-1 relative h-full">
                  {/* Offset spacer */}
                  {offsetDays >= 0 && durationDays > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-6"
                      style={{ left: `${offsetDays * 48}px` }}
                    >
                      {/* Bar */}
                      <div
                        className="rounded-sm h-6 opacity-90 hover:opacity-100 transition cursor-pointer flex items-center justify-center text-white text-[10px] font-medium px-1"
                        style={{
                          width: `${Math.max(durationDays * 48, 48)}px`,
                          backgroundColor: statusColor,
                          minWidth: "48px",
                        }}
                        title={`${row.title || "Untitled"}\nStatus: ${row.status}\nCreated: ${start.format("DD MMM YYYY")}\nPublish: ${row.publish_date ? end.format("DD MMM YYYY") : "No date"}\nCampaign: ${row.campaigns?.name || "None"}`}
                      >
                        {durationDays * 48 > 60 && (
                          <span className="truncate">{row.title || "Untitled"}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

