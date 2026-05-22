"use client"

import { useCallback, useMemo } from "react"
import { format, parseISO, isValid } from "date-fns"
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Globe,
  Linkedin,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Pencil,
  type LucideIcon,
} from "lucide-react"
import type { PageBlock } from "@/lib/interface/types"
import type { UpcomingSummarySectionId } from "@/lib/interface/types"
import { cn } from "@/lib/utils"
import {
  ALL_UPCOMING_SUMMARY_SECTIONS,
  BLOCKER_REASON_LABELS,
  DATE_RANGE_LABELS,
  MOCK_APPROVAL,
  MOCK_BLOCKERS,
  MOCK_CAMPAIGNS,
  MOCK_DEADLINES,
  MOCK_EVENTS,
  MOCK_PUBLISHED,
  getVisibleSections,
  sliceItems,
  sortCampaignsByStatus,
  type ApprovalItem,
  type BlockerItem,
  type CampaignItem,
  type DeadlineItem,
  type EventItem,
  type PublishedItem,
} from "@/lib/interface/upcoming-summary-mock-data"
import UpcomingSummarySectionCard from "./upcoming-summary/UpcomingSummarySectionCard"

interface UpcomingSummaryBlockProps {
  block: PageBlock
  isEditing?: boolean
}

const STATUS_DOT: Record<string, string> = {
  overdue: "bg-red-500",
  "to-do": "bg-gray-400",
  "in-progress": "bg-blue-500",
  "awaiting-approval": "bg-orange-400",
  approved: "bg-emerald-500",
  scheduled: "bg-amber-500",
}

const DEADLINE_DATE_CLASS: Record<string, string> = {
  overdue: "text-red-600 font-medium",
  scheduled: "text-amber-600",
}

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  mail: Mail,
  message: MessageSquare,
  globe: Globe,
  file: FileText,
  linkedin: Linkedin,
}

function formatDateLabel(value: string): string {
  try {
    const d = parseISO(value)
    if (!isValid(d)) return value
    return format(d, "d MMM")
  } catch {
    return value
  }
}

function formatDateRange(start: string, end?: string): string {
  const s = formatDateLabel(start)
  if (!end) return s
  return `${s} – ${formatDateLabel(end)}`
}

function StatusPill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium truncate",
        className ?? "bg-muted/60 text-foreground/90"
      )}
    >
      {label}
    </span>
  )
}

function ItemRow({
  children,
  onClick,
  isEditing,
  isCompact,
  showChevron,
}: {
  children: React.ReactNode
  onClick?: () => void
  isEditing?: boolean
  isCompact?: boolean
  showChevron?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        disabled={isEditing}
        onClick={onClick}
        className={cn(
          "group flex w-full items-center gap-2 rounded-lg text-left transition-colors hover:bg-[#F8F8FC] disabled:opacity-60",
          isCompact ? "px-1.5 py-1.5" : "px-2 py-2"
        )}
      >
        {children}
        {showChevron ? (
          <ChevronRight
            className="h-3.5 w-3.5 shrink-0 text-[#6B7280]/40 group-hover:text-[#6B7280]"
            aria-hidden
          />
        ) : null}
      </button>
    </li>
  )
}

function OwnerAvatar({ initials }: { initials: string }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E6E6EF] text-[10px] font-semibold text-[#6B7280]"
      title={initials}
    >
      {initials}
    </span>
  )
}

