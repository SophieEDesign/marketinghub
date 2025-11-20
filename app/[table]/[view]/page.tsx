import { notFound } from "next/navigation";
import { getTable, isValidView } from "@/lib/tables";
import GridView from "@/components/views/GridView";
import KanbanView from "@/components/views/KanbanView";
import CalendarView from "@/components/views/CalendarView";
import TimelineView from "@/components/views/TimelineView";
import CardsView from "@/components/views/CardsView";

interface PageProps {
  params: {
    table: string;
    view: string;
  };
}

export default function TableViewPage({ params }: PageProps) {
  const { table, view } = params;

  // Validate table and view
  if (!isValidView(table, view)) {
    notFound();
  }

  const tableConfig = getTable(table);
  if (!tableConfig) {
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

