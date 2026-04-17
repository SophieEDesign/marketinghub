/**
 * One-off seed: creates a new "Marketing Dashboard (Theme-led)" interface page variant.
 * Layout: Themes (top), Campaigns (middle), Upcoming Content (bottom).
 *
 * Run from baserow-app: npm run seed:marketing-dashboard
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
  console.error("Set them in the environment or in baserow-app/.env.local")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function matchTable(rows, pred) {
  return rows.find((t) => pred(t.name))?.id
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function fieldNameFromRecord(field) {
  return field?.name || field?.field_name || field?.key || ""
}

function pickFieldName(fields, patterns) {
  const candidates = fields.map((f) => fieldNameFromRecord(f)).filter(Boolean)
  for (const pattern of patterns) {
    const hit = candidates.find((name) => pattern.test(normalizeName(name)) || pattern.test(String(name).toLowerCase()))
    if (hit) return hit
  }
  return null
}

function section(title, description, y, h = 2) {
  const escapedTitle = String(title || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  const escapedDescription = String(description || "").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return {
    type: "html",
    position_x: 0,
    position_y: y,
    width: 12,
    height: h,
    config: {
      title: "",
      html: `<div class="pt-2 pb-2 border-b border-border/50"><h2 class="text-lg font-semibold tracking-tight text-foreground">${escapedTitle}</h2><p class="text-sm text-muted-foreground mt-1">${escapedDescription}</p></div>`,
    },
  }
}

async function main() {
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
  if (!campaignTableId || !contentTableId || !quarterlyThemesTableId) {
    console.error(
      "Could not resolve Quarterly Themes, Campaigns, and Content tables. Found:",
      tables.map((t) => t.name).join(", ")
    )
    process.exit(1)
  }

  const [themeFieldsRes, campaignFieldsRes, contentFieldsRes] = await Promise.all([
    supabase.from("table_fields").select("name, field_name, key").eq("table_id", quarterlyThemesTableId),
    supabase.from("table_fields").select("name, field_name, key").eq("table_id", campaignTableId),
    supabase.from("table_fields").select("name, field_name, key").eq("table_id", contentTableId),
  ])

  if (themeFieldsRes.error || campaignFieldsRes.error || contentFieldsRes.error) {
    console.error("Could not load table_fields metadata", {
      themes: themeFieldsRes.error,
      campaigns: campaignFieldsRes.error,
      content: contentFieldsRes.error,
    })
    process.exit(1)
  }

  const themeFields = themeFieldsRes.data || []
  const campaignFields = campaignFieldsRes.data || []
  const contentFields = contentFieldsRes.data || []

  const themeNameField = pickFieldName(themeFields, [/^name$/, /theme_name/, /title/]) || "name"
  const themeNotesField = pickFieldName(themeFields, [/key_message/, /key_messages?/, /notes?/, /message/, /summary/, /description/])
  const campaignNameField = pickFieldName(campaignFields, [/^name$/, /campaign_name/, /title/]) || "name"
  const campaignStatusField = pickFieldName(campaignFields, [/^status$/, /campaign_status/, /state/]) || "status"
  const campaignThemeLinkField = pickFieldName(campaignFields, [/quarterly_theme/, /theme/, /quarterlythemes?/, /theme_link/])
  const contentNameField = pickFieldName(contentFields, [/content_name/, /^name$/, /title/]) || "content_name"
  const contentDateField = pickFieldName(contentFields, [/^date$/, /publish_date/, /scheduled_date/, /due_date/]) || "date"
  const contentCampaignField = pickFieldName(contentFields, [/campaigns?/, /linked_campaign/, /campaign_link/])

  const baseVariantName = "Marketing Dashboard (Theme-led)"
  const { data: existingVariantRows, error: variantErr } = await supabase
    .from("interface_pages")
    .select("name")
    .eq("is_archived", false)
    .ilike("name", `${baseVariantName}%`)

  if (variantErr) {
    console.error("Failed to check existing dashboard variants", variantErr)
    process.exit(1)
  }

  const existingNames = new Set((existingVariantRows || []).map((row) => row.name))
  let pageName = baseVariantName
  if (existingNames.has(pageName)) {
    let n = 2
    while (existingNames.has(`${baseVariantName} ${n}`)) n += 1
    pageName = `${baseVariantName} ${n}`
  }

  const { data: page, error: pErr } = await supabase
    .from("interface_pages")
    .insert({
      name: pageName,
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

  /** @type {any[]} */
  const blocks = []
  let nextY = 0

  blocks.push(section("Themes", "Current quarterly themes and key messaging", nextY, 3))
  nextY += 3

  const themeVisibleFields = [themeNameField]
  if (themeNotesField && !themeVisibleFields.includes(themeNotesField)) {
    themeVisibleFields.push(themeNotesField)
  }
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: nextY,
    width: 12,
    height: 7,
    config: {
      title: "Themes",
      table_id: quarterlyThemesTableId,
      view_type: "gallery",
      row_limit: 12,
      visible_fields: themeVisibleFields,
      appearance: { showTitle: true, border: "none" },
    },
  })
  nextY += 8

  blocks.push(section("Campaigns", "Campaigns and editorials aligned to themes", nextY, 2))
  nextY += 2

  const campaignVisibleFields = [campaignNameField]
  if (campaignStatusField && !campaignVisibleFields.includes(campaignStatusField)) {
    campaignVisibleFields.push(campaignStatusField)
  }
  if (campaignThemeLinkField && !campaignVisibleFields.includes(campaignThemeLinkField)) {
    campaignVisibleFields.push(campaignThemeLinkField)
  }

  const campaignsConfig = {
    title: "Campaigns",
    table_id: campaignTableId,
    view_type: "list",
    row_limit: 16,
    list_title_field: campaignNameField,
    pill_fields: campaignStatusField ? [campaignStatusField] : [],
    visible_fields: campaignVisibleFields,
    appearance: { showTitle: true, border: "none" },
  }
  if (campaignThemeLinkField) {
    campaignsConfig.group_by_field = campaignThemeLinkField
  }

  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: nextY,
    width: 12,
    height: 8,
    config: campaignsConfig,
  })
  nextY += 9

  blocks.push(section("Upcoming Content", "Recent and upcoming planned content", nextY, 2))
  nextY += 2

  const contentVisibleFields = [contentNameField]
  if (contentCampaignField && !contentVisibleFields.includes(contentCampaignField)) {
    contentVisibleFields.push(contentCampaignField)
  }
  if (contentDateField && !contentVisibleFields.includes(contentDateField)) {
    contentVisibleFields.push(contentDateField)
  }

  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: nextY,
    width: 12,
    height: 7,
    config: {
      title: "Upcoming Content",
      table_id: contentTableId,
      view_type: "list",
      row_limit: 10,
      list_title_field: contentNameField,
      visible_fields: contentVisibleFields,
      sorts: [{ field: contentDateField, direction: "asc" }],
      filters: [{ field: contentDateField, operator: "date_next_days", value: 45 }],
      appearance: { showTitle: true, border: "none" },
    },
  })

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

  console.log(`Created ${pageName} page id=${pageId} with ${rows.length} blocks.`)
  console.log(`Open: /pages/${pageId}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
