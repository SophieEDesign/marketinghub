"use client"

import { RecordPanelProvider } from "@/contexts/RecordPanelContext"
import { EditModeProvider } from "@/contexts/EditModeContext"
import { SidebarModeProvider } from "@/contexts/SidebarModeContext"
import { UIStateProvider } from "@/contexts/UIStateContext"
import type { DevModeShellData } from "@/lib/dev-mode-data"
import AirtableDevLayout from "./AirtableDevLayout"

interface AirtableDevModeClientProps {
  shellData: DevModeShellData
}

export default function AirtableDevModeClient({ shellData }: AirtableDevModeClientProps) {
  return (
    <UIStateProvider>
      <EditModeProvider>
        <SidebarModeProvider>
          <RecordPanelProvider>
            <AirtableDevLayout shellData={shellData} />
          </RecordPanelProvider>
        </SidebarModeProvider>
      </EditModeProvider>
    </UIStateProvider>
  )
}
