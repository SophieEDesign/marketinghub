"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2, Edit2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";

interface TableField {
  id: string;
  name: string;
  label: string;
  type: string;
  options: any;
  required: boolean;
  unique_field: boolean;
  order: number;
}

interface DynamicTable {
  id: string;
  name: string;
  label: string;
  fields: TableField[];
}

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "datetime", label: "Date & Time" },
  { value: "checkbox", label: "Checkbox" },
  { value: "single_select", label: "Single Select" },
  { value: "multi_select", label: "Multi Select" },
  { value: "url", label: "URL" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "attachment", label: "Attachment" },
  { value: "linked_record", label: "Linked Record" },
];

function FieldsContent() {
  const params = useParams();
  const router = useRouter();
  const tableId = params.tableId as string;
  const [table, setTable] = useState<DynamicTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingField, setEditingField] = useState<TableField | null>(null);
  const [fieldName, setFieldName] = useState("");
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldUnique, setFieldUnique] = useState(false);

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
      toast({
        title: "Error",
        description: error.message || "Failed to load table",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fieldName.trim() || !fieldLabel.trim()) {
      toast({
        title: "Error",
        description: "Field name and label are required",
        type: "error",
      });
      return;
    }

    try {
      const response = await fetch(`/api/tables/${tableId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fieldName.trim().toLowerCase().replace(/\s+/g, "_"),
          label: fieldLabel.trim(),
          type: fieldType,
          required: fieldRequired,
          unique_field: fieldUnique,
          order: table?.fields.length || 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create field");
      }

      await loadTable();
      setShowCreateModal(false);
      resetForm();
      toast({
        title: "Success",
        description: "Field created successfully",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error creating field:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create field",
        type: "error",
      });
    }
  };

  const handleDeleteField = async (fieldId: string, fieldName: string) => {
    if (!confirm(`Delete field "${fieldName}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/tables/${tableId}/fields/${fieldId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete field");
      }

      await loadTable();
      toast({
        title: "Success",
        description: "Field deleted successfully",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error deleting field:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete field",
        type: "error",
      });
    }
  };

  const resetForm = () => {
    setFieldName("");
    setFieldLabel("");
    setFieldType("text");
    setFieldRequired(false);
    setFieldUnique(false);
    setEditingField(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-500">Loading fields...</div>
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
                onClick={() => router.push(`/tables/${tableId}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {table.label} - Fields
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Manage fields for this table
                </p>
              </div>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              New Field
            </Button>
          </div>
        </div>
      </div>

      {/* Fields List */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {table.fields.length === 0 ? (
          <div className="text-center py-12 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No fields yet. Add your first field to get started.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Field
            </Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Field
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Options
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {table.fields.map((field) => (
                  <tr key={field.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {field.label}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {field.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {FIELD_TYPES.find((t) => t.value === field.type)?.label || field.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {field.required && (
                        <span className="inline-block px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded mr-1">
                          Required
                        </span>
                      )}
                      {field.unique_field && (
                        <span className="inline-block px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 rounded">
                          Unique
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDeleteField(field.id, field.label)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Field Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Create New Field
              </h2>
              <form onSubmit={handleCreateField} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field Name *
                  </label>
                  <input
                    type="text"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    placeholder="e.g., title"
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
                    value={fieldLabel}
                    onChange={(e) => setFieldLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    placeholder="e.g., Title"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Field Type *
                  </label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    required
                  >
                    {FIELD_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={fieldRequired}
                      onChange={(e) => setFieldRequired(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={fieldUnique}
                      onChange={(e) => setFieldUnique(e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Unique</span>
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Create Field</Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FieldsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-sm text-gray-500">Loading...</div>
        </div>
      }
    >
      <FieldsContent />
    </Suspense>
  );
}

