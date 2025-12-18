"use client"

import ViewTopBar from "@/components/layout/ViewTopBar"
import FormView from "@/components/views/FormView"
import KanbanView from "@/components/views/KanbanView"
import CalendarView from "@/components/views/CalendarView"

interface NonGridViewWrapperProps {
  viewType: "form" | "kanban" | "calendar"
  viewName: string
  tableId: string
  viewId: string
  fieldIds: string[]
  groupingFieldId?: string
  dateFieldId?: string
}

export default function NonGridViewWrapper({
  viewType,
  viewName,
  tableId,
  viewId,
  fieldIds,
  groupingFieldId,
  dateFieldId,
}: NonGridViewWrapperProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ViewTopBar
        viewName={viewName}
        viewType={viewType}
        onSearch={(query) => {
          // TODO: Implement search
        }}
      />
      <div className="flex-1 overflow-hidden">
        {viewType === "form" && (
          <FormView
            tableId={tableId}
            viewId={viewId}
            fieldIds={fieldIds}
          />
        )}
        {viewType === "kanban" && (
          <KanbanView
            tableId={tableId}
            viewId={viewId}
            groupingFieldId={groupingFieldId || fieldIds[0] || ""}
            fieldIds={fieldIds}
          />
        )}
        {viewType === "calendar" && (
          <CalendarView
            tableId={tableId}
            viewId={viewId}
            dateFieldId={dateFieldId || fieldIds[0] || ""}
            fieldIds={fieldIds}
          />
        )}
      </div>
    </div>
  )
}
