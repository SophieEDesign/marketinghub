"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useModal } from "@/lib/modalState";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";

export default function NewContentModal() {
  const { open, setOpen } = useModal();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    status: "To Do",
    channels: "",
    description: "",
    publish_date: "",
    content_type: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const channels = formData.channels
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const { error } = await supabase.from("content").insert([
      {
        title: formData.title,
        status: formData.status,
        channels: channels,
        description: formData.description || null,
        publish_date: formData.publish_date || null,
        content_type: formData.content_type || null,
      },
    ]);

    if (!error) {
      setOpen(false);
      setFormData({
        title: "",
        status: "To Do",
        channels: "",
        description: "",
        publish_date: "",
        content_type: "",
      });
      window.location.reload();
    }
    setLoading(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Create New Content</h2>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Title */}
            <div>
              <label className="text-sm opacity-70 block mb-1">Title *</label>
              <input
                type="text"
                required
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Enter title..."
              />
            </div>

            {/* Status */}
            <div>
              <label className="text-sm opacity-70 block mb-1">Status</label>
              <select
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
              >
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
              {formData.status && (
                <div className="mt-2">
                  <StatusChip value={formData.status} />
                </div>
              )}
            </div>

            {/* Channels */}
            <div>
              <label className="text-sm opacity-70 block mb-1">Channels</label>
              <input
                type="text"
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                value={formData.channels}
                onChange={(e) =>
                  setFormData({ ...formData, channels: e.target.value })
                }
                placeholder="LinkedIn, Instagram, Facebook"
              />
              {formData.channels && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {formData.channels
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean)
                    .map((c) => (
                      <ChannelChip key={c} label={c} />
                    ))}
                </div>
              )}
            </div>

            {/* Content Type */}
            <div>
              <label className="text-sm opacity-70 block mb-1">
                Content Type
              </label>
              <input
                type="text"
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                value={formData.content_type}
                onChange={(e) =>
                  setFormData({ ...formData, content_type: e.target.value })
                }
                placeholder="Post, Article, Video, etc."
              />
            </div>

            {/* Publish Date */}
            <div>
              <label className="text-sm opacity-70 block mb-1">
                Publish Date
              </label>
              <input
                type="date"
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
                value={formData.publish_date}
                onChange={(e) =>
                  setFormData({ ...formData, publish_date: e.target.value })
                }
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm opacity-70 block mb-1">
                Description
              </label>
              <textarea
                className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 h-28 resize-none"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Enter description..."
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Content"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

