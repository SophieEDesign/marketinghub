"use client"

import { Button } from "@/components/ui/button"
import { Settings, Database, LayoutDashboard, FileText, FileCheck, BookOpen } from "lucide-react"
import { useRouter } from "next/navigation"
import type { InterfacePage } from "@/lib/interface/page-types-only"
import { getRequiredAnchorType, getPageTypeDefinition, validatePageAnchor } from "@/lib/interface/page-types"

interface PageSetupStateProps {
  page: InterfacePage
  isAdmin: boolean
  onOpenSettings?: () => void
}

export default function PageSetupState({ page, isAdmin, onOpenSettings }: PageSetupStateProps) {
  const router = useRouter()
  const requiredAnchor = getRequiredAnchorType(page.page_type)
  const definition = getPageTypeDefinition(page.page_type)
  
  // Validate page anchor to determine what's missing
  const validation = validatePageAnchor(
    page.page_type,
    page.saved_view_id,
    page.dashboard_layout_id,
    page.form_config_id,
    page.record_config_id
  )

  const getSetupContent = () => {
    // UNIFIED: All pages use blocks - setup is always about adding blocks
    if (page.page_type === 'content') {
      return {
        icon: BookOpen,
        title: 'This is a content page',
        description: 'Add blocks to build your page. Use text, headings, images, and links to create documentation and resources.',
        actionLabel: 'Add Blocks',
        actionType: 'edit' as const,
      }
    }
    
    if (page.page_type === 'record_view') {
      return {
        icon: FileCheck,
        title: 'This is a record view page',
        description: 'Add blocks to build your record view. Blocks can access the record context and display record-specific data.',
        actionLabel: 'Add Blocks',
        actionType: 'edit' as const,
      }
    }
    
    // Fallback (should not happen with unified architecture)
    return {
      icon: LayoutDashboard,
      title: 'Build your page',
      description: 'Add blocks to create your page content.',
      actionLabel: 'Add Blocks',
      actionType: 'edit' as const,
    }
  }

  const content = getSetupContent()
  const Icon = content.icon

  const handleAction = () => {
    if (content.actionType === 'edit') {
      // UNIFIED: All pages use block editing mode
      router.push(`/pages/${page.id}?edit=true`)
    } else {
      // For settings actions, open settings
      if (onOpenSettings) {
        onOpenSettings()
      } else {
        router.push(`/settings?tab=pages&page=${page.id}&action=configure`)
      }
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-8">
          <div className="text-4xl mb-4">🔒</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Page Not Configured
          </h3>
          <p className="text-sm text-gray-500">
            This page needs to be configured by an administrator before it can be used.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md p-8">
        <div className="flex justify-center mb-4">
          <Icon className="h-12 w-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {content.title}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          {content.description}
        </p>
        <Button
          onClick={handleAction}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Settings className="h-4 w-4 mr-2" />
          {content.actionLabel}
        </Button>
      </div>
    </div>
  )
}

