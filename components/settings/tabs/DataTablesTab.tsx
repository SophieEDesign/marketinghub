"use client";

import { useState } from "react";
import { Database, Table, Columns, Eye, Download, Upload, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { getAllTables } from "@/lib/tableMetadata";
import { useViewConfigs } from "@/lib/useViewConfigs";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";

export default function DataTablesTab() {
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<"tables" | "fields" | "views" | "import">("tables");
  const [selectedTable, setSelectedTable] = useState<string>("content");

  const subTabs = [
    { id: "tables" as const, label: "Tables", icon: Table },
    { id: "fields" as const, label: "Fields", icon: Columns },
    { id: "views" as const, label: "Views", icon: Eye },
    { id: "import" as const, label: "Import / Export", icon: Download },
  ];

  const handleExportCSV = async (tableId: string) => {
    try {
      const { data, error } = await supabase
        .from(tableId)
        .select("*")
        .limit(10000);

      if (error) throw error;

      // Convert to CSV
      if (!data || data.length === 0) {
        toast({
          title: "No Data",
          description: "This table has no records to export",
          type: "info",
        });
        return;
      }

      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(","),
        ...data.map((row) =>
          headers.map((header) => {
            const value = row[header];
            if (value === null || value === undefined) return "";
            if (Array.isArray(value)) return JSON.stringify(value);
            return String(value).replace(/"/g, '""');
          }).join(",")
        ),
      ];

      const csv = csvRows.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tableId}_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Success",
        description: `Exported ${data.length} records`,
        type: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export CSV",
        type: "error",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-1 overflow-x-auto">
          {subTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeSubTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-blue-600 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tables Tab */}
      {activeSubTab === "tables" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tables</h2>
            <Button
              variant="secondary"
              onClick={() => router.push("/settings/tables")}
            >
              Manage Tables
            </Button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            View and manage all tables in your workspace. Add new tables, rename existing ones, or delete tables you no longer need.
          </p>
          <div className="mt-4">
            <Button onClick={() => router.push("/settings/tables")}>
              Go to Table Management
            </Button>
          </div>
        </div>
      )}

      {/* Fields Tab */}
      {activeSubTab === "fields" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Fields</h2>
            <Button
              variant="secondary"
              onClick={() => router.push(`/settings/fields?table=${selectedTable}`)}
            >
              Manage Fields
            </Button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Table
              </label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                {getAllTables().map((tableId) => (
                  <option key={tableId} value={tableId}>
                    {tableId}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage fields for the selected table. Add new fields, change field types, reorder fields, or delete unused fields.
            </p>
            <Button onClick={() => router.push(`/settings/fields?table=${selectedTable}`)}>
              Manage Fields for {selectedTable}
            </Button>
          </div>
        </div>
      )}

      {/* Views Tab */}
      {activeSubTab === "views" && (
        <ViewsManagement selectedTable={selectedTable} />
      )}

      {/* Import / Export Tab */}
      {activeSubTab === "import" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Import / Export</h2>
            <div className="space-y-6">
              {/* Import Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Import Data
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Import CSV files to add or update records in your tables.
                </p>
                <Button onClick={() => router.push("/import")}>
                  Go to Import Page
                </Button>
              </div>

              {/* Export Section */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Download className="w-5 h-5" />
                  Export Data
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Export table data as CSV files.
                </p>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Select Table to Export
                  </label>
                  <select
                    value={selectedTable}
                    onChange={(e) => setSelectedTable(e.target.value)}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm mb-3"
                  >
                    {getAllTables().map((tableId) => (
                      <option key={tableId} value={tableId}>
                        {tableId}
                      </option>
                    ))}
                  </select>
                  <Button onClick={() => handleExportCSV(selectedTable)}>
                    Export {selectedTable} as CSV
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ViewsManagement({ selectedTable }: { selectedTable: string }) {
  const { views, loading, deleteView, setDefaultView, switchToViewByName } = useViewConfigs(selectedTable);
  const router = useRouter();

  const handleDeleteView = async (viewId: string, viewName: string) => {
    if (!confirm(`Delete view "${viewName}"?`)) return;
    await deleteView(viewId);
  };

  const handleSetDefault = async (viewId: string) => {
    await setDefaultView(viewId);
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading views...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Views</h2>
        <Button
          variant="secondary"
          onClick={() => router.push(`/${selectedTable}/grid`)}
        >
          Manage Views
        </Button>
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Select Table
          </label>
          <select
            value={selectedTable}
            onChange={(e) => router.push(`/settings?section=data&table=${e.target.value}`)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
          >
            {getAllTables().map((tableId) => (
              <option key={tableId} value={tableId}>
                {tableId}
              </option>
            ))}
          </select>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Manage saved views for the selected table. Each view can have its own filters, sorts, column order, and layout.
        </p>
        {views.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            No views yet. Create views from the table view.
          </div>
        ) : (
          <div className="space-y-2">
            {views.map((view) => (
              <div
                key={view.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md"
              >
                <div className="flex items-center gap-3">
                  <Eye className="w-4 h-4 text-gray-400" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {view.view_name}
                      {view.is_default && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">(Default)</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {view.view_type} • {view.filters?.length || 0} filters • {view.sort?.length || 0} sorts
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!view.is_default && (
                    <button
                      onClick={() => handleSetDefault(view.id)}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleDeleteView(view.id, view.view_name)}
                    className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

