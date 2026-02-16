"use client"

import { useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { X, Pin, PinOff, Maximize2, Minimize2, Copy as CopyIcon, ChevronLeft } from "lucide-react"
import { useRecordPanel } from "@/contexts/RecordPanelContext"
import { useRecordModal } from "@/contexts/RecordModalContext"
import { useToast } from "@/components/ui/use-toast"
import RecordEditor from "./RecordEditor"
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
  const { openRecordModal } = useRecordModal()
  const { toast } = useToast()
  const router = useRouter()
  const isMobile = useIsMobile()
  const resizeRef = useRef<HTMLDivElement>(null)
  const isResizingRef = useRef(false)
  const resizeCleanupRef = useRef<null | (() => void)>(null)

  const active = Boolean(state.isOpen && state.tableId && state.recordId)
  const interfaceMode = state.interfaceMode ?? "view"

  const handleOpenModal = useCallback(() => {
    if (!state.tableId || !state.recordId) return
    closeRecord()
    openRecordModal({
      tableId: state.tableId,
      recordId: state.recordId,
      supabaseTableName: state.tableName ?? undefined,
      modalFields: state.modalFields,
      modalLayout: state.modalLayout,
      fieldLayout: state.fieldLayout,
      cascadeContext: state.cascadeContext,
      interfaceMode,
      onDeleted: state.onRecordDeleted,
    })
  }, [
    state.tableId,
    state.recordId,
    state.tableName,
    state.modalFields,
    state.modalLayout,
    state.fieldLayout,
    state.cascadeContext,
    state.onRecordDeleted,
    interfaceMode,
    closeRecord,
    openRecordModal,
  ])

  const handleCopyLink = useCallback(() => {
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
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={closeRecord}
        />
      )}

      <div
        key={`record-panel-${state.recordId}-${interfaceMode}`}
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

        <div className="h-10 border-b border-gray-200 flex items-center justify-between px-4 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {canGoBack && (
              <button
                onClick={handleBack}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Go back"
              >
                <ChevronLeft className="h-4 w-4 text-gray-600" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyLink}
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
              title="Copy link"
            >
              <CopyIcon className="h-4 w-4 text-gray-600" />
            </button>
            <button
              onClick={togglePin}
              className={`p-1.5 hover:bg-gray-200 rounded transition-colors ${
                state.isPinned ? "bg-blue-100 text-blue-600" : ""
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
              className="p-1.5 hover:bg-gray-200 rounded transition-colors"
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
                className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                title="Close"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <RecordEditor
            recordId={state.recordId}
            tableId={state.tableId ?? ""}
            mode="review"
            fieldLayoutConfig={state.fieldLayout}
            supabaseTableName={state.tableName}
            cascadeContext={state.cascadeContext}
            active={active}
            onDeleted={() => {
              toast({ title: "Record deleted", description: "The record has been removed." })
              state.onRecordDeleted?.()
              closeRecord()
            }}
            onOpenModal={handleOpenModal}
            interfaceMode={interfaceMode}
            renderHeaderActions={false}
            modalLayout={state.modalLayout}
            modalFields={state.modalFields}
          />
        </div>
      </div>
    </>
  )
}
