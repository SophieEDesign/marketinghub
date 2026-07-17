"use client"

import { useState, useMemo, useCallback } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import FieldsTab from "./design/FieldsTab"
import ViewsTab from "./design/ViewsTab"
import PermissionsTab from "./design/PermissionsTab"
import ImportCSVTab from "./design/ImportCSVTab"
import { VIEWS_ENABLED } from "@/lib/featureFlags"

interface DesignSidebarProps {
  isOpen: boolean
  onClose: () => void
  tableId: string
  tableName: string
  supabaseTableName: string
  onFieldsUpdated: () => void
  hideViewsTab?: boolean // If true, hide the Views tab
}

export default function DesignSidebar({
  isOpen,
  onClose,
  tableId,
  tableName,
  supabaseTableName,
  onFieldsUpdated,
  hideViewsTab = false,
}: DesignSidebarProps) {
  const [activeTab, setActiveTab] = useState("fields")

  // Memoize callback to prevent re-renders
  const handleFieldsUpdated = useCallback(() => {
    onFieldsUpdated()
  }, [onFieldsUpdated])

  // RULE: Views are currently not used; force-hide Views tab unless explicitly enabled.
  const effectiveHideViewsTab = hideViewsTab || !VIEWS_ENABLED

  // Calculate number of tabs for grid layout
  const tabCount = effectiveHideViewsTab ? 3 : 4
  const gridCols = effectiveHideViewsTab ? "grid-cols-3" : "grid-cols-4"

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[380px] sm:w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold text-gray-900">
            Design: {tableName}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className={`grid w-full ${gridCols}`}>
            <TabsTrigger value="fields" className="text-xs">Fields</TabsTrigger>
            {!effectiveHideViewsTab && (
              <TabsTrigger value="views" className="text-xs">Views</TabsTrigger>
            )}
            <TabsTrigger value="permissions" className="text-xs">Permissions</TabsTrigger>
            <TabsTrigger value="import" className="text-xs">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="mt-4">
            <FieldsTab
              tableId={tableId}
              supabaseTableName={supabaseTableName}
              onFieldsUpdated={handleFieldsUpdated}
            />
          </TabsContent>

          {!effectiveHideViewsTab && (
            <TabsContent value="views" className="mt-4">
              <ViewsTab
                tableId={tableId}
                tableName={tableName}
              />
            </TabsContent>
          )}

          <TabsContent value="permissions" className="mt-4">
            <PermissionsTab
              tableId={tableId}
              tableName={tableName}
            />
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <ImportCSVTab
              tableId={tableId}
              tableName={tableName}
              supabaseTableName={supabaseTableName}
              onImportComplete={handleFieldsUpdated}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
