/**
 * Applies a curated Marketing Hub workspace structure using existing data model.
 *
 * Goals:
 * - Keep schema unchanged
 * - Reuse interface pages + view_blocks + record modal behavior
 * - Enforce hierarchy:
 *   Marketing Home -> Theme Workspace -> Campaign Workspace -> Content Planning
 * - Enforce per-page structure:
 *   one primary block + one supporting block + one compact summary strip
 *
 * Run from baserow-app:
 *   npm run apply:marketing-hub
 */

const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function pickFieldName(fields, patterns, fallback = null) {
  const names = (fields || []).map((f) => f.name).filter(Boolean)
  for (const pattern of patterns) {
    const hit = names.find((name) => pattern.test(name) || pattern.test(normalizeName(name)))
    if (hit) return hit
  }
  return fallback
}

function hasField(fields, name) {
  if (!name) return false
  return (fields || []).some((f) => f?.name === name)
}

function safeFilter(fields, filter) {
  if (!filter?.field) return null
  return hasField(fields, filter.field) ? filter : null
}

function compactFilters(fields, filters) {
  return (filters || []).map((f) => safeFilter(fields, f)).filter(Boolean)
}

function section(title, description, y, h = 2) {
  return {
    type: "html",
    position_x: 0,
    position_y: y,
    width: 12,
    height: h,
    config: {
      title: "",
      html: `<div class="pt-2 pb-2 border-b border-border/50"><h2 class="text-lg font-semibold tracking-tight text-foreground">${title}</h2><p class="text-sm text-muted-foreground mt-1">${description}</p></div>`,
    },
  }
}

async function fetchRequiredMetadata() {
  const { data: tables, error: tErr } = await supabase.from("tables").select("id, name, supabase_table")
  if (tErr || !tables?.length) throw new Error(`Could not load tables: ${tErr?.message || "unknown error"}`)

  const findTable = (pred) => tables.find((t) => pred(t.name))
  const quarterlyThemes = findTable((n) => /quarterly/i.test(n) && /theme/i.test(n))
  const matrix = findTable((n) => /theme/i.test(n) && /division/i.test(n) && /matrix/i.test(n))
  const campaigns = findTable((n) => /campaign/i.test(n) && !/content/i.test(n))
  const content = findTable((n) => /^content$/i.test(n.trim()) || (/content/i.test(n) && !/calendar/i.test(n) && !/briefing/i.test(n)))
  const sponsorships = findTable((n) => /sponsorship/i.test(n))
  const contacts = findTable((n) => /^contact(s)?$/i.test(n.trim()))
  const resources = findTable((n) => /resource|document|asset|file|library/i.test(n))

  if (!quarterlyThemes || !campaigns || !content) {
    throw new Error("Missing required tables: Quarterly Themes, Campaigns, or Content")
  }

  const tableIds = [quarterlyThemes.id, campaigns.id, content.id]
  if (matrix) tableIds.push(matrix.id)
  if (sponsorships) tableIds.push(sponsorships.id)
  if (contacts) tableIds.push(contacts.id)
  if (resources) tableIds.push(resources.id)

  const { data: fieldRows, error: fErr } = await supabase
    .from("table_fields")
    .select("table_id, name")
    .in("table_id", tableIds)
  if (fErr) throw new Error(`Could not load table_fields: ${fErr.message}`)

  const fieldsByTable = new Map()
  for (const row of fieldRows || []) {
    const bucket = fieldsByTable.get(row.table_id) || []
    bucket.push(row)
    fieldsByTable.set(row.table_id, bucket)
  }

  const { data: anchorViews, error: vErr } = await supabase
    .from("views")
    .select("id, table_id, name")
    .in("table_id", [quarterlyThemes.id, campaigns.id, content.id])
    .limit(50)
  if (vErr) throw new Error(`Could not load views: ${vErr.message}`)

  const firstViewFor = (tableId) => (anchorViews || []).find((v) => v.table_id === tableId)?.id || null
  const anchors = {
    home: firstViewFor(quarterlyThemes.id),
    theme: firstViewFor(quarterlyThemes.id),
    campaigns: firstViewFor(campaigns.id),
    content: firstViewFor(content.id),
    resources: resources ? firstViewFor(resources.id) || firstViewFor(content.id) : firstViewFor(content.id),
  }
  if (!anchors.home || !anchors.theme || !anchors.campaigns || !anchors.content) {
    throw new Error("Missing saved views for required page anchors")
  }

  return { quarterlyThemes, matrix, campaigns, content, sponsorships, contacts, resources, fieldsByTable, anchors }
}

