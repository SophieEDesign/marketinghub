/**
 * Client-side demo flag. Prefer NEXT_PUBLIC_AUTH_BYPASS; fall back is none
 * (server AUTH_BYPASS alone does not leak into the browser).
 */
export function isAuthBypass() {
  return process.env.NEXT_PUBLIC_AUTH_BYPASS === "true";
}

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function allowDemoAuthClient() {
  if (process.env.NEXT_PUBLIC_VERCEL_ENV === "production") return false;
  return isAuthBypass() || !hasSupabaseConfig();
}
