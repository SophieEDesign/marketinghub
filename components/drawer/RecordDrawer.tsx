"use client";

import { useDrawer } from "@/lib/drawerState";
import { supabase } from "@/lib/supabaseClient";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";
import FileUpload from "../uploader/FileUpload";
import { useEffect, useState } from "react";

export default function RecordDrawer() {
  const { open, setOpen, recordId } = useDrawer();
  const [row, setRow] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!recordId) {
      setRow(null);
      return;
    }

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("content")
        .select("*, campaigns(name)")
        .eq("id", recordId)
        .maybeSingle();
      setRow(data);
      setLoading(false);
    }
    load();
  }, [recordId]);

  if (!open) return null;

  const handleSave = async () => {
    if (!row) return;
    
    setLoading(true);
    const { error } = await supabase
      .from("content")
      .update({
        title: row.title,
        status: row.status,
        channels: row.channels,
        description: row.description,
      })
      .eq("id", row.id);

    if (!error) {
      setOpen(false);
      // Optionally refresh the page or trigger a refetch
      window.location.reload();
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 flex justify-end z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <div className="relative w-[420px] bg-white dark:bg-gray-900 shadow-xl h-full p-6 overflow-y-auto">
        {loading && !row ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-gray-400">Loading...</div>
          </div>
        ) : row ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{row.title || "Untitled"}</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ✕
              </button>
            </div>

            {/* Editable fields */}
            <div className="flex flex-col gap-4">
              {/* Title */}
              <div>
                <label className="text-sm opacity-70 block mb-1">Title</label>
                <input
                  className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                  value={row.title || ""}
                  onChange={(e) => setRow({ ...row, title: e.target.value })}
                />
              </div>

              {/* Status */}
              <div>
                <label className="text-sm opacity-70 block mb-1">Status</label>
                <select
                  value={row.status || ""}
                  onChange={(e) => setRow({ ...row, status: e.target.value })}
                  className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                >
                  <option value="">Select status...</option>
                  <option>To Do</option>
                  <option>Awaiting Information</option>
                  <option>In Progress</option>
                  <option>Needs Update</option>
                  <option>Drafted – Needs Internal Review</option>
                  <option>Sent for Approval – Internal (P&M)</option>
                  <option>Tech Check Required</option>
                  <option>Text Approved – Image Needed</option>
                  <option>Approved – Ready to Schedule</option>
                  <option>Scheduled</option>
                  <option>Completed (Published)</option>
                  <option>Event Passed / Out of Date</option>
                  <option>Monthly (Recurring)</option>
                  <option>Ideas</option>
                  <option>Dates for Engagement</option>
                  <option>Date Confirmed</option>
                  <option>On Hold</option>
                  <option>Duplicate</option>
                  <option>Cancelled</option>
                </select>
                {row.status && (
                  <div className="mt-2">
                    <StatusChip value={row.status} />
                  </div>
                )}
              </div>

              {/* Channels */}
              <div>
                <label className="text-sm opacity-70 block mb-1">Channels</label>
                <input
                  className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                  value={row.channels?.join(", ") || ""}
                  onChange={(e) => {
                    const list = e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean);
                    setRow({ ...row, channels: list });
                  }}
                  placeholder="LinkedIn, Instagram, Facebook"
                />
                {row.channels && row.channels.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {row.channels.map((c: string) => (
                      <ChannelChip key={c} label={c} />
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-sm opacity-70 block mb-1">Description</label>
                <textarea
                  className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 h-28 resize-none"
                  value={row.description || ""}
                  onChange={(e) => setRow({ ...row, description: e.target.value })}
                  placeholder="Enter description..."
                />
              </div>

              {/* Publish Date */}
              {row.publish_date && (
                <div>
                  <label className="text-sm opacity-70 block mb-1">Publish Date</label>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(row.publish_date).toLocaleDateString()}
                  </div>
                </div>
              )}

              {/* Campaign */}
              {row.campaigns?.name && (
                <div>
                  <label className="text-sm opacity-70 block mb-1">Campaign</label>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {row.campaigns.name}
                  </div>
                </div>
              )}

              {/* File Upload */}
              <FileUpload recordId={row.id} />

              {/* Save */}
              <button
                className="bg-blue-600 text-white p-2 rounded shadow mt-4 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSave}
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-500 dark:text-gray-400">Record not found</div>
          </div>
        )}
      </div>
    </div>
  );
}