async function getGroupIdByName(name) {
  const { data, error } = await supabase
    .from("interface_groups")
    .select("id, name")
    .ilike("name", name)
    .limit(1)
  if (error) throw new Error(`Failed loading interface_groups: ${error.message}`)
  return data?.[0]?.id || null
}

async function upsertPage({ name, page_type, group_id, order_index, saved_view_id, config }) {
  const { data: existing, error: eErr } = await supabase
    .from("interface_pages")
    .select("id")
    .eq("name", name)
    .eq("is_archived", false)
    .maybeSingle()
  if (eErr) throw new Error(`Page lookup failed for ${name}: ${eErr.message}`)

  if (existing?.id) {
    const { data: updated, error: uErr } = await supabase
      .from("interface_pages")
      .update({ page_type, group_id, order_index, saved_view_id, config, is_admin_only: false })
      .eq("id", existing.id)
      .select("id")
      .single()
    if (uErr || !updated) throw new Error(`Page update failed for ${name}: ${uErr?.message || "unknown error"}`)
    return updated.id
  }

  const { data: created, error: cErr } = await supabase
    .from("interface_pages")
    .insert({
      name,
      page_type,
      group_id,
      order_index,
      config: config || {},
      source_view: null,
      base_table: null,
      saved_view_id,
      dashboard_layout_id: null,
      form_config_id: null,
      record_config_id: null,
      is_admin_only: false,
    })
    .select("id")
    .single()
  if (cErr || !created) throw new Error(`Page create failed for ${name}: ${cErr?.message || "unknown error"}`)
  return created.id
}

function blockSignature(block) {
  const cfg = block?.config || {}
  return [block?.type || "", cfg.title || "", cfg.table_id || "", cfg.view_type || "", cfg.kpi_label || ""].join("::")
}

async function applyPageBlocksAdditive(pageId, blocks) {
  const { data: existing, error: existingError } = await supabase
    .from("view_blocks")
    .select("id, type, position_x, position_y, width, height, config, order_index")
    .eq("page_id", pageId)
    .eq("is_archived", false)
    .order("order_index", { ascending: true })
  if (existingError) throw new Error(`Block lookup failed for page ${pageId}: ${existingError.message}`)

  const existingBySignature = new Map()
  for (const row of existing || []) {
    existingBySignature.set(blockSignature(row), row)
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const next = blocks[i]
    const signature = blockSignature(next)
    const match = existingBySignature.get(signature)

    if (match?.id) {
      const { error } = await supabase
        .from("view_blocks")
        .update({
          position_x: next.position_x,
          position_y: next.position_y,
          width: next.width,
          height: next.height,
          config: next.config,
          order_index: i,
        })
        .eq("id", match.id)
      if (error) throw new Error(`Block update failed for page ${pageId}: ${error.message}`)
      continue
    }

    const { error } = await supabase.from("view_blocks").insert({
      page_id: pageId,
      view_id: null,
      type: next.type,
      position_x: next.position_x,
      position_y: next.position_y,
      width: next.width,
      height: next.height,
      config: next.config,
      order_index: i,
      is_archived: false,
    })
    if (error) throw new Error(`Block insert failed for page ${pageId}: ${error.message}`)
  }
}

