/** Ephemeral page-level record context (content pages). Never persisted. */
export type RecordContext = { tableId: string; recordId: string } | null

export type BlockType =
  | 'grid'
  | 'form'
  | 'record'
  | 'chart'
  | 'kpi'
  | 'kpi_summary'
  | 'text'
  | 'html'
  | 'image'
  | 'gallery'
  | 'divider'
  | 'button'
  | 'action'
  | 'link_preview'
  | 'filter'
  | 'field'
  | 'field_section'
  | 'calendar'
  | 'multi_calendar'
  | 'kanban'
  | 'timeline'
  | 'multi_timeline'
  | 'list'
  | 'number'
  | 'horizontal_grouped'
  | 'record_context'
  | 'content_theme'
  | 'content_timeline'
  | 'internal_resource_hub'
  | 'upcoming_summary'
  | 'things_to_do'
  | 'event_calendar'
  | 'social_media_calendar'
  | 'campaigns_overview'

export type UpcomingSummarySectionId =
  | 'deadlines'
  | 'campaigns'
  | 'events'
  | 'approval'
  | 'blockers'
  | 'published'

export type UpcomingSummaryLayout = 'stacked' | 'two_column' | 'compact'

export type UpcomingSummaryDateRange = 'this_week' | 'next_30_days' | 'this_quarter'

export type BlockSizing = 'content' | 'fill'

export type ChartType = 'bar' | 'line' | 'pie' | 'area' | 'stacked_bar'
export type AggregateType = 'count' | 'sum' | 'avg' | 'min' | 'max'

/** Canonical block model for the interface. See docs/architecture/BLOCK_SYSTEM_CANONICAL.md */
export interface PageBlock {
  id: string
  page_id: string
  type: BlockType
  /**
   * Sizing model for block content within its layout cell.
   * - 'content' (default): block height is driven by its content; no flex grow.
   * - 'fill': block may consume all available height within its layout container.
   *
   * IMPORTANT:
   * - All blocks default to 'content'.
   * - Only layout containers (e.g. canvases, section/column containers) may opt into 'fill'.
   * - Rich text / editor-style blocks (e.g. TextBlock) MUST always behave as 'content'.
   */
  sizing?: BlockSizing
  x: number
  y: number
  w: number
  h: number
  config: BlockConfig
  order_index: number
  created_at: string
  updated_at?: string
}

export type ViewType = 'grid' | 'kanban' | 'calendar' | 'gallery' | 'timeline' | 'form' | 'horizontal_grouped' | 'list'

/** Block types that use the two-tab Data/Appearance model (Airtable parity). No Advanced tab. */
export const DATA_VIEW_BLOCK_TYPES: BlockType[] = [
  'list',
  'grid',
  'gallery',
  'kanban',
  'calendar',
  'timeline',
]

/**
 * Canonical config for blocks. See docs/architecture/BLOCK_SYSTEM_CANONICAL.md
 *
 * Airtable parity (data-view blocks: list, grid, gallery, kanban, calendar, timeline):
 * - visible_fields is the single source of truth for which fields appear in list rows, grid columns,
 *   gallery cards, calendar previews, kanban cards. If empty, blocks fall back to title field only.
 * - modal_layout (order, groups, visibility) is scoped to the same set; no separate modal field list.
 * - Data tab: Source, Permissions, Filter, Sort, Group, Fields. Appearance tab: view-type-specific only.
 */
