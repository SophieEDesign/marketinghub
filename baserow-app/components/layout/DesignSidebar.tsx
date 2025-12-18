"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import FieldBuilderPanel from "./FieldBuilderPanel"
import CSVImportPanel from "./CSVImportPanel"

interface DesignSidebarProps {
  isOpen: boolean
  onClose: () => void
  tableId: string
  tableName: string
  supabaseTableName: string
  onFieldsUpdated: () => void
}

export default function DesignSidebar({
  isOpen,
  onClose,
  tableId,
  tableName,
  supabaseTableName,
  onFieldsUpdated,
}: DesignSidebarProps) {
  const [activeTab, setActiveTab] = useState("fields")

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[380px] sm:w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold text-gray-900">
            Design: {tableName}
          </SheetTitle>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="import">Import CSV</TabsTrigger>
          </TabsList>

          <TabsContent value="fields" className="mt-4">
            <FieldBuilderPanel
              tableId={tableId}
              supabaseTableName={supabaseTableName}
              onFieldsUpdated={onFieldsUpdated}
            />
          </TabsContent>

          <TabsContent value="import" className="mt-4">
            <CSVImportPanel
              tableId={tableId}
              tableName={tableName}
              supabaseTableName={supabaseTableName}
              onImportComplete={onFieldsUpdated}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
