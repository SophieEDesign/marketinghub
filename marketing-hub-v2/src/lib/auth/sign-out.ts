"use client";

import {
  hasSupabaseConfig,
  isAuthBypass,
} from "@/lib/auth/config-client";

/** Clears Supabase session (when configured) and hub demo / media cookies. */
export async function signOutOfHub(): Promise<void> {
  if (hasSupabaseConfig() && !isAuthBypass()) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      await createClient().auth.signOut();
    } catch {
      // continue clearing cookies
    }
  }
  await fetch("/api/auth/logout", { method: "POST" });
}
