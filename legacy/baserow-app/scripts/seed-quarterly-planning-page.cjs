/**
 * One-off seed: "Quarterly planning" interface page — theme spine, content by theme, events.
 * Skips if a non-archived page with this name already exists.
 *
 * Run: npm run seed:quarterly-planning
 */

const fs = require("fs")
const path = require("path")

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local")
  if (!fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, "utf8")
  for (const line of text.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

const { createClient } = require("@supabase/supabase-js")

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PAGE_NAME = "Quarterly planning"

function matchTable(rows, pred) {
  return rows.find((t) => pred(t.name))?.id
}

function section(html, y, h = 2) {
  return {
    type: "html",
    position_x: 0,
    position_y: y,
    width: 12,
    height: h,
    config: { title: "", html },
  }
}

async function main() {
  const { data: existing } = await supabase
    .from("interface_pages")
    .select("id, name")
    .eq("name", PAGE_NAME)
    .eq("is_archived", false)
    .maybeSingle()

  if (existing) {
    console.log(`${PAGE_NAME} page already exists (id=${existing.id}). Skipping.`)
    process.exit(0)
  }

  const { data: groups, error: gErr } = await supabase
    .from("interface_groups")
    .select("id")
    .order("order_index", { ascending: true })
    .limit(1)

  if (gErr || !groups?.length) {
    console.error("No interface_groups found.", gErr)
    process.exit(1)
  }

  const { data: tables, error: tErr } = await supabase.from("tables").select("id, name")
  if (tErr || !tables?.length) {
    console.error("Could not load tables", tErr)
    process.exit(1)
  }

  const contentTableId = matchTable(
    tables,
    (n) => /content/i.test(n) && !/calendar/i.test(n) && !/briefing/i.test(n)
  )
  const quarterlyThemesTableId = matchTable(
    tables,
    (n) => /quarterly/i.test(n) && /theme/i.test(n)
  )
  const eventsTableId = matchTable(
    tables,
    (n) => /event/i.test(n) && !/content/i.test(n)
  )

  if (!contentTableId || !quarterlyThemesTableId) {
    console.error("Need Content and Quarterly Themes tables. Found:", tables.map((t) => t.name).join(", "))
    process.exit(1)
  }

  const { data: page, error: pErr } = await supabase
    .from("interface_pages")
    .insert({
      name: PAGE_NAME,
      page_type: "content",
      group_id: groups[0].id,
      order_index: 1,
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
    console.error("Failed to create page", pErr)
    process.exit(1)
  }

  const pageId = page.id
  /** @type {any[]} */
  const blocks = [
    section(
      `<div class="pt-1 pb-2 border-b border-border/50"><h2 class="text-lg font-semibold tracking-tight text-foreground">Quarterly planning</h2><p class="text-sm text-muted-foreground mt-1">Themes, content, and events linked to the same spine</p></div>`,
      0,
      3
    ),
    {
      type: "grid",
      position_x: 0,
      position_y: 3,
      width: 12,
      height: 8,
      config: {
        title: "Themes",
        table_id: quarterlyThemesTableId,
        view_type: "gallery",
        row_limit: 12,
        visible_fields: ["name"],
        appearance: { showTitle: true, border: "none" },
      },
    },
    section(
      `<div class="pt-4 pb-2 border-b border-border/50"><h2 class="text-lg font-semibold tracking-tight text-foreground">Content by theme</h2></div>`,
      11,
      2
    ),
    {
      type: "grid",
      position_x: 0,
      position_y: 13,
      width: 12,
      height: 10,
      config: {
        title: "Content",
        table_id: contentTableId,
        view_type: "list",
        group_by_field: "quarterly_theme",
        row_limit: 15,
        list_title_field: "content_name",
        pill_fields: ["status"],
        visible_fields: ["content_name", "status", "date", "quarterly_theme"],
        appearance: { showTitle: true, border: "none" },
      },
    },
  ]

  let nextY = 23
  if (eventsTableId) {
    blocks.push(
      section(
        `<div class="pt-4 pb-2 border-b border-border/50"><h2 class="text-lg font-semibold tracking-tight text-foreground">Events</h2><p class="text-sm text-muted-foreground mt-1">Linked theme and location</p></div>`,
        nextY,
        2
      )
    )
    nextY += 2
    blocks.push({
      type: "grid",
      position_x: 0,
      position_y: nextY,
      width: 12,
      height: 9,
      config: {
        title: "Events",
        table_id: eventsTableId,
        view_type: "list",
        row_limit: 12,
        list_title_field: "name",
        pill_fields: ["event_type"],
        visible_fields: ["name", "linked_theme", "location", "status"],
        sorts: [{ field: "created_at", direction: "desc" }],
        appearance: { showTitle: true, border: "none" },
      },
    })
  }

  const rows = blocks.map((b, order_index) => ({
    page_id: pageId,
    view_id: null,
    type: b.type,
    position_x: b.position_x,
    position_y: b.position_y,
    width: b.width,
    height: b.height,
    config: b.config,
    order_index,
    is_archived: false,
  }))

  const { error: bErr } = await supabase.from("view_blocks").insert(rows)
  if (bErr) {
    console.error("Failed to insert blocks", bErr)
    await supabase.from("interface_pages").update({ is_archived: true }).eq("id", pageId)
    process.exit(1)
  }

  console.log(`Created ${PAGE_NAME} page id=${pageId} with ${rows.length} blocks.`)
  console.log(`Open: /pages/${pageId}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
