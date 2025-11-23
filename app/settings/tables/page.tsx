"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Plus, Trash2, Edit2, Settings, ArrowLeft } from "lucide-react";
import { getAllTables, getTableLabel, getTableMetadata } from "@/lib/tableMetadata";
import { tableCategories } from "@/lib/tables";
import { toast } from "@/components/ui/Toast";

export default function TablesManagementPage() {
  const router = useRouter();
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      const allTableIds = getAllTables();
      
      // Get metadata for each table
      const tablesWithMetadata = await Promise.all(
        allTableIds.map(async (tableId) => {
          const { data: metadata } = await supabase
            .from("table_metadata")
            .select("*")
            .eq("table_name", tableId)
            .maybeSingle();
          
          // Find category for this table
          const category = tableCategories.find((cat) => cat.tableIds.includes(tableId));
          
          return {
            id: tableId,
            name: getTableLabel(tableId),
            category: category?.name || "Uncategorized",
            metadata: metadata || null,
          };
        })
      );
      
      setTables(tablesWithMetadata);
    } catch (error) {
      console.error("Error loading tables:", error);
      toast({
        title: "Error",
        description: "Failed to load tables",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddTable = async () => {
    if (!newTableName.trim()) {
      toast({
        title: "Error",
        description: "Table name is required",
        type: "error",
      });
      return;
    }

    const tableId = newTableName.toLowerCase().replace(/\s+/g, "_");

    try {
      setAdding(true);

      // Check if table already exists
      const existing = tables.find((t) => t.id === tableId);
      if (existing) {
        toast({
          title: "Error",
          description: "A table with this name already exists",
          type: "error",
        });
        return;
      }

      // Create table metadata
      const { error: metadataError } = await supabase
        .from("table_metadata")
        .insert([
          {
            table_name: tableId,
            display_name: newTableName,
            description: "",
          },
        ]);

      if (metadataError) {
        throw metadataError;
      }

      // Create default view
      const { error: viewError } = await supabase
        .from("table_view_configs")
        .insert([
          {
            table_name: tableId,
            view_name: "Default View",
            view_type: "grid",
            is_default: true,
            column_order: [],
            column_widths: {},
            hidden_columns: [],
            filters: [],
            sort: [],
            groupings: [],
            row_height: "medium",
          },
        ]);

      if (viewError) {
        console.warn("Error creating default view:", viewError);
      }

      toast({
        title: "Success",
        description: `Table "${newTableName}" created successfully`,
        type: "success",
      });

      setNewTableName("");
      setShowAddModal(false);
      await loadTables();
    } catch (error: any) {
      console.error("Error creating table:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create table",
        type: "error",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteTable = async (tableId: string, tableName: string) => {
    if (!confirm(`Are you sure you want to delete the table "${tableName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete table metadata
      const { error: metadataError } = await supabase
        .from("table_metadata")
        .delete()
        .eq("table_name", tableId);

      if (metadataError) {
        throw metadataError;
      }

      // Delete view configs
      await supabase
        .from("table_view_configs")
        .delete()
        .eq("table_name", tableId);

      // Delete table fields
      await supabase
        .from("table_fields")
        .delete()
        .eq("table_id", tableId);

      toast({
        title: "Success",
        description: `Table "${tableName}" deleted successfully`,
        type: "success",
      });

      await loadTables();
    } catch (error: any) {
      console.error("Error deleting table:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete table",
        type: "error",
      });
    }
  };

  const handleManageFields = (tableId: string) => {
    router.push(`/settings/fields?table=${tableId}`);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-gray-500 dark:text-gray-400">Loading tables...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Table Management</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage your tables and their fields
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Table
          </button>
        </div>

        {/* Tables List */}
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Table Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {tables.map((table) => (
                <tr key={table.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {table.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {table.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {table.category || "Uncategorized"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleManageFields(table.id)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
                      >
                        <Settings className="w-4 h-4" />
                        Manage Fields
                      </button>
                      <button
                        onClick={() => handleDeleteTable(table.id, table.name)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 flex items-center gap-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add Table Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                Add New Table
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Table Name
                  </label>
                  <input
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    placeholder="Enter table name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddTable();
                      } else if (e.key === "Escape") {
                        setShowAddModal(false);
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setNewTableName("");
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddTable}
                    disabled={adding || !newTableName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
                  >
                    {adding ? "Creating..." : "Create Table"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

