import path from "path";

/**
 * Local JSON / upload persistence.
 * On Vercel the app filesystem is read-only — use /tmp instead of cwd/.data.
 * When SUPABASE_SERVICE_ROLE_KEY is set and demo auth is off, the primary
 * durable store is `public.hub_store` (see lib/store/local.ts); /tmp is cache only.
 */
export function getDataDir(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "marketing-hub-v2", ".data");
  }
  return path.join(process.cwd(), ".data");
}
