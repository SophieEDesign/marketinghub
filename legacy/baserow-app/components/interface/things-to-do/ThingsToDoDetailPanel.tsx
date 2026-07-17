"use client"

/** @deprecated Unused runtime path — tasks open in RecordPanel. Retained for reference/tests. */

import type { ReactNode } from "react"
import {
  Copy,
  ExternalLink,
  MessageSquare,
  MoreHorizontal,
  RefreshCcw,
  ShieldCheck,
  User,
  X,
} from "lucide-react"
import {
  getTypeLabel,
  getPriorityLabel,
  getStatusLabel,
  formatDueDateLong,
  assignRowGroup,
  type ThingsToDoChecklistItem,
  type ThingsToDoItem,
} from "@/lib/marketing/things-to-do"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { debugLog } from "@/lib/debug"
import {
  ThingsToDoPriorityBadge,
  ThingsToDoStatusBadge,
  ThingsToDoTypeBadge,
} from "./ThingsToDoBadges"

interface ThingsToDoDetailPanelProps {
  item: ThingsToDoItem
  checklist: ThingsToDoChecklistItem[]
  onClose: () => void
  onChecklistToggle: (checklistId: string, completed: boolean) => void
  onOpenRecord?: () => void
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-xs">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-foreground">{children}</span>
    </div>
  )
}

export function ThingsToDoDetailPanel({
  item,
  checklist,
  onClose,
  onChecklistToggle,
  onOpenRecord,
}: ThingsToDoDetailPanelProps) {
  const group = assignRowGroup(item)
  const isOverdue = group === "overdue"

  const handleOpenRecord = () => {
    onOpenRecord?.()
  }

  const handleMarkApproved = () => {
    debugLog(`[ThingsToDo] Mark approved: ${item.id}`)
  }

  const handleMarkDone = () => {
    debugLog(`[ThingsToDo] Mark done: ${item.id}`)
  }

  const handleRequestChanges = () => {
    debugLog(`[ThingsToDo] Request changes: ${item.id}`)
  }

  const handleCopyLink = () => {
    debugLog(`[ThingsToDo] Copy link: ${item.id}`)
  }

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-border/40 bg-background md:w-[340px] md:border-l md:border-t-0">
      <div className="flex items-start justify-between gap-2 border-b border-border/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          <ThingsToDoTypeBadge type={item.type} className="mb-2" />
          <h3 className="text-base font-semibold leading-snug text-foreground">{item.title}</h3>
          {item.contentType ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.contentType}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <ThingsToDoPriorityBadge priority={item.priority} />
            <ThingsToDoStatusBadge status={item.status} />
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onClose}
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <MetaRow label="Owner">
          {item.owner ? (
            <span className="inline-flex items-center gap-1.5">
              <User className="h-3 w-3 text-muted-foreground" />
              {item.owner.name}
            </span>
          ) : (
            "—"
          )}
        </MetaRow>
        <MetaRow label="Reviewer">
          {item.reviewer ? item.reviewer.name : "—"}
        </MetaRow>
        <MetaRow label="Type">{getTypeLabel(item.type)}</MetaRow>
        <MetaRow label="Status">{getStatusLabel(item.status)}</MetaRow>
        <MetaRow label="Priority">{getPriorityLabel(item.priority)}</MetaRow>
        <MetaRow label="Due date">
          <span className={cn(isOverdue && "font-medium text-red-600")}>
            {formatDueDateLong(item.dueDate)}
            {isOverdue ? " · Overdue" : ""}
          </span>
        </MetaRow>
        <MetaRow label="Campaign">{item.campaign?.title ?? "—"}</MetaRow>
        <MetaRow label="Theme">{item.theme?.title ?? "—"}</MetaRow>
        <MetaRow label="Channel">{item.channel ?? "—"}</MetaRow>
        {item.description ? (
          <div className="mt-4">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </p>
            <p className="text-xs leading-relaxed text-foreground/90">{item.description}</p>
          </div>
        ) : null}

        {checklist.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Checklist
            </p>
            <ul className="space-y-2">
              {checklist.map((cl) => (
                <li key={cl.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`cl-${item.id}-${cl.id}`}
                    checked={cl.completed}
                    onCheckedChange={(v) => onChecklistToggle(cl.id, v === true)}
                  />
                  <label
                    htmlFor={`cl-${item.id}-${cl.id}`}
                    className={cn(
                      "text-xs",
                      cl.completed && "text-muted-foreground line-through"
                    )}
                  >
                    {cl.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {item.linkedItems && item.linkedItems.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Linked items
            </p>
            <ul className="space-y-1.5">
              {item.linkedItems.map((li) => (
                <li key={li.id}>
                  <button
                    type="button"
                    onClick={handleOpenRecord}
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 text-left text-xs hover:bg-muted/40"
                  >
                    <span className="truncate font-medium">{li.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 space-y-2 rounded-xl border border-dashed border-border/50 bg-muted/20 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            Comments
          </p>
          <p className="text-xs text-muted-foreground">
            {/* TODO: support comments/activity later. */}
            {item.commentsCount
              ? `${item.commentsCount} comment(s) — coming soon.`
              : "No comments yet."}
          </p>
        </div>

        <div className="mt-2 space-y-2 rounded-xl border border-dashed border-border/50 bg-muted/20 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <RefreshCcw className="h-3 w-3" />
            Activity
          </p>
          <p className="text-xs text-muted-foreground">Activity feed coming soon.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border/40 p-4">
        <Button type="button" variant="outline" size="sm" onClick={handleOpenRecord}>
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
          Open record
        </Button>
        {(item.type === "approval" || item.type === "review") && (
          <Button type="button" size="sm" onClick={handleMarkApproved}>
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark approved
          </Button>
        )}
        <Button type="button" variant="secondary" size="sm" onClick={handleMarkDone}>
          Mark done
        </Button>
        {item.type === "approval" || item.type === "review" ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleRequestChanges}>
            Request review
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyLink}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleCopyLink}>Copy link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
