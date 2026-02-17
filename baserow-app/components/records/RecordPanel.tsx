"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { X, Pin, PinOff, Maximize2, Minimize2, Link2, ChevronLeft } from "lucide-react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { useUIMode } from "@/contexts/UIModeContext"
import { useToast } from "@/components/ui/use-toast"
import RecordEditor from "./RecordEditor"
import ModalRightSettingsPanel from "@/components/interface/ModalRightSettingsPanel"
import { useIsMobile } from "@/hooks/useResponsive"

const MIN_WIDTH = 320
const MAX_WIDTH = 1200

export default function RecordPanel() {
  const {
    state,
    closeRecord,
    setWidth,
    togglePin,
    toggleFullscreen,
    goBack,
  } = useRecordPanel()
  const { enterRecordLayoutEdit, exitRecordLayoutEdit, uiMode } = useUIMode()
  const { toast } = useToast()
  const router = useRouter()
  const isMobile = useIsMobile()

  // Sync UIMode with RecordPanel edit state so RightSettingsPanel shows when editing record layout
  useEffect(() => {
    if (state.isOpen && state.interfaceMode === "edit") {
      if (uiMode === "view") {
        enterRecordLayoutEdit()
      }
    } else if (uiMode === "recordLayoutEdit") {
      exitRecordLayoutEdit()
    }
  }, [state.isOpen, state.interfaceMode, uiMode, enterRecordLayoutEdit, exitRecordLayoutEdit])
  const resizeRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)
  const resizeCleanupRef = useRef<null | (() => void)>(null)

  const active = Boolean(state.isOpen && state.tableId)
  const interfaceMode = state.interfaceMode ?? "view"

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
    } else {
      goBack()
    }
  }, [state.isFullscreen, router, goBack])

  const useOverlayLayout = true
  const panelWidth = state.isFullscreen ? "100%" : `${state.width}px`
  const canGoBack = state.isFullscreen || state.history.length > 1

  useEffect(() => {
    if (!state.isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !state.isPinned) closeRecord()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [state.isOpen, state.isPinned, closeRecord])

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.()
      resizeCleanupRef.current = null
      isResizingRef.current = false
    }
  }, [])

  if (!state.isOpen && useOverlayLayout) return null

  return (
    <>
      {useOverlayLayout && !state.isPinned && state.isOpen && (
        <div
          className="fixed inset-0 md:left-64 bg-black/20 z-40 transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Key: remount on record change only; interfaceMode is a prop, not a key */}
      <div
        key={`record-panel-${state.recordId}`}
        className={`${
          useOverlayLayout
            ? "fixed right-0 top-0 h-full z-50"
            : "flex-shrink-0 border-l border-gray-200"
        } bg-white shadow-xl flex flex-col transition-all duration-300 ease-out`}
        style={{
          width: state.isOpen ? panelWidth : "0px",
          transform: useOverlayLayout && !state.isOpen ? "translateX(100%)" : "none",
          minWidth: !useOverlayLayout && state.isOpen ? `${state.width}px` : undefined,
          maxWidth: !useOverlayLayout && state.isOpen ? `${state.width}px` : undefined,
          overflow: state.isOpen ? undefined : "hidden",
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

        <div className="h-10 border-b border-gray-200 flex items-center justify-between px-4 bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Go back"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            {state.recordId && (
              <button
                onClick={handleCopyLink}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Copy link"
              >
                <Link2 className="h-4 w-4 text-gray-600" />
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
                <PinOff className="h-4 w-4 text-gray-600" />
              )}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              title={state.isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {state.isFullscreen ? (
                <Minimize2 className="h-4 w-4 text-gray-600" />
              ) : (
                <Maximize2 className="h-4 w-4 text-gray-600" />
              )}
            </button>
            {!state.isPinned && (
              <button
                onClick={closeRecord}
                className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                title="Close"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        {/* Body: flex row - RecordEditor (scrollable) + ModalRightSettingsPanel (when edit mode) */}
        <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col">
            <RecordEditor
            recordId={state.recordId}
            tableId={state.tableId ?? ""}
            mode="review"
            fieldLayoutConfig={state.fieldLayout}
            tableFields={state.tableFields}
            supabaseTableName={state.tableName}
            cascadeContext={state.cascadeContext}
            active={active}
            onDeleted={() => {
              toast({ title: "Record deleted", description: "The record has been removed." })
              state.onRecordDeleted?.()
              closeRecord()
            }}
            interfaceMode={interfaceMode}
            renderHeaderActions={false}
            modalLayout={state.modalLayout}
            modalFields={state.modalFields}
            canEditLayout={!!state.onLayoutSave}
            onLayoutSave={state.onLayoutSave}
          />
          </div>
          {state.isOpen &&
            interfaceMode === "edit" &&
            state.onLayoutSave &&
            state.recordId &&
            state.tableId && (
              <ModalRightSettingsPanel />
            )}
        </div>
      </div>
    </>
  )
}
