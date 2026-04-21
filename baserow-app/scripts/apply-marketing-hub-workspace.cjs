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

async function upsertPage({ name, aliases = [], page_type, group_id, order_index, saved_view_id, config }) {
  const lookupNames = [name, ...(aliases || [])]
  const { data: existingRows, error: eErr } = await supabase
    .from("interface_pages")
    .select("id, name")
    .in("name", lookupNames)
    .eq("is_archived", false)
    .limit(1)
  if (eErr) throw new Error(`Page lookup failed for ${name}: ${eErr.message}`)
  const existing = existingRows?.[0] || null

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
  const contentFields = ctx.fieldsByTable.get(ctx.content.id) || []

  const themeName = pickFieldName(themeFields, [/^name$/i, /theme/i], "name")
  const themeStatus = pickFieldName(themeFields, [/^status$/i, /state/i], null)
  const themeSummary = pickFieldName(themeFields, [/summary/i, /description/i, /brief/i, /notes?/i], null)
  const themeYear = pickFieldName(themeFields, [/^year$/i, /fiscal_year/i, /planning_year/i], null)
  const themeDate = pickFieldName(themeFields, [/start_date/i, /date/i, /period_start/i, /from_date/i], null)
  const contentName = pickFieldName(contentFields, [/content_name/i, /^name$/i], "content_name")
  const contentDate = pickFieldName(contentFields, [/^date$/i, /publish_date/i, /due_date/i], "date")
  const contentStatus = pickFieldName(contentFields, [/^status$/i, /state/i], null)
  const contentTheme = pickFieldName(contentFields, [/quarterly_theme/i, /^theme$/i], null)

  const blocks = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const yearStart = `${currentYear}-01-01`
  const yearEnd = `${currentYear}-12-31`
  const themeCurrentYearFilters = compactFilters(
    themeFields,
    themeYear
      ? [
          { field: themeName, operator: "is_not_empty", value: "" },
          { field: themeYear, operator: "is_any_of", value: [String(currentYear), currentYear] },
        ]
      : themeDate
      ? [
          { field: themeName, operator: "is_not_empty", value: "" },
          { field: themeDate, operator: "date_range", value: { start: yearStart, end: yearEnd } },
        ]
      : [{ field: themeName, operator: "is_not_empty", value: "" }]
  )
  const baseContentFilters = compactFilters(contentFields, [
    { field: contentName, operator: "is_not_empty", value: "" },
    ...(contentDate ? [{ field: contentDate, operator: "is_not_empty", value: "" }] : []),
  ])

  let y = 0
  blocks.push({
    type: "html",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 2,
    config: {
      title: "",
      html: `<div class="rounded-card-lg border border-border/60 bg-card px-5 py-4 shadow-sm"><div class="flex items-start justify-between gap-4"><div><h2 class="text-xl font-semibold tracking-tight text-foreground">Good morning, {{user_first_name}} 👋</h2><p class="mt-1 text-sm text-muted-foreground">Here&apos;s what&apos;s happening in marketing.</p></div><div class="text-xs text-muted-foreground">Use the Year filter block to scope this page.</div></div></div>`,
    },
  })
  y += 3

  blocks.push({
    type: "filter",
    position_x: 9,
    position_y: 0,
    width: 3,
    height: 2,
    config: {
      title: "Year",
      table_id: ctx.content.id,
      target_blocks: "all",
      allowed_fields: contentDate ? [contentDate] : [],
      // Default to current year; users can change from the filter block UI.
      filter_tree: contentDate
        ? {
            operator: "AND",
            children: [
              {
                field_id: contentDate,
                operator: "date_range",
                value: { start: yearStart, end: yearEnd },
              },
            ],
          }
        : null,
      default_filters: contentDate
        ? {
            operator: "AND",
            children: [
              {
                field_id: contentDate,
                operator: "date_range",
                value: { start: yearStart, end: yearEnd },
              },
            ],
          }
        : null,
      filters: contentDate
        ? [{ field: contentDate, operator: "date_range", value: yearStart, value2: yearEnd }]
        : [],
      appearance: { title: "Year", show_title: true, background_color: "#ffffff", border_color: "#e5e7eb", border_width: 1, border_radius: 10, padding: 8 },
    },
  })

  blocks.push({
    type: "kpi",
    position_x: 0,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "Themes this year",
      kpi_label: "Active themes",
      table_id: ctx.quarterlyThemes.id,
      kpi_aggregate: "count",
      filters: themeCurrentYearFilters,
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 3,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "Due this week",
      kpi_label: "Content items",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [...baseContentFilters, ...(contentDate ? [{ field: contentDate, operator: "date_next_days", value: 7 }] : [])]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 6,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "In progress",
      kpi_label: "Content items",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [...baseContentFilters, ...(contentStatus ? [{ field: contentStatus, operator: "is_any_of", value: ["In Progress", "In progress"] }] : [])]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 9,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "Awaiting approval",
      kpi_label: "Content items",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(
        contentFields,
        [...baseContentFilters, ...(contentStatus ? [{ field: contentStatus, operator: "is_any_of", value: ["Sent for Approval", "Awaiting approval", "Waiting for approval"] }] : [])]
      ),
    },
  })
  y += 4

  const themeVisible = [themeName, themeSummary].filter(Boolean).slice(0, 2)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 8,
    height: 7,
    config: {
      title: "This Year's Themes",
      table_id: ctx.quarterlyThemes.id,
      view_type: "gallery",
      row_limit: 4,
      list_title_field: themeName,
      visible_fields: themeVisible,
      ...(themeStatus ? { pill_fields: [themeStatus] } : {}),
      filters: themeCurrentYearFilters,
      appearance: { showTitle: true, border: "none", compact: true, padding: "compact" },
    },
  })
  blocks.push({
    type: "grid",
    position_x: 8,
    position_y: y,
    width: 4,
    height: 7,
    config: {
      title: "Upcoming Content",
      table_id: ctx.content.id,
      view_type: "list",
      row_limit: 5,
      list_title_field: contentName,
      visible_fields: [contentName, contentTheme, contentDate].filter(Boolean),
      list_meta_fields: [contentTheme, contentDate].filter(Boolean),
      filters: compactFilters(contentFields, [...baseContentFilters, ...(contentDate ? [{ field: contentDate, operator: "date_next_days", value: 30 }] : [])]),
      sorts: [...(contentDate ? [{ field: contentDate, direction: "asc" }] : [])],
      appearance: { showTitle: true, border: "none", compact: true, padding: "compact" },
    },
  })
  y += 8

  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 8,
    height: 7,
    config: {
      title: "What's in Progress",
      table_id: ctx.content.id,
      view_type: "list",
      row_limit: 8,
      list_title_field: contentName,
      visible_fields: [contentName, contentStatus, contentTheme, contentDate].filter(Boolean),
      ...(contentStatus ? { pill_fields: [contentStatus] } : {}),
      list_meta_fields: [contentTheme, contentDate].filter(Boolean),
      filters: compactFilters(
        contentFields,
        [...baseContentFilters, ...(contentStatus ? [{ field: contentStatus, operator: "is_any_of", value: ["In Progress", "In progress", "Sent for Approval", "Awaiting approval", "Todo", "To do"] }] : [])]
      ),
      sorts: [...(contentDate ? [{ field: contentDate, direction: "asc" }] : [])],
      appearance: { showTitle: true, border: "none", compact: true, padding: "compact" },
    },
  })
  blocks.push({
    type: "grid",
    position_x: 8,
    position_y: y,
    width: 4,
    height: 7,
    config: {
      title: "Planning Calendar",
      table_id: ctx.content.id,
      view_type: "calendar",
      calendar_date_field: contentDate,
      default_date_range_preset: "thisMonth",
      visible_week_span: 4,
      visible_fields: [contentName, contentDate].filter(Boolean),
      filters: compactFilters(contentFields, [...baseContentFilters]),
      sorts: [...(contentDate ? [{ field: contentDate, direction: "asc" }] : [])],
      appearance: { showTitle: true, border: "none", compact: true, event_density: "compact" },
    },
  })

  return blocks
}

