'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { 
  Filter, 
  ArrowUpDown, 
  Group, 
  Eye, 
  Share2, 
  Plus, 
  Search,
  Grid3x3,
  Layout,
  Calendar,
  FileText,
  Settings
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import dynamic from 'next/dynamic'

// Dynamically import components from baserow-app to avoid path issues
// Using absolute path from project root
const FieldBuilderPanel = dynamic(
  () => import('../../../baserow-app/components/layout/FieldBuilderPanel').catch(() => {
    // Fallback: return a placeholder if import fails
    return { default: () => <div>Field Builder not available</div> }
  }),
  { ssr: false }
)
const CSVImportPanel = dynamic(
  () => import('../../../baserow-app/components/layout/CSVImportPanel').catch(() => {
    // Fallback: return a placeholder if import fails
    return { default: () => <div>CSV Import not available</div> }
  }),
  { ssr: false }
)
import { createClientSupabaseClient } from '@/lib/supabase'
import type { ViewField, ViewFilter, ViewSort } from '@/types/database'

interface ViewPageClientProps {
  tableId: string
  tableName: string
  supabaseTableName: string
  viewId: string
  viewName: string
  viewType: 'grid' | 'kanban' | 'calendar' | 'form' | 'gallery' | 'page'
  children: React.ReactNode
}

export default function ViewPageClient({
  tableId,
  tableName,
  supabaseTableName,
  viewId,
  viewName,
  viewType,
  children,
}: ViewPageClientProps) {
  const router = useRouter()
  const [designSidebarOpen, setDesignSidebarOpen] = useState(false)

  async function handleNewRecord() {
    const supabase = createClientSupabaseClient()
    const { createRowClient } = await import('@/lib/data')
    await createRowClient(supabase, tableId, {})
    router.refresh()
  }

  function handleFieldsUpdated() {
    router.refresh()
  }

  function getViewIcon(type: string) {
    switch (type) {
      case 'grid': return <Grid3x3 className="h-4 w-4" />
      case 'kanban': return <Layout className="h-4 w-4" />
      case 'calendar': return <Calendar className="h-4 w-4" />
      case 'form': return <FileText className="h-4 w-4" />
      default: return <Grid3x3 className="h-4 w-4" />
    }
  }

  // Don't show toolbar for interface pages
  if (viewType === 'page' || viewType === 'gallery') {
    return <div className="w-full h-full">{children}</div>
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ViewTopBar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <h1 className="text-base font-semibold text-gray-900 truncate">{viewName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setDesignSidebarOpen(true)}
            size="sm"
            variant="outline"
            className="h-8 px-3 text-sm font-medium border-gray-300 hover:bg-gray-50"
          >
            <Settings className="h-4 w-4 mr-1.5" />
            Design
          </Button>
          <Button
            onClick={() => setDesignSidebarOpen(true)}
            size="sm"
            variant="outline"
            className="h-8 px-3 text-sm font-medium border-gray-300 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Field
          </Button>
          <Button
            onClick={handleNewRecord}
            size="sm"
            className="h-8 px-3 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Record
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {children}
      </div>

      {/* DesignSidebar */}
      <Sheet open={designSidebarOpen} onOpenChange={setDesignSidebarOpen}>
        <SheetContent className="w-[380px] sm:w-[380px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-semibold text-gray-900">
              Design: {tableName}
            </SheetTitle>
          </SheetHeader>
          <Tabs defaultValue="fields" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fields">Fields</TabsTrigger>
              <TabsTrigger value="import">Import CSV</TabsTrigger>
            </TabsList>
            <TabsContent value="fields" className="mt-4">
              <FieldBuilderPanel
                tableId={tableId}
                supabaseTableName={supabaseTableName}
                onFieldsUpdated={handleFieldsUpdated}
              />
            </TabsContent>
            <TabsContent value="import" className="mt-4">
              <CSVImportPanel
                tableId={tableId}
                tableName={tableName}
                supabaseTableName={supabaseTableName}
                onImportComplete={handleFieldsUpdated}
              />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  )
}
