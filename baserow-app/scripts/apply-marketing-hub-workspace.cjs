/**
 * Applies the Marketing Hub workspace: seven Interface Builder pages composed from blocks.
 *
 * - No layout_style canvas bypass
 * - Idempotent block sync via config.provisioning_key
 *
 * Run from baserow-app:
 *   npm run apply:marketing-hub
 */

const fs = require("fs")
const path = require("path")
const { createClient } = require("@supabase/supabase-js")

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const text = fs.readFileSync(filePath, "utf8")
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

function loadEnvLocal() {
  const candidates = [
    path.join(__dirname, "..", ".env.local"),
    path.join(__dirname, "..", ".env"),
    path.join(__dirname, "..", "..", ".env.local"),
    path.join(__dirname, "..", "..", ".env"),
  ]
  for (const envPath of candidates) {
    parseEnvFile(envPath)
  }
}

loadEnvLocal()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  console.error("")
  console.error("Create baserow-app/.env.local from .env.example, then run:")
  console.error("  npm run apply:marketing-hub")
  console.error("")
  console.error("Or apply via Supabase CLI:")
  console.error("  supabase db push   (includes migration 20260523000000_marketing_hub_workspace.sql)")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Mirrors baserow-app/lib/interface/kpi-summary-defaults.ts */
const DEFAULT_KPI_SUMMARY_CARDS = [
  {
    id: "active-campaigns",
    label: "Active Campaigns",
    icon: "rocket",
    accent: "purple",
    table_source: "campaigns",
    kpi_aggregate: "count",
    comparison_preset: "last_7_days",
    number_format: "standard",
  },
  {
    id: "content-scheduled",
    label: "Content Scheduled",
    icon: "calendar",
    accent: "blue",
    table_source: "content",
    kpi_aggregate: "count",
    comparison_preset: "last_7_days",
    number_format: "standard",
  },
  {
    id: "social-posts",
    label: "Social Posts",
    icon: "barchart",
    accent: "purple",
    table_source: "social_posts",
    kpi_aggregate: "count",
    comparison_preset: "last_7_days",
    number_format: "compact",
  },
  {
    id: "events-month",
    label: "Events This Month",
    icon: "calendardays",
    accent: "red",
    table_source: "events",
    kpi_aggregate: "count",
    comparison_preset: "month_over_month",
    number_format: "standard",
  },
]

