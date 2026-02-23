"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { PageBlock } from "@/lib/interface/types"
import { Button } from "@/components/ui/button"
import { ExternalLink, Plus, ArrowRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface ActionBlockProps {
  block: PageBlock
  isEditing?: boolean
}

export default function ActionBlock({ block, isEditing = false }: ActionBlockProps) {
  const router = useRouter()
  const { config } = block
  const actionType = config?.action_type || "navigate"
  const label = config?.label || config?.title || "Action"
  const url = config?.url
  const route = config?.route
  const tableId = config?.table_id
  const confirmationMessage = config?.confirmation_message
  const icon = config?.icon || "arrow-right"
  
  const [showConfirmation, setShowConfirmation] = useState(false)

  function handleClick() {
    if (isEditing) return

    if (confirmationMessage) {
      setShowConfirmation(true)
    } else {
      executeAction()
    }
  }

  function executeAction() {
    if (actionType === "navigate") {
      if (route) {
        router.push(route)
      } else if (url) {
        window.open(url, "_blank")
      }
    } else if (actionType === "create_record" && tableId) {
      router.push(`/tables/${tableId}/new`)
    }
  }

  function handleConfirm() {
    setShowConfirmation(false)
    executeAction()
  }

  // Apply appearance settings
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : '1px',
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
  }

  const title = appearance.title || config.title
  const showTitle = appearance.show_title !== false && title

  const buttonStyle: React.CSSProperties = {
    backgroundColor: appearance.button_background || appearance.header_background || "#3b82f6",
    color: appearance.button_text_color || appearance.header_text_color || "#ffffff",
  }

  function getIcon() {
    switch (icon) {
      case "plus":
        return <Plus className="h-4 w-4" />
      case "external":
        return <ExternalLink className="h-4 w-4" />
      default:
        return <ArrowRight className="h-4 w-4" />
    }
  }

  // Empty state
  if (!actionType || (!url && !route && !tableId)) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4" style={blockStyle}>
        <div className="text-center">
          <ArrowRight className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-1">{isEditing ? "Configure action" : "No action configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Set action type and target in settings</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="h-full w-full overflow-hidden flex flex-col items-center justify-center" style={blockStyle}>
        {showTitle && (
          <div
            className="mb-4 pb-2 border-b w-full text-center"
            style={{
              backgroundColor: appearance.header_background,
              color: appearance.header_text_color || appearance.title_color,
            }}
          >
            <h3 className="text-lg font-semibold">{title}</h3>
          </div>
        )}
        <Button
          onClick={handleClick}
          disabled={isEditing}
          className="flex items-center gap-2"
          style={buttonStyle}
        >
          {getIcon()}
          {label}
        </Button>
        {isEditing && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            Action disabled in edit mode
          </p>
        )}
      </div>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>
              {confirmationMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

