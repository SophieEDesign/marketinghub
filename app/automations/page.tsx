"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAutomations } from "@/lib/hooks/useAutomations";
import Button from "@/components/ui/Button";
import { Plus, Play, Pause, Edit, Trash2, Settings, Clock } from "lucide-react";
import AutomationEditor from "@/components/automations/AutomationEditor";

export default function AutomationsPage() {
  const router = useRouter();
  const {
    automations,
    loading,
    error,
    updateAutomation,
    deleteAutomation,
    runAutomation,
  } = useAutomations();
  const [editingAutomation, setEditingAutomation] = useState<any | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleToggleStatus = async (automation: any) => {
    try {
      await updateAutomation(automation.id, {
        status: automation.status === "active" ? "paused" : "active",
      });
    } catch (err) {
      console.error("Error toggling automation status:", err);
      alert("Failed to update automation status");
    }
  };

  const handleDelete = async (automation: any) => {
    if (!confirm(`Are you sure you want to delete "${automation.name}"?`)) {
      return;
    }

    try {
      await deleteAutomation(automation.id);
    } catch (err) {
      console.error("Error deleting automation:", err);
      alert("Failed to delete automation");
    }
  };

  const handleRun = async (automation: any) => {
    try {
      await runAutomation(automation.id);
      alert("Automation executed successfully");
    } catch (err: any) {
      console.error("Error running automation:", err);
      alert(`Failed to run automation: ${err.message}`);
    }
  };

  const getTriggerLabel = (trigger: any) => {
    if (!trigger) return "Unknown";
    switch (trigger.type) {
      case "schedule":
        return `Schedule: ${trigger.frequency}${trigger.time ? ` at ${trigger.time}` : ""}`;
      case "record_created":
        return `Record Created: ${trigger.table}`;
      case "record_updated":
        return `Record Updated: ${trigger.table}`;
      case "field_match":
        return `Field Match: ${trigger.table}.${trigger.field}`;
      case "date_approaching":
        return `Date Approaching: ${trigger.table}.${trigger.dateField}`;
      case "manual":
        return "Manual";
      default:
        return trigger.type || "Unknown";
    }
  };

  const getLastRun = (automation: any) => {
    // This would need to fetch from logs
    return "Never";
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Loading automations...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-4">
            Error
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Automations
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Automate your workflows with triggers and actions
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingAutomation(null);
            setIsEditorOpen(true);
          }}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Automation
        </Button>
      </div>

      {/* Automations Table */}
      {automations.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <p className="mb-4">No automations yet.</p>
          <Button
            variant="outline"
            onClick={() => {
              setEditingAutomation(null);
              setIsEditorOpen(true);
            }}
          >
            Create Your First Automation
          </Button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Trigger
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Run
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {automations.map((automation) => (
                  <tr
                    key={automation.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {automation.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {getTriggerLabel(automation.trigger)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          automation.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {automation.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {getLastRun(automation)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRun(automation)}
                          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title="Run automation"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(automation)}
                          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title={automation.status === "active" ? "Pause" : "Activate"}
                        >
                          {automation.status === "active" ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setEditingAutomation(automation);
                            setIsEditorOpen(true);
                          }}
                          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title="Edit automation"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => router.push(`/automations/${automation.id}/logs`)}
                          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title="View logs"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(automation)}
                          className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                          title="Delete automation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Editor Drawer */}
      <AutomationEditor
        automation={editingAutomation}
        open={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingAutomation(null);
        }}
      />
    </div>
  );
}

