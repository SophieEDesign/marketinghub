"use client";

import { useState, useEffect } from "react";
import { Database, Table, Columns, Eye, Download, Upload, ChevronRight, Plus, Trash2, Edit2, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTables } from "@/lib/hooks/useTables";
import { useViewConfigs } from "@/lib/useViewConfigs";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";

export default function DataTablesTab() {
  const router = useRouter();
  const [activeSubTab, setActiveSubTab] = useState<"tables" | "fields" | "views" | "import">("tables");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const { tables: dynamicTables } = useTables();

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
        <TablesManagement />
      )}

      {/* Fields Tab */}
      {activeSubTab === "fields" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Fields</h2>
            {selectedTable && (
              <Button
                variant="secondary"
                onClick={() => router.push(`/settings/fields?table=${selectedTable}`)}
              >
                Manage Fields
              </Button>
            )}
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
                <option value="">-- Select a table --</option>
                {dynamicTables.map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Manage fields for the selected table. Add new fields, change field types, reorder fields, or delete unused fields.
            </p>
            {selectedTable && (
              <Button onClick={() => router.push(`/settings/fields?table=${selectedTable}`)}>
                Manage Fields for {dynamicTables.find(t => t.name === selectedTable)?.label || selectedTable}
              </Button>
            )}
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
                    <option value="">-- Select a table --</option>
                    {dynamicTables.map((table) => (
                      <option key={table.id} value={table.name}>
                        {table.label}
                      </option>
                    ))}
                  </select>
                  {selectedTable && (
                    <Button onClick={() => handleExportCSV(selectedTable)}>
                      Export {dynamicTables.find(t => t.name === selectedTable)?.label || selectedTable} as CSV
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TablesManagement() {
  const router = useRouter();
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableLabel, setNewTableLabel] = useState("");
  const [newTableDescription, setNewTableDescription] = useState("");
  const [editingTable, setEditingTable] = useState<any | null>(null);

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
          const { data: oldTables, error } = await supabase
            .from("table_metadata")
            .select("table_name, display_name, description")
            .order("display_name", { ascending: true });
          
          if (!error && oldTables && oldTables.length > 0) {
            data = oldTables.map((row) => ({
              id: row.table_name,
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

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTableName.trim() || !newTableLabel.trim()) {
      toast({
        title: "Error",
        description: "Table name and label are required",
        type: "error",
      });
      return;
    }

    try {
      const response = await fetch("/api/tables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTableName.trim().toLowerCase().replace(/\s+/g, "_"),
          label: newTableLabel.trim(),
          description: newTableDescription.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create table");
      }

      await loadTables();
      setShowCreateModal(false);
      setNewTableName("");
      setNewTableLabel("");
      setNewTableDescription("");
      toast({
        title: "Success",
        description: "Table created successfully",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error creating table:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create table",
        type: "error",
      });
    }
  };

  const handleDeleteTable = async (id: string, name: string) => {
    if (!confirm(`Delete table "${name}"? This will also delete all records and fields.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/tables/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete table");
      }

      await loadTables();
      toast({
        title: "Success",
        description: "Table deleted successfully",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error deleting table:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete table",
        type: "error",
      });
    }
  };

  const handleUpdateTable = async () => {
    if (!editingTable) return;
    if (!editingTable.label?.trim()) {
      toast({
        title: "Error",
        description: "Table label is required",
        type: "error",
      });
      return;
    }

    try {
      const response = await fetch(`/api/tables/${editingTable.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: editingTable.label.trim(),
          description: editingTable.description?.trim() || "",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update table");
      }

      await loadTables();
      setEditingTable(null);
      toast({
        title: "Success",
        description: "Table updated successfully",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error updating table:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update table",
        type: "error",
      });
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">Loading tables...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Tables</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create, edit, and manage your data tables
          </p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Table
        </Button>
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-12 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Table className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No tables yet. Create your first table to get started.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Table
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {tables.map((table) => (
            <div
              key={table.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50"
            >
              <div className="flex items-center gap-3 flex-1">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: table.color || '#6366f1' }}
                >
                  <Table className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingTable?.id === table.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingTable.label}
                        onChange={(e) => setEditingTable({ ...editingTable, label: e.target.value })}
                        className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-sm flex-1"
                        placeholder="Table label"
                      />
                      <Button size="sm" onClick={handleUpdateTable}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingTable(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {table.label || table.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {table.name} {table.description && `• ${table.description}`}
                      </p>
                    </>
                  )}
                </div>
              </div>
              {editingTable?.id !== table.id && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/tables/${table.id}`)}
                  >
                    View Records
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/tables/${table.id}/fields`)}
                    title="Manage Fields"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingTable({ ...table })}
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTable(table.id, table.label || table.name)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Create New Table
              </h2>
              <form onSubmit={handleCreateTable} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Table Name *
                  </label>
                  <input
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    placeholder="e.g., campaigns"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lowercase, alphanumeric, underscores only
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Label *
                  </label>
                  <input
                    type="text"
                    value={newTableLabel}
                    onChange={(e) => setNewTableLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    placeholder="e.g., Campaigns"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newTableDescription}
                    onChange={(e) => setNewTableDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewTableName("");
                      setNewTableLabel("");
                      setNewTableDescription("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create Table</Button>
                </div>
              </form>
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
            <option value="">-- Select a table --</option>
            {dynamicTables.map((table) => (
              <option key={table.id} value={table.name}>
                {table.label}
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