function introBlock(provisioningKey, title, subtitle, y, h = 2) {
  return makeBlock({
    provisioningKey,
    type: "html",
    x: 0,
    y,
    w: 12,
    h,
    config: {
      title: `${title} intro`,
      html: `<div class="px-1 py-2"><h1 class="text-2xl font-bold tracking-tight text-[#111827] md:text-3xl">${title}</h1><p class="mt-1 text-sm text-[#6B7280]">${subtitle}</p></div>`,
    },
  })
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function buildMembersActionCardsHtml(cards) {
  const cardHtml = cards
    .map((card) => {
      const title = escapeHtml(card.title)
      const description = escapeHtml(card.description)
      const actionLabel = escapeHtml(card.actionLabel)
      if (card.url) {
        return `<article class="rounded-2xl border border-[#E6E6EF] bg-white p-5 shadow-sm"><h3 class="text-base font-semibold text-[#111827]">${title}</h3><p class="mt-2 text-sm text-[#6B7280]">${description}</p><a href="${escapeHtml(card.url)}" class="mt-4 inline-flex text-sm font-semibold text-[#5B3DF5]">${actionLabel} →</a></article>`
      }
      return `<article class="rounded-2xl border border-[#E6E6EF] bg-white p-5 shadow-sm"><h3 class="text-base font-semibold text-[#111827]">${title}</h3><p class="mt-2 text-sm text-[#6B7280]">${description}</p><span class="mt-4 inline-flex text-sm font-semibold text-[#9CA3AF]">${actionLabel}</span></article>`
    })
    .join("")

  return `<section class="rounded-2xl border border-[#E6E6EF] bg-[#FAF9FF] p-4 md:p-5"><div class="mb-4"><h2 class="text-lg font-semibold text-[#111827]">Quick actions</h2><p class="mt-1 text-sm text-[#6B7280]">Open the areas you can use most often.</p></div><div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">${cardHtml}</div></section>`
}

function makeBlock({ provisioningKey, type, x, y, w, h, config }) {
  return {
    type,
    position_x: x,
    position_y: y,
    width: w,
    height: h,
    config: {
      provisioning_key: provisioningKey,
      ...config,
    },
  }
}

function blockMatchKey(row) {
  const cfg = row?.config || {}
  if (cfg.provisioning_key) return String(cfg.provisioning_key)
  return [row?.type || "", cfg.title || ""].join("::")
}

function buildMembersWelcomeBlocks() {
  return [
    makeBlock({
      provisioningKey: "members_welcome_main",
      type: "members_welcome",
      x: 0,
      y: 0,
      w: 12,
      h: 22,
      config: {
        title: "Welcome to the Peters & May Marketing Hub",
        subtitle:
          "Access shared events, useful resources and collaboration tools in one place.",
        members_welcome_body:
          "Use this space to view upcoming events, manage your attendance, access approved documents and stay aligned with relevant activity.",
        members_welcome_show_quick_actions: true,
        is_full_page: true,
        members_welcome_max_events: 5,
        members_welcome_max_resources: 5,
        members_welcome_allow_submit_event: true,
        appearance: { showTitle: false },
      },
    }),
  ]
}

async function fetchRequiredMetadata() {
  const { data: tables, error: tErr } = await supabase.from("tables").select("id, name, supabase_table")
  if (tErr || !tables?.length) throw new Error(`Could not load tables: ${tErr?.message || "unknown error"}`)

  const findTable = (pred) => tables.find((t) => pred(t.name))
  const quarterlyThemes = findTable((n) => /quarterly/i.test(n) && /theme/i.test(n))
  const campaigns = findTable((n) => /campaign/i.test(n) && !/content/i.test(n))
  const content = findTable((n) =>
    /^content$/i.test(n.trim()) || (/content/i.test(n) && !/calendar/i.test(n) && !/briefing/i.test(n))
  )
  const resources = findTable((n) => /resource|document|asset|file|library/i.test(n))

  if (!quarterlyThemes || !campaigns || !content) {
    throw new Error("Missing required tables: Quarterly Themes, Campaigns, or Content")
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

  return { anchors }
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

const ADMIN_ONLY_PAGE_NAMES = new Set([
  "Marketing Home",
  "Dashboard",
  "Marketing Dashboard",
  "Theme Workspace",
  "Campaigns",
  "Content Planning",
  "Things To Do",
])

function pageIsAdminOnly(name) {
  return ADMIN_ONLY_PAGE_NAMES.has(name)
}

async function upsertPage({
  name,
  aliases = [],
  page_type,
  group_id,
  order_index,
  saved_view_id,
  config,
  is_admin_only,
}) {
  const adminOnly = is_admin_only ?? pageIsAdminOnly(name)
  const lookupNames = [name, ...(aliases || [])]
  const { data: existingRows, error: eErr } = await supabase
    .from("interface_pages")
    .select("id, name")
    .in("name", lookupNames)
    .eq("is_archived", false)
  if (eErr) throw new Error(`Page lookup failed for ${name}: ${eErr.message}`)
  const byName = new Map((existingRows || []).map((row) => [row.name, row]))
  const existing =
    byName.get(name) ||
    (aliases || []).map((alias) => byName.get(alias)).find(Boolean) ||
    null

  if (existing?.id) {
    const { data: updated, error: uErr } = await supabase
      .from("interface_pages")
      .update({
        name,
        page_type,
        group_id,
        order_index,
        saved_view_id,
        config,
        is_admin_only: adminOnly,
        is_hidden: false,
      })
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
      is_admin_only: adminOnly,
      is_hidden: false,
    })
    .select("id")
    .single()
  if (cErr || !created) throw new Error(`Page create failed for ${name}: ${cErr?.message || "unknown error"}`)
  return created.id
}

async function findFirstPageIdByNames(names) {
  if (!Array.isArray(names) || names.length === 0) return null
  const { data, error } = await supabase
    .from("interface_pages")
    .select("id, name")
    .in("name", names)
    .eq("is_archived", false)
    .eq("is_hidden", false)
    .order("order_index", { ascending: true })
    .limit(20)
  if (error) return null
  for (const name of names) {
    const hit = (data || []).find((row) => row.name === name)
    if (hit?.id) return hit.id
  }
  return data?.[0]?.id || null
}

async function syncPageBlocks(pageId, blocks) {
  const { data: existing, error: existingError } = await supabase
    .from("view_blocks")
    .select("id, type, position_x, position_y, width, height, config, order_index")
    .eq("page_id", pageId)
    .eq("is_archived", false)
    .order("order_index", { ascending: true })
  if (existingError) throw new Error(`Block lookup failed for page ${pageId}: ${existingError.message}`)

  const existingByKey = new Map()
  for (const row of existing || []) {
    existingByKey.set(blockMatchKey(row), row)
  }

  const desiredKeys = new Set()

  for (let i = 0; i < blocks.length; i += 1) {
    const next = blocks[i]
    const key = blockMatchKey(next)
    desiredKeys.add(key)
    const match = existingByKey.get(key)

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

  for (const row of existing || []) {
    const key = blockMatchKey(row)
    if (!desiredKeys.has(key)) {
      const { error } = await supabase.from("view_blocks").update({ is_archived: true }).eq("id", row.id)
      if (error) throw new Error(`Block archive failed for page ${pageId}: ${error.message}`)
    }
  }
}

function buildMarketingHomeBlocks() {
  return [
    introBlock(
      "home_intro",
      "Marketing Hub",
      "Plan campaigns, content, resources and activity from one shared workspace.",
      0
    ),
    makeBlock({
      provisioningKey: "home_kpi",
      type: "kpi_summary",
      x: 0,
      y: 2,
      w: 12,
      h: 3,
      config: {
        title: "Marketing Overview",
        kpi_summary_cards: DEFAULT_KPI_SUMMARY_CARDS,
      },
    }),
    makeBlock({
      provisioningKey: "home_themes",
      type: "content_theme",
      x: 0,
      y: 5,
      w: 8,
      h: 8,
      config: {
        title: "Content Themes",
        content_theme_subtitle: "Strategic themes and content focus areas for the quarter.",
        content_theme_year: 2026,
        content_theme_quarter: "Q2",
        content_theme_show_filters: true,
        content_theme_show_view_toggle: true,
        content_theme_show_footer: true,
        content_theme_highlight_current_quarter: true,
        content_theme_view_mode: "grid",
      },
    }),
    makeBlock({
      provisioningKey: "home_todo",
      type: "things_to_do",
      x: 8,
      y: 5,
      w: 4,
      h: 4,
      config: {
        title: "Things To Do",
        things_to_do_subtitle: "Content actions that need attention.",
        things_to_do_compact_mode: true,
        things_to_do_max_items: 5,
        things_to_do_show_stats: true,
        things_to_do_show_filters: false,
        things_to_do_enable_detail_panel: false,
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "home_resources",
      type: "internal_resource_hub",
      x: 8,
      y: 9,
      w: 4,
      h: 4,
      config: {
        title: "Latest Resources",
        resource_hub_subtitle: "Logos, documents, templates and internal assets.",
        resource_hub_layout_mode: "list",
        resource_hub_use_dashboard_mock: false,
        resource_hub_show_search: false,
        resource_hub_show_recent: false,
        resource_hub_show_upload: false,
      },
    }),
    makeBlock({
      provisioningKey: "home_timeline",
      type: "content_timeline",
      x: 0,
      y: 13,
      w: 8,
      h: 8,
      config: {
        title: "Content Timeline",
        content_timeline_subtitle: "Plan and track key content and campaigns.",
        content_timeline_use_mock: false,
        content_timeline_default_view: "quarter",
        content_timeline_group_by: "theme",
        content_timeline_preset: "marketing_home",
        content_timeline_include_social_posts: true,
        content_timeline_show_filters: true,
        content_timeline_enable_detail_panel: true,
        content_timeline_compact_mode: false,
        content_timeline_title_field: "content_name",
        content_timeline_theme_field: "quarterly_theme",
        content_timeline_type_field: "content_type",
        content_timeline_status_field: "status",
        content_timeline_channel_field: "channels",
        content_timeline_owner_field: "owner",
        content_timeline_start_date_field: "date",
        content_timeline_end_date_field: "date_due",
        content_timeline_date_to_field: "date_to",
        content_timeline_division_field: "division",
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "home_events",
      type: "event_calendar",
      x: 8,
      y: 13,
      w: 4,
      h: 8,
      config: {
        title: "Upcoming Events",
        event_calendar_subtitle: "Upcoming events, boat shows and planning.",
        event_calendar_default_view: "list",
        event_calendar_show_toolbar: false,
        event_calendar_show_metrics: false,
        event_calendar_show_filters: false,
        event_calendar_show_search: false,
        event_calendar_show_add_button: false,
        event_calendar_density: "compact",
        appearance: { showTitle: true },
      },
    }),
  ]
}

function buildThemeWorkspaceBlocks() {
  return [
    introBlock(
      "theme_intro",
      "Theme Workspace",
      "Shape quarterly themes, campaign angles and content focus areas.",
      0
    ),
    makeBlock({
      provisioningKey: "theme_themes",
      type: "content_theme",
      x: 0,
      y: 2,
      w: 12,
      h: 8,
      config: {
        title: "Content Themes",
        content_theme_subtitle: "Strategic themes and content focus areas.",
        content_theme_year: 2026,
        content_theme_quarter: "Q2",
        content_theme_show_filters: true,
        content_theme_show_footer: true,
        content_theme_highlight_current_quarter: true,
        content_theme_view_mode: "grid",
      },
    }),
    makeBlock({
      provisioningKey: "theme_timeline",
      type: "content_timeline",
      x: 0,
      y: 10,
      w: 8,
      h: 8,
      config: {
        title: "Theme Timeline",
        content_timeline_subtitle: "See how themes connect to planned content.",
        content_timeline_default_view: "quarter",
        content_timeline_group_by: "theme",
        content_timeline_show_filters: true,
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "theme_actions",
      type: "things_to_do",
      x: 8,
      y: 10,
      w: 4,
      h: 8,
      config: {
        title: "Theme Actions",
        things_to_do_subtitle: "Tasks linked to current content themes.",
        things_to_do_compact_mode: true,
        things_to_do_max_items: 5,
        things_to_do_show_stats: true,
        appearance: { showTitle: true },
      },
    }),
  ]
}

function buildContentPlanningBlocks() {
  return [
    introBlock(
      "planning_intro",
      "Content Planning",
      "Plan, organise and review upcoming content across channels.",
      0
    ),
    makeBlock({
      provisioningKey: "planning_todo",
      type: "things_to_do",
      x: 0,
      y: 2,
      w: 4,
      h: 6,
      config: {
        title: "Things To Do",
        things_to_do_subtitle: "Content actions, approvals and missing assets.",
        things_to_do_compact_mode: false,
        things_to_do_max_items: 8,
        things_to_do_show_stats: true,
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "planning_timeline",
      type: "content_timeline",
      x: 4,
      y: 2,
      w: 8,
      h: 8,
      config: {
        title: "Content Timeline",
        content_timeline_subtitle: "Plan and track upcoming content.",
        content_timeline_default_view: "month",
        content_timeline_group_by: "theme",
        content_timeline_show_filters: true,
        content_timeline_enable_detail_panel: true,
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "planning_theme_context",
      type: "content_theme",
      x: 0,
      y: 8,
      w: 4,
      h: 6,
      config: {
        title: "Content Theme Context",
        content_theme_view_mode: "compact",
        content_theme_max_themes: 4,
        content_theme_card_density: "compact",
        content_theme_show_filters: false,
        content_theme_show_footer: false,
      },
    }),
    makeBlock({
      provisioningKey: "planning_social",
      type: "social_media_calendar",
      x: 0,
      y: 14,
      w: 12,
      h: 10,
      config: {
        title: "Social Media Calendar",
        social_media_calendar_subtitle:
          "Visual planning for social posts — platforms, media, and approval status at a glance.",
        social_media_calendar_default_view: "month",
        social_media_calendar_content_scope: "social_only",
        social_media_calendar_mode: "full",
        social_media_calendar_show_status_bar: true,
        social_media_calendar_show_filters: true,
        social_media_calendar_show_toolbar: true,
        social_media_calendar_show_media_preview: true,
        social_media_calendar_show_approval_status: true,
        social_media_calendar_show_platform_icons: true,
        appearance: { showTitle: true },
      },
    }),
  ]
}

function buildCampaignsBlocks() {
  return [
    introBlock(
      "campaigns_intro",
      "Campaigns",
      "Plan, manage and track all marketing campaigns.",
      0
    ),
    makeBlock({
      provisioningKey: "campaigns_overview_main",
      type: "campaigns_overview",
      x: 0,
      y: 2,
      w: 12,
      h: 14,
      config: {
        title: "Campaigns",
        subtitle: "Plan, manage and track all marketing campaigns.",
        campaigns_default_view: "list",
        campaigns_group_by: "status",
        campaigns_show_search: true,
        campaigns_show_filters: true,
        campaigns_show_kpis: true,
        campaigns_show_progress: true,
        campaigns_show_thumbnails: true,
        campaigns_density: "comfortable",
        campaigns_max_items: 200,
        campaigns_click_action: "open_record",
        appearance: { showTitle: true },
      },
    }),
  ]
}

function buildThingsToDoBlocks() {
  return [
    introBlock(
      "todo_intro",
      "Things To Do",
      "Track content actions, approvals, missing assets and upcoming deadlines.",
      0
    ),
    makeBlock({
      provisioningKey: "todo_main",
      type: "things_to_do",
      x: 0,
      y: 2,
      w: 12,
      h: 8,
      config: {
        title: "Things To Do",
        things_to_do_subtitle: "Content actions that need attention.",
        things_to_do_compact_mode: false,
        things_to_do_max_items: 12,
        things_to_do_show_stats: true,
        things_to_do_show_filters: true,
        things_to_do_enable_detail_panel: true,
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "todo_timeline",
      type: "content_timeline",
      x: 0,
      y: 10,
      w: 8,
      h: 8,
      config: {
        title: "Upcoming Deadlines",
        content_timeline_subtitle: "See task and content deadlines in context.",
        content_timeline_default_view: "month",
        content_timeline_group_by: "status",
        content_timeline_show_filters: true,
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "todo_social_preview",
      type: "social_media_calendar",
      x: 8,
      y: 10,
      w: 4,
      h: 8,
      config: {
        title: "Social Tasks Preview",
        social_media_calendar_content_scope: "social_only",
        social_media_calendar_mode: "compact",
        social_media_calendar_default_view: "list",
        social_media_calendar_max_posts: 5,
        social_media_calendar_show_status_bar: true,
        social_media_calendar_show_filters: false,
        social_media_calendar_show_toolbar: false,
        appearance: { showTitle: true },
      },
    }),
  ]
}

function buildResourceHubBlocks() {
  return [
    introBlock(
      "resources_intro",
      "Resource Hub",
      "Find logos, documents, media, templates and internal assets.",
      0
    ),
    makeBlock({
      provisioningKey: "resources_hub",
      type: "internal_resource_hub",
      x: 0,
      y: 2,
      w: 12,
      h: 8,
      config: {
        title: "Internal Resource Hub",
        resource_hub_subtitle:
          "Approved logos, guidelines, photography and templates — on brand, every time.",
        resource_hub_layout_mode: "gallery",
        resource_hub_use_dashboard_mock: false,
        resource_hub_show_search: true,
        resource_hub_show_recent: true,
        resource_hub_show_filters: true,
        resource_hub_show_upload: true,
      },
    }),
    makeBlock({
      provisioningKey: "resources_gallery_embed",
      type: "drive_gallery",
      x: 0,
      y: 10,
      w: 8,
      h: 6,
      config: {
        title: "Shared Image Gallery",
        subtitle: "Inline view of the shared Google Drive gallery for generic resource images.",
        drive_folder_id: "1-pHl-DXNlOPC4LuWneYmHB-fzHscofyS",
      },
    }),
    makeBlock({
      provisioningKey: "resources_actions",
      type: "things_to_do",
      x: 8,
      y: 10,
      w: 4,
      h: 6,
      config: {
        title: "Resource Actions",
        things_to_do_subtitle: "Assets or content items needing attention.",
        things_to_do_compact_mode: true,
        things_to_do_max_items: 5,
        things_to_do_show_stats: true,
        // TODO: filter missing media when config supports it
        appearance: { showTitle: true },
      },
    }),
  ]
}

function buildSocialCalendarBlocks() {
  return [
    introBlock(
      "social_intro",
      "Social Calendar",
      "Plan social posts, captions, platforms, creative and approvals.",
      0
    ),
    makeBlock({
      provisioningKey: "social_calendar",
      type: "social_media_calendar",
      x: 0,
      y: 2,
      w: 12,
      h: 10,
      config: {
        title: "Social Media Calendar",
        social_media_calendar_subtitle:
          "Visual planning for social posts — platforms, media, and approval status at a glance.",
        social_media_calendar_default_view: "month",
        social_media_calendar_content_scope: "social_only",
        social_media_calendar_mode: "full",
        social_media_calendar_show_status_bar: true,
        social_media_calendar_show_filters: true,
        social_media_calendar_show_toolbar: true,
        social_media_calendar_show_media_preview: true,
        social_media_calendar_show_approval_status: true,
        social_media_calendar_show_platform_icons: true,
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "social_actions",
      type: "things_to_do",
      x: 0,
      y: 12,
      w: 4,
      h: 6,
      config: {
        title: "Social Actions",
        things_to_do_subtitle: "Social posts needing approval, scheduling or media.",
        things_to_do_compact_mode: true,
        things_to_do_max_items: 6,
        things_to_do_show_stats: true,
        // TODO: filter social when config supports it
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "social_timeline",
      type: "content_timeline",
      x: 4,
      y: 12,
      w: 8,
      h: 6,
      config: {
        title: "Social Timeline",
        content_timeline_default_view: "month",
        content_timeline_group_by: "status",
        content_timeline_show_filters: true,
        appearance: { showTitle: true },
      },
    }),
  ]
}

function buildEventCalendarBlocks() {
  return [
    introBlock(
      "events_intro",
      "Event Calendar",
      "Plan events, boat shows, attendance and related marketing activity.",
      0
    ),
    makeBlock({
      provisioningKey: "events_calendar",
      type: "event_calendar",
      x: 0,
      y: 2,
      w: 12,
      h: 10,
      config: {
        title: "Event Calendar",
        event_calendar_subtitle:
          "Plan, manage and track marketing events, trade shows and activations.",
        event_calendar_default_view: "month",
        event_calendar_show_toolbar: true,
        event_calendar_show_metrics: true,
        event_calendar_show_filters: true,
        event_calendar_show_search: true,
        event_calendar_show_add_button: true,
        event_calendar_show_attendance_controls: true,
        event_calendar_show_schedule: true,
        event_calendar_show_resources: true,
        event_calendar_show_notes: true,
        event_calendar_show_legend: true,
        event_calendar_density: "comfortable",
        appearance: { showTitle: true },
      },
    }),
    makeBlock({
      provisioningKey: "events_resources",
      type: "internal_resource_hub",
      x: 0,
      y: 12,
      w: 6,
      h: 6,
      config: {
        title: "Event Resources",
        resource_hub_subtitle: "Assets, documents and resources linked to events.",
        resource_hub_layout_mode: "list",
        resource_hub_use_dashboard_mock: false,
        resource_hub_show_search: false,
        resource_hub_show_recent: false,
      },
    }),
    makeBlock({
      provisioningKey: "events_actions",
      type: "things_to_do",
      x: 6,
      y: 12,
      w: 6,
      h: 6,
      config: {
        title: "Event Actions",
        things_to_do_subtitle: "Content and resources needed for upcoming events.",
        things_to_do_compact_mode: true,
        things_to_do_max_items: 5,
        things_to_do_show_stats: true,
        appearance: { showTitle: true },
      },
    }),
  ]
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

/** When multiple active pages share a hub name, archive extras (keep most keyed blocks, then oldest). */
async function archiveDuplicateHubPages(names) {
  for (const name of names) {
    const { data: pages, error } = await supabase
      .from("interface_pages")
      .select("id, name, created_at")
      .eq("name", name)
      .eq("is_archived", false)
    if (error) throw new Error(`Duplicate page lookup failed for ${name}: ${error.message}`)
    if (!pages || pages.length <= 1) continue

    const withCounts = await Promise.all(
      pages.map(async (page) => {
        const { count, error: countError } = await supabase
          .from("view_blocks")
          .select("id", { count: "exact", head: true })
          .eq("page_id", page.id)
          .eq("is_archived", false)
          .not("config->>provisioning_key", "is", null)
        if (countError) throw new Error(`Block count failed for ${page.id}: ${countError.message}`)
        return { ...page, keyed: count || 0 }
      })
    )
    withCounts.sort((a, b) => b.keyed - a.keyed || new Date(a.created_at) - new Date(b.created_at))
    const [, ...duplicates] = withCounts
    for (const dup of duplicates) {
      const { data: row } = await supabase.from("interface_pages").select("config").eq("id", dup.id).single()
      const config = { ...(row?.config || {}) }
      delete config.is_home
      await supabase
        .from("interface_pages")
        .update({
          is_archived: true,
          is_hidden: true,
          is_admin_only: true,
          config,
        })
        .eq("id", dup.id)
      console.log(`Archived duplicate page: ${name} (${dup.id})`)
    }
  }
}

async function archiveDeprecatedPages() {
  const deprecatedNames = [
    "Campaign Archive",
    "Campaign Workspace",
    "Campaign Dashboard",
    "Marketing Dashboard (Theme-led)",
    "Marketing Dashboard",
  ]
  const { data: pages, error } = await supabase
    .from("interface_pages")
    .select("id, name")
    .in("name", deprecatedNames)
    .eq("is_archived", false)
  if (error) throw new Error(`Failed loading deprecated pages: ${error.message}`)
  for (const page of pages || []) {
    await supabase
      .from("interface_pages")
      .update({ is_archived: true, is_hidden: true, is_admin_only: true })
      .eq("id", page.id)
  }
  if ((pages || []).length > 0) {
    console.log(`Archived deprecated pages: ${(pages || []).map((p) => p.name).join(", ")}`)
  }
}

async function applyMarketingNavPriority(pageIds) {
  const ordered = [
    { id: pageIds.membersWelcome, name: "Members Welcome" },
    { id: pageIds.home, name: "Marketing Home" },
    { id: pageIds.theme, name: "Theme Workspace" },
    { id: pageIds.campaigns, name: "Campaigns" },
    { id: pageIds.content, name: "Content Planning" },
    { id: pageIds.thingsToDo, name: "Things To Do" },
    { id: pageIds.resourceHub, name: "Resource Hub" },
    { id: pageIds.social, name: "Social Calendar" },
    { id: pageIds.eventCalendar, name: "Event Calendar" },
  ].filter((entry) => entry.id)
  for (let i = 0; i < ordered.length; i += 1) {
    const { id, name } = ordered[i]
    await supabase
      .from("interface_pages")
      .update({ order_index: i, is_admin_only: pageIsAdminOnly(name) })
      .eq("id", id)
  }
}

/** Set workspace default landing page to Marketing Home (login + `/` redirect). */
async function setWorkspaceDefaultPage(pageId) {
  if (!pageId) return
  const { data: rows, error: loadError } = await supabase
    .from("workspace_settings")
    .select("id, default_interface_id")
    .order("created_at", { ascending: false })
  if (loadError) {
    console.warn(`Could not load workspace_settings: ${loadError.message}`)
    return
  }
  if (!rows?.length) {
    const { error: insertError } = await supabase
      .from("workspace_settings")
      .insert({ default_interface_id: pageId })
    if (insertError) {
      console.warn(`Could not create workspace_settings: ${insertError.message}`)
    } else {
      console.log("Set workspace default page (new settings row)")
    }
    return
  }
  const target = rows[0]
  if (target.default_interface_id === pageId) return
  const { error: updateError } = await supabase
    .from("workspace_settings")
    .update({ default_interface_id: pageId })
    .eq("id", target.id)
  if (updateError) {
    console.warn(`Could not update workspace default page: ${updateError.message}`)
  } else {
    console.log(`Set workspace default page to Marketing Home (${pageId})`)
  }
}

async function main() {
  const ctx = await fetchRequiredMetadata()

  const publicGroup = (await getGroupIdByName("Public")) || (await getGroupIdByName("Other"))
  if (!publicGroup) {
    throw new Error("Could not resolve required interface groups")
  }

  await archiveDuplicateHubPages(["Marketing Home"])

  const homePageId = await upsertPage({
    name: "Marketing Home",
    aliases: ["Dashboard", "Marketing Dashboard"],
    page_type: "content",
    group_id: publicGroup,
    order_index: 0,
    saved_view_id: ctx.anchors.home,
    config: { is_home: true },
  })
  const themePageId = await upsertPage({
    name: "Theme Workspace",
    page_type: "content",
    group_id: publicGroup,
    order_index: 1,
    saved_view_id: ctx.anchors.theme,
    config: {},
  })
  const contentPageId = await upsertPage({
    name: "Content Planning",
    page_type: "content",
    group_id: publicGroup,
    order_index: 3,
    saved_view_id: ctx.anchors.content,
    config: {},
  })
  const campaignsPageId = await upsertPage({
    name: "Campaigns",
    page_type: "content",
    group_id: publicGroup,
    order_index: 2,
    saved_view_id: ctx.anchors.campaigns,
    config: {},
  })
  const thingsToDoPageId = await upsertPage({
    name: "Things To Do",
    page_type: "content",
    group_id: publicGroup,
    order_index: 4,
    saved_view_id: ctx.anchors.content,
    config: {},
  })
  const resourceHubPageId = await upsertPage({
    name: "Resource Hub",
    aliases: ["Internal Staff Hub", "Internal Marketing Hub"],
    page_type: "content",
    group_id: publicGroup,
    order_index: 5,
    saved_view_id: ctx.anchors.resources,
    config: {},
  })
  const socialCalendarPageId = await upsertPage({
    name: "Social Calendar",
    aliases: ["Social Media Calendar", "Social Media"],
    page_type: "content",
    group_id: publicGroup,
    order_index: 6,
    saved_view_id: ctx.anchors.content,
    config: {},
  })
  const eventCalendarPageId = await upsertPage({
    name: "Event Calendar",
    aliases: ["Events Calendar", "Marketing Events"],
    page_type: "content",
    group_id: publicGroup,
    order_index: 7,
    saved_view_id: ctx.anchors.content,
    config: {},
  })
  const membersWelcomePageId = await upsertPage({
    name: "Members Welcome",
    page_type: "content",
    group_id: publicGroup,
    order_index: 0,
    saved_view_id: ctx.anchors.content,
    config: {},
  })

  const contactsPageId = await findFirstPageIdByNames(["Contacts"])
  const helpPageId = await findFirstPageIdByNames(["Help & Guidance", "Help and Guidance", "Help"])

  await syncPageBlocks(membersWelcomePageId, buildMembersWelcomeBlocks())
  await syncPageBlocks(homePageId, buildMarketingHomeBlocks())
  await syncPageBlocks(themePageId, buildThemeWorkspaceBlocks())
  await syncPageBlocks(campaignsPageId, buildCampaignsBlocks())
  await syncPageBlocks(contentPageId, buildContentPlanningBlocks())
  await syncPageBlocks(thingsToDoPageId, buildThingsToDoBlocks())
  await syncPageBlocks(resourceHubPageId, buildResourceHubBlocks())
  await syncPageBlocks(socialCalendarPageId, buildSocialCalendarBlocks())
  await syncPageBlocks(eventCalendarPageId, buildEventCalendarBlocks())

  await archiveDeprecatedPages()
  await applyMarketingNavPriority({
    membersWelcome: membersWelcomePageId,
    home: homePageId,
    theme: themePageId,
    campaigns: campaignsPageId,
    content: contentPageId,
    thingsToDo: thingsToDoPageId,
    resourceHub: resourceHubPageId,
    social: socialCalendarPageId,
    eventCalendar: eventCalendarPageId,
  })
  await applyVisibilityCuration()
  await setWorkspaceDefaultPage(homePageId)

  console.log("Marketing Hub workspace applied successfully.")
  console.log(`Members Welcome: /pages/${membersWelcomePageId}`)
  console.log(`Marketing Home: /pages/${homePageId}`)
  console.log(`Theme Workspace: /pages/${themePageId}`)
  console.log(`Campaigns: /pages/${campaignsPageId}`)
  console.log(`Content Planning: /pages/${contentPageId}`)
  console.log(`Things To Do: /pages/${thingsToDoPageId}`)
  console.log(`Resource Hub: /pages/${resourceHubPageId}`)
  console.log(`Social Calendar: /pages/${socialCalendarPageId}`)
  console.log(`Event Calendar: /pages/${eventCalendarPageId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
