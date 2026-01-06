"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/client"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import FormDataSettings from "./settings/FormDataSettings"
import FormAppearanceSettings from "./settings/FormAppearanceSettings"

interface FormPageSettingsPanelProps {
  page: InterfacePage | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

interface Table {
  id: string
  name: string
}

interface TableField {
  id: string
  name: string
  type: string
}

export default function FormPageSettingsPanel({
  page,
  isOpen,
  onClose,
  onUpdate,
}: FormPageSettingsPanelProps) {
  const [tables, setTables] = useState<Table[]>([])
  const [tableFields, setTableFields] = useState<TableField[]>([])
  const [selectedTableId, setSelectedTableId] = useState<string>("")
  const [config, setConfig] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && page) {
      loadInitialData()
    } else if (!isOpen) {
      // Reset state when panel closes
      setConfig({})
      setSelectedTableId("")
      setTableFields([])
    }
  }, [isOpen, page])

  async function loadInitialData() {
    if (!page) return

    setLoading(true)
    try {
      const supabase = createClient()

      // Load tables
      const { data: tablesData } = await supabase
        .from('tables')
        .select('id, name')
        .order('name')
      setTables(tablesData || [])

      // Load page config
      const pageConfig = page.config || {}
      setConfig(pageConfig)

      // Get table ID from form_config_id or base_table
      const tableId = page.form_config_id || page.base_table || ""
      if (tableId) {
        setSelectedTableId(tableId)
        await loadTableFields(tableId)
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadTableFields(tableId: string) {
    try {
      const supabase = createClient()
      const fields = await loadTableFieldsSync(tableId)
      setTableFields(fields)
    } catch (error) {
      console.error('Error loading table fields:', error)
      setTableFields([])
    }
  }

  async function loadTableFieldsSync(tableId: string): Promise<TableField[]> {
    try {
      const supabase = createClient()
      const { data: fieldsData } = await supabase
        .from('table_fields')
        .select('id, name, type')
        .eq('table_id', tableId)
        .order('position', { ascending: true })
      return (fieldsData || []) as TableField[]
    } catch (error) {
      console.error('Error loading table fields:', error)
      return []
    }
  }

  async function handleTableChange(tableId: string) {
    setSelectedTableId(tableId)
    await loadTableFields(tableId)
    
    // Update config with new table
    const newConfig = {
      ...config,
      table_id: tableId,
    }
    setConfig(newConfig)
    await saveConfig(newConfig, tableId)
  }

  async function handleConfigUpdate(updates: Partial<any>) {
    const newConfig = {
      ...config,
      ...updates,
    }
    setConfig(newConfig)
    await saveConfig(newConfig, selectedTableId)
  }

  async function saveConfig(newConfig: any, tableId?: string) {
    if (!page) return

    setSaving(true)
    try {
      const supabase = createClient()

      // Update interface_pages table
      const updateData: any = {
        config: newConfig,
        updated_at: new Date().toISOString(),
      }

      // Update form_config_id if table changed
      if (tableId && tableId !== page.form_config_id) {
        updateData.form_config_id = tableId
        updateData.base_table = tableId
      }

      const { error } = await supabase
        .from('interface_pages')
        .update(updateData)
        .eq('id', page.id)

      if (error) {
        console.error('Error saving form config:', error)
        throw error
      }

      // Trigger update callback
      onUpdate()
    } catch (error) {
      console.error('Error saving form configuration:', error)
      alert('Failed to save form settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!page) return null

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[500px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Form Settings</SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Loading...</div>
          </div>
        ) : (
          <Tabs defaultValue="data" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
            </TabsList>

            <TabsContent value="data" className="mt-6">
              <FormDataSettings
                config={config}
                tables={tables}
                fields={tableFields}
                onUpdate={handleConfigUpdate}
                onTableChange={handleTableChange}
              />
            </TabsContent>

            <TabsContent value="appearance" className="mt-6">
              <FormAppearanceSettings
                config={config}
                onUpdate={handleConfigUpdate}
              />
            </TabsContent>
          </Tabs>
        )}

        {saving && (
          <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg">
            Saving...
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