export default function UpcomingSummaryBlock({
  block,
  isEditing = false,
}: UpcomingSummaryBlockProps) {
  const { config } = block

  const blockTitle = config.title || "Upcoming Summary"
  const subtitle =
    config.upcoming_summary_subtitle ||
    "A quick view of deadlines, campaigns and marketing activity needing attention."
  const maxItems = config.upcoming_summary_max_items ?? 5
  const layout = config.upcoming_summary_layout || "two_column"
  const dateRange = config.upcoming_summary_date_range || "next_30_days"
  const showCounts = config.upcoming_summary_show_counts !== false
  const showDates = config.upcoming_summary_show_dates !== false
  const showOwners = config.upcoming_summary_show_owners !== false
  const showViewAll = config.upcoming_summary_show_view_all !== false
  const groupCampaigns = config.upcoming_summary_group_campaigns_by_status === true

  const visibleSections = useMemo(() => getVisibleSections(config), [config])
  const isCompact = layout === "compact"

  const gridClass =
    layout === "stacked" || layout === "compact"
      ? "grid grid-cols-1 gap-3"
      : "grid grid-cols-1 gap-3 md:grid-cols-2"

  const campaigns = useMemo(() => {
    const list = groupCampaigns ? sortCampaignsByStatus(MOCK_CAMPAIGNS) : MOCK_CAMPAIGNS
    return sliceItems(list, maxItems)
  }, [groupCampaigns, maxItems])

  const handleItemClick = useCallback(
    (_itemId: string, _section: UpcomingSummarySectionId) => {
      // TODO: connect deadlines to Content table date/status fields
      // TODO: connect campaigns to Campaigns table
      // TODO: connect events to Events table
      // TODO: connect approval items to status field
      // TODO: connect blockers to missing required fields
      // TODO: connect recently published to published content status
      // TODO: open existing RecordModal / RecordEditor on click
      // e.g. openRecordModal({ tableId, recordId: itemId, supabaseTableName, ... })
    },
    []
  )

  const handleViewAll = useCallback((_section: UpcomingSummarySectionId) => {
    // TODO: link to filtered view for section
  }, [])

  const handleViewAllActivity = useCallback(() => {
    // TODO: navigate to activity view
  }, [])

  const renderDeadline = (item: DeadlineItem) => {
    const ChannelIcon = CHANNEL_ICONS[item.channel ?? "file"] ?? FileText
    const dateLabel =
      item.status === "overdue"
        ? "Overdue"
        : showDates
          ? formatDateLabel(item.dueDate)
          : null

    return (
      <ItemRow
        key={item.id}
        isEditing={isEditing}
        isCompact={isCompact}
        onClick={() => handleItemClick(item.id, "deadlines")}
      >
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[item.status] ?? "bg-gray-400")}
          aria-hidden
        />
        <ChannelIcon className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#111827]">
          {item.title}
        </span>
        {dateLabel ? (
          <span
            className={cn(
              "shrink-0 text-[10px]",
              DEADLINE_DATE_CLASS[item.status] ?? "text-[#6B7280]"
            )}
          >
            {dateLabel}
          </span>
        ) : null}
      </ItemRow>
    )
  }

  const renderCampaign = (item: CampaignItem) => {
    const meta = [
      item.plannedCount != null ? `${item.plannedCount} planned` : null,
      item.scheduledCount != null ? `${item.scheduledCount} scheduled` : null,
    ]
      .filter(Boolean)
      .join(" · ")

    return (
      <ItemRow
        key={item.id}
        isEditing={isEditing}
        isCompact={isCompact}
        showChevron
        onClick={() => handleItemClick(item.id, "campaigns")}
      >
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-purple-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-[#111827]">{item.title}</p>
          {meta ? <p className="truncate text-[10px] text-[#6B7280]">{meta}</p> : null}
        </div>
        {item.status ? (
          <StatusPill
            label={item.status}
            className={
              item.status === "In progress"
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-100 text-slate-600"
            }
          />
        ) : null}
      </ItemRow>
    )
  }

  const renderEvent = (item: EventItem) => (
    <ItemRow
      key={item.id}
      isEditing={isEditing}
      isCompact={isCompact}
      showChevron
      onClick={() => handleItemClick(item.id, "events")}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[#111827]">{item.title}</p>
        <div className="flex flex-wrap items-center gap-x-1.5 text-[10px] text-[#6B7280]">
          {showDates ? (
            <span>{formatDateRange(item.startDate, item.endDate)}</span>
          ) : null}
          {item.location ? (
            <span className="inline-flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" aria-hidden />
              {item.location}
            </span>
          ) : null}
        </div>
      </div>
      {item.status ? (
        <StatusPill label={item.status} className="bg-emerald-50 text-emerald-700" />
      ) : null}
    </ItemRow>
  )

  const renderApproval = (item: ApprovalItem) => (
    <ItemRow
      key={item.id}
      isEditing={isEditing}
      isCompact={isCompact}
      onClick={() => handleItemClick(item.id, "approval")}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" aria-hidden />
      <FileText className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[#111827]">{item.title}</p>
        {item.contentType ? (
          <p className="truncate text-[10px] text-[#6B7280]">{item.contentType}</p>
        ) : null}
      </div>
      {showOwners && item.ownerInitials ? (
        <OwnerAvatar initials={item.ownerInitials} />
      ) : null}
    </ItemRow>
  )

  const renderBlocker = (item: BlockerItem) => (
    <ItemRow
      key={item.id}
      isEditing={isEditing}
      isCompact={isCompact}
      onClick={() => handleItemClick(item.id, "blockers")}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[#111827]">{item.title}</p>
        <p className="truncate text-[10px] text-[#6B7280]">
          {item.relatedContent ?? BLOCKER_REASON_LABELS[item.reason]}
        </p>
      </div>
      <Pencil className="h-3 w-3 shrink-0 text-[#6B7280]/50" aria-hidden />
    </ItemRow>
  )

  const renderPublished = (item: PublishedItem) => (
    <ItemRow
      key={item.id}
      isEditing={isEditing}
      isCompact={isCompact}
      onClick={() => handleItemClick(item.id, "published")}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
      <Globe className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[#111827]">{item.title}</p>
        {item.channel ? (
          <p className="truncate text-[10px] text-[#6B7280]">{item.channel}</p>
        ) : null}
      </div>
      {showDates ? (
        <span className="shrink-0 text-[10px] text-[#6B7280]">
          {formatDateLabel(item.publishedDate)}
        </span>
      ) : null}
    </ItemRow>
  )

  const sectionNodes: Partial<Record<UpcomingSummarySectionId, React.ReactNode>> = {
    deadlines: visibleSections.includes("deadlines") ? (
      <UpcomingSummarySectionCard
        key="deadlines"
        icon={CalendarClock}
        iconWrapClass="bg-red-50"
        iconClass="text-red-600"
        title="Upcoming deadlines"
        subtitle="Content due soon"
        countLabel={showCounts ? `${MOCK_DEADLINES.length} due` : undefined}
        countBadgeClass="bg-red-100 text-red-700"
        showCounts={showCounts}
        showViewAll={showViewAll}
        viewAllLabel="View all deadlines"
        isEditing={isEditing}
        isCompact={isCompact}
        onViewAll={() => handleViewAll("deadlines")}
      >
        {sliceItems(MOCK_DEADLINES, maxItems).map(renderDeadline)}
      </UpcomingSummarySectionCard>
    ) : null,
    campaigns: visibleSections.includes("campaigns") ? (
      <UpcomingSummarySectionCard
        key="campaigns"
        icon={Megaphone}
        iconWrapClass="bg-purple-50"
        iconClass="text-purple-600"
        title="Upcoming campaigns"
        subtitle="Active and planned campaigns"
        countLabel={showCounts ? `${MOCK_CAMPAIGNS.length} campaigns` : undefined}
        countBadgeClass="bg-purple-100 text-purple-700"
        showCounts={showCounts}
        showViewAll={showViewAll}
        viewAllLabel="View all campaigns"
        isEditing={isEditing}
        isCompact={isCompact}
        onViewAll={() => handleViewAll("campaigns")}
      >
        {campaigns.map(renderCampaign)}
      </UpcomingSummarySectionCard>
    ) : null,
    events: visibleSections.includes("events") ? (
      <UpcomingSummarySectionCard
        key="events"
        icon={Calendar}
        iconWrapClass="bg-emerald-50"
        iconClass="text-emerald-600"
        title="Upcoming events"
        subtitle="Shows and industry events"
        countLabel={showCounts ? `${MOCK_EVENTS.length} events` : undefined}
        countBadgeClass="bg-emerald-100 text-emerald-700"
        showCounts={showCounts}
        showViewAll={showViewAll}
        viewAllLabel="View all events"
        isEditing={isEditing}
        isCompact={isCompact}
        onViewAll={() => handleViewAll("events")}
      >
        {sliceItems(MOCK_EVENTS, maxItems).map(renderEvent)}
      </UpcomingSummarySectionCard>
    ) : null,
    approval: visibleSections.includes("approval") ? (
      <UpcomingSummarySectionCard
        key="approval"
        icon={Clock}
        iconWrapClass="bg-orange-50"
        iconClass="text-orange-600"
        title="Awaiting approval"
        subtitle="Content waiting for sign-off"
        countLabel={showCounts ? `${MOCK_APPROVAL.length} items` : undefined}
        countBadgeClass="bg-orange-100 text-orange-700"
        showCounts={showCounts}
        showViewAll={showViewAll}
        viewAllLabel="View all approvals"
        isEditing={isEditing}
        isCompact={isCompact}
        onViewAll={() => handleViewAll("approval")}
      >
        {sliceItems(MOCK_APPROVAL, maxItems).map(renderApproval)}
      </UpcomingSummarySectionCard>
    ) : null,
    blockers: visibleSections.includes("blockers") ? (
      <UpcomingSummarySectionCard
        key="blockers"
        icon={AlertCircle}
        iconWrapClass="bg-red-50"
        iconClass="text-red-600"
        title="Blockers / missing items"
        subtitle="Items needing attention"
        countLabel={showCounts ? `${MOCK_BLOCKERS.length} issues` : undefined}
        countBadgeClass="bg-red-100 text-red-700"
        showCounts={showCounts}
        showViewAll={showViewAll}
        viewAllLabel="View all blockers"
        isEditing={isEditing}
        isCompact={isCompact}
        onViewAll={() => handleViewAll("blockers")}
      >
        {sliceItems(MOCK_BLOCKERS, maxItems).map(renderBlocker)}
      </UpcomingSummarySectionCard>
    ) : null,
    published: visibleSections.includes("published") ? (
      <UpcomingSummarySectionCard
        key="published"
        icon={CheckCircle}
        iconWrapClass="bg-emerald-50"
        iconClass="text-emerald-600"
        title="Recently published"
        subtitle="Latest completed content"
        countLabel={showCounts ? `${MOCK_PUBLISHED.length} items` : undefined}
        countBadgeClass="bg-emerald-100 text-emerald-700"
        showCounts={showCounts}
        showViewAll={showViewAll}
        viewAllLabel="View all published"
        isEditing={isEditing}
        isCompact={isCompact}
        onViewAll={() => handleViewAll("published")}
      >
        {sliceItems(MOCK_PUBLISHED, maxItems).map(renderPublished)}
      </UpcomingSummarySectionCard>
    ) : null,
  }

  const orderedSections = ALL_UPCOMING_SUMMARY_SECTIONS.map((id) => sectionNodes[id]).filter(
    Boolean
  )

  return (
    <div
      className={cn(
        "h-full min-h-0 overflow-auto rounded-2xl border border-[#E6E6EF] bg-white shadow-sm",
        isEditing && "pointer-events-auto"
      )}
    >
      <div className="flex min-h-full flex-col">
        <div
          className={cn(
            "flex flex-wrap items-start justify-between gap-3 border-b border-[#E6E6EF] bg-[#F8F8FC]/50",
            isCompact ? "px-3 py-2.5" : "px-5 py-4"
          )}
        >
          <div className="flex min-w-0 flex-1 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
              <CalendarClock className="h-5 w-5 text-blue-600" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2
                className={cn(
                  "font-semibold text-[#111827]",
                  isCompact ? "text-sm" : "text-base"
                )}
              >
                {blockTitle}
              </h2>
              <p className={cn("text-[#6B7280]", isCompact ? "text-xs" : "text-sm")}>
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isEditing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6EF] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827] shadow-sm transition-colors hover:bg-[#F8F8FC] disabled:opacity-60"
            >
              <Calendar className="h-3.5 w-3.5 text-[#6B7280]" aria-hidden />
              {DATE_RANGE_LABELS[dateRange]}
              <ChevronDown className="h-3 w-3 text-[#6B7280]" aria-hidden />
            </button>
            <button
              type="button"
              disabled={isEditing}
              onClick={handleViewAllActivity}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6EF] bg-white px-2.5 py-1.5 text-xs font-medium text-[#111827] shadow-sm transition-colors hover:bg-[#F8F8FC] disabled:opacity-60"
            >
              View all activity
              <ExternalLink className="h-3 w-3 text-[#6B7280]" aria-hidden />
            </button>
          </div>
        </div>

        <div className={cn(isCompact ? "p-3" : "p-4", "flex-1")}>
          {orderedSections.length > 0 ? (
            <div className={gridClass}>{orderedSections}</div>
          ) : (
            <p className="py-8 text-center text-sm text-[#6B7280]">
              No sections selected. Enable sections in block settings.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
