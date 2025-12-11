"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAutomations } from "@/lib/hooks/useAutomations";
import Button from "@/components/ui/Button";
import { ArrowLeft, Play, Trash2, Save, Code } from "lucide-react";
import AutomationEditor from "@/components/automations/AutomationEditor";

export default function AutomationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const automationId = params.id as string;
  const { getAutomation, updateAutomation, deleteAutomation, runAutomation } = useAutomations();
  const [automation, setAutomation] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(false);

  useEffect(() => {
    const loadAutomation = async () => {
      try {
        setLoading(true);
        const data = await getAutomation(automationId);
        setAutomation(data);
      } catch (error) {
        console.error("Error loading automation:", error);
      } finally {
        setLoading(false);
      }
    };

    if (automationId) {
      loadAutomation();
    }
  }, [automationId, getAutomation]);

  const handleRun = async () => {
    if (!automation) return;
    try {
      await runAutomation(automation.id);
      alert("Automation executed successfully");
      // Reload automation to get updated logs
      const data = await getAutomation(automationId);
      setAutomation(data);
    } catch (err: any) {
      console.error("Error running automation:", err);
      alert(`Failed to run automation: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    if (!automation) return;
    if (!confirm(`Are you sure you want to delete "${automation.name}"?`)) {
      return;
    }

    try {
      await deleteAutomation(automation.id);
      router.push("/automations");
    } catch (err) {
      console.error("Error deleting automation:", err);
      alert("Failed to delete automation");
    }
  };

  const handleSave = async (updatedAutomation: any) => {
    try {
      await updateAutomation(automationId, updatedAutomation);
      const data = await getAutomation(automationId);
      setAutomation(data);
      setIsEditorOpen(false);
    } catch (err) {
      console.error("Error saving automation:", err);
      alert("Failed to save automation");
    }
  };

  const getTriggerLabel = (trigger: any) => {
    if (!trigger) return "Unknown";
    switch (trigger.type) {
      case "schedule":
        const schedule = trigger.schedule || {};
        return `Schedule: ${schedule.frequency || "daily"}${schedule.time ? ` at ${schedule.time}` : ""}`;
      case "record_created":
        return `Record Created: ${trigger.table_name || trigger.table_id}`;
      case "record_updated":
        return `Record Updated: ${trigger.table_name || trigger.table_id}`;
      case "field_match":
        return `Field Match: ${trigger.table_name || trigger.table_id}.${trigger.field_key}`;
      case "date_approaching":
        return `Date Approaching: ${trigger.table_name || trigger.table_id}.${trigger.date_field_key}`;
      case "manual":
        return "Manual";
      default:
        return trigger.type || "Unknown";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Loading automation...
        </div>
      </div>
    );
  }

  if (!automation) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-4">
            Automation Not Found
          </h2>
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">
            The automation you're looking for doesn't exist or has been deleted.
          </p>
          <Button onClick={() => router.push("/automations")}>
            Back to Automations
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => router.push("/automations")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {automation.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {automation.id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowJsonPreview(!showJsonPreview)}
            className="flex items-center gap-2"
          >
            <Code className="w-4 h-4" />
            {showJsonPreview ? "Hide" : "Show"} JSON
          </Button>
          <Button
            variant="outline"
            onClick={handleRun}
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Run Now
          </Button>
          <Button
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            onClick={handleDelete}
            className="flex items-center gap-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Toggle */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {automation.status === "active" ? "Automation is active and will run automatically" : "Automation is paused"}
            </p>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              automation.status === "active"
                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
            }`}
          >
            {automation.status}
          </span>
        </div>
      </div>

      {/* Trigger Block */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trigger</h2>
        <div className="space-y-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Type:</strong> {automation.trigger?.type || "Unknown"}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Configuration:</strong> {getTriggerLabel(automation.trigger)}
          </div>
          {showJsonPreview && (
            <pre className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded text-xs overflow-auto">
              {JSON.stringify(automation.trigger, null, 2)}
            </pre>
          )}
        </div>
      </div>

      {/* Conditions Block */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Conditions</h2>
        {automation.conditions && automation.conditions.length > 0 ? (
          <div className="space-y-2">
            {automation.conditions.map((condition: any, index: number) => (
              <div key={index} className="text-sm text-gray-600 dark:text-gray-400">
                {condition.type === "field" && (
                  <div>
                    <strong>{condition.field_key}</strong> {condition.operator} {String(condition.value || "")}
                  </div>
                )}
                {condition.type === "logic" && (
                  <div>
                    <strong>Logic:</strong> {condition.operator} ({condition.conditions?.length || 0} conditions)
                  </div>
                )}
              </div>
            ))}
            {showJsonPreview && (
              <pre className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded text-xs overflow-auto">
                {JSON.stringify(automation.conditions, null, 2)}
              </pre>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No conditions (always runs when trigger fires)</p>
        )}
      </div>

      {/* Actions List */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
        {automation.actions && automation.actions.length > 0 ? (
          <div className="space-y-4">
            {automation.actions.map((action: any, index: number) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded p-4">
                <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  {index + 1}. {action.type}
                </div>
                {showJsonPreview ? (
                  <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs overflow-auto">
                    {JSON.stringify(action, null, 2)}
                  </pre>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {action.type === "send_email" && (
                      <div>To: {action.to} | Subject: {action.subject}</div>
                    )}
                    {action.type === "send_webhook" && (
                      <div>URL: {action.url} | Method: {action.method || "POST"}</div>
                    )}
                    {action.type === "update_record" && (
                      <div>Table: {action.table_name || action.table_id} | Fields: {Object.keys(action.field_updates || {}).join(", ")}</div>
                    )}
                    {action.type === "create_record" && (
                      <div>Table: {action.table_name || action.table_id}</div>
                    )}
                    {action.type === "delete_record" && (
                      <div>Table: {action.table_name || action.table_id}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No actions configured</p>
        )}
      </div>

      {/* JSON Preview */}
      {showJsonPreview && (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Full JSON</h2>
          <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded text-xs overflow-auto max-h-96">
            {JSON.stringify(automation, null, 2)}
          </pre>
        </div>
      )}

      {/* Editor Drawer */}
      <AutomationEditor
        automation={automation}
        open={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
