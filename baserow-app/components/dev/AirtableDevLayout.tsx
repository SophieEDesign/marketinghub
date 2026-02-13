"use client"

import type { DevModeShellData } from "@/lib/dev-mode-data"
import DevRecordPanel from "./DevRecordPanel"
import Sidebar from "./Sidebar"
import TopToolbar from "./TopToolbar"
import MainContent from "./MainContent"

interface AirtableDevLayoutProps {
  shellData: DevModeShellData
}

export default function AirtableDevLayout({ shellData }: AirtableDevLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar shellData={shellData} />
      <div className="flex-1 flex flex-row overflow-hidden min-w-0 gap-0">
        <div className="flex-1 flex flex-col overflow-hidden min-h-0 min-w-0">
          <TopToolbar />
          <main className="flex-1 min-h-0 overflow-auto">
            <MainContent shellData={shellData} />
          </main>
        </div>
        <DevRecordPanel />
      </div>
    </div>
  )
}
