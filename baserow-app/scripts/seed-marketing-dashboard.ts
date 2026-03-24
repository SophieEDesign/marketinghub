/**
 * One-off seed: creates the "Marketing Dashboard" interface page and view_blocks.
 *
 * Requires:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Run from baserow-app:
 *   npx tsx scripts/seed-marketing-dashboard.ts
 *
 * Idempotent: if a non-archived page named "Marketing Dashboard" exists, exits without changes.
 */
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const ACTIVE_STATUS = ["live", "Live", "in progress", "In Progress", "Active", "active"]

function matchTable(
  rows: { id: string; name: string }[],
  pred: (name: string) => boolean
): string | undefined {
  return rows.find((t) => pred(t.name))?.id
}

async function main() {
  const { data: existing } = await supabase
    .from("interface_pages")
    .select("id, name")
    .eq("name", "Marketing Dashboard")
    .eq("is_archived", false)
    .maybeSingle()

  if (existing) {
    console.log(`Marketing Dashboard page already exists (id=${existing.id}). Skipping.`)
    process.exit(0)
  }

  const { data: groups, error: gErr } = await supabase
    .from("interface_groups")
    .select("id")
    .order("order_index", { ascending: true })
    .limit(1)

  if (gErr || !groups?.length) {
    console.error("No interface_groups found. Create an interface group first.", gErr)
    process.exit(1)
  }
  const groupId = groups[0].id

  const { data: tables, error: tErr } = await supabase.from("tables").select("id, name")

  if (tErr || !tables?.length) {
    console.error("Could not load tables catalog", tErr)
    process.exit(1)
  }

  const campaignTableId = matchTable(tables, (n) => /campaign/i.test(n) && !/content/i.test(n))
  const contentTableId = matchTable(
    tables,
    (n) => /content/i.test(n) && !/calendar/i.test(n) && !/briefing/i.test(n)
  )
  const quarterlyThemesTableId = matchTable(
    tables,
    (n) => /quarterly/i.test(n) && /theme/i.test(n)
  )

  if (!campaignTableId || !contentTableId) {
    console.error(
      "Could not resolve Campaigns and Content tables. Found:",
      tables.map((t) => t.name).join(", ")
    )
    process.exit(1)
  }

  const { data: page, error: pErr } = await supabase
    .from("interface_pages")
    .insert({
      name: "Marketing Dashboard",
      page_type: "content",
      group_id: groupId,
      order_index: 0,
      config: { layout_style: "marketing_dashboard" },
      source_view: null,
      base_table: null,
      saved_view_id: null,
      dashboard_layout_id: null,
      form_config_id: null,
      record_config_id: null,
      is_admin_only: false,
    })
    .select("id")
    .single()

  if (pErr || !page) {
    console.error("Failed to create interface page", pErr)
    process.exit(1)
  }

  const pageId = page.id

  const section = (html: string, y: number, h = 2) => ({
    type: "html" as const,
    position_x: 0,
    position_y: y,
    width: 12,
    height: h,
    config: {
      title: "",
      html,
    },
  })

  const blocks: Array<Record<string, unknown>> = [
    section(
      `<div class="pt-1 pb-2 border-b border-border/50"><h2 class="text-lg font-semibold tracking-tight text-foreground">Focus</h2><p class="text-sm text-muted-foreground mt-1">Active work, this week, and priorities</p></div>`,
      0,
      3
    ),
    {
      type: "kpi",
      position_x: 0,
      position_y: 3,
      width: 4,
      height: 4,
      config: {
        title: "Active campaigns",
        kpi_label: "Active campaigns",
        table_id: campaignTableId,
        kpi_aggregate: "count",
        filters: [{ field: "status", operator: "is_any_of", value: ACTIVE_STATUS }],
      },
    },
    {
      type: "kpi",
      position_x: 4,
      position_y: 3,
      width: 4,
      height: 4,
      config: {
        title: "Content this week",
        kpi_label: "This week",
        table_id: contentTableId,
        kpi_aggregate: "count",
        filters: [{ field: "date", operator: "date_next_days", value: 7 }],
      },
    },
    {
      type: "kpi",
      position_x: 8,
      position_y: 3,
      width: 4,
      height: 4,
      config: {
        title: "Total content",
        kpi_label: "All content",
        table_id: contentTableId,
        kpi_aggregate: "count",
        filters: [],
      },
    },
    {
      type: "grid",
      position_x: 0,
      position_y: 7,
      width: 12,
      height: 10,
      config: {
        title: "Active campaigns",
        table_id: campaignTableId,
        view_type: "gallery",
        visible_fields: ["name", "status", "content"],
        filters: [{ field: "status", operator: "is_any_of", value: ACTIVE_STATUS }],
        row_limit: 12,
        appearance: { showTitle: true, border: "none" },
      },
    },
    {
      type: "grid",
      position_x: 0,
      position_y: 17,
      width: 12,
      height: 10,
      config: {
        title: "This week's content",
        table_id: contentTableId,
        view_type: "list",
        filters: [{ field: "date", operator: "date_next_days", value: 7 }],
        row_limit: 7,
        list_title_field: "content_name",
        pill_fields: ["status"],
        visible_fields: ["content_name", "status", "date"],
        appearance: { showTitle: true, border: "none" },
      },
    },
    section(
      `<div class="pt-4 pb-2 border-b border-border/50"><h2 class="text-lg font-semibold tracking-tight text-foreground">Strategy context</h2><p class="text-sm text-muted-foreground mt-1">Quarterly themes</p></div>`,
      27,
      3
    ),
  ]

  let nextY = 30
  if (quarterlyThemesTableId) {
    blocks.push({
      type: "grid",
      position_x: 0,
      position_y: nextY,
      width: 12,
      height: 8,
      config: {
        title: "Quarterly themes",
        table_id: quarterlyThemesTableId,
        view_type: "gallery",
        row_limit: 8,
        appearance: { showTitle: true, border: "none" },
      },
    })
    nextY += 8
  } else {
    blocks.push({
      type: "html",
      position_x: 0,
      position_y: nextY,
      width: 12,
      height: 3,
      config: {
        title: "",
        html: `<p class="text-sm text-muted-foreground py-2">No <strong>Quarterly Themes</strong> table found in the catalog. Add one under Core Data to show themes here.</p>`,
      },
    })
    nextY += 3
  }

  blocks.push(
    section(
      `<div class="pt-4 pb-2 border-b border-border/50"><h2 class="text-lg font-semibold tracking-tight text-foreground">Campaigns overview</h2><p class="text-sm text-muted-foreground mt-1">All campaigns</p></div>`,
      nextY,
      3
    )
  )
  nextY += 3

  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: nextY,
    width: 12,
    height: 12,
    config: {
      title: "All campaigns",
      table_id: campaignTableId,
      view_type: "gallery",
      visible_fields: ["name", "status", "content"],
      row_limit: 20,
      appearance: { showTitle: true, border: "none" },
    },
  })
  nextY += 12

  blocks.push(
    section(
      `<div class="pt-4 pb-2 border-b border-border/50"><h2 class="text-lg font-semibold tracking-tight text-foreground">Content snapshot</h2><p class="text-sm text-muted-foreground mt-1">Upcoming and recent items</p></div>`,
      nextY,
      3
    )
  )
  nextY += 3

  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: nextY,
    width: 12,
    height: 12,
    config: {
      title: "Content",
      table_id: contentTableId,
      view_type: "list",
      sorts: [{ field: "date", direction: "asc" }],
      row_limit: 10,
      list_title_field: "content_name",
      pill_fields: ["status"],
      visible_fields: ["content_name", "status", "date"],
      appearance: { showTitle: true, border: "none" },
    },
  })

  const rows = blocks.map((b, order_index) => {
    const row = b as Record<string, unknown>
    return {
      page_id: pageId,
      view_id: null,
      type: row.type as string,
      position_x: row.position_x as number,
      position_y: row.position_y as number,
      width: row.width as number,
      height: row.height as number,
      config: row.config,
      order_index,
      is_archived: false,
    }
  })

  const { error: bErr } = await supabase.from("view_blocks").insert(rows)

  if (bErr) {
    console.error("Failed to insert blocks", bErr)
    await supabase.from("interface_pages").update({ is_archived: true }).eq("id", pageId)
    process.exit(1)
  }

  console.log(`Created Marketing Dashboard page id=${pageId} with ${rows.length} blocks.`)
  console.log(`Open: /pages/${pageId}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
