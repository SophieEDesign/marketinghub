"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useDrawer } from "@/lib/drawerState";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";

export default function GridTable() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { setOpen, setRecordId } = useDrawer();

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("content")
        .select("*, campaigns(name)");
      if (!error) setRows(data);
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
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr className="text-left border-b border-gray-300 dark:border-gray-700">
            <th className="p-2">Image</th>
            <th className="p-2">Title</th>
            <th className="p-2">Status</th>
            <th className="p-2">Channels</th>
            <th className="p-2">Type</th>
            <th className="p-2">Publish Date</th>
            <th className="p-2">Campaign</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-200 dark:border-gray-700"
              onClick={() => {
                setRecordId(row.id);
                setOpen(true);
              }}
            >
              <td className="p-2">
                {row.thumbnail_url ? (
                  <img
                    src={row.thumbnail_url}
                    alt={row.title || "Content thumbnail"}
                    className="h-12 w-12 object-cover rounded-md"
                  />
                ) : (
                  <div className="h-12 w-12 bg-gray-300 dark:bg-gray-700 rounded-md" />
                )}
              </td>

              <td className="p-2 font-medium">{row.title || "—"}</td>

              <td className="p-2">
                <StatusChip value={row.status} />
              </td>

              <td className="p-2">
                <div className="flex flex-wrap gap-1">
                  {row.channels && row.channels.length > 0 ? (
                    row.channels.map((ch: string) => (
                      <ChannelChip key={ch} label={ch} />
                    ))
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </td>

              <td className="p-2">{row.content_type || "—"}</td>

              <td className="p-2">
                {row.publish_date ? new Date(row.publish_date).toLocaleDateString() : "—"}
              </td>

              <td className="p-2">
                {row.campaigns?.name ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

