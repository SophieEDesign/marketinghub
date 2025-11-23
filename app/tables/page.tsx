"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Table, Edit2, Trash2, Settings } from "lucide-react";
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTableName, setNewTableName] = useState("");
  const [newTableLabel, setNewTableLabel] = useState("");
  const [newTableDescription, setNewTableDescription] = useState("");

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/tables");
      if (!response.ok) throw new Error("Failed to load tables");
      const data = await response.json();
      setTables(data);
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

      const newTable = await response.json();
      setTables([...tables, newTable]);
      setShowCreateModal(false);
      setNewTableName("");
      setNewTableLabel("");
      setNewTableDescription("");
      toast({
        title: "Success",
        description: "Table created successfully",
        type: "success",
      });
      
      // Navigate to the new table
      router.push(`/tables/${newTable.id}`);
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

      setTables(tables.filter((t) => t.id !== id));
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
                Manage your dynamic data tables
              </p>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Table
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
              No tables yet. Create your first table to get started.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Table
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tables.map((table) => (
              <div
                key={table.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: table.color }}
                    >
                      <Table className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {table.label}
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
                    onClick={() => router.push(`/tables/${table.id}`)}
                    className="flex-1"
                  >
                    View Records
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/tables/${table.id}/fields`)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTable(table.id, table.label)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
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

