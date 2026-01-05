"use client"

import { Button } from "@/components/ui/button"
import { Settings, Database, LayoutDashboard, FileText, FileCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import type { InterfacePage } from "@/lib/interface/pages"
import { getRequiredAnchorType, getPageTypeDefinition } from "@/lib/interface/page-types"

interface PageSetupStateProps {
  page: InterfacePage
  isAdmin: boolean
}

export default function PageSetupState({ page, isAdmin }: PageSetupStateProps) {
  const router = useRouter()
  const requiredAnchor = getRequiredAnchorType(page.page_type)
  const definition = getPageTypeDefinition(page.page_type)

  const getSetupContent = () => {
    switch (requiredAnchor) {
      case 'saved_view':
        return {
          icon: Database,
          title: 'Select a data source',
          description: `${definition.label} pages need a saved view to display data. Choose an existing view or create a new one.`,
          actionLabel: 'Configure Data Source',
          actionPath: `/settings?tab=pages&page=${page.id}&action=configure`,
        }
      case 'dashboard':
        return {
          icon: LayoutDashboard,
          title: 'Build your dashboard',
          description: `${definition.label} pages start empty. Add blocks to create KPIs, charts, and data visualizations.`,
          actionLabel: 'Add Blocks',
          actionPath: `/pages/${page.id}?edit=true`,
        }
      case 'form':
        return {
          icon: FileText,
          title: 'Configure this form',
          description: 'Form pages need field configuration. Set up which fields to collect and their validation rules.',
          actionLabel: 'Configure Form',
          actionPath: `/pages/${page.id}?edit=true`,
        }
      case 'record':
        return {
          icon: FileCheck,
          title: 'Configure record review',
          description: 'Record review pages need configuration for which fields to show in the detail panel.',
          actionLabel: 'Configure Review',
          actionPath: `/pages/${page.id}?edit=true`,
        }
    }
  }

  const content = getSetupContent()
  const Icon = content.icon

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
          onClick={() => {
            if (content.actionPath.includes('settings')) {
              router.push(content.actionPath)
            } else {
              router.push(content.actionPath)
            }
          }}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Settings className="h-4 w-4 mr-2" />
          {content.actionLabel}
        </Button>
      </div>
    </div>
  )
}