export interface BlockConfig {
  /** When true, this block is the single full-page block (content page only). Stored in config; no DB column. */
  is_full_page?: boolean
  title?: string
  subtitle?: string
  table_id?: string
  view_id?: string
  view_type?: ViewType // View type for grid blocks (grid, kanban, calendar, gallery, timeline)
  record_id?: string
  /** Alias for visible_fields; prefer visible_fields for data-view blocks. */
  fields?: string[]
  /** Canonical visible field names (single source of truth for data-view blocks). */
  visible_fields?: string[]
  /** Kanban-only: field names to show on cards. When set, overrides visible_fields for Kanban view. */
  kanban_card_fields?: string[]
  filters?: BlockFilter[]
  sorts?: BlockSort[]
  /**
   * Narrow this block to rows linked to the record_context selection.
   * See `buildRecordContextFilters` in `lib/interface/record-context-filters.ts`.
   */
  record_context_link?: {
    field: string
    parent_table_id?: string
    operator?: "equal" | "is_any_of" | "contains"
  }
  group_by?: string
  chart_type?: ChartType
  chart_x_axis?: string
  chart_y_axis?: string
  chart_aggregate?: AggregateType
  kpi_field?: string
  kpi_aggregate?: AggregateType
  kpi_label?: string
  text_content?: string
  image_url?: string
  image_alt?: string
  button_label?: string
  button_automation_id?: string
  visibility_rules?: VisibilityRule[]
  // Table snapshot
  row_limit?: number
  /** Unified display model for data blocks. */
  display_mode?: 'fit' | 'fixed'
  /** Unified record limit for data blocks (defaults to 20 when missing). */
  record_limit?: number
  /** Behaviour when records exceed record_limit. */
  overflow_behaviour?: 'view_all' | 'scroll' | 'paginate'
  /** Shared card rendering settings for card-based blocks. */
  card_image_display?: 'show_if_available' | 'placeholder' | 'hide_when_empty'
  card_show_labels?: boolean
  card_show_empty_fields?: boolean
  card_text_behaviour?: 'wrap' | 'truncate_1' | 'truncate_2' | 'truncate_3'
  card_height_mode?: 'fit' | 'fixed'
  card_fixed_height_px?: number
  highlight_rules?: HighlightRule[]
  // Action block
  action_type?: 'navigate' | 'create_record' | 'redirect'
  label?: string
  url?: string
  route?: string
  confirmation_message?: string
  icon?: string
  // Link preview
  link_url?: string
  link_title?: string
  link_description?: string
  // Text block
  content?: string
  markdown?: boolean
  // HTML block (custom bits)
  html?: string
  // KPI comparison
  comparison?: {
    date_field: string
    current_start: string
    current_end: string
    previous_start: string
    previous_end: string
  }
  target_value?: number | string
  click_through?: {
    view_id?: string
  }
  // Chart
  group_by_field?: string
  metric_field?: string
  source_type?: 'table' | 'sql_view'
  source_view?: string
  // Form
  form_fields?: Array<{
    field_id: string
    field_name: string
    required: boolean
    visible: boolean
    order: number
  }>
  submit_action?: 'create' | 'update' | 'custom'
  detail_fields?: string[]
  allow_editing?: boolean
  // Filter block
  target_blocks?: 'all' | string[]
  // Field block
  field_id?: string
  /** Field section block: section key matching table field groups / field_sections.name */
  group_name?: string
  /** Optional subset of field names to show within the section */
  field_names?: string[]
  /** Field section: default collapsed state */
  collapsed?: boolean
  /** Field section: show labels on fields */
  show_labels?: boolean
  allowed_fields?: string[]
  allowed_operators?: string[]
  allow_inline_edit?: boolean // Enable inline editing for field block
  inline_edit_permission?: 'admin' | 'member' | 'both' // Who can edit inline (default: 'both')
  // Block-level permissions
  permissions?: {
    mode?: 'view' | 'edit' // Access mode: view-only or editable
    allowInlineCreate?: boolean // Allow users to add records inline
    allowInlineDelete?: boolean // Allow users to delete records inline
    allowOpenRecord?: boolean // Allow users to open record details
  }
  // Record action permissions (create/delete)
  record_actions?: {
    create?: 'admin' | 'both' // Who can create records: 'admin' (admin only) or 'both' (admins + members)
    delete?: 'admin' | 'both' // Who can delete records: 'admin' (admin only) or 'both' (admins + members)
  }
  // Appearance settings
  appearance?: {
    // Airtable-style appearance (new)
    background?: 'none' | 'subtle' | 'tinted' | 'emphasised'
    border?: 'none' | 'outline' | 'card'
    radius?: 'square' | 'rounded'
    shadow?: 'none' | 'subtle' | 'card'
    padding?: 'compact' | 'normal' | 'spacious' | number // New style or legacy numeric
    margin?: 'none' | 'small' | 'normal' | 'large'
    accent?: 'none' | 'grey' | 'blue' | 'green' | 'yellow' | 'red' | 'purple'
    showTitle?: boolean
    titleSize?: 'small' | 'medium' | 'large'
    titleAlign?: 'left' | 'center'
    showDivider?: boolean
    // Legacy appearance (for backward compatibility)
    title?: string
    title_color?: string
    text_color?: string // General text color
    background_color?: string
    border_color?: string
    border_width?: number
    border_radius?: number
    show_title?: boolean
    header_background?: string
    header_text_color?: string
    // Action block specific
    button_background?: string
    button_text_color?: string
    button_style?: string
    // Chart block specific
    show_legend?: boolean
    legend_position?: string
    color_scheme?: string
    show_grid?: boolean
    // KPI block specific
    number_format?: string
    show_trend?: boolean
    alignment?: string
    value_size?: string
    // Table snapshot specific
    row_height?: string
    show_headers?: boolean
    // Grid block specific
    show_toolbar?: boolean
    show_search?: boolean
    show_filter?: boolean
    show_sort?: boolean
    wrap_text?: boolean // Whether to wrap cell text (block-level setting)
    // Data-view blocks (grid/calendar/kanban/timeline/gallery/list)
    show_add_record?: boolean // Show an "Add record" button inside the block
    // Record opening settings
    enable_record_open?: boolean // Enable/disable record opening (default: true)
    record_open_style?: 'side_panel' | 'modal' // How to open records (default: 'side_panel' for desktop)
    // Data-view blocks: field for row/card/event color (grid, kanban, calendar, timeline, etc.)
    color_field?: string // Field name/ID for row/card/event color
    // Image field for table/kanban/timeline/gallery blocks
    image_field?: string // Field name/ID to use for row/card images
    fit_image_size?: boolean // Whether to fit image to container size
    // Text block specific
    text_size?: string
    text_align?: string
    font_weight?: 'normal' | 'medium' | 'semibold' | 'bold'
    // Link preview specific
    display_mode?: string
    show_provider?: boolean
    show_thumbnail?: boolean
    // Tabs specific
    tab_style?: 'default' | 'pills' | 'underline'
    tab_position?: 'top' | 'left' | 'right'
    tab_background?: string
    active_tab_color?: string
    content_padding?: number
    // Form specific
    form_layout?: 'single' | 'two'
    label_position?: 'top' | 'left' | 'inline'
    field_spacing?: number
    button_alignment?: 'left' | 'center' | 'right' | 'full'
    enable_modal_display?: boolean // Enable modal display for form/record blocks
    modal_style?: 'side_panel' | 'modal' // Modal display style (default: 'side_panel')
    // Image specific
    image_size?: 'auto' | 'contain' | 'cover' | 'small' | 'medium' | 'large'
    image_align?: 'left' | 'center' | 'right'
    aspect_ratio?: 'auto' | '1:1' | '16:9' | '4:3' | '3:2'
    max_width?: number
    // Divider specific
    divider_thickness?: number
    divider_color?: string
    divider_style?: 'solid' | 'dashed' | 'dotted'
    divider_height?: number
    divider_spacing_top?: number
    divider_spacing_bottom?: number
    // Timeline/Calendar view specific
    timeline_wrap_title?: boolean
    card_wrap_title?: boolean
    // List view specific
    list_title_field?: string // Required: field name for list item title
    list_subtitle_fields?: string[] // Optional: up to 3 subtitle fields
    list_image_field?: string // Optional: field name for image/attachment
    list_pill_fields?: string[] // Optional: select/multi-select fields to show as pills
    list_meta_fields?: string[] // Optional: date, number, etc. for metadata
    // Gallery view specific
    gallery_title_field?: string // Field name for card title in gallery view
    gallery_rows_per_page?: number // Rows per page in gallery view
    // Attachment/Image field display settings (for field blocks)
    attachment_display_style?: 'thumbnails' | 'list' | 'hero' | 'cover' | 'gallery' // Display style for attachments
    attachment_size?: 'small' | 'medium' | 'large' // Preview size for attachments (for thumbnails/list)
    attachment_max_visible?: number // Max number of previews to show before "+X more"
    // Linked field display settings (for field blocks)
    linked_field_display_mode?: 'compact' | 'inline' | 'expanded' | 'list' // Display mode for linked record fields
  }
  // Timeline view specific (compact card contract)
  timeline_title_field?: string // Field for card title
  timeline_tag_field?: string // Optional single tag field (max 1 pill)
  timeline_compact_mode?: boolean // When true: 28px cards; when false: 40px
  // Content Theme block
  content_theme_subtitle?: string
  content_theme_year?: number
  content_theme_quarter?: string
  content_theme_show_filters?: boolean
  content_theme_show_view_toggle?: boolean
  content_theme_show_footer?: boolean
  content_theme_card_density?: 'comfortable' | 'compact'
  content_theme_highlight_current_quarter?: boolean
  content_theme_max_themes?: number
  content_theme_view_mode?: 'grid' | 'list' | 'compact'
  content_theme_use_mock?: boolean
  content_theme_name_field_id?: string
  content_theme_quarter_field_id?: string
  content_theme_year_field_id?: string
  content_theme_colour_field_id?: string
  content_theme_divisions_field_id?: string
  // Content Timeline block
  content_timeline_use_mock?: boolean
  content_timeline_max_items?: number
  content_timeline_show_search?: boolean
  content_timeline_title_field_id?: string
  content_timeline_title_field?: string
  content_timeline_theme_field_id?: string
  content_timeline_theme_field?: string
  content_timeline_campaign_field_id?: string
  content_timeline_campaign_field?: string
  content_timeline_type_field_id?: string
  content_timeline_type_field?: string
  content_timeline_channel_field_id?: string
  content_timeline_channel_field?: string
  content_timeline_status_field_id?: string
  content_timeline_status_field?: string
  content_timeline_owner_field_id?: string
  content_timeline_owner_field?: string
  content_timeline_start_date_field_id?: string
  content_timeline_start_date_field?: string
  content_timeline_end_date_field_id?: string
  content_timeline_end_date_field?: string
  content_timeline_images_field_id?: string
  content_timeline_images_field?: string
  content_timeline_notes_field_id?: string
  content_timeline_notes_field?: string
  content_timeline_date_to_field_id?: string
  content_timeline_date_to_field?: string
  content_timeline_division_field_id?: string
  content_timeline_division_field?: string
  content_timeline_subtitle?: string
  content_timeline_default_view?: 'month' | 'quarter' | 'year'
  content_timeline_group_by?: 'theme' | 'channel' | 'status' | 'owner' | 'campaign'
  content_timeline_default_theme_filter?: string
  content_timeline_show_filters?: boolean
  content_timeline_show_status_badges?: boolean
  content_timeline_show_owner_initials?: boolean
  content_timeline_enable_detail_panel?: boolean
  /** When true (default), auto-discovery loads Social Posts table alongside Content. */
  content_timeline_include_social_posts?: boolean
  content_timeline_compact_mode?: boolean
  content_timeline_preset?: 'marketing_home' | 'default'
  content_timeline_show_footer_link?: boolean
  content_timeline_footer_link_label?: string
  // KPI Summary block
  kpi_summary_use_mock?: boolean
  kpi_summary_cards?: import('@/lib/interface/kpi-summary-defaults').KpiSummaryCardConfig[]
  // Internal Resource Hub block
  resource_hub_subtitle?: string
  resource_hub_default_category?: string
  resource_hub_show_search?: boolean
  resource_hub_show_filters?: boolean
  resource_hub_show_recent?: boolean
  resource_hub_show_upload?: boolean
  resource_hub_layout_mode?: 'gallery' | 'preview' | 'list'
  resource_hub_use_dashboard_mock?: boolean
  resource_hub_use_mock?: boolean
  resource_hub_max_items?: number
  resource_hub_show_detail_panel?: boolean
  resource_hub_title_field_id?: string
  resource_hub_title_field?: string
  resource_hub_category_field_id?: string
  resource_hub_category_field?: string
  resource_hub_file_type_field_id?: string
  resource_hub_file_type_field?: string
  resource_hub_file_url_field_id?: string
  resource_hub_file_url_field?: string
  resource_hub_attachments_field_id?: string
  resource_hub_attachments_field?: string
  resource_hub_thumbnail_url_field_id?: string
  resource_hub_thumbnail_url_field?: string
  resource_hub_description_field_id?: string
  resource_hub_description_field?: string
  resource_hub_tags_field_id?: string
  resource_hub_tags_field?: string
  resource_hub_usage_field_id?: string
  resource_hub_usage_field?: string
  resource_hub_uploaded_by_field_id?: string
  resource_hub_uploaded_by_field?: string
  resource_hub_updated_at_field_id?: string
  resource_hub_updated_at_field?: string
  resource_hub_internal_notice?: string
  // Upcoming Summary block
  upcoming_summary_content_table_id?: string
  upcoming_summary_campaigns_table_id?: string
  upcoming_summary_empty_deadlines_title?: string
  upcoming_summary_empty_campaigns_title?: string
  upcoming_summary_empty_events_title?: string
  upcoming_summary_subtitle?: string
  upcoming_summary_sections?: UpcomingSummarySectionId[]
  upcoming_summary_max_items?: number
  upcoming_summary_layout?: UpcomingSummaryLayout
  upcoming_summary_date_range?: UpcomingSummaryDateRange
  upcoming_summary_show_counts?: boolean
  upcoming_summary_show_dates?: boolean
  upcoming_summary_show_owners?: boolean
  upcoming_summary_show_view_all?: boolean
  upcoming_summary_group_campaigns_by_status?: boolean
  /** When true, show sample data instead of live Content / Campaigns / Events. */
  upcoming_summary_use_mock?: boolean
  upcoming_summary_title_field_id?: string
  upcoming_summary_title_field?: string
  upcoming_summary_type_field_id?: string
  upcoming_summary_type_field?: string
  upcoming_summary_status_field_id?: string
  upcoming_summary_status_field?: string
  upcoming_summary_theme_field_id?: string
  upcoming_summary_theme_field?: string
  upcoming_summary_campaign_field_id?: string
  upcoming_summary_campaign_field?: string
  upcoming_summary_owner_field_id?: string
  upcoming_summary_owner_field?: string
  upcoming_summary_date_field_id?: string
  upcoming_summary_date_field?: string
  upcoming_summary_due_date_field_id?: string
  upcoming_summary_due_date_field?: string
  upcoming_summary_priority_field_id?: string
  upcoming_summary_priority_field?: string
  upcoming_summary_campaign_name_field_id?: string
  upcoming_summary_campaign_name_field?: string
  upcoming_summary_campaign_status_field_id?: string
  upcoming_summary_campaign_status_field?: string
  // Things To Do block
  things_to_do_subtitle?: string
  things_to_do_default_view?: 'list' | 'board' | 'by-priority' | 'by-campaign' | 'calendar'
  things_to_do_default_grouping?: 'due-date' | 'status' | 'campaign' | 'priority'
  things_to_do_show_filters?: boolean
  things_to_do_show_quick_links?: boolean
  things_to_do_show_stats?: boolean
  things_to_do_enable_detail_panel?: boolean
  things_to_do_max_items?: number
  things_to_do_date_range?: 'all' | 'this_week' | 'next_30_days' | 'this_quarter'
  things_to_do_compact_mode?: boolean
  things_to_do_use_mock?: boolean
  things_to_do_show_search?: boolean
  things_to_do_title_field_id?: string
  things_to_do_type_field_id?: string
  things_to_do_status_field_id?: string
  things_to_do_priority_field_id?: string
  things_to_do_owner_field_id?: string
  things_to_do_reviewer_field_id?: string
  things_to_do_due_date_field_id?: string
  things_to_do_campaign_field_id?: string
  things_to_do_theme_field_id?: string
  things_to_do_description_field_id?: string
  things_to_do_channels_field_id?: string
  // Event Calendar block
  event_calendar_use_mock?: boolean
  event_calendar_max_items?: number
  event_calendar_detail_mode?: 'drawer' | 'modal' | 'inline' | 'record' | 'panel'
  event_calendar_click_action?: 'open_detail' | 'open_record' | 'none'
  event_calendar_allow_attendance_updates?: boolean
  event_calendar_allow_member_submissions?: boolean
  event_calendar_allow_calendar_export?: boolean
  event_calendar_external_mode?: boolean
  event_calendar_mobile_default_view?: 'month' | 'week' | 'list' | 'timeline'
  event_calendar_title_field_id?: string
  event_calendar_title_field?: string
  event_calendar_event_type_field_id?: string
  event_calendar_event_type_field?: string
  event_calendar_location_field_id?: string
  event_calendar_location_field?: string
  event_calendar_country_field_id?: string
  event_calendar_country_field?: string
  event_calendar_venue_field_id?: string
  event_calendar_venue_field?: string
  event_calendar_start_date_field_id?: string
  event_calendar_start_date_field?: string
  event_calendar_end_date_field_id?: string
  event_calendar_end_date_field?: string
  event_calendar_status_field_id?: string
  event_calendar_status_field?: string
  event_calendar_visibility_field_id?: string
  event_calendar_visibility_field?: string
  event_calendar_attending_field_id?: string
  event_calendar_url_field_id?: string
  event_calendar_url_field?: string
  event_calendar_description_field_id?: string
  event_calendar_description_field?: string
  event_calendar_attending_field?: string
  event_calendar_campaign_field_id?: string
  event_calendar_campaign_field?: string
  event_calendar_resources_field_id?: string
  event_calendar_resources_field?: string
  event_calendar_content_type_field_id?: string
  event_calendar_content_type_field?: string
  event_calendar_location_link_field_id?: string
  event_calendar_location_link_field?: string
  event_calendar_city_field_id?: string
  event_calendar_city_field?: string
  event_calendar_all_day_field_id?: string
  event_calendar_all_day_field?: string
  event_calendar_start_time_field_id?: string
  event_calendar_start_time_field?: string
  event_calendar_end_time_field_id?: string
  event_calendar_end_time_field?: string
  event_calendar_timezone_field_id?: string
  event_calendar_timezone_field?: string
  event_calendar_hero_image_field_id?: string
  event_calendar_hero_image_field?: string
  event_calendar_theme_field_id?: string
  event_calendar_theme_field?: string
  event_calendar_owner_field_id?: string
  event_calendar_owner_field?: string
  event_calendar_budget_field_id?: string
  event_calendar_budget_field?: string
  event_calendar_notes_field_id?: string
  event_calendar_notes_field?: string
  event_calendar_schedule_field_id?: string
  event_calendar_schedule_field?: string
  event_calendar_deleted_at_field_id?: string
  event_calendar_deleted_at_field?: string
  event_calendar_submitted_status_value?: string
  event_calendar_approved_status_value?: string
  event_calendar_rejected_status_value?: string
  event_calendar_member_default_visibility?: string
  event_calendar_content_type_default?: string
  event_calendar_show_sync_banner?: boolean
  event_calendar_feed_scope?: 'all' | 'attending'
  event_calendar_subtitle?: string
  event_calendar_default_view?: 'month' | 'week' | 'list' | 'timeline'
  event_calendar_show_toolbar?: boolean
  event_calendar_show_metrics?: boolean
  event_calendar_show_stats?: boolean
  event_calendar_show_actions?: boolean
  event_calendar_show_filters?: boolean
  event_calendar_show_search?: boolean
  event_calendar_show_add_button?: boolean
  event_calendar_show_attendance_controls?: boolean
  event_calendar_show_schedule?: boolean
  event_calendar_show_resources?: boolean
  event_calendar_show_notes?: boolean
  event_calendar_show_legend?: boolean
  event_calendar_show_page_header?: boolean
  event_calendar_density?: 'comfortable' | 'compact'
  // Social Media Calendar block
  social_media_calendar_subtitle?: string
  social_media_calendar_default_view?: 'month' | 'week' | 'list' | 'feed'
  social_media_calendar_content_scope?: 'social_only' | 'all_content'
  social_media_calendar_mode?: 'full' | 'compact'
  social_media_calendar_show_status_bar?: boolean
  social_media_calendar_show_filters?: boolean
  social_media_calendar_show_toolbar?: boolean
  social_media_calendar_show_media_preview?: boolean
  social_media_calendar_show_approval_status?: boolean
  social_media_calendar_show_platform_icons?: boolean
  social_media_calendar_max_posts?: number
  social_media_calendar_show_page_header?: boolean
  social_media_calendar_use_mock?: boolean
  social_media_calendar_show_search?: boolean
  social_media_calendar_preview_mode?: 'inline' | 'drawer' | 'modal'
  social_media_calendar_title_field_id?: string
  social_media_calendar_title_field?: string
  social_media_calendar_caption_field_id?: string
  social_media_calendar_caption_field?: string
  social_media_calendar_platform_field_id?: string
  social_media_calendar_platform_field?: string
  social_media_calendar_channels_field_id?: string
  social_media_calendar_channels_field?: string
  social_media_calendar_images_field_id?: string
  social_media_calendar_images_field?: string
  social_media_calendar_status_field_id?: string
  social_media_calendar_status_field?: string
  social_media_calendar_type_field_id?: string
  social_media_calendar_type_field?: string
  social_media_calendar_content_type_default?: string
  social_media_calendar_owner_field_id?: string
  social_media_calendar_owner_field?: string
  social_media_calendar_publish_date_field_id?: string
  social_media_calendar_publish_date_field?: string
  social_media_calendar_campaign_field_id?: string
  social_media_calendar_campaign_field?: string
  social_media_calendar_theme_field_id?: string
  social_media_calendar_theme_field?: string
  social_media_calendar_image_field_id?: string
  social_media_calendar_image_field?: string
  social_media_calendar_post_url_field_id?: string
  social_media_calendar_post_url_field?: string
  // Campaigns Overview block
  campaigns_use_mock?: boolean
  campaigns_max_items?: number
  campaigns_default_view?: "list" | "kanban" | "calendar" | "timeline"
  campaigns_show_filters?: boolean
  campaigns_show_search?: boolean
  campaigns_show_kpis?: boolean
  campaigns_show_progress?: boolean
  campaigns_show_thumbnails?: boolean
  campaigns_density?: "comfortable" | "compact"
  /** @deprecated Use subtitle */
  campaigns_subtitle?: string
  campaigns_title_field_id?: string
  campaigns_title_field?: string
  campaigns_type_field_id?: string
  campaigns_type_field?: string
  campaigns_division_field_id?: string
  campaigns_division_field?: string
  campaigns_status_field_id?: string
  campaigns_status_field?: string
  campaigns_priority_field_id?: string
  campaigns_priority_field?: string
  campaigns_stage_field_id?: string
  campaigns_stage_field?: string
  campaigns_start_date_field_id?: string
  campaigns_start_date_field?: string
  campaigns_end_date_field_id?: string
  campaigns_end_date_field?: string
  campaigns_owner_field_id?: string
  campaigns_owner_field?: string
  campaigns_progress_field_id?: string
  campaigns_progress_field?: string
  campaigns_image_field_id?: string
  campaigns_image_field?: string
  campaigns_linked_content_field_id?: string
  campaigns_linked_content_field?: string
  campaigns_linked_tasks_field_id?: string
  campaigns_linked_tasks_field?: string
  campaigns_linked_events_field_id?: string
  campaigns_linked_events_field?: string
  campaigns_click_action?: "open_record" | "none"
  campaigns_open_record_mode?: "modal" | "side_panel"
  // List block specific config (at root level for backward compatibility)
  list_title_field?: string
  list_subtitle_fields?: string[]
  list_image_field?: string
  list_pill_fields?: string[]
  list_meta_fields?: string[]
  // List view grouping behavior (choice fields)
  list_choice_groups_default_collapsed?: boolean
  /** @deprecated Use field_layout instead. Modal layout configuration. */
  modal_layout?: {
    blocks: Array<{
      id: string
      type: 'field' | 'text' | 'divider' | 'image'
      fieldName?: string // For field blocks
      x: number
      y: number
      w: number
      h: number
      config?: Record<string, any>
    }>
    layoutSettings?: {
      cols?: number
      rowHeight?: number
      margin?: [number, number]
    }
  }
  [key: string]: any
}

