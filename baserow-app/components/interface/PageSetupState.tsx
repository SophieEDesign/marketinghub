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
    // Content pages have a special setup message
    if (page.page_type === 'content') {
      return {
        icon: BookOpen,
        title: 'This is a content page',
        description: 'Add blocks to build your page. Use text, headings, images, and links to create documentation and resources.',
        actionLabel: 'Add Blocks',
        actionType: 'edit' as const,
      }
    }
    
    // Check if page needs base_table (for form/record_review pages)
    const needsBaseTable = definition.requiresBaseTable && !page.base_table
    
    switch (requiredAnchor) {
      case 'saved_view':
        if (needsBaseTable) {
          return {
            icon: Database,
            title: 'Connect a table',
            description: `${definition.label} pages need a table connection to display data. Select a table to get started.`,
            actionLabel: 'Connect Table',
            actionType: 'settings' as const,
          }
        }
        return {
          icon: Database,
          title: 'Select a view',
          description: `${definition.label} pages need a saved view to display data. Configure the view settings to get started.`,
          actionLabel: 'Configure View',
          actionType: 'settings' as const,
        }
      case 'dashboard':
        return {
          icon: LayoutDashboard,
          title: 'Build your dashboard',
          description: `${definition.label} pages start empty. Add blocks to create KPIs, charts, and data visualizations.`,
          actionLabel: 'Add Blocks',
          actionType: 'edit' as const,
        }
      case 'form':
        if (needsBaseTable) {
          return {
            icon: FileText,
            title: 'Connect a table',
            description: 'Form pages need a table connection. Select a table to configure form fields.',
            actionLabel: 'Connect Table',
            actionType: 'settings' as const,
          }
        }
        return {
          icon: FileText,
          title: 'Configure form fields',
          description: 'Form pages need field configuration. Set up which fields to collect and their validation rules.',
          actionLabel: 'Configure Form',
          actionType: 'edit' as const,
        }
      case 'record':
        if (needsBaseTable) {
          return {
            icon: FileCheck,
            title: 'Connect a table',
            description: 'Record review pages need a table connection. Select a table to configure the detail panel.',
            actionLabel: 'Connect Table',
            actionType: 'settings' as const,
          }
        }
        return {
          icon: FileCheck,
          title: 'Configure detail panel',
          description: 'Record review pages need configuration for which fields to show in the detail panel.',
          actionLabel: 'Configure Panel',
          actionType: 'edit' as const,
        }
      default:
        // Fallback for any unexpected cases
        return {
          icon: LayoutDashboard,
          title: 'Configure this page',
          description: `${definition.label} pages need configuration.`,
          actionLabel: 'Configure Page',
          actionType: 'settings' as const,
        }
    }
  }

  const content = getSetupContent()
  const Icon = content.icon

  const handleAction = () => {
    if (content.actionType === 'edit') {
      // For edit actions, trigger edit mode
      if (page.page_type === 'dashboard' || page.page_type === 'overview' || page.page_type === 'content') {
        router.push(`/pages/${page.id}?edit=true`)
      } else {
        // For other page types, open settings panel
        if (onOpenSettings) {
          onOpenSettings()
        } else {
          router.push(`/settings?tab=pages&page=${page.id}&action=configure`)
        }
      }
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