function buildThemeWorkspaceBlocks(ctx) {
  const themeFields = ctx.fieldsByTable.get(ctx.quarterlyThemes.id) || []
  const contentFields = ctx.fieldsByTable.get(ctx.content.id) || []

  const themeName = pickFieldName(themeFields, [/^name$/i, /theme/i], "name")
  const themeStatus = pickFieldName(themeFields, [/^status$/i, /state/i], null)
  const themeSummary = pickFieldName(themeFields, [/summary/i, /description/i, /brief/i, /notes?/i], null)
  const themeYear = pickFieldName(themeFields, [/^year$/i, /fiscal_year/i, /planning_year/i], null)
  const themeDate = pickFieldName(themeFields, [/start_date/i, /date/i, /period_start/i, /from_date/i], null)
  const contentName = pickFieldName(contentFields, [/content_name/i, /^name$/i, /title/i, /headline/i], null)
  const contentStatus = pickFieldName(contentFields, [/^status$/i, /state/i], null)
  const contentDate = pickFieldName(contentFields, [/^date$/i, /publish_date/i, /due_date/i], null)
  const contentTheme = pickFieldName(contentFields, [/quarterly_theme/i, /^theme$/i], null)
  const fallbackContentTitle = (contentFields || []).find((f) => f?.name && !/^id$/i.test(f.name) && !/_id$/i.test(f.name))?.name || null
  const contentDisplayField = contentName || fallbackContentTitle || "content_name"

  const blocks = []
  const now = new Date()
  const currentYear = now.getFullYear()
  const yearStart = `${currentYear}-01-01`
  const yearEnd = `${currentYear}-12-31`
  const themeCurrentYearFilters = compactFilters(
    themeFields,
    themeYear
      ? [
          { field: themeName, operator: "is_not_empty", value: "" },
          { field: themeYear, operator: "is_any_of", value: [String(currentYear), currentYear] },
        ]
      : themeDate
      ? [
          { field: themeName, operator: "is_not_empty", value: "" },
          { field: themeDate, operator: "date_range", value: { start: yearStart, end: yearEnd } },
        ]
      : [{ field: themeName, operator: "is_not_empty", value: "" }]
  )

  let y = 0
  blocks.push(section("Theme Workspace", "Planning view: current themes first, then the content flowing under each theme", y, 2))
  y += 2

  const themeVisible = [themeName, themeStatus, themeSummary].filter(Boolean).slice(0, 3)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 7,
    config: {
      title: `Quarterly Themes (${currentYear})`,
      table_id: ctx.quarterlyThemes.id,
      view_type: "gallery",
      row_limit: 6,
      list_title_field: themeName,
      visible_fields: themeVisible,
      ...(themeStatus ? { pill_fields: [themeStatus] } : {}),
      filters: themeCurrentYearFilters,
      appearance: { showTitle: true, border: "none" },
    },
  })
  y += 8

  const contentVisible = [contentDisplayField, contentStatus, contentDate, contentTheme].filter(Boolean)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 8,
    config: {
      title: "Content by Theme",
      table_id: ctx.content.id,
      view_type: "list",
      row_limit: 8,
      list_title_field: contentDisplayField,
      visible_fields: contentVisible,
      ...(contentStatus ? { pill_fields: [contentStatus] } : {}),
      ...(contentTheme ? { group_by_field: contentTheme } : {}),
      filters: compactFilters(contentFields, [
        { field: contentDisplayField, operator: "is_not_empty", value: "" },
        ...(contentTheme ? [{ field: contentTheme, operator: "is_not_empty", value: "" }] : []),
        ...(contentDate
          ? [{ field: contentDate, operator: "date_next_days", value: 60 }]
          : contentStatus
          ? [{ field: contentStatus, operator: "is_any_of", value: ["In Progress", "Planned", "Scheduled", "Active", "Draft"] }]
          : []),
      ]),
      ...(contentDate ? { sorts: [{ field: contentDate, direction: "asc" }] } : {}),
      appearance: { showTitle: true, border: "none" },
    },
  })
  y += 9

  blocks.push(section("Planning Snapshot", "Quick indicators for volume and upcoming work under current themes", y, 2))
  y += 2
  blocks.push({
    type: "kpi",
    position_x: 0,
    position_y: y,
    width: 6,
    height: 3,
    config: {
      title: "Content items per theme",
      kpi_label: "Theme-linked",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [
        { field: contentDisplayField, operator: "is_not_empty", value: "" },
        ...(contentTheme ? [{ field: contentTheme, operator: "is_not_empty", value: "" }] : []),
      ]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 6,
    position_y: y,
    width: 6,
    height: 3,
    config: {
      title: "Upcoming content",
      kpi_label: "Next 60d",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [
        { field: contentDisplayField, operator: "is_not_empty", value: "" },
        ...(contentTheme ? [{ field: contentTheme, operator: "is_not_empty", value: "" }] : []),
        ...(contentDate ? [{ field: contentDate, operator: "date_next_days", value: 60 }] : []),
      ]),
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
  blocks.push(section("Campaign Archive", "Reference view for historical and secondary campaign context", y, 2))
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
      title: "Past Campaigns",
      table_id: ctx.campaigns.id,
      view_type: "list",
      row_limit: 10,
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
      title: "Related Content",
      table_id: ctx.content.id,
      view_type: "list",
      row_limit: 8,
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
  const contentTheme = pickFieldName(contentFields, [/quarterly_theme/i, /^theme$/i], null)
  const isArchivedField = pickFieldName(contentFields, [/^is_archived$/i, /^archived$/i], null)
  const deletedAtField = pickFieldName(contentFields, [/^deleted_at$/i], null)
  const todoStatuses = ["Todo", "To do", "Ready to plan"]
  const inProgressStatuses = ["In Progress", "In progress"]
  const awaitingApprovalStatuses = ["Sent for Approval", "Awaiting approval", "Waiting for approval"]
  const baseQueueFilters = compactFilters(contentFields, [
    { field: contentName, operator: "is_not_empty", value: "" },
    ...(contentDate ? [{ field: contentDate, operator: "is_not_empty", value: "" }] : []),
    ...(isArchivedField ? [{ field: isArchivedField, operator: "is_not_any_of", value: [true, "true", 1, "1"] }] : []),
    ...(deletedAtField ? [{ field: deletedAtField, operator: "is_empty", value: "" }] : []),
  ])

  const blocks = []
  let y = 0
  blocks.push({
    type: "html",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 2,
    config: {
      title: "",
      html: `<div class="rounded-card-lg border border-border/60 bg-card px-5 py-4 shadow-sm"><div class="flex items-start justify-between gap-4"><div><h2 class="text-xl font-semibold tracking-tight text-foreground">Content Planning</h2><p class="mt-1 text-sm text-muted-foreground">Plan, prioritise, and track upcoming content across themes</p></div><button class="inline-flex items-center rounded-md border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">+ Add content</button></div></div>`,
    },
  })
  y += 3
  blocks.push({
    type: "kpi",
    position_x: 0,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "To do",
      kpi_label: "Content items",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [
        ...baseQueueFilters,
        ...(contentStatus ? [{ field: contentStatus, operator: "is_any_of", value: todoStatuses }] : []),
      ]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 3,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "In progress",
      kpi_label: "Content items",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [
        ...baseQueueFilters,
        ...(contentStatus ? [{ field: contentStatus, operator: "is_any_of", value: inProgressStatuses }] : []),
      ]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 6,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "Awaiting approval",
      kpi_label: "Content items",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [
        ...baseQueueFilters,
        ...(contentStatus ? [{ field: contentStatus, operator: "is_any_of", value: awaitingApprovalStatuses }] : []),
      ]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 9,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "Due this week",
      kpi_label: "Content items",
      table_id: ctx.content.id,
      kpi_aggregate: "count",
      filters: compactFilters(contentFields, [
        ...baseQueueFilters,
        ...(contentDate ? [{ field: contentDate, operator: "date_next_days", value: 7 }] : []),
      ]),
    },
  })
  y += 4

  const queueVisibleFields = [contentName, contentTheme, contentDate].filter(Boolean)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 8,
    height: 11,
    config: {
      title: "Content Queue",
      table_id: ctx.content.id,
      view_type: "list",
      row_limit: 12,
      list_title_field: contentName,
      visible_fields: queueVisibleFields,
      pill_fields: contentStatus ? [contentStatus] : [],
      ...(contentStatus ? { group_by_field: contentStatus } : {}),
      filters: compactFilters(contentFields, [
        ...baseQueueFilters,
        ...(contentStatus
          ? [
              {
                field: contentStatus,
                operator: "is_any_of",
                value: [...todoStatuses, ...inProgressStatuses, ...awaitingApprovalStatuses],
              },
            ]
          : []),
      ]),
      list_meta_fields: [contentTheme, contentDate].filter(Boolean),
      list_subtitle_fields: [],
      sorts: [...(contentDate ? [{ field: contentDate, direction: "asc" }] : [])],
      appearance: { showTitle: true, border: "none", compact: true, padding: "compact", showDivider: true },
    },
  })
  blocks.push({
    type: "grid",
    position_x: 8,
    position_y: y,
    width: 4,
    height: 6,
    config: {
      title: "Upcoming Content",
      table_id: ctx.content.id,
      view_type: "list",
      row_limit: 6,
      list_title_field: contentName,
      visible_fields: [contentName, contentDate].filter(Boolean),
      filters: compactFilters(contentFields, [
        ...baseQueueFilters,
        ...(contentDate ? [{ field: contentDate, operator: "date_next_days", value: 14 }] : []),
      ]),
      sorts: [...(contentDate ? [{ field: contentDate, direction: "asc" }] : [])],
      appearance: { showTitle: true, border: "none", compact: true, padding: "compact", showDivider: true },
    },
  })
  blocks.push({
    type: "grid",
    position_x: 8,
    position_y: y + 6,
    width: 4,
    height: 5,
    config: {
      title: "Planning Calendar",
      table_id: ctx.content.id,
      view_type: "calendar",
      calendar_date_field: contentDate,
      default_date_range_preset: "thisMonth",
      visible_week_span: 4,
      visible_fields: [contentName, contentDate, contentTheme].filter(Boolean),
      filters: compactFilters(contentFields, [...baseQueueFilters]),
      sorts: [...(contentDate ? [{ field: contentDate, direction: "asc" }] : [])],
      appearance: { showTitle: true, border: "none", compact: true, event_density: "compact" },
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
  const resourceCategory = pickFieldName(resourceFields, [/^category$/i, /segment/i, /group/i], null)
  const resourceOwner = pickFieldName(resourceFields, [/owner/i, /assignee/i, /team/i], null)
  const resourceLink = pickFieldName(resourceFields, [/url/i, /link/i, /document_link/i, /drive/i], null)
  const resourceStatus = pickFieldName(resourceFields, [/^status$/i, /state/i], null)
  const resourceUpdatedAt = pickFieldName(resourceFields, [/^updated_at$/i, /last_updated/i, /modified/i, /updated/i], null)
  const resourceDescription = pickFieldName(resourceFields, [/description/i, /summary/i, /notes?/i, /details?/i], null)
  const resourceIsArchived = pickFieldName(resourceFields, [/^is_archived$/i, /^archived$/i], null)
  const resourceDeletedAt = pickFieldName(resourceFields, [/^deleted_at$/i], null)

  const contactName = pickFieldName(contactFields, [/^name$/i, /contact/i], "name")
  const contactRole = pickFieldName(contactFields, [/role/i, /title/i, /job/i], null)
  const contactTeam = pickFieldName(contactFields, [/team/i, /department/i, /division/i], null)
  const contactEmail = pickFieldName(contactFields, [/email/i], null)
  const contactIsArchived = pickFieldName(contactFields, [/^is_archived$/i, /^archived$/i], null)
  const contactDeletedAt = pickFieldName(contactFields, [/^deleted_at$/i], null)
  const linkTypeValues = ["Link", "Tool", "Useful Link", "External", "Platform"]

  const blocks = []
  let y = 0
  blocks.push({
    type: "html",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 2,
    config: {
      title: "",
      html: `<div class="rounded-card-lg border border-border/60 bg-card px-5 py-4 shadow-sm"><div class="flex items-start justify-between gap-4"><div><h2 class="text-xl font-semibold tracking-tight text-foreground">Internal Marketing Hub</h2><p class="mt-1 text-sm text-muted-foreground">Resources, contacts and tools for the Marketing team.</p></div><div class="flex items-center gap-2"><div class="hidden md:flex items-center rounded-md border border-border/70 bg-background px-3 py-1.5 text-xs text-muted-foreground min-w-[180px]">Search resources...</div></div></div></div>`,
    },
  })
  y += 3

  const baseResourceFilters = compactFilters(resourceFields, [
    { field: resourceTitle, operator: "is_not_empty", value: "" },
    ...(resourceIsArchived ? [{ field: resourceIsArchived, operator: "is_not_any_of", value: [true, "true", 1, "1"] }] : []),
    ...(resourceDeletedAt ? [{ field: resourceDeletedAt, operator: "is_empty", value: "" }] : []),
  ])
  const baseContactFilters = compactFilters(contactFields, [
    ...(contactName ? [{ field: contactName, operator: "is_not_empty", value: "" }] : []),
    ...(contactIsArchived ? [{ field: contactIsArchived, operator: "is_not_any_of", value: [true, "true", 1, "1"] }] : []),
    ...(contactDeletedAt ? [{ field: contactDeletedAt, operator: "is_empty", value: "" }] : []),
  ])

  blocks.push({
    type: "kpi",
    position_x: 0,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "Total resources",
      kpi_label: "Available to staff",
      table_id: resourceTable.id,
      kpi_aggregate: "count",
      filters: baseResourceFilters,
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 3,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "With links",
      kpi_label: "Quick access",
      table_id: resourceTable.id,
      kpi_aggregate: "count",
      filters: compactFilters(resourceFields, [
        ...baseResourceFilters,
        ...(resourceLink ? [{ field: resourceLink, operator: "is_not_empty", value: "" }] : []),
      ]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 6,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "Recently updated",
      kpi_label: resourceUpdatedAt ? "In the last 30 days" : "Active set",
      table_id: resourceTable.id,
      kpi_aggregate: "count",
      filters: compactFilters(resourceFields, [
        ...baseResourceFilters,
        ...(resourceUpdatedAt
          ? [{ field: resourceUpdatedAt, operator: "date_last_days", value: 30 }]
          : resourceStatus
          ? [{ field: resourceStatus, operator: "is_any_of", value: ["Active", "Live", "Published", "In Use"] }]
          : []),
      ]),
    },
  })
  blocks.push({
    type: "kpi",
    position_x: 9,
    position_y: y,
    width: 3,
    height: 3,
    config: {
      title: "Downloads this month",
      kpi_label: "Team activity",
      table_id: resourceTable.id,
      kpi_aggregate: "count",
      filters: compactFilters(resourceFields, [
        ...baseResourceFilters,
        ...(resourceUpdatedAt
          ? [{ field: resourceUpdatedAt, operator: "date_this_month", value: true }]
          : resourceLink
          ? [{ field: resourceLink, operator: "is_not_empty", value: "" }]
          : []),
      ]),
    },
  })
  y += 4

  const primaryVisible = [resourceTitle, resourceType, resourceCategory, resourceUpdatedAt, resourceLink].filter(Boolean)
  blocks.push({
    type: "grid",
    position_x: 0,
    position_y: y,
    width: 12,
    height: 7,
    config: {
      title: "Resource Library",
      table_id: resourceTable.id,
      view_type: "list",
      row_limit: 7,
      list_title_field: resourceTitle,
      visible_fields: primaryVisible,
      list_subtitle_fields: [resourceDescription].filter(Boolean),
      list_meta_fields: [resourceType, resourceCategory, resourceUpdatedAt, resourceOwner].filter(Boolean),
      ...(resourceType ? { pill_fields: [resourceType] } : resourceStatus ? { pill_fields: [resourceStatus] } : {}),
      filters: baseResourceFilters,
      sorts: [...(resourceUpdatedAt ? [{ field: resourceUpdatedAt, direction: "desc" }] : [])],
      appearance: { showTitle: true, border: "none", compact: true, padding: "compact", showDivider: true },
    },
  })
  y += 8

  if (ctx.contacts && contactName) {
    const supportVisible = [contactName, contactRole, contactTeam, contactEmail].filter(Boolean)
    blocks.push({
      type: "grid",
      position_x: 0,
      position_y: y,
      width: 7,
      height: 6,
      config: {
        title: "Internal Contacts",
        table_id: ctx.contacts.id,
        view_type: "list",
        row_limit: 6,
        list_title_field: contactName,
        visible_fields: supportVisible,
        list_meta_fields: [contactRole, contactTeam, contactEmail].filter(Boolean),
        ...(contactTeam ? { group_by_field: contactTeam } : {}),
        filters: baseContactFilters,
        appearance: { showTitle: true, border: "none", compact: true, padding: "compact" },
      },
    })
    blocks.push({
      type: "grid",
      position_x: 7,
      position_y: y,
      width: 5,
      height: 6,
      config: {
        title: "Useful Links",
        table_id: resourceTable.id,
        view_type: "list",
        row_limit: 6,
        list_title_field: resourceTitle,
        visible_fields: [resourceTitle, resourceDescription, resourceLink].filter(Boolean),
        list_subtitle_fields: [resourceDescription].filter(Boolean),
        list_meta_fields: [resourceType].filter(Boolean),
        ...(resourceType ? { pill_fields: [resourceType] } : {}),
        filters: compactFilters(resourceFields, [
          ...baseResourceFilters,
          ...(resourceLink ? [{ field: resourceLink, operator: "is_not_empty", value: "" }] : []),
          ...(resourceType ? [{ field: resourceType, operator: "is_any_of", value: linkTypeValues }] : []),
        ]),
        appearance: { showTitle: true, border: "none", compact: true, padding: "compact" },
      },
    })
  } else {
    blocks.push({
      type: "html",
      position_x: 0,
      position_y: y,
      width: 7,
      height: 4,
      config: {
        title: "Internal Contacts",
        html: `<div class="rounded-card-lg border border-border/60 bg-card p-4 shadow-sm"><p class="text-sm text-muted-foreground">No contact table is connected yet. Add a Contacts table to enable the internal directory panel.</p></div>`,
      },
    })
    blocks.push({
      type: "grid",
      position_x: 7,
      position_y: y,
      width: 5,
      height: 6,
      config: {
        title: "Useful Links",
        table_id: resourceTable.id,
        view_type: "list",
        row_limit: 6,
        list_title_field: resourceTitle,
        visible_fields: [resourceTitle, resourceDescription, resourceLink].filter(Boolean),
        list_subtitle_fields: [resourceDescription].filter(Boolean),
        list_meta_fields: [resourceType].filter(Boolean),
        ...(resourceType ? { pill_fields: [resourceType] } : {}),
        filters: compactFilters(resourceFields, [
          ...baseResourceFilters,
          ...(resourceLink ? [{ field: resourceLink, operator: "is_not_empty", value: "" }] : []),
        ]),
        appearance: { showTitle: true, border: "none", compact: true, padding: "compact" },
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
  const orderedIds = [pageIds.home, pageIds.theme, pageIds.content, pageIds.campaign, pageIds.internalStaff].filter(Boolean)
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
    group_id: publicGroup,
    order_index: 2,
    saved_view_id: ctx.anchors.theme,
    config: { layout_style: "marketing_dashboard" },
  })
  const campaignPageId = await upsertPage({
    name: "Campaign Archive",
    aliases: ["Campaign Workspace"],
    page_type: "content",
    group_id: publicGroup,
    order_index: 3,
    saved_view_id: ctx.anchors.campaigns,
    config: { layout_style: "marketing_dashboard" },
  })
  const contentPageId = await upsertPage({
    name: "Content Planning",
    page_type: "content",
    group_id: publicGroup,
    order_index: 4,
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
  console.log(`Campaign Archive: /pages/${campaignPageId}`)
  console.log(`Content Planning: /pages/${contentPageId}`)
  console.log(`Internal Staff Hub: /pages/${internalStaffPageId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

