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
  // #region agent log
  fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H2',location:'client.ts:noStoreFetch:start',message:'Supabase browser fetch started',data:{requestUrl,method:init?.method||'GET',hasAuthHeader:Boolean((init?.headers as any)?.Authorization),cacheMode:(init?.cache||'no-store')},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return fetch(input, { ...(init || {}), cache: "no-store" }).catch((error) => {
    // #region agent log
    fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H3',location:'client.ts:noStoreFetch:catch',message:'Supabase browser fetch rejected',data:{requestUrl,errorName:error?.name||null,errorMessage:error?.message||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7903/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'909a6f'},body:JSON.stringify({sessionId:'909a6f',runId:'initial',hypothesisId:'H2',location:'client.ts:createClient',message:'Creating browser Supabase client',data:{hasSupabaseUrl:Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),supabaseUrlHost,hasAnonKey:Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