function buildMarketingHomeBlocks(ctx) {
  const themeFields = ctx.fieldsByTable.get(ctx.quarterlyThemes.id) || []
  const campaignFields = ctx.fieldsByTable.get(ctx.campaigns.id) || []
  const contentFields = ctx.fieldsByTable.get(ctx.content.id) || []

  const themeName = pickFieldName(themeFields, [/^name$/i, /theme/i], "name")
  const campaignName = pickFieldName(campaignFields, [/^name$/i], "name")
  const campaignStatus = pickFieldName(campaignFields, [/^status$/i, /state/i], "status")
  const campaignTheme = pickFieldName(campaignFields, [/quarterly_theme/i, /^theme$/i], null)
  const contentName = pickFieldName(contentFields, [/content_name/i, /^name$/i], "content_name")
  const contentDate = pickFieldName(contentFields, [/^date$/i, /publish_date/i, /due_date/i], "date")
  const contentCampaign = pickFieldName(contentFields, [/campaigns?/i], null)

  const blocks = []
  let y = 0
  blocks.push(section("Marketing Home", "Snapshot: themes, active campaigns, and upcoming content", y, 2))
  y += 2
  blocks.push({
    type: "kpi",
    position_x: 0,
    position_y: y,
    width: 4,
    height: 3,
    config: { title: "Themes", kpi_label: "Active themes", table_id: ctx.quarterlyThemes.id, kpi_aggregate: "count", filters: [] },
  })
  blocks.push({
    type: "kpi",
    position_x: 4,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Campaigns",
      kpi_label: "In flight",
      table_id: ctx.campaigns.id,
      kpi_aggregate: "count",
      filters: compactFilters(campaignFields, [
        { field: campaignName, operator: "is_not_empty", value: "" },
        { field: campaignStatus, operator: "is_not_empty", value: "" },
      ]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 8,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Upcoming Content",
      kpi_label: "Next 30 days",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [
        { field: contentName, operator: "is_not_empty", value: "" },
        { field: contentDate, operator: "date_next_days", value: 30 },
      ]),
    },
  })
  y += 3

  const primaryFields = [campaignName, campaignStatus].filter(Boolean)
  if (campaignTheme) primaryFields.push(campaignTheme)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 8,
    config: {
      title: "Theme-led Campaign Overview",
      table_id: ctx.campaigns.id,
      view_type: "list",
      row_limit: 14,
      list_title_field: campaignName,
      visible_fields: primaryFields,
      pill_fields: campaignStatus ? [campaignStatus] : [],
      ...(campaignTheme ? { group_by_field: campaignTheme } : {}),
      appearance: { showTitle: true, border: "none" },
    },
  })
  y += 8

  const supportingFields = [contentName, contentDate].filter(Boolean)
  if (contentCampaign) supportingFields.push(contentCampaign)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 6,
    config: {
      title: "Upcoming Content",
      table_id: ctx.content.id,
      view_type: "list",
      row_limit: 8,
      list_title_field: contentName,
      visible_fields: supportingFields,
      filters: compactFilters(contentFields, [
        { field: contentName, operator: "is_not_empty", value: "" },
        { field: contentDate, operator: "date_next_days", value: 45 },
      ]),
      sorts: [{ field: contentDate, direction: "asc" }],
      appearance: { showTitle: true, border: "none" },
    },
  })

  return blocks
}

