"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/useSettings";
import ChannelChip from "../chips/ChannelChip";

const DEFAULT_CHANNELS = [
  "linkedin",
  "facebook",
  "instagram",
  "x",
  "twitter",
  "website",
  "blog",
  "email",
  "youtube",
  "tiktok",
  "pr",
  "internal",
];

export default function ChannelManager() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [channelColors, setChannelColors] = useState<Record<string, string>>({});
  const [newChannel, setNewChannel] = useState("");

  useEffect(() => {
    if (settings.channel_colors) {
      setChannelColors(settings.channel_colors);
    }
  }, [settings.channel_colors]);

  const handleColorChange = (channel: string, color: string) => {
    setChannelColors((prev) => ({ ...prev, [channel]: color }));
  };

  const handleAddChannel = () => {
    if (newChannel.trim() && !channelColors[newChannel.trim().toLowerCase()]) {
      setChannelColors((prev) => ({
        ...prev,
        [newChannel.trim().toLowerCase()]: "#888888",
      }));
      setNewChannel("");
    }
  };

  const handleRemoveChannel = (channel: string) => {
    setChannelColors((prev) => {
      const updated = { ...prev };
      delete updated[channel];
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({ channel_colors: channelColors });
      alert("Channel colors saved successfully!");
    } catch (error) {
      console.error("Error saving channel colors:", error);
      alert("Failed to save channel colors");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-gray-500 dark:text-gray-400">Loading...</div>;
  }

  const allChannels = [
    ...DEFAULT_CHANNELS,
    ...Object.keys(channelColors).filter((c) => !DEFAULT_CHANNELS.includes(c)),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Channel Colors</h3>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Add new channel */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newChannel}
          onChange={(e) => setNewChannel(e.target.value)}
          placeholder="Add new channel..."
          className="flex-1 p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm"
          onKeyPress={(e) => e.key === "Enter" && handleAddChannel()}
        />
        <button
          onClick={handleAddChannel}
          className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
        >
          Add
        </button>
      </div>

      {/* Channel list */}
      <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
        {allChannels.map((channel) => {
          if (!channelColors[channel] && !DEFAULT_CHANNELS.includes(channel)) return null;
          
          return (
            <div
              key={channel}
              className="flex items-center gap-3 p-2 rounded bg-gray-50 dark:bg-gray-800"
            >
              <input
                type="color"
                value={channelColors[channel] || "#888888"}
                onChange={(e) => handleColorChange(channel, e.target.value)}
                className="w-12 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <span className="flex-1 text-sm capitalize">{channel}</span>
              <div className="flex items-center gap-2">
                <ChannelChip label={channel} size="sm" />
                {!DEFAULT_CHANNELS.includes(channel) && (
                  <button
                    onClick={() => handleRemoveChannel(channel)}
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

