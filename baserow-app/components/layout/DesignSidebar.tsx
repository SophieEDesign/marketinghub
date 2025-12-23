"use client"

import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { FileText } from "lucide-react"
import FieldBuilderPanel from "./FieldBuilderPanel"
import CSVImportModal from "./CSVImportModal"

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
  const [importModalOpen, setImportModalOpen] = useState(false)

  return (
    <>
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent className="w-[380px] sm:w-[380px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold text-gray-900">
              Design: {tableName}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-4">
            <FieldBuilderPanel
              tableId={tableId}
              supabaseTableName={supabaseTableName}
              onFieldsUpdated={onFieldsUpdated}
            />
            
            <div className="pt-4 border-t">
              <Button
                onClick={() => setImportModalOpen(true)}
                variant="outline"
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CSVImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        tableId={tableId}
        tableName={tableName}
        supabaseTableName={supabaseTableName}
        onImportComplete={onFieldsUpdated}
      />
    </>
  )
}