function buildThemeWorkspaceBlocks(ctx) {
  const themeFields = ctx.fieldsByTable.get(ctx.quarterlyThemes.id) || []
  const matrixFields = ctx.matrix ? ctx.fieldsByTable.get(ctx.matrix.id) || [] : []
  const campaignFields = ctx.fieldsByTable.get(ctx.campaigns.id) || []
  const contentFields = ctx.fieldsByTable.get(ctx.content.id) || []

  const themeName = pickFieldName(themeFields, [/^name$/i, /theme/i], "name")
  const matrixTheme = pickFieldName(matrixFields, [/quarterly_theme/i, /^theme$/i], "quarterly_themes")
  const matrixDivision = pickFieldName(matrixFields, [/division/i], "division")
  const matrixMessage = pickFieldName(matrixFields, [/key_message/i, /notes?/i, /seasonal/i], null)
  const campaignName = pickFieldName(campaignFields, [/^name$/i], "name")
  const campaignStatus = pickFieldName(campaignFields, [/^status$/i], "status")
  const campaignTheme = pickFieldName(campaignFields, [/quarterly_theme/i, /^theme$/i], null)
  const contentDate = pickFieldName(contentFields, [/^date$/i, /publish_date/i], "date")
  const contentTheme = pickFieldName(contentFields, [/quarterly_theme/i, /^theme$/i], null)

  const blocks = []
  let y = 0
  blocks.push(section("Theme Workspace", "Planning brain: themes, division alignment, and linked execution", y, 2))
  y += 2
  blocks.push({
    type: "kpi",
    position_x: 0,
    position_y: y,
    width: 4,
    height: 3,
    config: { title: "Themes", kpi_label: "Total", table_id: ctx.quarterlyThemes.id, kpi_aggregate: "count", filters: [] },
  })
  blocks.push({
    type: "kpi",
    position_x: 4,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Theme-linked campaigns",
      kpi_label: "Linked",
      table_id: ctx.campaigns.id,
      kpi_aggregate: "count",
      filters: compactFilters(campaignFields, campaignTheme ? [{ field: campaignTheme, operator: "is_not_empty", value: "" }] : []),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 8,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Upcoming theme content",
      kpi_label: "Next 45d",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [
        ...(contentTheme ? [{ field: contentTheme, operator: "is_not_empty", value: "" }] : []),
        { field: contentDate, operator: "date_next_days", value: 45 },
      ]),
    },
  })
  y += 3

  const matrixVisible = [matrixTheme, matrixDivision].filter(Boolean)
  if (matrixMessage) matrixVisible.push(matrixMessage)
  if (ctx.matrix) {
    blocks.push({
      type: "grid",
      position_x: 0,
      position_y: y,
      width: 12,
      height: 8,
      config: {
        title: "Quarterly Themes / Division Matrix",
        table_id: ctx.matrix.id,
        view_type: "list",
        row_limit: 24,
        list_title_field: matrixTheme || matrixDivision || "id",
        visible_fields: matrixVisible,
        ...(matrixTheme ? { group_by_field: matrixTheme } : {}),
        appearance: { showTitle: true, border: "none" },
      },
    })
  } else {
    blocks.push({
      type: "grid",
      position_x: 0,
      position_y: y,
      width: 12,
      height: 8,
      config: {
        title: "Quarterly Themes",
        table_id: ctx.quarterlyThemes.id,
        view_type: "gallery",
        row_limit: 12,
        visible_fields: [themeName],
        appearance: { showTitle: true, border: "none" },
      },
    })
  }
  y += 8

  const campaignVisible = [campaignName, campaignStatus].filter(Boolean)
  if (campaignTheme) campaignVisible.push(campaignTheme)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 7,
    config: {
      title: "Linked Campaigns",
      table_id: ctx.campaigns.id,
      view_type: "list",
      row_limit: 12,
      list_title_field: campaignName,
      visible_fields: campaignVisible,
      pill_fields: campaignStatus ? [campaignStatus] : [],
      ...(campaignTheme ? { group_by_field: campaignTheme } : {}),
      appearance: { showTitle: true, border: "none" },
    },
  })

  return blocks
}

