"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/useSettings";
import StatusChip from "../chips/StatusChip";

const DEFAULT_STATUSES = [
  "draft",
  "in-progress",
  "review",
  "approved",
  "published",
  "archived",
  "Ideas",
  "Dates for Engagement",
  "Date Confirmed",
  "On Hold",
  "Duplicate",
  "Cancelled",
  "To Do",
  "Awaiting Information",
  "Needs Update",
  "Drafted – Needs Internal Review",
  "Sent for Approval – Internal (P&M)",
  "Tech Check Required",
  "Text Approved – Image Needed",
  "Approved – Ready to Schedule",
  "Scheduled",
  "Completed (Published)",
  "Event Passed / Out of Date",
  "Monthly (Recurring)",
];

export default function StatusManager() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [statusColors, setStatusColors] = useState<Record<string, string>>({});
  const [newStatus, setNewStatus] = useState("");

  useEffect(() => {
    if (settings.status_colors) {
      setStatusColors(settings.status_colors);
    }
  }, [settings.status_colors]);

  const handleColorChange = (status: string, color: string) => {
    setStatusColors((prev) => ({ ...prev, [status]: color }));
  };

  const handleAddStatus = () => {
    if (newStatus.trim() && !statusColors[newStatus.trim()]) {
      setStatusColors((prev) => ({
        ...prev,
        [newStatus.trim()]: "#9ca3af",
      }));
      setNewStatus("");
    }
  };

  const handleRemoveStatus = (status: string) => {
    setStatusColors((prev) => {
      const updated = { ...prev };
      delete updated[status];
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ status_colors: statusColors });
      alert("Status colors saved successfully!");
    } catch (error) {
      console.error("Error saving status colors:", error);
      alert("Failed to save status colors");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  const allStatuses = [
    ...DEFAULT_STATUSES,
    ...Object.keys(statusColors).filter((s) => !DEFAULT_STATUSES.includes(s)),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Status Colors</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Add new status */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          placeholder="Add new status..."
          className="flex-1 p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm"
          onKeyPress={(e) => e.key === "Enter" && handleAddStatus()}
        />
        <button
          onClick={handleAddStatus}
          className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
        >
          Add
        </button>
      </div>

      {/* Status list */}
      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {allStatuses.map((status) => {
          if (!statusColors[status] && !DEFAULT_STATUSES.includes(status)) return null;
          
          return (
            <div
              key={status}
              className="flex items-center gap-3 p-2 rounded bg-gray-50 dark:bg-gray-800"
            >
              <input
                type="color"
                value={statusColors[status] || "#9ca3af"}
                onChange={(e) => handleColorChange(status, e.target.value)}
                className="w-12 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <span className="flex-1 text-sm capitalize">{status}</span>
              <div className="flex items-center gap-2">
                <StatusChip value={status} size="sm" />
                {!DEFAULT_STATUSES.includes(status) && (
                  <button
                    onClick={() => handleRemoveStatus(status)}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

