"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react"
import { Settings2 } from "lucide-react"
import { useUIMode } from "@/contexts/UIModeContext"
import { cn } from "@/lib/utils"

export type DashboardSectionCapability = "preview" | "editable"

interface DashboardEditChromeContextValue {
  selectedId: string | null
  selectSection: (id: string) => void
  clearSelection: () => void
}

const DashboardEditChromeContext = createContext<DashboardEditChromeContextValue | null>(
  null
)

function useDashboardEditChrome(): DashboardEditChromeContextValue | null {
  return useContext(DashboardEditChromeContext)
}

/** Wraps a bespoke marketing dashboard so section chrome can share selection state in edit mode. */
export function DashboardEditChromeProvider({ children }: { children: ReactNode }) {
  const isEditMode = useUIMode().isEdit()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectSection = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id))
  }, [])

  const clearSelection = useCallback(() => setSelectedId(null), [])

  const value = useMemo(
    () => ({ selectedId, selectSection, clearSelection }),
    [selectedId, selectSection, clearSelection]
  )

  if (!isEditMode) {
    return <>{children}</>
  }

  return (
    <DashboardEditChromeContext.Provider value={value}>
      {children}
    </DashboardEditChromeContext.Provider>
  )
}

export interface EditableDashboardRegionProps {
  id: string
  label: string
  capability?: DashboardSectionCapability
  className?: string
  children: ReactNode
  onOpenSettings?: () => void
}

/**
 * Lightweight edit-preview frame for bespoke marketing dashboards.
 * View mode: pass-through (no extra DOM chrome).
 * Edit mode: hover outline, selection ring, preview/settings affordances — no layout shift.
 */
export function EditableDashboardRegion({
  id,
  label,
  capability = "preview",
  className,
  children,
  onOpenSettings,
}: EditableDashboardRegionProps) {
  const isEditMode = useUIMode().isEdit()

  if (!isEditMode) {
    return className ? <div className={className}>{children}</div> : <>{children}</>
  }

  return (
    <EditableDashboardRegionChrome
      id={id}
      label={label}
      capability={capability}
      className={className}
      onOpenSettings={onOpenSettings}
    >
      {children}
    </EditableDashboardRegionChrome>
  )
}

function EditableDashboardRegionChrome({
  id,
  label,
  capability = "preview",
  className,
  children,
  onOpenSettings,
}: EditableDashboardRegionProps) {
  const chrome = useDashboardEditChrome()
  const isSelected = chrome?.selectedId === id
  const isPreview = capability === "preview"

  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    chrome?.selectSection(id)
  }

  const handleSettings = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    onOpenSettings?.()
  }

  return (
    <div
      data-dashboard-section={id}
      className={cn("group/dashboard-section relative min-w-0", className)}
      onClick={handleClick}
      role="group"
      aria-label={label}
    >
      {children}

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 z-[1] rounded-md border-2 border-dashed transition-colors",
          isSelected
            ? "border-accent-link/55 ring-2 ring-accent-link/25"
            : "border-transparent group-hover/dashboard-section:border-accent-link/30"
        )}
      />

      <div
        className={cn(
          "pointer-events-none absolute top-1 right-1 z-[2] flex items-center gap-1 transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover/dashboard-section:opacity-100"
        )}
      >
        <span className="rounded-inner bg-card/95 backdrop-blur-sm border border-border/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm truncate max-w-[140px]">
          {label}
        </span>
        {isPreview ? (
          <span className="rounded-inner bg-muted/80 border border-border/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            Preview
          </span>
        ) : onOpenSettings ? (
          <button
            type="button"
            onClick={handleSettings}
            className="pointer-events-auto rounded-inner bg-card/95 backdrop-blur-sm border border-border/50 p-0.5 text-muted-foreground hover:text-foreground hover:border-accent-link/40 shadow-sm"
            aria-label={`${label} settings`}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
