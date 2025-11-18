"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";

export default function CardsView() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("content")
        .select("*, campaigns(name)")
        .order("updated_at", { ascending: false });
      
      if (!error && data) {
        setRows(data);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">No content found</div>
      </div>
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
    >
      {rows.map((row) => (
        <div
          key={row.id}
          className="bg-white dark:bg-gray-900 rounded-xl shadow-sm hover:shadow-md overflow-hidden cursor-pointer transition border border-gray-200 dark:border-gray-800"
        >
          {/* Thumbnail */}
          {row.thumbnail_url ? (
            <img
              src={row.thumbnail_url}
              alt={row.title || "Content thumbnail"}
              className="h-40 w-full object-cover"
            />
          ) : (
            <div className="h-40 w-full bg-gray-300 dark:bg-gray-700" />
          )}

          {/* Body */}
          <div className="p-4 flex flex-col gap-2">
            <h3 className="font-semibold text-sm line-clamp-2">{row.title || "Untitled"}</h3>

            {row.channels && row.channels.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {row.channels.map((c: string) => (
                  <ChannelChip key={c} label={c} size="sm" />
                ))}
              </div>
            )}

            {row.status && <StatusChip value={row.status} size="sm" />}

            {row.publish_date && (
              <div className="text-xs opacity-70 text-gray-600 dark:text-gray-400">
                Publish: {new Date(row.publish_date).toLocaleDateString()}
              </div>
            )}

            {row.campaigns?.name && (
              <div className="text-xs opacity-70 italic text-gray-600 dark:text-gray-400">
                {row.campaigns.name}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

