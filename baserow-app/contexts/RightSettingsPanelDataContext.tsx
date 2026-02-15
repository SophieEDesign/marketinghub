"use client"

import {
  createContext,
  useContext,
  useState,
  useCallback,
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
      setDataState(null)
      return
    }
    setDataState((prev) => ({
      ...defaultData,
      ...prev,
      ...updates,
    }))
  }, [])

  return (
    <RightSettingsPanelDataContext.Provider value={{ data, setData }}>
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
