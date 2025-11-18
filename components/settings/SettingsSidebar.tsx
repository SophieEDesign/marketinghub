"use client";

import { useState } from "react";
import { useSettings } from "@/lib/useSettings";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";
import LogoUploader from "./LogoUploader";

export default function SettingsSidebar() {
  const { settings, isLoading, updateSettings, updateLogo } = useSettings();
  const [saving, setSaving] = useState(false);
  const [statusColors, setStatusColors] = useState(settings.status_colors || {});
  const [channelColors, setChannelColors] = useState(settings.channel_colors || {});
  const [brandingColors, setBrandingColors] = useState(settings.branding_colors || {});

  // Sync with settings when they load
  useState(() => {
    if (settings.status_colors) setStatusColors(settings.status_colors);
    if (settings.channel_colors) setChannelColors(settings.channel_colors);
    if (settings.branding_colors) setBrandingColors(settings.branding_colors);
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      await updateLogo(file);
    } catch (error) {
      console.error("Error uploading logo:", error);
      alert("Failed to upload logo");
    } finally {
      setSaving(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        status_colors: statusColors,
        channel_colors: channelColors,
        branding_colors: brandingColors,
      });
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const updateStatusColor = (status: string, color: string) => {
    setStatusColors((prev) => ({ ...prev, [status]: color }));
  };

  const updateChannelColor = (channel: string, color: string) => {
    setChannelColors((prev) => ({ ...prev, [channel]: color }));
  };

  const updateBrandingColor = (key: "primary" | "secondary" | "accent", color: string) => {
    setBrandingColors((prev) => ({ ...prev, [key]: color }));
  };

  if (isLoading) {
    return (
      <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 p-6">
        <div className="text-gray-500 dark:text-gray-400">Loading settings...</div>
      </div>
    );
  }

  const statusOptions = [
    "draft",
    "in-progress",
    "review",
    "approved",
    "published",
    "archived",
  ];

  const channelOptions = [
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

  return (
    <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-300 dark:border-gray-700 p-6 overflow-y-auto h-full">
      <h2 className="text-xl font-semibold mb-6">Settings</h2>

      <div className="flex flex-col gap-6">
        {/* Logo Uploader */}
        <div>
          <label className="text-sm font-medium block mb-2">Logo</label>
          {settings.logo_url ? (
            <div className="mb-2">
              <img
                src={settings.logo_url}
                alt="Logo"
                className="h-16 w-auto object-contain"
              />
            </div>
          ) : (
            <div className="h-16 w-32 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-gray-500 mb-2">
              No logo
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            disabled={saving}
            className="w-full text-sm file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 disabled:opacity-50"
          />
        </div>

        {/* Status Colors */}
        <div>
          <label className="text-sm font-medium block mb-3">Status Colors</label>
          <div className="flex flex-col gap-2">
            {statusOptions.map((status) => (
              <div key={status} className="flex items-center gap-2">
                <input
                  type="color"
                  value={statusColors[status] || "#888888"}
                  onChange={(e) => updateStatusColor(status, e.target.value)}
                  className="w-10 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <span className="text-sm flex-1 capitalize">{status}</span>
                <StatusChip
                  value={status}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Channel Colors */}
        <div>
          <label className="text-sm font-medium block mb-3">Channel Colors</label>
          <div className="flex flex-col gap-2">
            {channelOptions.map((channel) => (
              <div key={channel} className="flex items-center gap-2">
                <input
                  type="color"
                  value={channelColors[channel] || "#888888"}
                  onChange={(e) => updateChannelColor(channel, e.target.value)}
                  className="w-10 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                />
                <span className="text-sm flex-1 capitalize">{channel}</span>
                <ChannelChip
                  label={channel}
                  size="sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Branding Colors */}
        <div>
          <label className="text-sm font-medium block mb-3">Branding Colors</label>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandingColors.primary || "#2563eb"}
                onChange={(e) => updateBrandingColor("primary", e.target.value)}
                className="w-10 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <span className="text-sm flex-1">Primary</span>
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: brandingColors.primary || "#2563eb" }}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandingColors.secondary || "#64748b"}
                onChange={(e) => updateBrandingColor("secondary", e.target.value)}
                className="w-10 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <span className="text-sm flex-1">Secondary</span>
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: brandingColors.secondary || "#64748b" }}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandingColors.accent || "#f59e0b"}
                onChange={(e) => updateBrandingColor("accent", e.target.value)}
                className="w-10 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
              <span className="text-sm flex-1">Accent</span>
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: brandingColors.accent || "#f59e0b" }}
              />
            </div>
          </div>
        </div>

        {/* Branding Section */}
        <div className="mt-6 border-t pt-4">
          <h3 className="font-semibold mb-2">Branding</h3>
          <LogoUploader />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

