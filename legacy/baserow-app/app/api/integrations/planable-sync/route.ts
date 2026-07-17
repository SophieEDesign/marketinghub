import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/roles"
import {
  MAKE_SCENARIO_3_FILTER,
  PLANABLE_API_BASE_URL,
  PLANABLE_SYNC_FIELDS,
} from "@/lib/marketing/planable-sync"

async function resolveSocialPostsTable(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: tables } = await supabase
    .from("tables")
    .select("id, name, supabase_table")
    .not("supabase_table", "is", null)

  const candidates = (tables || []).filter((t) => {
    const name = String(t.name || "").trim().toLowerCase()
    if (name === "social posts" || name === "social post") return true
    return (
      name.includes("social") &&
      name.includes("post") &&
      !name.includes("content planning")
    )
  })

  candidates.sort((a, b) => {
    const an = String(a.name || "").trim().toLowerCase()
    const bn = String(b.name || "").trim().toLowerCase()
    const rank = (n: string) =>
      n === "social posts" ? 1 : n === "social post" ? 2 : 3
    return rank(an) - rank(bn)
  })

  const row = candidates[0]
  if (!row?.supabase_table) return { tableId: null, tableName: null }

  return {
    tableId: row.id as string,
    tableName: String(row.supabase_table).replace(/^public\./, ""),
  }
}

/**
 * GET /api/integrations/planable-sync
 * Admin-only reference for Make.com Planable sync scenarios.
 */
export async function GET() {
  try {
    const admin = await isAdmin()
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const supabase = await createClient()
    const { tableId, tableName } = await resolveSocialPostsTable(supabase)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""

    return NextResponse.json({
      socialPostsTable: tableName,
      socialPostsTableId: tableId,
      supabaseUrl,
      fields: PLANABLE_SYNC_FIELDS,
      planableApiBaseUrl: PLANABLE_API_BASE_URL,
      makeScenario3: {
        name: "Hub updates → Planable",
        trigger: "Supabase → Watch rows → Update",
        table: tableName,
        filter: MAKE_SCENARIO_3_FILTER,
        filterNotes: [
          "planable_post_id must be set (post already linked in Planable).",
          "Skip rows last written by Planable poll (sync_source = planable).",
          "Only run when the row changed after last_synced_at.",
        ],
        httpPatch: {
          method: "PATCH",
          urlTemplate: `${PLANABLE_API_BASE_URL}/posts/{{planable_post_id}}`,
          note: "Confirm path and body in Planable API docs (unpublished posts only).",
        },
        afterPatch: {
          module: "Supabase → Update a row",
          set: {
            [PLANABLE_SYNC_FIELDS.lastSyncedAt]: "{{now}}",
            [PLANABLE_SYNC_FIELDS.syncSource]: "hub",
          },
        },
      },
      makeScenario2Poll: {
        name: "Planable → Hub (scheduled)",
        note: "After updating Hub from Planable, set sync_source = planable and last_synced_at = now() to avoid Scenario 3 loops.",
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load Planable sync config"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
