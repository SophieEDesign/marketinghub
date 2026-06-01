import type { SupabaseClient } from '@supabase/supabase-js'

/** Persist grid layout settings without 409 races on concurrent inserts. */
export async function upsertGridViewSettings(
  supabase: SupabaseClient,
  viewId: string,
  patch: Record<string, unknown>
) {
  return supabase
    .from('grid_view_settings')
    .upsert({ view_id: viewId, ...patch }, { onConflict: 'view_id' })
}
