"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RecordEditorCascadeContext } from "@/lib/interface/record-editor-core"
import { Plus, Search } from "lucide-react"
import SocialMediaCalendarView from "@/components/interface/SocialMediaCalendarView"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"
import { SocialCalendarStatusBar } from "@/components/interface/social/SocialCalendarStatusBar"
import { SocialMediaFeedView } from "@/components/interface/social/SocialMediaFeedView"
import { SocialMediaListView } from "@/components/interface/social/SocialMediaListView"
import { MarketingFilterStrip } from "@/components/layout/ui-system"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { useSocialMediaCalendarData } from "@/hooks/useSocialMediaCalendarData"
import { formatDisplayValue } from "@/lib/marketing/field-utils"
import {
  applyContentScope,
  buildSocialCalendarCreateInitialData,
  buildSocialCalendarEvents,
  buildSocialCalendarItems,
  buildSocialStatusSummary,
  collectSocialFilterOptions,
  sourceTableLooksSocial,
  extendSocialCalendarFieldMap,
  filterSocialCalendarItems,
  getCurrentQuarter,
  quarterLabel,
  type ContentScopeMode,
  type QuarterNum,
  type SocialCalendarFilters,
  type SocialCalendarViewMode,
  socialCalendarDateFieldValue,
  socialCalendarSettingsFromConfig,
  type SocialMediaCalendarBlockSettings,
  type SocialPlatform,
} from "@/lib/marketing/social-media-calendar"
import {
  isMarketingMockEnabled,
  marketingDemoState,
  MARKETING_DEMO_BANNER_DEFAULT,
} from "@/lib/marketing/block-config-resolver"
import MarketingDemoDataBanner from "@/components/interface/primitives/MarketingDemoDataBanner"
import { cn } from "@/lib/utils"

