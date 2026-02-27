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
import type { PageConfig } from "@/lib/interface/page-config"

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
  /** Page config for record_view (title field, permissions, appearance, user actions). When provided with onPageConfigSave, RecordLayoutSettings shows Data/Permissions/Appearance/User actions sections. */
  pageConfig?: PageConfig | Record<string, unknown> | null
  /** Save page config updates (record_view only). */
  onPageConfigSave?: ((updates: Partial<PageConfig>) => Promise<void>) | null
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
  pageConfig: null,
  onPageConfigSave: null,
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
          prev.tableFields === next.tableFields && prev.isEditing === next.isEditing &&
          prev.pageConfig === next.pageConfig && prev.onPageConfigSave === next.onPageConfigSave) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'41b24e'},body:JSON.stringify({sessionId:'41b24e',location:'RightSettingsPanelDataContext.tsx:setData',message:'SKIP (guard)',data:{hypothesisId:'A'},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        return prev
      }
      // #region agent log
      const changed: string[] = []
      if (prev?.blocks !== next.blocks) changed.push('blocks')
      if (prev?.selectedBlock !== next.selectedBlock) changed.push('selectedBlock')
      if (prev?.onBlockSave !== next.onBlockSave) changed.push('onBlockSave')
      if (prev?.onBlockMoveToTop !== next.onBlockMoveToTop) changed.push('onBlockMoveToTop')
      if (prev?.onBlockMoveToBottom !== next.onBlockMoveToBottom) changed.push('onBlockMoveToBottom')
      if (prev?.onBlockLock !== next.onBlockLock) changed.push('onBlockLock')
      if (prev?.onLayoutSave !== next.onLayoutSave) changed.push('onLayoutSave')
      fetch('http://127.0.0.1:7242/ingest/7e9b68cb-9457-4ad2-a6ab-af4806759e7a',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'41b24e'},body:JSON.stringify({sessionId:'41b24e',location:'RightSettingsPanelDataContext.tsx:setData',message:'UPDATE',data:{changed,hypothesisId:'A'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
