"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  ReactNode,
} from "react"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import type { PageBlock, BlockConfig } from "@/lib/interface/types"
import type { TableField } from "@/types/fields"
import type { FieldLayoutItem } from "@/lib/interface/field-layout-utils"

export interface RightSettingsPanelData {
  page: InterfacePage | null
  blocks: PageBlock[]
  selectedBlock: PageBlock | null
  onPageUpdate: () => void
  onBlockSave: (blockId: string, config: Partial<BlockConfig>) => void
  onBlockMoveToTop?: (blockId: string) => void
  onBlockMoveToBottom?: (blockId: string) => void
  onBlockLock?: (blockId: string, locked: boolean) => void
  pageTableId: string | null
  recordId: string | null
  recordTableId: string | null
  fieldLayout: FieldLayoutItem[]
  onLayoutSave: ((layout: FieldLayoutItem[]) => void) | ((layout: FieldLayoutItem[]) => Promise<void>) | null
  tableFields: TableField[]
  /** When true, settings panel is visible. Panel only shows in edit mode. */
  isEditing?: boolean
}

interface RightSettingsPanelDataContextType {
  data: RightSettingsPanelData | null
  setData: (updates: Partial<RightSettingsPanelData> | null) => void
}

const defaultData: RightSettingsPanelData = {
  page: null,
  blocks: [],
  selectedBlock: null,
  onPageUpdate: () => {},
  onBlockSave: () => {},
  pageTableId: null,
  recordId: null,
  recordTableId: null,
  fieldLayout: [],
  onLayoutSave: null,
  tableFields: [],
}

const RightSettingsPanelDataContext =
  createContext<RightSettingsPanelDataContextType | undefined>(undefined)

export function RightSettingsPanelDataProvider({ children }: { children: ReactNode }) {
  const [data, setDataState] = useState<RightSettingsPanelData | null>(null)

  const setData = useCallback((updates: Partial<RightSettingsPanelData> | null) => {
    if (updates === null) {
      setDataState((prev) => (prev === null ? prev : null))
      return
    }
    setDataState((prev) => {
      const next = { ...defaultData, ...prev, ...updates }
      // CRITICAL: Skip update if key references unchanged - prevents render loop from redundant setData calls
      if (prev && prev.page === next.page && prev.blocks === next.blocks && prev.selectedBlock === next.selectedBlock &&
          prev.onPageUpdate === next.onPageUpdate && prev.onBlockSave === next.onBlockSave &&
          prev.onBlockMoveToTop === next.onBlockMoveToTop && prev.onBlockMoveToBottom === next.onBlockMoveToBottom &&
          prev.onBlockLock === next.onBlockLock && prev.pageTableId === next.pageTableId &&
          prev.recordId === next.recordId && prev.recordTableId === next.recordTableId &&
          prev.fieldLayout === next.fieldLayout && prev.onLayoutSave === next.onLayoutSave &&
          prev.tableFields === next.tableFields && prev.isEditing === next.isEditing) {
        return prev
      }
      return next
    })
  }, [])

  const contextValue = useMemo(() => ({ data, setData }), [data, setData])

  return (
    <RightSettingsPanelDataContext.Provider value={contextValue}>
      {children}
    </RightSettingsPanelDataContext.Provider>
  )
}

export function useRightSettingsPanelData() {
  const context = useContext(RightSettingsPanelDataContext)
  if (context === undefined) {
    throw new Error(
      "useRightSettingsPanelData must be used within RightSettingsPanelDataProvider"
    )
  }
  return context
}