function buildCampaignWorkspaceBlocks(ctx) {
  const campaignFields = ctx.fieldsByTable.get(ctx.campaigns.id) || []
  const contentFields = ctx.fieldsByTable.get(ctx.content.id) || []

  const campaignName = pickFieldName(campaignFields, [/^name$/i], "name")
  const campaignStatus = pickFieldName(campaignFields, [/^status$/i], "status")
  const campaignTheme = pickFieldName(campaignFields, [/quarterly_theme/i, /^theme$/i], null)
  const campaignContent = pickFieldName(campaignFields, [/^content$/i, /content_link/i], null)
  const contentName = pickFieldName(contentFields, [/content_name/i, /^name$/i], "content_name")
  const contentDate = pickFieldName(contentFields, [/^date$/i, /publish_date/i], "date")
  const contentCampaign = pickFieldName(contentFields, [/campaigns?/i], null)

  const blocks = []
  let y = 0
  blocks.push(section("Campaign Workspace", "Execution cluster: campaign health and linked production queue", y, 2))
  y += 2
  blocks.push({
    type: "kpi",
    position_x: 0,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Active campaigns",
      kpi_label: "In progress",
      table_id: ctx.campaigns.id,
      kpi_aggregate: "count",
      filters: compactFilters(
        campaignFields,
        campaignStatus ? [{ field: campaignStatus, operator: "is_any_of", value: ["In Progress", "Live", "Active", "Planning"] }] : []
      ),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 4,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Content linked",
      kpi_label: "With content",
      table_id: ctx.campaigns.id,
      kpi_aggregate: "count",
      filters: compactFilters(campaignFields, campaignContent ? [{ field: campaignContent, operator: "is_not_empty", value: "" }] : []),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 8,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Upcoming items",
      kpi_label: "Next 30d",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [{ field: contentDate, operator: "date_next_days", value: 30 }]),
    },
  })
  y += 3

  const campaignVisible = [campaignName, campaignStatus].filter(Boolean)
  if (campaignTheme) campaignVisible.push(campaignTheme)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 8,
    config: {
      title: "Campaign Execution",
      table_id: ctx.campaigns.id,
      view_type: "list",
      row_limit: 16,
      list_title_field: campaignName,
      visible_fields: campaignVisible,
      pill_fields: campaignStatus ? [campaignStatus] : [],
      ...(campaignStatus ? { group_by_field: campaignStatus } : {}),
      appearance: { showTitle: true, border: "none" },
    },
  })
  y += 8

  const contentVisible = [contentName, contentDate].filter(Boolean)
  if (contentCampaign) contentVisible.push(contentCampaign)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 6,
    config: {
      title: "Linked Content Queue",
      table_id: ctx.content.id,
      view_type: "list",
      row_limit: 10,
      list_title_field: contentName,
      visible_fields: contentVisible,
      filters: compactFilters(contentFields, [
        { field: contentName, operator: "is_not_empty", value: "" },
        { field: contentDate, operator: "date_next_days", value: 60 },
      ]),
      sorts: [{ field: contentDate, direction: "asc" }],
      appearance: { showTitle: true, border: "none" },
    },
  })

  return blocks
}

function buildContentPlanningBlocks(ctx) {
  const contentFields = ctx.fieldsByTable.get(ctx.content.id) || []
  const contentName = pickFieldName(contentFields, [/content_name/i, /^name$/i], "content_name")
  const contentDate = pickFieldName(contentFields, [/^date$/i, /publish_date/i], "date")
  const contentStatus = pickFieldName(contentFields, [/^status$/i], "status")
  const contentCampaign = pickFieldName(contentFields, [/campaigns?/i], null)
  const contentTheme = pickFieldName(contentFields, [/quarterly_theme/i, /^theme$/i], null)

  const blocks = []
  let y = 0
  blocks.push(section("Content Planning", "Production surface: upcoming, scheduled, and recently delivered content", y, 2))
  y += 2
  blocks.push({
    type: "kpi",
    position_x: 0,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Upcoming (14d)",
      kpi_label: "Scheduled soon",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [
        { field: contentName, operator: "is_not_empty", value: "" },
        { field: contentDate, operator: "date_next_days", value: 14 },
      ]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 4,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "With campaign",
      kpi_label: "Linked",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, contentCampaign ? [{ field: contentCampaign, operator: "is_not_empty", value: "" }] : []),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 8,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Theme linked",
      kpi_label: "Aligned",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, contentTheme ? [{ field: contentTheme, operator: "is_not_empty", value: "" }] : []),
    },
  })
  y += 3

  const primaryFields = [contentName, contentStatus, contentDate].filter(Boolean)
  if (contentCampaign) primaryFields.push(contentCampaign)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 8,
    config: {
      title: "Content Queue",
      table_id: ctx.content.id,
      view_type: "list",
      row_limit: 16,
      list_title_field: contentName,
      visible_fields: primaryFields,
      pill_fields: contentStatus ? [contentStatus] : [],
      filters: compactFilters(contentFields, [
        { field: contentName, operator: "is_not_empty", value: "" },
        { field: contentDate, operator: "date_next_days", value: 90 },
      ]),
      sorts: [{ field: contentDate, direction: "asc" }],
      appearance: { showTitle: true, border: "none" },
    },
  })
  y += 8

  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 7,
    config: {
      title: "Planning Calendar",
      table_id: ctx.content.id,
      view_type: "calendar",
      calendar_date_field: contentDate,
      default_date_range_preset: "thisMonth",
      visible_fields: [contentName, contentStatus, contentDate].filter(Boolean),
      filters: compactFilters(contentFields, [{ field: contentName, operator: "is_not_empty", value: "" }]),
      appearance: { showTitle: true, border: "none" },
    },
  })

  return blocks
}