const FILTER_CONTROL = "h-8 text-xs border-border/40"

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  linkedin: "LinkedIn",
  twitter: "X",
  facebook: "Facebook",
  tiktok: "TikTok",
  youtube: "YouTube",
  other: "Other",
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  placeholder,
  className,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  placeholder: string
  className?: string
}) {
  if (options.length === 0) return null
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={cn(FILTER_CONTROL, "w-[120px]", className)} aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function valueMatchesSocialMarker(raw: unknown, marker: string): boolean {
  const needle = marker.trim().toLowerCase()
  if (!needle) return false
  if (raw == null) return false

  if (Array.isArray(raw)) {
    return raw.some((entry) => valueMatchesSocialMarker(entry, marker))
  }

  if (typeof raw === "object") {
    if ("label" in (raw as Record<string, unknown>)) {
      const label = String((raw as Record<string, unknown>).label ?? "")
      return label.toLowerCase().includes(needle)
    }
    if ("value" in (raw as Record<string, unknown>)) {
      const value = String((raw as Record<string, unknown>).value ?? "")
      return value.toLowerCase().includes(needle)
    }
    return Object.values(raw as Record<string, unknown>).some((entry) =>
      valueMatchesSocialMarker(entry, marker)
    )
  }

  return String(raw).toLowerCase().includes(needle)
}

export interface SocialMediaCalendarCoreProps {
  settings: SocialMediaCalendarBlockSettings
  config?: import("@/lib/interface/types").BlockConfig | null
  canEdit?: boolean
  className?: string
}

export function SocialMediaCalendarFromConfig({
  config,
  canEdit = false,
  isEditing = false,
  interfaceMode = "view",
  embeddedInBlock = true,
  className,
}: {
  config?: import("@/lib/interface/types").BlockConfig | null
  canEdit?: boolean
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  /** When true, preview panel stays inline (dashboard block). When false, full-page may use a drawer on small screens. */
  embeddedInBlock?: boolean
  className?: string
}) {
  const settings = socialCalendarSettingsFromConfig(config)
  return (
    <SocialMediaCalendarCore
      settings={settings}
      config={config}
      canEdit={canEdit}
      isEditing={isEditing}
      interfaceMode={interfaceMode}
      embeddedInBlock={embeddedInBlock}
      className={className}
    />
  )
}

export function SocialMediaCalendarCore({
  settings,
  config,
  canEdit = false,
  isEditing = false,
  interfaceMode = "view",
  embeddedInBlock = true,
  className,
}: SocialMediaCalendarCoreProps & {
  isEditing?: boolean
  interfaceMode?: "view" | "edit"
  embeddedInBlock?: boolean
}) {
  const blockConfig = config ?? undefined
  const { openRecordModal } = useRecordModal()
  const { state: recordPanelState } = useRecordPanel()
  const {
    loading,
    error,
    fromLiveData,
    hasTable,
    tableIds,
    fields,
    contentFields,
    contentTableFields,
    contentRows,
    allItems,
    campaignRows,
    sourceTableName,
    reload,
  } = useSocialMediaCalendarData({ config: blockConfig })

  const forceMock = isMarketingMockEnabled(blockConfig, "social_media_calendar_use_mock")
  const demoState = marketingDemoState({ forceMock, fromLiveData, hasTable, error })

  const isCompact = settings.mode === "compact"
  const showSearch = config?.social_media_calendar_show_search !== false

  const [contentScope, setContentScope] = useState<ContentScopeMode>(settings.contentScope)
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [quarter, setQuarter] = useState<QuarterNum | "all">(getCurrentQuarter())
  const [platformFilter, setPlatformFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [themeFilter, setThemeFilter] = useState("all")
  const [ownerFilter, setOwnerFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [viewMode, setViewMode] = useState<SocialCalendarViewMode>(settings.defaultView)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setContentScope(settings.contentScope)
  }, [settings.contentScope])

  useEffect(() => {
    setViewMode(settings.defaultView)
  }, [settings.defaultView])

  const socialFields = useMemo(() => {
    if (!fields || contentFields.length === 0) return null
    return extendSocialCalendarFieldMap(fields, contentFields, blockConfig)
  }, [fields, contentFields, blockConfig])

  /** Overlay record panel (like grid calendar) so opening a post does not squeeze the calendar. */
  const recordPanelCascade = useMemo((): RecordEditorCascadeContext => {
    const dateField =
      socialFields?.contentDate ??
      fields?.contentDate ??
      blockConfig?.social_media_calendar_publish_date_field ??
      "date"
    return {
      blockConfig: {
        ...(blockConfig ?? {}),
        view_type: "calendar",
        calendar_date_field: dateField,
      },
    }
  }, [blockConfig, fields?.contentDate, socialFields?.contentDate])

  const campaignLabelById = useMemo(() => {
    const map = new Map<string, string>()
    if (!fields) return map
    for (const row of campaignRows) {
      map.set(String(row.id), formatDisplayValue(row[fields.campaignName]) || "Campaign")
    }
    return map
  }, [campaignRows, fields])

  const isSocialPostsTable = useMemo(
    () => sourceTableLooksSocial(sourceTableName),
    [sourceTableName]
  )

  const socialMarkerFieldName = useMemo(() => {
    const id = blockConfig?.social_media_calendar_social_marker_field_id?.trim()
    if (id) {
      const byId = contentTableFields.find((f) => f.id === id)
      if (byId?.name) return byId.name
    }
    const byName = blockConfig?.social_media_calendar_social_marker_field?.trim()
    return byName || null
  }, [
    blockConfig?.social_media_calendar_social_marker_field,
    blockConfig?.social_media_calendar_social_marker_field_id,
    contentTableFields,
  ])

  const socialMarkerValue = blockConfig?.social_media_calendar_social_marker_value?.trim() || null

  const rowById = useMemo(() => {
    return new Map(contentRows.map((row) => [String(row.id), row]))
  }, [contentRows])

  const allSocialItems = useMemo(() => {
    if (!socialFields) return []
    return buildSocialCalendarItems({
      baseItems: allItems,
      contentRows,
      fields: socialFields,
      campaignLabelById,
    })
  }, [allItems, contentRows, socialFields, campaignLabelById])

  const scopedItems = useMemo(
    () => {
      const autoScoped = applyContentScope(
        allSocialItems,
        contentScope,
        !isSocialPostsTable && socialFields?.contentType != null
      )

      if (contentScope !== "social_only" || !socialMarkerFieldName || !socialMarkerValue) {
        return autoScoped
      }

      return allSocialItems.filter((item) => {
        const row = rowById.get(item.id)
        return valueMatchesSocialMarker(row?.[socialMarkerFieldName], socialMarkerValue)
      })
    },
    [
      allSocialItems,
      contentScope,
      socialFields?.contentType,
      socialMarkerFieldName,
      socialMarkerValue,
      isSocialPostsTable,
      rowById,
    ]
  )

  const filterOptions = useMemo(
    () =>
      collectSocialFilterOptions(scopedItems, {
        contentFields,
        statusFieldName: fields?.contentStatus ?? null,
      }),
    [scopedItems, contentFields, fields?.contentStatus]
  )

  useEffect(() => {
    if (filterOptions.years.length === 0) return
    if (!filterOptions.years.includes(year)) {
      setYear(filterOptions.years[0])
    }
  }, [filterOptions.years, year])

  const filters: SocialCalendarFilters = useMemo(
    () => ({
      year,
      quarter,
      contentTypes: [],
      divisions: [],
      statuses: statusFilter === "all" ? [] : [statusFilter],
      search: settings.showFilters ? search : "",
      platforms: platformFilter === "all" ? [] : [platformFilter as SocialPlatform],
      themes: themeFilter === "all" ? [] : [themeFilter],
      owners: ownerFilter === "all" ? [] : [ownerFilter],
    }),
    [
      year,
      quarter,
      statusFilter,
      search,
      platformFilter,
      themeFilter,
      ownerFilter,
      settings.showFilters,
    ]
  )

  const filteredItems = useMemo(() => {
    const base = filterSocialCalendarItems(scopedItems, filters)
    if (settings.maxPosts != null && settings.maxPosts > 0) {
      return base.slice(0, settings.maxPosts)
    }
    return base
  }, [scopedItems, filters, settings.maxPosts])

  useEffect(() => {
    if (quarter === "all") return
    if (filteredItems.length === 0) {
      setQuarter("all")
    }
  }, [quarter, filteredItems.length])

  const calendarEvents = useMemo(
    () => buildSocialCalendarEvents(filteredItems),
    [filteredItems]
  )

  const statusSummary = useMemo(
    () => buildSocialStatusSummary(filteredItems),
    [filteredItems]
  )

  const canCreatePost =
    canEdit &&
    !isEditing &&
    demoState.useLiveData &&
    !forceMock &&
    !!tableIds?.contentTableId

  const openPost = useCallback(
    (
      recordId: string | null,
      scheduleDate?: string,
      initialDrawerMode: "view" | "edit" = "view"
    ) => {
      if (!tableIds) return
      if (
        recordId === null &&
        recordPanelState.isOpen &&
        recordPanelState.recordId === null &&
        recordPanelState.tableId === tableIds.contentTableId
      ) {
        return
      }
      const common = {
        tableId: tableIds.contentTableId,
        supabaseTableName: tableIds.contentSupabaseTable,
        onRecordUpdated: reload,
        onDeleted: reload,
        onSave: () => reload(),
        cascadeContext: recordPanelCascade,
        tableFields: contentTableFields,
        interfaceMode,
        recordLayoutType: "social_post" as const,
      }
      if (recordId === null) {
        openRecordModal({
          ...common,
          recordId: null,
          initialDrawerMode: "edit",
          initialData: buildSocialCalendarCreateInitialData({
            config: blockConfig,
            contentScope,
            fields,
            contentFields,
            tableFields: contentTableFields,
            scheduleDate,
          }),
        })
      } else {
        openRecordModal({
          ...common,
          recordId,
          initialDrawerMode,
        })
      }
    },
    [
      tableIds,
      reload,
      recordPanelCascade,
      contentTableFields,
      blockConfig,
      contentScope,
      fields,
      contentFields,
      openRecordModal,
      interfaceMode,
      isEditing,
      recordPanelState.isOpen,
      recordPanelState.recordId,
      recordPanelState.tableId,
    ]
  )

  const handleCalendarDateClick = useCallback(
    (dateStr: string) => {
      if (!canCreatePost) return
      openPost(null, dateStr)
    },
    [canCreatePost, openPost]
  )

  const handleSelectPost = useCallback(
    (id: string) => {
      setSelectedId(id)
      if (isEditing) return
      openPost(id, undefined, "view")
    },
    [isEditing, openPost]
  )

  useEffect(() => {
    if (!recordPanelState.isOpen) {
      setSelectedId(null)
    }
  }, [recordPanelState.isOpen])

  const calendarEditable =
    canEdit &&
    !isEditing &&
    demoState.useLiveData &&
    !forceMock &&
    !!tableIds?.contentSupabaseTable &&
    !!socialFields?.contentDate

  const handleEventDateChange = useCallback(
    async (recordId: string, newDate: Date): Promise<boolean> => {
      if (!calendarEditable || !tableIds?.contentSupabaseTable || !socialFields?.contentDate) {
        return false
      }
      const dateField = socialFields.contentDate
      const updates = { [dateField]: socialCalendarDateFieldValue(newDate) }
      try {
        const supabase = createClient()
        const { error } = await supabase
          .from(tableIds.contentSupabaseTable)
          .update(updates)
          .eq("id", recordId)
        if (error) throw error
        reload()
        return true
      } catch (err) {
        console.error("Social calendar: failed to reschedule post", err)
        const message = err instanceof Error ? err.message : "Could not save the new date"
        window.alert(`Failed to reschedule post: ${message}`)
        return false
      }
    },
    [calendarEditable, tableIds?.contentSupabaseTable, socialFields?.contentDate, reload]
  )

  if (loading && !demoState.useLiveData && !forceMock) {
    return (
      <div className={cn("flex items-center justify-center py-16", className)}>
        <LoadingSpinner size="lg" text="Loading social calendar…" />
      </div>
    )
  }

  if (demoState.showEmptyState && !demoState.useDemoData) {
    return (
      <div className={cn("flex flex-col items-center gap-4 py-12 text-center", className)}>
        <DashboardEmpty
          title="Social calendar not configured"
          description={demoState.bannerMessage}
          variant="default"
        />
      </div>
    )
  }

  const calendarView = viewMode === "week" ? "week" : "month"

  return (
    <div
      className={cn(
        "flex flex-col gap-3 md:gap-4 min-w-0 min-h-0 h-full w-full",
        isCompact && "gap-2 md:gap-3",
        className
      )}
      data-social-media-calendar-core
      data-block-selectable
    >
      {demoState.showDemoBanner ? (
        <MarketingDemoDataBanner
          message={
            forceMock ? demoState.bannerMessage : MARKETING_DEMO_BANNER_DEFAULT
          }
        />
      ) : null}
      {settings.showPageHeader ? (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0">
          <div className="flex flex-col gap-0.5 min-w-0">
            <h2 className={cn("text-foreground font-semibold", isCompact ? "text-base" : "text-page-title")}>
              {settings.title}
            </h2>
            <p className="text-meta text-muted-foreground">{settings.subtitle}</p>
          </div>
          {settings.showToolbar ? (
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
              <div
                className="inline-flex rounded-lg border border-border/40 p-0.5 bg-muted/25"
                role="group"
                aria-label="Content scope"
              >
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    contentScope === "social_only"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setContentScope("social_only")}
                >
                  Social only
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    contentScope === "all_content"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setContentScope("all_content")}
                >
                  All content
                </button>
              </div>
              {canEdit ? (
                <Button type="button" size="sm" onClick={() => openPost(null)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create post
                </Button>
              ) : null}
            </div>
          ) : null}
        </header>
      ) : settings.showToolbar ? (
        <div className="flex items-center justify-end gap-2 shrink-0 flex-wrap">
          <div
            className="inline-flex rounded-lg border border-border/40 p-0.5 bg-muted/25"
            role="group"
            aria-label="Content scope"
          >
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                contentScope === "social_only"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
              onClick={() => setContentScope("social_only")}
            >
              Social only
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                contentScope === "all_content"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground"
              )}
              onClick={() => setContentScope("all_content")}
            >
              All content
            </button>
          </div>
          {canEdit ? (
            <Button type="button" size="sm" variant="outline" onClick={() => openPost(null)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create
            </Button>
          ) : null}
        </div>
      ) : null}

      {settings.showFilters ? (
        <MarketingFilterStrip className="shrink-0">
          <div className="relative flex-1 min-w-[200px] max-w-md order-first">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts…"
              className={cn(FILTER_CONTROL, "pl-8 bg-background ring-1 ring-border/30 w-full")}
            />
          </div>
          <FilterSelect
            label="Platform"
            value={platformFilter}
            placeholder="Platforms"
            options={filterOptions.platforms.map((p) => ({
              value: p,
              label: PLATFORM_LABELS[p],
            }))}
            onChange={setPlatformFilter}
          />
          <FilterSelect
            label="Status"
            value={statusFilter}
            placeholder="Status"
            options={filterOptions.statuses.map((s) => ({ value: s, label: s }))}
            onChange={setStatusFilter}
          />
          <FilterSelect
            label="Theme"
            value={themeFilter}
            placeholder="Theme"
            options={filterOptions.themes.map((t) => ({ value: t, label: t }))}
            onChange={setThemeFilter}
          />
          <FilterSelect
            label="Owner"
            value={ownerFilter}
            placeholder="Owner"
            options={filterOptions.owners.map((o) => ({ value: o, label: o }))}
            onChange={setOwnerFilter}
          />
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className={cn(FILTER_CONTROL, "w-[88px]")} aria-label="Year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={quarter === "all" ? "all" : String(quarter)}
            onValueChange={(v) => setQuarter(v === "all" ? "all" : (Number(v) as QuarterNum))}
          >
            <SelectTrigger className={cn(FILTER_CONTROL, "w-[100px]")} aria-label="Quarter">
              <SelectValue placeholder="Quarter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All quarters</SelectItem>
              {([1, 2, 3, 4] as const).map((q) => (
                <SelectItem key={q} value={String(q)}>
                  {quarterLabel(q)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {statusSummary.overdue > 0 ? (
            <Badge
              variant="outline"
              className="text-[11px] font-normal border-destructive/40 text-destructive"
            >
              {statusSummary.overdue} overdue
            </Badge>
          ) : null}
        </MarketingFilterStrip>
      ) : null}

      <Tabs
        value={viewMode}
        onValueChange={(v) => setViewMode(v as SocialCalendarViewMode)}
        className="shrink-0"
      >
        <TabsList className="h-8">
          <TabsTrigger value="month" className="text-xs px-3">
            Month
          </TabsTrigger>
          <TabsTrigger value="week" className="text-xs px-3">
            Week
          </TabsTrigger>
          <TabsTrigger value="list" className="text-xs px-3">
            List
          </TabsTrigger>
          <TabsTrigger value="feed" className="text-xs px-3">
            Feed
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex min-h-0 flex-1 relative overflow-hidden flex-col">
        <div className="flex-1 min-w-0 flex flex-col gap-2 min-h-0">
          {filteredItems.length === 0 ? (
            <DashboardEmpty
              title="No social posts"
              description="Adjust filters or create a new post."
              className="py-12"
            />
          ) : viewMode === "month" || viewMode === "week" ? (
            <div
              className={cn(
                "rounded-card border border-border/30 flex-1 min-h-0 overflow-x-hidden",
                embeddedInBlock
                  ? cn(
                      "overflow-y-auto",
                      isCompact ? "min-h-[360px]" : "min-h-[400px]"
                    )
                  : "min-h-0 overflow-hidden"
              )}
            >
              <SocialMediaCalendarView
                events={calendarEvents}
                viewMode={calendarView}
                onEventClick={handleSelectPost}
                onDateClick={canCreatePost ? handleCalendarDateClick : undefined}
                onEventDateChange={calendarEditable ? handleEventDateChange : undefined}
                editable={calendarEditable}
                compact={isCompact}
                showPlatformIcons={settings.showPlatformIcons}
                showApprovalStatus={settings.showApprovalStatus}
                fillContainer={!embeddedInBlock}
              />
            </div>
          ) : viewMode === "list" ? (
            <SocialMediaListView
              items={filteredItems}
              selectedId={selectedId}
              onSelect={handleSelectPost}
              compact={isCompact}
              showPlatformIcons={settings.showPlatformIcons}
              showApprovalStatus={settings.showApprovalStatus}
              fillContainer={!embeddedInBlock}
            />
          ) : (
            <SocialMediaFeedView
              items={filteredItems}
              selectedId={selectedId}
              onSelect={handleSelectPost}
              compact={isCompact}
              showPlatformIcons={settings.showPlatformIcons}
              showApprovalStatus={settings.showApprovalStatus}
              fillContainer={!embeddedInBlock}
            />
          )}

          {settings.showStatusBar ? (
            <SocialCalendarStatusBar summary={statusSummary} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
