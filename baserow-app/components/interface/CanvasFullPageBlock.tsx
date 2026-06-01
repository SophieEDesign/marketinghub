"use client"

import BlockRenderer from "@/components/interface/BlockRenderer"
import BlockAppearanceWrapper from "@/components/interface/BlockAppearanceWrapper"
import RecordPreviewSurface from "@/components/interface/record-preview/RecordPreviewSurface"
import {
  builderBlockFrameClassName,
} from "@/components/interface/primitives/BuilderBlockFrame"
import { shouldShowBlockChromeToolbar } from "@/lib/interface/canvas-edit-chrome"
import type { BlockDefinition } from "@/lib/interface/registry"
import type { PageBlock, RecordContext } from "@/lib/interface/types"
import type { FilterTree } from "@/lib/filters/canonical-model"
import type { FilterConfig } from "@/lib/interface/filters"
import { Settings2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CanvasFullPageBlockProps {
  block: PageBlock
  isEditing: boolean
  isBlockSelected: boolean
  isRail: boolean
  showPreview: boolean
  fullPageDef: BlockDefinition | null
  onConfigureLeftPanel?: () => void
  onShowRecordSettings?: () => void
  recordId?: string | null
  recordTableId?: string | null
  pageId?: string | null
  pageTableId?: string | null
  interfaceMode: "view" | "edit"
  onBlockUpdate?: (blockId: string, config: Partial<PageBlock["config"]>) => void
  mode?: "view" | "edit" | "review"
  getFiltersForBlock: (blockId: string, tableId?: string | null) => FilterConfig[]
  getFilterTreeForBlock: (blockId: string, tableId?: string | null) => FilterTree | undefined
  onRecordClick?: (recordId: string, tableId?: string) => void
  onRecordContextChange?: (context: RecordContext) => void
  aggregateData: Record<string, { data: unknown; error: string | null; isLoading: boolean }>
  pageShowAddRecord?: boolean
  pageEditable?: boolean
  editableFieldNames?: string[]
  pageShowFieldNames?: boolean
  hideEditButton?: boolean
  allBlocks: PageBlock[]
  editingBlockCanvasId?: string | null
  layoutSettings?: { rowHeight?: number }
  openRecordInEditModeForBlock?: { blockId: string; recordId: string; tableId: string } | null
  onFieldBlockSelect?: (blockId: string, fieldId: string) => void
  selectedFieldBlockId?: string | null
  onBlockClick?: (blockId: string) => void
  onBlockDelete?: (blockId: string) => void
}

export default function CanvasFullPageBlock({
  block,
  isEditing,
  isBlockSelected,
  isRail,
  showPreview,
  fullPageDef,
  onConfigureLeftPanel,
  onShowRecordSettings,
  recordId,
  recordTableId,
  pageId,
  pageTableId,
  interfaceMode,
  onBlockUpdate,
  mode,
  getFiltersForBlock,
  getFilterTreeForBlock,
  onRecordClick,
  onRecordContextChange,
  aggregateData,
  pageShowAddRecord,
  pageEditable,
  editableFieldNames,
  pageShowFieldNames,
  hideEditButton,
  allBlocks,
  editingBlockCanvasId,
  layoutSettings,
  openRecordInEditModeForBlock,
  onFieldBlockSelect,
  selectedFieldBlockId,
  onBlockClick,
  onBlockDelete,
}: CanvasFullPageBlockProps) {
  const showChromeToolbar = shouldShowBlockChromeToolbar({
    isEditing,
    isFullPageMode: true,
    isThisFullPageBlock: true,
    isBlockSelected,
  })

  const blockRenderer = (
    <BlockRenderer
      block={block}
      isEditing={isEditing && !block.config?.locked}
      interfaceMode={interfaceMode}
      onUpdate={onBlockUpdate}
      isLocked={block.config?.locked || false}
      pageTableId={pageTableId}
      pageId={pageId}
      recordId={recordId}
      recordTableId={recordTableId}
      mode={mode}
      filters={getFiltersForBlock(block.id, block.config?.table_id || pageTableId)}
      filterTree={getFilterTreeForBlock(block.id, block.config?.table_id || pageTableId) as FilterTree}
      onRecordClick={onRecordClick}
      onRecordContextChange={onRecordContextChange}
      aggregateData={aggregateData[block.id]}
      pageShowAddRecord={pageShowAddRecord}
      pageEditable={pageEditable}
      editableFieldNames={editableFieldNames}
      pageShowFieldNames={pageShowFieldNames}
      hideEditButton={hideEditButton}
      allBlocks={allBlocks}
      onEphemeralHeightDelta={() => {}}
      rowHeight={Number(layoutSettings?.rowHeight) || 30}
      isEditingCanvas={editingBlockCanvasId === block.id}
      isFullPage
      openRecordInEditModeForBlock={openRecordInEditModeForBlock}
    />
  )

  return (
    <div
      className={cn(
        builderBlockFrameClassName({
          isEditing,
          isSelected: isBlockSelected,
          isFullPageLayout: true,
        }),
        "group relative flex h-full min-h-0 w-full flex-1 flex-col"
      )}
    >
      {isEditing ? (
        <div
          data-block-chrome
          className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-2 p-1.5"
        >
          <div className="pointer-events-none min-w-[30px]" aria-hidden />
          <div
            className={cn(
              "pointer-events-auto flex items-center gap-1 transition-all duration-200",
              showChromeToolbar ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            {isEditing && !isBlockSelected ? (
              <span className="mr-1 hidden sm:inline-flex rounded-md border border-border/50 bg-card/95 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm">
                Click block to edit
              </span>
            ) : null}
            {onBlockClick ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onBlockClick(block.id)
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 shadow-sm hover:border-blue-400 hover:bg-gray-50"
                title="Block settings"
                aria-label="Block settings"
              >
                <Settings2 className="h-4 w-4" />
              </button>
            ) : null}
            {onBlockDelete ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onBlockDelete(block.id)
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-300 bg-white text-red-600 shadow-sm hover:border-red-400 hover:bg-red-50"
                title="Delete block"
                aria-label="Delete block"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div
        className={cn(
          "block-content relative z-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg",
          block.config?.locked && "pointer-events-none opacity-75"
        )}
        data-block-id={block.id}
      >
        {isRail ? (
          <div className="flex h-full min-h-0 w-full min-w-0 max-w-full overflow-hidden">
            <div
              className="relative flex h-full shrink-0 flex-col overflow-hidden border-r"
              style={{ width: `clamp(280px, 28vw, ${fullPageDef?.fullPageMaxWidth ?? 360}px)` }}
            >
              <BlockAppearanceWrapper
                block={block}
                isFullPage
                isRail
                isLayoutEditing={isEditing}
                className={isEditing ? "pointer-events-auto" : ""}
              >
                <div className="h-full min-h-0 w-full overflow-hidden">{blockRenderer}</div>
              </BlockAppearanceWrapper>
            </div>
            <div className="h-full min-h-0 min-w-0 flex-1 overflow-hidden">
              {showPreview && recordTableId && recordId ? (
                <RecordPreviewSurface
                  tableId={recordTableId}
                  recordId={recordId}
                  pageId={pageId}
                  isEditing={isEditing}
                  pageEditable={
                    block.type === "record_context"
                      ? block.config?.allow_editing !== false
                      : pageEditable
                  }
                  blockConfig={block.config}
                  blockId={block.id}
                  onBlockUpdate={onBlockUpdate}
                  onShowRecordSettings={onShowRecordSettings}
                  onFieldBlockSelect={onFieldBlockSelect}
                  selectedFieldBlockId={selectedFieldBlockId}
                />
              ) : (
                <div className="h-full min-h-0 flex-1 bg-background" />
              )}
            </div>
          </div>
        ) : (
          <BlockAppearanceWrapper
            block={block}
            isFullPage
            isLayoutEditing={isEditing}
            className={cn("flex min-h-0 flex-1 flex-col", isEditing ? "pointer-events-auto" : "")}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{blockRenderer}</div>
          </BlockAppearanceWrapper>
        )}
      </div>
    </div>
  )
}
