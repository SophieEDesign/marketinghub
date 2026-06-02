"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { X, Pin, PinOff, Maximize2, Minimize2, Link2, ChevronLeft } from "lucide-react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { useUIMode } from "@/contexts/UIModeContext"
import { useToast } from "@/components/ui/use-toast"
import { createPortal } from "react-dom"
import RecordEditor from "./RecordEditor"
import { useIsMobile } from "@/hooks/useResponsive"
import { resolveRecordEditMode } from "@/lib/interface/resolve-record-edit-mode"
import { SHELL_RIGHT_SETTINGS_WIDTH_PX } from "@/lib/interface/layout-constants"
import { cn } from "@/lib/utils"

const MIN_WIDTH = 320
const MAX_WIDTH = 1200

export default function RecordPanel() {
  const {
    state,
    openRecord,
    closeRecord,
    setWidth,
    togglePin,
    toggleFullscreen,
    goBack,
  } = useRecordPanel()
  const { isEdit, state: uiModeState } = useUIMode()
  const { toast } = useToast()
  const router = useRouter()
  const isMobile = useIsMobile()

  const resizeRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)
  const resizeCleanupRef = useRef<null | (() => void)>(null)

  const active = Boolean(state.isOpen && state.tableId)
  const interfaceMode = resolveRecordEditMode({
    interfaceMode: state.interfaceMode,
    pageLayoutEditActive: isEdit() && Boolean(state.onLayoutSave),
  })
    ? "edit"
    : "view"
  const calendarOrigin =
    ((state.cascadeContext?.blockConfig as any)?.view_type === "calendar") ||
    ((state.cascadeContext?.blockConfig as any)?.calendar_start_field != null) ||
    ((state.cascadeContext?.blockConfig as any)?.calendar_date_field != null)

  const handleCopyLink = useCallback(() => {
    if (!state.recordId) return
    const url = `${window.location.origin}/tables/${state.tableId}/records/${state.recordId}`
    navigator.clipboard.writeText(url)
    toast({
      title: "Link copied",
      description: "Record link copied to clipboard",
    })
  }, [state.tableId, state.recordId, toast])

  const handleBack = useCallback(() => {
    if (state.isFullscreen) {
      router.back()
    } else if (state.history.length > 1) {
      goBack()
    } else {
      // In edit mode, Back closes the record when it's the only one (no close button shown)
      closeRecord()
    }
  }, [state.isFullscreen, state.history.length, router, goBack, closeRecord])

  // Desktop edit mode keeps the shell as a stable 3-region layout (sidebar, canvas, settings).
  // Record panel overlays in edit mode to avoid starving center width with multiple fixed side columns.
  const useOverlayLayout = isMobile || isEdit() || calendarOrigin
  /** In page edit mode, leave the right settings column clickable and place the panel beside it. */
  const offsetForRightSettings = useOverlayLayout && isEdit() && !isMobile
  const panelWidth = state.isFullscreen ? "100%" : `${state.width}px`
  // In edit mode, always show Back so user can close (X is hidden). Otherwise show when we can go to previous record.
  const canGoBack = state.isFullscreen || state.history.length > 1 || isEdit()

  useEffect(() => {
    if (!state.isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      // In edit mode, panel cannot be closed via Escape (use Back instead)
      if (e.key === "Escape" && !state.isPinned && !isEdit()) closeRecord()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [state.isOpen, state.isPinned, isEdit, closeRecord])

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.()
      resizeCleanupRef.current = null
      isResizingRef.current = false
    }
  }, [])

  // When overlay opens, blur focused element (e.g. ProseMirror) to prevent "Blocked aria-hidden on
  // an element because its descendant retained focus" - focus must move before aria-hidden is applied
  // CRITICAL: Must be before early return - hooks cannot be called conditionally (Rules of Hooks)
  useEffect(() => {
    if (useOverlayLayout && !state.isPinned && state.isOpen) {
      const active = document.activeElement as HTMLElement | null
      if (active && (active.closest('.ProseMirror') || active.closest('[contenteditable="true"]'))) {
        active.blur()
      }
    }
  }, [useOverlayLayout, state.isPinned, state.isOpen])

  // FullCalendar and other flex canvases need a layout pass after the panel opens/closes or resizes.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("app:layout-resize"))
    })
    return () => cancelAnimationFrame(frame)
  }, [state.isOpen, state.width, state.isFullscreen, state.isPinned, useOverlayLayout])

  if (!state.isOpen) return null

  const panelContent = (
    <>
      {useOverlayLayout && !state.isPinned && state.isOpen && (
        <div
          className={cn(
            "fixed inset-0 md:left-sidebar bg-black/20 z-40 transition-opacity",
            offsetForRightSettings && "md:right-right-settings"
          )}
          onClick={closeRecord}
          aria-hidden="true"
        />
      )}

      {/* Key: remount on record change only; interfaceMode is a prop, not a key */}
      <div
        key={`record-panel-${state.recordId ?? "new"}`}
        className={cn(
          useOverlayLayout
            ? cn(
                "fixed top-0 h-full z-50",
                offsetForRightSettings ? "md:right-right-settings right-0" : "right-0"
              )
            : "flex-shrink-0 border-l border-border",
          "bg-card border-border/50 flex flex-col transition-all duration-300 ease-out"
        )}
        style={{
          width: state.isOpen ? panelWidth : "0px",
          minWidth: !useOverlayLayout && state.isOpen ? `${state.width}px` : undefined,
          maxWidth: !useOverlayLayout && state.isOpen ? `${state.width}px` : undefined,
          overflow: state.isOpen ? undefined : "hidden",
          ...(offsetForRightSettings && useOverlayLayout
            ? { maxWidth: `min(${state.width}px, calc(100vw - var(--shell-sidebar-width) - ${SHELL_RIGHT_SETTINGS_WIDTH_PX}px))` }
            : {}),
        }}
      >
        {!state.isFullscreen && !isMobile && state.isOpen && (
          <div
            ref={resizeRef}
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault()
              resizeCleanupRef.current?.()
              isResizingRef.current = true
              const prevCursor = document.body.style.cursor
              const prevUserSelect = document.body.style.userSelect
              document.body.style.cursor = "col-resize"
              document.body.style.userSelect = "none"

              const handleMouseMove = (ev: MouseEvent) => {
                if (!isResizingRef.current) return
                const raw = window.innerWidth - ev.clientX
                const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, raw))
                setWidth(clamped)
              }

              const handleMouseUp = () => {
                isResizingRef.current = false
                document.body.style.cursor = prevCursor
                document.body.style.userSelect = prevUserSelect
                document.removeEventListener("mousemove", handleMouseMove)
                document.removeEventListener("mouseup", handleMouseUp)
                resizeCleanupRef.current = null
              }

              resizeCleanupRef.current = handleMouseUp
              document.addEventListener("mousemove", handleMouseMove)
              document.addEventListener("mouseup", handleMouseUp)
            }}
          />
        )}

        <div className="h-11 border-b border-border/40 flex items-center justify-between px-4 bg-muted/20 flex-shrink-0">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="p-1.5 hover:bg-muted rounded-inner transition-colors"
                title={state.history.length <= 1 && isEdit() ? "Close" : "Go back"}
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {state.recordId && (
              <button
                onClick={handleCopyLink}
                className="p-1.5 hover:bg-muted rounded-inner transition-colors"
                title="Copy link"
              >
                <Link2 className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            <button
              onClick={togglePin}
              className={`p-1.5 hover:bg-gray-100 rounded transition-colors ${
                state.isPinned ? "bg-blue-50 text-blue-600" : ""
              }`}
              title={state.isPinned ? "Unpin panel" : "Pin panel"}
            >
              {state.isPinned ? (
                <Pin className="h-4 w-4" />
              ) : (
                <PinOff className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title={state.isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {state.isFullscreen ? (
                <Minimize2 className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Maximize2 className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {!state.isPinned && !isEdit() && (
              <button
                onClick={closeRecord}
                className="p-1.5 hover:bg-muted rounded-inner transition-colors"
                title="Close"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Body: single column - RecordEditor only. Settings in shell RightSettingsPanel. */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col bg-background">
          <RecordEditor
            recordId={state.recordId}
            tableId={state.tableId ?? ""}
            mode="review"
            fieldLayoutConfig={state.fieldLayout}
            tableFields={state.tableFields}
            supabaseTableName={state.tableName}
            cascadeContext={state.cascadeContext}
            initialData={state.initialData}
            active={active}
            onSave={state.recordId === null ? (createdId) => {
              state.onRecordCreated?.(createdId ?? "")
              // Switch to edit mode so user can continue editing; subsequent changes auto-save
              if (createdId && state.tableId && state.tableName) {
                openRecord(
                  state.tableId,
                  createdId,
                  state.tableName,
                  state.modalFields,
                  state.modalLayout,
                  state.cascadeContext,
                  "edit",
                  state.onRecordDeleted,
                  state.onRecordUpdated,
                  state.fieldLayout,
                  state.onLayoutSave,
                  state.tableFields,
                  state.recordLayoutType
                )
              } else {
                closeRecord()
              }
            } : undefined}
            onDeleted={() => {
              toast({ title: "Moved to trash", description: "The record has been moved to trash." })
              state.onRecordDeleted?.()
              closeRecord()
            }}
            onRecordUpdate={() => state.onRecordUpdated?.()}
            interfaceMode={interfaceMode}
            recordLayoutType={state.recordLayoutType}
            renderHeaderActions={false}
            modalLayout={state.modalLayout}
            modalFields={state.modalFields}
            canEditLayout={!!state.onLayoutSave}
            onLayoutSave={state.onLayoutSave}
          />
        </div>
      </div>
    </>
  )

  // Inline (desktop): render in place so parent flex layout positions it. Overlay (mobile): portal to modal-root.
  const modalRoot = typeof document !== "undefined" ? document.getElementById("modal-root") : null
  if (useOverlayLayout && modalRoot) {
    return createPortal(panelContent, modalRoot)
  }
  return panelContent
}
