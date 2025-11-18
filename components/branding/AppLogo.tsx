"use client";

import useSWR from "swr";
import { supabase } from "@/lib/supabaseClient";

export default function AppLogo() {
  // Load settings
  async function fetchSettings() {
    const { data } = await supabase
      .from("settings")
      .select("*")
      .eq("key", "branding")
      .single();
    return data?.value || {};
  }

  const { data } = useSWR("branding-settings", fetchSettings);

  if (!data?.logo_url) {
    return (
      <div className="text-lg font-bold opacity-70">
        Workspace
      </div>
    );
  }

  return (
    <img
      src={data.logo_url}
      alt="Logo"
      className="h-8 w-auto object-contain"
    />
  );
}

