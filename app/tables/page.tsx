"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Table, Settings } from "lucide-react";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

interface DynamicTable {
  id: string;
  name: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export default function TablesPage() {
  const router = useRouter();
  const [tables, setTables] = useState<DynamicTable[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tables");
      if (!response.ok) throw new Error("Failed to load tables");
      let data = await response.json();
      
      // If no tables in new system, try loading from old table_metadata as fallback
      if (!data || data.length === 0) {
        try {
          const { supabase } = await import("@/lib/supabaseClient");
          const { data: oldTables, error } = await supabase
            .from("table_metadata")
            .select("table_name, display_name, description")
            .order("display_name", { ascending: true });
          
          if (!error && oldTables && oldTables.length > 0) {
            // Convert old format to new format for display
            data = oldTables.map((row) => ({
              id: row.table_name, // Use table_name as id temporarily
              name: row.table_name,
              label: row.display_name,
              description: row.description || '',
              icon: 'table',
              color: '#6366f1',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }));
          }
        } catch (fallbackError) {
          console.warn("Could not load from table_metadata:", fallbackError);
        }
      }
      
      setTables(data || []);
    } catch (error: any) {
      console.error("Error loading tables:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load tables",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Loading tables...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Tables</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                View and access your data tables
              </p>
            </div>
            <Button variant="outline" onClick={() => router.push("/settings?section=data")}>
              <Settings className="w-4 h-4 mr-2" />
              Manage Tables
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {tables.length === 0 ? (
          <div className="text-center py-12 border border-gray-200 dark:border-gray-700 rounded-lg">
            <Table className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No tables yet. Create your first table in settings.
            </p>
            <Button onClick={() => router.push("/settings?section=data")}>
              <Settings className="w-4 h-4 mr-2" />
              Go to Settings
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table) => (
              <div
                key={table.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/tables/${table.id}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: table.color || '#6366f1' }}
                    >
                      <Table className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {table.label || table.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {table.name}
                      </p>
                    </div>
                  </div>
                </div>
                {table.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                    {table.description}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/tables/${table.id}`);
                    }}
                    className="flex-1"
                  >
                    View Records
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/tables/${table.id}/fields`);
                    }}
                    title="Manage Fields"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

