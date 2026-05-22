"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import DashboardEmpty from "@/components/interface/primitives/DashboardEmpty"

interface EventEmptyStateProps {
  onAddEvent?: () => void
  canEdit?: boolean
}

export default function EventEmptyState({ onAddEvent, canEdit = false }: EventEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <DashboardEmpty
        title="No events planned yet"
        description="Add boat shows, activations and key marketing events to build your calendar."
        variant="default"
        className="border-none bg-transparent max-w-md"
      />
      {canEdit && onAddEvent ? (
        <Button type="button" className="mt-4 gap-2" onClick={onAddEvent}>
          <Plus className="h-4 w-4" aria-hidden />
          Add event
        </Button>
      ) : null}
    </div>
  )
}
