import { supabase } from "@/lib/supabase/client"
import { normalizeUuid } from "@/lib/utils/ids"

/**
 * Marks one view as the default for a table (opens first from /tables/[tableId]).
 * Clears is_default on other views for the same table_id.
 */
export async function setDefaultTableView(
  tableId: string,
  viewId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const tid = normalizeUuid(tableId)
  const vid = normalizeUuid(viewId)
  if (!tid || !vid) {
    return { ok: false, message: "Invalid table or view id" }
  }

  const { error: clearError } = await supabase
    .from("views")
    .update({ is_default: false })
    .eq("table_id", tid)

  if (clearError) {
    return { ok: false, message: clearError.message || "Could not clear previous default" }
  }

  const { error: setError } = await supabase.from("views").update({ is_default: true }).eq("id", vid)

  if (setError) {
    return { ok: false, message: setError.message || "Could not set default view" }
  }

  return { ok: true }
}
