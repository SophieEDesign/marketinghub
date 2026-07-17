import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasSupabaseConfig } from "@/lib/auth/config";

export function hasServiceRoleKey() {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY && hasSupabaseConfig()
  );
}

/**
 * Service-role client for server-only privileged work.
 * Never falls back to the anon key.
 */
export function createServiceClient(): SupabaseClient {
  if (!hasSupabaseConfig()) {
    throw new Error("Supabase is not configured");
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Alias used by user-admin code paths. */
export function createAdminClient(): SupabaseClient {
  return createServiceClient();
}
