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
    // Validate file
    if (!file) {
      throw new Error("No file provided");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("File size must be less than 5MB");
    }

    // Upload logo to Supabase Storage (branding bucket)
    const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
    const fileName = `logo.${fileExt}`;
    const filePath = fileName;

    console.log("Uploading logo:", { fileName, filePath, size: file.size, type: file.type });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("branding")
      .upload(filePath, file, { 
        upsert: true,
        contentType: file.type || `image/${fileExt}`,
      });

    if (uploadError) {
      console.error("Upload error details:", {
        message: uploadError.message,
        error: uploadError,
      });

      // Provide more specific error message
      const errorMsg = uploadError.message || "";
      if (errorMsg.includes("Bucket not found") || errorMsg.includes("The resource was not found")) {
        throw new Error("Storage bucket 'branding' not found. Please create it in Supabase Storage → Storage → New bucket (name: 'branding', make it Public).");
      } else if (errorMsg.includes("new row violates row-level security") || errorMsg.includes("RLS")) {
        throw new Error("Permission denied. Please check RLS policies for the 'branding' bucket. Go to Storage → branding → Policies and ensure INSERT is allowed.");
      } else if (errorMsg.includes("403") || errorMsg.includes("Forbidden")) {
        throw new Error("Access forbidden. The 'branding' bucket may not be public or RLS policies are blocking uploads.");
      } else if (errorMsg.includes("401") || errorMsg.includes("Unauthorized")) {
        throw new Error("Authentication failed. Please check your Supabase credentials.");
      }
      throw new Error(`Upload failed: ${errorMsg || "Unknown error"}`);
    }

    if (!uploadData) {
      throw new Error("Upload succeeded but no data returned");
    }

    console.log("Upload successful:", uploadData);

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("branding").getPublicUrl(filePath);

    console.log("Public URL:", publicUrl);

    if (!publicUrl) {
      throw new Error("Failed to get public URL for uploaded file");
    }

    // Update settings
    await updateSettings({ logo_url: publicUrl });
    
    console.log("Settings updated with logo URL");
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

