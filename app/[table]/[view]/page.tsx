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

  // Only content table has fully implemented views
  // Other tables show placeholder
  if (table !== "content") {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">{tableConfig.name} - {view.charAt(0).toUpperCase() + view.slice(1)} View</h2>
          <p className="text-gray-500 dark:text-gray-400">
            This view is not implemented yet. Only the Content table has full view support.
          </p>
        </div>
      </div>
    );
  }

  // Render the appropriate view component for content table
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

