export const dynamic = 'force-dynamic';

import { notFound } from "next/navigation";
import { isValidViewForTable, getTableMetadata } from "@/lib/tableMetadata";
import dynamic from "next/dynamic";
import GridView from "@/components/views/GridView";
import KanbanView from "@/components/views/KanbanView";
import CardsView from "@/components/views/CardsView";

// Lazy load heavy calendar and timeline components
const CalendarView = dynamic(() => import("@/components/views/CalendarView"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading calendar...</div></div>,
});

const TimelineView = dynamic(() => import("@/components/views/TimelineView"), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-64"><div className="text-gray-500">Loading timeline...</div></div>,
});

interface PageProps {
  params: {
    table: string;
    view: string;
  };
}

export default function TableViewPage({ params }: PageProps) {
  const { table, view } = params;

  // Validate table exists in metadata
  const tableMeta = getTableMetadata(table);
  if (!tableMeta) {
    notFound();
  }

  // Validate view is supported for this table
  if (!isValidViewForTable(table, view)) {
    notFound();
  }

  // Render the appropriate view component for all tables
  switch (view) {
    case "grid":
      return <GridView tableId={table} />;
    case "kanban":
      return <KanbanView tableId={table} />;
    case "calendar":
      return <CalendarView tableId={table} />;
    case "timeline":
      return <TimelineView tableId={table} />;
    case "cards":
      return <CardsView tableId={table} />;
    default:
      notFound();
  }
}

