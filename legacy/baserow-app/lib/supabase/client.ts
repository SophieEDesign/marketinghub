import { createBrowserClient } from "@supabase/ssr";

/**
 * Chrome can intermittently throw `net::ERR_CACHE_RACE` on concurrent GETs that hit disk cache,
 * which surfaces as "Failed to fetch" / row-loading failures in the UI.
 * For Supabase REST calls, we force `cache: 'no-store'` to avoid the browser cache entirely.
 */
const noStoreFetch: typeof fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  // Respect explicit cache settings if provided.
  if (init?.cache) return fetch(input, init)
  const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url
  return fetch(input, { ...(init || {}), cache: "no-store" }).catch((error) => {
    throw error
  })
}

export function createClient() {
  const supabaseUrlHost = (() => {
    try {
      return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host : null
    } catch {
      return "invalid-url"
    }
  })()
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: noStoreFetch,
      },
    }
  );
}

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: noStoreFetch,
    },
  }
);
