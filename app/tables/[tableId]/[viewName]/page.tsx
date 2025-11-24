"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import GridView from "@/components/views/GridView";
import KanbanView from "@/components/views/KanbanView";
import CardsView from "@/components/views/CardsView";

// Lazy load heavy calendar and timeline components
const CalendarView = dynamic(() => import("@/components/views/CalendarView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading calendar...</div>
    </div>
  ),
});

const TimelineView = dynamic(() => import("@/components/views/TimelineView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500">Loading timeline...</div>
    </div>
  ),
});

interface TableViewPageProps {
  params: {
    tableId: string;
    viewName: string;
  };
}

function TableViewContent({ params }: TableViewPageProps) {
  const { tableId, viewName } = params;

  // Get view type from view name by looking it up, or use viewName as view type
  // For now, we'll use the viewName directly as the view type
  // In the future, we can look up the view config to get the actual view_type
  const viewType = viewName.toLowerCase();

  // Render the appropriate view component
  switch (viewType) {
    case "grid":
      return <GridView tableId={tableId} />;
    case "kanban":
      return <KanbanView tableId={tableId} />;
    case "calendar":
      return <CalendarView tableId={tableId} />;
    case "timeline":
      return <TimelineView tableId={tableId} />;
    case "cards":
      return <CardsView tableId={tableId} />;
    default:
      // If viewName doesn't match a view type, try to render GridView as fallback
      // The view might be a custom view name, so GridView will handle it
      return <GridView tableId={tableId} />;
  }
}

export default function TableViewPage({ params }: TableViewPageProps) {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-sm text-gray-500">Loading view...</div>
        </div>
      }
    >
      <TableViewContent params={params} />
    </Suspense>
  );
}