function buildInternalStaffBlocks(ctx) {
  const resourceTable = ctx.resources || ctx.content
  const resourceFields = ctx.fieldsByTable.get(resourceTable.id) || []
  const contactFields = ctx.contacts ? ctx.fieldsByTable.get(ctx.contacts.id) || [] : []

  const resourceTitle = pickFieldName(resourceFields, [/^name$/i, /^title$/i, /document/i, /resource/i], "name")
  const resourceType = pickFieldName(resourceFields, [/^type$/i, /category/i, /format/i], null)
  const resourceOwner = pickFieldName(resourceFields, [/owner/i, /assignee/i, /team/i], null)
  const resourceLink = pickFieldName(resourceFields, [/url/i, /link/i, /document_link/i, /drive/i], null)
  const resourceStatus = pickFieldName(resourceFields, [/^status$/i, /state/i], null)

  const contactName = pickFieldName(contactFields, [/^name$/i, /contact/i], "name")
  const contactTeam = pickFieldName(contactFields, [/team/i, /department/i, /division/i], null)
  const contactEmail = pickFieldName(contactFields, [/email/i], null)

  const blocks = []
  let y = 0
  blocks.push(section("Internal Staff Hub", "Central place for team resources, documents, and internal contacts", y, 2))
  y += 2

  blocks.push({
    type: "kpi",
    position_x: 0,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Resources",
      kpi_label: "Total",
      table_id: resourceTable.id,
      kpi_aggregate: "count",
      filters: compactFilters(resourceFields, [{ field: resourceTitle, operator: "is_not_empty", value: "" }]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 4,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Linked docs",
      kpi_label: "With link",
      table_id: resourceTable.id,
      kpi_aggregate: "count",
      filters: compactFilters(resourceFields, resourceLink ? [{ field: resourceLink, operator: "is_not_empty", value: "" }] : []),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 8,
    position_y: y,
    width: 4,
    height: 3,
    config: {
      title: "Active items",
      kpi_label: "In use",
      table_id: resourceTable.id,
      kpi_aggregate: "count",
      filters: compactFilters(
        resourceFields,
        resourceStatus
          ? [{ field: resourceStatus, operator: "is_any_of", value: ["Active", "Live", "Published", "In Use"] }]
          : [{ field: resourceTitle, operator: "is_not_empty", value: "" }]
      ),
    },
  })
  y += 3

  const primaryVisible = [resourceTitle, resourceType, resourceOwner, resourceLink].filter(Boolean)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 8,
    config: {
      title: ctx.resources ? "Resource Library" : "Resource Library (using Content table)",
      table_id: resourceTable.id,
      view_type: "list",
      row_limit: 20,
      list_title_field: resourceTitle,
      visible_fields: primaryVisible,
      ...(resourceType ? { group_by_field: resourceType } : {}),
      ...(resourceStatus ? { pill_fields: [resourceStatus] } : {}),
      filters: compactFilters(resourceFields, [{ field: resourceTitle, operator: "is_not_empty", value: "" }]),
      appearance: { showTitle: true, border: "none" },
    },
  })
  y += 8

  if (ctx.contacts && contactName) {
    const supportVisible = [contactName, contactTeam, contactEmail].filter(Boolean)
    blocks.push({
      type: "grid",
      position_x: 0,
      position_y: y,
      width: 12,
      height: 6,
      config: {
        title: "Internal Contacts",
        table_id: ctx.contacts.id,
        view_type: "list",
        row_limit: 10,
        list_title_field: contactName,
        visible_fields: supportVisible,
        ...(contactTeam ? { group_by_field: contactTeam } : {}),
        filters: compactFilters(contactFields, [{ field: contactName, operator: "is_not_empty", value: "" }]),
        appearance: { showTitle: true, border: "none" },
      },
    })
  } else {
    blocks.push({
      type: "html",
      position_x: 0,
      position_y: y,
      width: 12,
      height: 4,
      config: {
        title: "How to use this page",
        html: `<div class="rounded-lg border border-border/60 bg-card p-4"><p class="text-sm text-muted-foreground">Add a dedicated Resources/Documents table to make this page fully document-led. For now, this page uses your existing data model and remains member-accessible.</p></div>`,
      },
    })
  }

  return blocks
}

