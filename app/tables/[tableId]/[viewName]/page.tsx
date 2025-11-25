"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Settings } from "lucide-react";
import Button from "@/components/ui/Button";
import GridView from "@/components/views/GridView";
import KanbanView from "@/components/views/KanbanView";
import CardsView from "@/components/views/CardsView";
import ViewTabs from "@/components/views/ViewTabs";

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

interface DynamicTable {
  id: string;
  name: string;
  label: string;
  description: string;
  fields: Array<{
    id: string;
    name: string;
    label: string;
    type: string;
  }>;
}

interface TableViewPageProps {
  params: {
    tableId: string;
    viewName: string;
  };
}

function TableViewContent({ params }: TableViewPageProps) {
  const { tableId, viewName } = params;
  const router = useRouter();
  const [table, setTable] = useState<DynamicTable | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTable();
  }, [tableId]);

  const loadTable = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tables/${tableId}`);
      if (!response.ok) throw new Error("Failed to load table");
      const data = await response.json();
      setTable(data);
    } catch (error: any) {
      console.error("Error loading table:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Loading table...</div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-500">Table not found</div>
      </div>
    );
  }

  // Get view type from view name by looking it up, or use viewName as view type
  const viewType = viewName.toLowerCase();

  // Render the appropriate view component
  let ViewComponent;
  switch (viewType) {
    case "grid":
      ViewComponent = <GridView tableId={table.name} />;
      break;
    case "kanban":
      ViewComponent = <KanbanView tableId={table.name} />;
      break;
    case "calendar":
      ViewComponent = <CalendarView tableId={table.name} />;
      break;
    case "timeline":
      ViewComponent = <TimelineView tableId={table.name} />;
      break;
    case "cards":
      ViewComponent = <CardsView tableId={table.name} />;
      break;
    default:
      // If viewName doesn't match a view type, try to render GridView as fallback
      ViewComponent = <GridView tableId={table.name} />;
      break;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/tables")}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {table.label}
                </h1>
                {table.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {table.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => router.push(`/tables/${tableId}/fields`)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Fields
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* View Tabs - Below the top bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-[73px] z-10">
        <ViewTabs 
          tableId={tableId} 
          tableName={table.name} 
          displayName={table.label} 
        />
      </div>

      {/* View Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {ViewComponent}
      </div>
    </div>
  );
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

