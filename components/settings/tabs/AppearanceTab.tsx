"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/useSettings";
import StatusChip from "@/components/chips/StatusChip";
import ChannelChip from "@/components/chips/ChannelChip";
import { toast } from "@/components/ui/Toast";

export default function AppearanceTab() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  const [statusColors, setStatusColors] = useState(settings.status_colors || {});
  const [channelColors, setChannelColors] = useState(settings.channel_colors || {});
  const [brandingColors, setBrandingColors] = useState(settings.branding_colors || {});

  // Sync with settings when they load
  useEffect(() => {
    if (settings.status_colors) setStatusColors(settings.status_colors);
    if (settings.channel_colors) setChannelColors(settings.channel_colors);
    if (settings.branding_colors) setBrandingColors(settings.branding_colors);
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        status_colors: statusColors,
        channel_colors: channelColors,
        branding_colors: brandingColors,
      });
      toast({
        title: "Success",
        description: "Appearance settings saved successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save appearance settings",
        type: "error",
      });
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
    return <div className="text-sm text-gray-500">Loading appearance settings...</div>;
  }

  const statusOptions = [
    "To Do",
    "Awaiting Information",
    "In Progress",
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
    "Ideas",
    "Dates for Engagement",
    "Date Confirmed",
    "On Hold",
    "Duplicate",
    "Cancelled",
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
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-heading font-semibold text-brand-blue mb-4">Status Colors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {statusOptions.map((status) => (
            <div key={status} className="flex items-center gap-3">
              <StatusChip value={status} />
              <input
                type="color"
                value={statusColors[status] || "#6b7280"}
                onChange={(e) => updateStatusColor(status, e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-heading font-semibold text-brand-blue mb-4">Channel Colors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {channelOptions.map((channel) => (
            <div key={channel} className="flex items-center gap-3">
              <ChannelChip label={channel} />
              <input
                type="color"
                value={channelColors[channel] || "#6b7280"}
                onChange={(e) => updateChannelColor(channel, e.target.value)}
                className="w-10 h-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-heading font-semibold text-brand-blue mb-4">Branding Colors</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Primary</span>
            <input
              type="color"
              value={brandingColors.primary || "#e10600"}
              onChange={(e) => updateBrandingColor("primary", e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Secondary</span>
            <input
              type="color"
              value={brandingColors.secondary || "#003756"}
              onChange={(e) => updateBrandingColor("secondary", e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Accent</span>
            <input
              type="color"
              value={brandingColors.accent || "#4a4f54"}
              onChange={(e) => updateBrandingColor("accent", e.target.value)}
              className="w-10 h-10 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "Saving..." : "Save Appearance Settings"}
        </button>
      </div>
    </div>
  );
}

