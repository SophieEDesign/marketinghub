"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { ArrowLeft, Plus, Settings } from "lucide-react";
import Button from "@/components/ui/Button";
import GridView from "@/components/views/GridView";
import ViewTabs from "@/components/views/ViewTabs";

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

function TableRecordsContent() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const tableId = params.tableId as string;
  const [table, setTable] = useState<DynamicTable | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Get view name from URL if present
  const pathParts = pathname.split("/").filter(Boolean);
  const viewName = pathParts[2]; // /tables/[tableId]/[viewName]

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
        
        {/* View Tabs */}
        <ViewTabs tableId={table.name} tableName={table.label} />
      </div>

      {/* Grid View */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <GridView tableId={table.name} />
      </div>
    </div>
  );
}

export default function TableRecordsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      }
    >
      <TableRecordsContent />
    </Suspense>
  );
}

