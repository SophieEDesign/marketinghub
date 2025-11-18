"use client";

import useSWR from "swr";
import { supabase } from "./supabaseClient";

const SETTINGS_TABLE = "settings";
const SETTINGS_KEY = "app_settings";

interface Settings {
  logo_url?: string;
  status_colors?: Record<string, string>;
  channel_colors?: Record<string, string>;
  branding_colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
  };
  custom_fields?: any[];
  view_configs?: Record<string, {
    visible_fields: string[];
    field_order: string[];
  }>;
}

const fetcher = async (): Promise<Settings> => {
  const { data, error } = await supabase
    .from(SETTINGS_TABLE)
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // PGRST116 is "not found" - return defaults
    console.error("Error fetching settings:", error);
  }

  return data?.value || getDefaultSettings();
};

const getDefaultSettings = (): Settings => ({
  logo_url: undefined,
  status_colors: {
    draft: "#9ca3af",
    "in-progress": "#60a5fa",
    review: "#fbbf24",
    approved: "#4ade80",
    published: "#a78bfa",
    archived: "#6b7280",
  },
  channel_colors: {
    linkedin: "#0077b5",
    facebook: "#1877f2",
    instagram: "#e4405f",
    x: "#000000",
    twitter: "#000000",
    website: "#06b6d4",
    blog: "#8b5cf6",
    email: "#f97316",
    youtube: "#ff0000",
    tiktok: "#000000",
    pr: "#10b981",
    internal: "#b45309",
  },
  branding_colors: {
    primary: "#2563eb",
    secondary: "#64748b",
    accent: "#f59e0b",
  },
});

export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<Settings>(
    "settings",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
    }
  );

  const updateSettings = async (updates: Partial<Settings>) => {
    const currentSettings = data || getDefaultSettings();
    const newSettings = { ...currentSettings, ...updates };

    // Upsert settings
    const { error: updateError } = await supabase
      .from(SETTINGS_TABLE)
      .upsert({
        key: SETTINGS_KEY,
        value: newSettings,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      console.error("Error updating settings:", updateError);
      throw updateError;
    }

    // Optimistically update cache
    mutate(newSettings, false);
  };

  const updateLogo = async (file: File) => {
    // Upload logo to Supabase Storage (branding bucket)
    const fileExt = file.name.split(".").pop();
    const fileName = `logo.${fileExt}`;
    const filePath = fileName;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("branding")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error("Error uploading logo:", uploadError);
      throw uploadError;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("branding").getPublicUrl(filePath);

    // Update settings
    await updateSettings({ logo_url: publicUrl });
  };

  return {
    settings: data || getDefaultSettings(),
    isLoading,
    error,
    updateSettings,
    updateLogo,
    mutate,
  };
}

