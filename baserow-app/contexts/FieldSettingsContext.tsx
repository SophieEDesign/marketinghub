"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

export interface FieldSettingsState {
  fieldId: string | null
  tableId: string | null
  /** When true, FieldSettingsDrawer renders read-only (permissions.mode === 'view') */
  readOnly?: boolean
}

interface FieldSettingsContextType {
  /** Currently selected field for schema editing. */
  state: FieldSettingsState
  /** Open FieldSettingsDrawer for the given field. */
  openFieldSettings: (fieldId: string, tableId: string, readOnly?: boolean) => void
  /** Close FieldSettingsDrawer. */
  closeFieldSettings: () => void
}

const FieldSettingsContext = createContext<FieldSettingsContextType | undefined>(undefined)

export function FieldSettingsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FieldSettingsState>({
    fieldId: null,
    tableId: null,
  })

  const openFieldSettings = useCallback((fieldId: string, tableId: string, readOnly?: boolean) => {
    setState({ fieldId, tableId, readOnly })
  }, [])

  const closeFieldSettings = useCallback(() => {
    setState({ fieldId: null, tableId: null })
  }, [])

  return (
    <FieldSettingsContext.Provider
      value={{ state, openFieldSettings, closeFieldSettings }}
    >
      {children}
    </FieldSettingsContext.Provider>
  )
}

export function useFieldSettings() {
  const context = useContext(FieldSettingsContext)
  if (context === undefined) {
    throw new Error("useFieldSettings must be used within FieldSettingsProvider")
  }
  return context
}