export interface BlockFilter {
  field: string
  operator: 'equal' | 'not_equal' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'
  value: any
}

export interface BlockSort {
  field: string
  direction: 'asc' | 'desc'
}

export interface VisibilityRule {
  field?: string
  condition?: string
  value?: any
}

export interface HighlightRule {
  field: string
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'date_before' | 'date_after' | 'date_today' | 'date_overdue' | 'is_empty' | 'is_not_empty'
  value?: any
  background_color?: string
  text_color?: string
  scope?: 'cell' | 'row' | 'group' // Where the color applies: cell (specific field), row (entire row), or group (group header)
  target_field?: string // Optional field name for cell-level formatting (when scope is 'cell')
}

export interface Page {
  id: string
  name: string
  description?: string
  settings?: PageSettings
  created_at: string
  updated_at?: string
  created_by?: string
  is_admin_only?: boolean // If true, only admins can see this interface
}

export interface PageSettings {
  icon?: string
  access?: 'public' | 'authenticated' | 'roles'
  allowed_roles?: string[]
  primary_table_id?: string
  /**
   * Page-level default for showing an "Add record" button in data blocks.
   * Blocks can override via block.config.appearance.show_add_record:
   * - true: always show
   * - false: never show
   * - undefined: follow this page default
   */
  show_add_record?: boolean
  // Backward compatibility / convenience (camelCase)
  showAddRecord?: boolean
  layout?: {
    cols?: number
    rowHeight?: number
    margin?: [number, number]
  }
  // Record Review page settings
  tableId?: string // Required for record_review pages
  leftPanel?: {
    visibleFieldIds: string[] // Which fields show in left column
    fieldOrder: string[] // Order of fields (if empty, use table field order)
    showLabels?: boolean // Show field labels
    compact?: boolean // Compact display mode
  }
  // Backward compatibility: support snake_case format
  left_panel?: {
    visibleFieldIds: string[] // Which fields show in left column
    fieldOrder: string[] // Order of fields (if empty, use table field order)
    showLabels?: boolean // Show field labels
    compact?: boolean // Compact display mode
  }
}

export interface LayoutItem {
  i: string // block id
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}