async function applyVisibilityCuration() {
  const noisyNames = [
    "Timeline Content Test",
    "Test Blocks",
    "Forwarding",
    "Reports",
    "Guides",
    "Ideas",
    "Memberships",
    "Welcome",
  ]
  const { data: noisyPages, error } = await supabase
    .from("interface_pages")
    .select("id, name")
    .in("name", noisyNames)
    .eq("is_archived", false)
  if (error) throw new Error(`Failed loading noisy pages: ${error.message}`)
  for (const page of noisyPages || []) {
    await supabase.from("interface_pages").update({ is_admin_only: true }).eq("id", page.id)
  }
}

async function applyMarketingNavPriority(pageIds) {
  const orderedIds = [pageIds.home, pageIds.internalStaff, pageIds.theme, pageIds.campaign, pageIds.content].filter(Boolean)
  for (let i = 0; i < orderedIds.length; i += 1) {
    await supabase.from("interface_pages").update({ order_index: i, is_admin_only: false }).eq("id", orderedIds[i])
  }
}

async function main() {
  const ctx = await fetchRequiredMetadata()

  const publicGroup = (await getGroupIdByName("Public")) || (await getGroupIdByName("Other"))
  const strategyGroup = (await getGroupIdByName("Strategy")) || publicGroup
  const plannerGroup = (await getGroupIdByName("Planner")) || publicGroup
  if (!publicGroup || !strategyGroup || !plannerGroup) {
    throw new Error("Could not resolve required interface groups")
  }

  const homePageId = await upsertPage({
    name: "Marketing Home",
    page_type: "content",
    group_id: publicGroup,
    order_index: 0,
    saved_view_id: ctx.anchors.home,
    config: { layout_style: "marketing_dashboard" },
  })
  const themePageId = await upsertPage({
    name: "Theme Workspace",
    page_type: "content",
    group_id: strategyGroup,
    order_index: 0,
    saved_view_id: ctx.anchors.theme,
    config: { layout_style: "marketing_dashboard" },
  })
  const campaignPageId = await upsertPage({
    name: "Campaign Workspace",
    page_type: "content",
    group_id: plannerGroup,
    order_index: 0,
    saved_view_id: ctx.anchors.campaigns,
    config: { layout_style: "marketing_dashboard" },
  })
  const contentPageId = await upsertPage({
    name: "Content Planning",
    page_type: "content",
    group_id: plannerGroup,
    order_index: 1,
    saved_view_id: ctx.anchors.content,
    config: { layout_style: "marketing_dashboard" },
  })
  const internalStaffPageId = await upsertPage({
    name: "Internal Staff Hub",
    page_type: "content",
    group_id: publicGroup,
    order_index: 1,
    saved_view_id: ctx.anchors.resources,
    config: { layout_style: "marketing_dashboard" },
  })

  await applyPageBlocksAdditive(homePageId, buildMarketingHomeBlocks(ctx))
  await applyPageBlocksAdditive(themePageId, buildThemeWorkspaceBlocks(ctx))
  await applyPageBlocksAdditive(campaignPageId, buildCampaignWorkspaceBlocks(ctx))
  await applyPageBlocksAdditive(contentPageId, buildContentPlanningBlocks(ctx))
  await applyPageBlocksAdditive(internalStaffPageId, buildInternalStaffBlocks(ctx))

  await applyMarketingNavPriority({
    home: homePageId,
    internalStaff: internalStaffPageId,
    theme: themePageId,
    campaign: campaignPageId,
    content: contentPageId,
  })
  await applyVisibilityCuration()

  console.log("Marketing Hub workspace applied successfully.")
  console.log(`Marketing Home: /pages/${homePageId}`)
  console.log(`Theme Workspace: /pages/${themePageId}`)
  console.log(`Campaign Workspace: /pages/${campaignPageId}`)
  console.log(`Content Planning: /pages/${contentPageId}`)
  console.log(`Internal Staff Hub: /pages/${internalStaffPageId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

