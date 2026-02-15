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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'RightSettingsPanelDataContext.tsx:setData',message:'setData_CALLED',data:{hasBlocks:!!updates?.blocks,hasSelectedBlock:!!updates?.selectedBlock},timestamp:Date.now(),hypothesisId:'H4'})}).catch(()=>{})
    // #endregion
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
