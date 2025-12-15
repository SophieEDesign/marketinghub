"use client";

import { useState } from "react";
import { Zap, Plus, Edit2, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { useAutomations } from "@/lib/hooks/useAutomations";
import AutomationEditor from "@/components/automations/AutomationEditor";

export default function AutomationsTab() {
  const {
    automations,
    loading,
    loadAutomations,
    deleteAutomation,
    updateAutomation,
  } = useAutomations();
  const [editingAutomation, setEditingAutomation] = useState<any | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleToggleStatus = async (automation: any) => {
    try {
      await updateAutomation(automation.id, {
        status: automation.status === "active" ? "paused" : "active",
      });
      await loadAutomations();
      toast({
        title: "Success",
        description: `Automation ${automation.status === "active" ? "paused" : "activated"}`,
        type: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update automation status",
        type: "error",
      });
    }
  };

  const handleDelete = async (automation: any) => {
    if (!confirm(`Delete automation "${automation.name}"?`)) return;

    try {
      await deleteAutomation(automation.id);
      toast({
        title: "Success",
        description: "Automation deleted",
        type: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete automation",
        type: "error",
      });
    }
  };

  const handleEdit = (automation: any) => {
    setEditingAutomation(automation);
    setIsEditorOpen(true);
  };

  const handleNew = () => {
    setEditingAutomation(null);
    setIsEditorOpen(true);
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

  if (loading) {
    return <div className="text-sm text-gray-500">Loading automations...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Automations</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Build workflows that run automatically based on triggers
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-4 h-4 mr-2" />
          New Automation
        </Button>
      </div>

      {automations.length === 0 ? (
        <div className="text-center py-12 border border-gray-200 dark:border-gray-700 rounded-lg">
          <Zap className="w-12 h-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            No Automations Yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Create your first automation to automate repetitive tasks
          </p>
          <Button onClick={handleNew}>
            <Plus className="w-4 h-4 mr-2" />
            Create Automation
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((automation) => (
            <div
              key={automation.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <button
                      onClick={() => handleToggleStatus(automation)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        automation.status === "active" ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          automation.status === "active" ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {automation.name}
                    </h3>
                    {automation.status === "active" && (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    )}
                    {automation.status === "paused" && (
                      <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    <span>Trigger: {getTriggerLabel(automation.trigger)}</span>
                    <span>Actions: {automation.actions?.length || 0}</span>
                    {automation.conditions && automation.conditions.length > 0 && (
                      <span>Conditions: {automation.conditions.length}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(automation)}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    title="Edit automation"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(automation)}
                    className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Delete automation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Automation Editor */}
      <AutomationEditor
        automation={editingAutomation}
        open={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingAutomation(null);
        }}
        onSave={async () => {
          await loadAutomations();
          setIsEditorOpen(false);
          setEditingAutomation(null);
        }}
      />
    </div>
  );
}
