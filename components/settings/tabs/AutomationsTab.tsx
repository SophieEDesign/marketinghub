"use client";

import { useState, useEffect } from "react";
import { Zap, Plus, Edit2, Trash2, Play, Pause, CheckCircle, AlertCircle, Clock, X, Save, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import { getAllTables } from "@/lib/tableMetadata";

interface Automation {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  trigger_type: string;
  trigger_config: any;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

interface AutomationStep {
  id: string;
  automation_id: string;
  step_order: number;
  action_type: string;
  action_config: any;
}

export default function AutomationsTab() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [steps, setSteps] = useState<AutomationStep[]>([]);

  useEffect(() => {
    loadAutomations();
  }, []);

  const loadAutomations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAutomations(data || []);
    } catch (error: any) {
      console.error("Error loading automations:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load automations",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSteps = async (automationId: string) => {
    try {
      const { data, error } = await supabase
        .from("automation_steps")
        .select("*")
        .eq("automation_id", automationId)
        .order("step_order", { ascending: true });

      if (error) throw error;
      setSteps(data || []);
    } catch (error: any) {
      console.error("Error loading steps:", error);
    }
  };

  const handleToggleEnabled = async (automation: Automation) => {
    try {
      const { error } = await supabase
        .from("automations")
        .update({ enabled: !automation.enabled })
        .eq("id", automation.id);

      if (error) throw error;
      await loadAutomations();
      toast({
        title: "Success",
        description: `Automation ${!automation.enabled ? "enabled" : "disabled"}`,
        type: "success",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle automation",
        type: "error",
      });
    }
  };

  const handleDelete = async (automationId: string, automationName: string) => {
    if (!confirm(`Delete automation "${automationName}"?`)) return;

    try {
      const { error } = await supabase
        .from("automations")
        .delete()
        .eq("id", automationId);

      if (error) throw error;
      await loadAutomations();
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

  const handleEdit = async (automation: Automation) => {
    setEditingAutomation(automation);
    await loadSteps(automation.id);
    setShowBuilder(true);
  };

  const handleNew = () => {
    setEditingAutomation(null);
    setSteps([]);
    setShowBuilder(true);
  };

  if (showBuilder) {
    return (
      <AutomationBuilder
        automation={editingAutomation}
        initialSteps={steps}
        onSave={async () => {
          await loadAutomations();
          setShowBuilder(false);
          setEditingAutomation(null);
          setSteps([]);
        }}
        onCancel={() => {
          setShowBuilder(false);
          setEditingAutomation(null);
          setSteps([]);
        }}
      />
    );
  }

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
                      onClick={() => handleToggleEnabled(automation)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        automation.enabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          automation.enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {automation.name}
                    </h3>
                    {automation.status === "ok" && (
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    )}
                    {automation.status === "error" && (
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  {automation.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {automation.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <span>Trigger: {automation.trigger_type.replace(/_/g, " ")}</span>
                    {automation.next_run_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Next: {new Date(automation.next_run_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {automation.error_message && (
                    <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                      Error: {automation.error_message}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(automation)}
                    className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(automation.id, automation.name)}
                    className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AutomationBuilder({
  automation,
  initialSteps,
  onSave,
  onCancel,
}: {
  automation: Automation | null;
  initialSteps: AutomationStep[];
  onSave: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(automation?.name || "");
  const [description, setDescription] = useState(automation?.description || "");
  const [triggerType, setTriggerType] = useState(automation?.trigger_type || "record_created");
  const [triggerConfig, setTriggerConfig] = useState(automation?.trigger_config || {});
  const [steps, setSteps] = useState<AutomationStep[]>(initialSteps);
  const [saving, setSaving] = useState(false);
  const [editingStep, setEditingStep] = useState<AutomationStep | null>(null);

  const triggerTypes = [
    { value: "record_created", label: "When record created" },
    { value: "record_updated", label: "When record updated" },
    { value: "record_matches_conditions", label: "When record matches conditions" },
    { value: "schedule", label: "On schedule (daily/weekly/monthly)" },
    { value: "fixed_date", label: "On fixed date" },
  ];

  const actionTypes = [
    { value: "send_email", label: "Send email" },
    { value: "insert_record", label: "Insert record" },
    { value: "update_record", label: "Update record" },
    { value: "webhook", label: "Webhook" },
    { value: "post_to_table", label: "Post to table" },
  ];

  const handleAddStep = () => {
    const newStep: Partial<AutomationStep> = {
      id: `temp-${Date.now()}`,
      automation_id: automation?.id || "",
      step_order: steps.length + 1,
      action_type: "send_email",
      action_config: {},
    };
    setEditingStep(newStep as AutomationStep);
  };

  const handleSaveStep = (step: AutomationStep) => {
    if (editingStep?.id.startsWith("temp-")) {
      setSteps([...steps, { ...step, step_order: steps.length + 1 }]);
    } else {
      setSteps(steps.map((s) => (s.id === step.id ? step : s)));
    }
    setEditingStep(null);
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps(steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, step_order: i + 1 })));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Automation name is required",
        type: "error",
      });
      return;
    }

    setSaving(true);
    try {
      let automationId = automation?.id;

      // Save automation
      if (automationId) {
        const { error } = await supabase
          .from("automations")
          .update({
            name,
            description: description || null,
            trigger_type: triggerType,
            trigger_config: triggerConfig,
            updated_at: new Date().toISOString(),
          })
          .eq("id", automationId);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("automations")
          .insert({
            name,
            description: description || null,
            trigger_type: triggerType,
            trigger_config: triggerConfig,
            enabled: true,
            status: "ok",
          })
          .select()
          .single();

        if (error) throw error;
        automationId = data.id;
      }

      // Delete existing steps
      if (automationId) {
        await supabase
          .from("automation_steps")
          .delete()
          .eq("automation_id", automationId);
      }

      // Save new steps
      if (steps.length > 0 && automationId) {
        const stepsToInsert = steps.map((step, index) => ({
          automation_id: automationId,
          step_order: index + 1,
          action_type: step.action_type,
          action_config: step.action_config,
        }));

        const { error } = await supabase
          .from("automation_steps")
          .insert(stepsToInsert);

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Automation saved successfully",
        type: "success",
      });
      onSave();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save automation",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {automation ? "Edit Automation" : "New Automation"}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Automation"}
          </Button>
        </div>
      </div>

      {/* Basic Info */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Automation Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
            placeholder="e.g., Auto-create task when status changes"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
            rows={2}
            placeholder="Optional description"
          />
        </div>
      </div>

      {/* Trigger */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Trigger</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              When should this automation run?
            </label>
            <select
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
            >
              {triggerTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          {triggerType === "record_created" || triggerType === "record_updated" || triggerType === "record_matches_conditions" ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Table
              </label>
              <select
                value={triggerConfig.table_name || ""}
                onChange={(e) => setTriggerConfig({ ...triggerConfig, table_name: e.target.value })}
                className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
              >
                <option value="">Select table...</option>
                {getAllTables().map((tableId) => (
                  <option key={tableId} value={tableId}>
                    {tableId}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>

      {/* Actions */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Actions</h3>
          <Button variant="secondary" onClick={handleAddStep}>
            <Plus className="w-4 h-4 mr-2" />
            Add Action
          </Button>
        </div>
        {steps.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm border border-gray-200 dark:border-gray-700 rounded-lg">
            No actions yet. Add an action to define what this automation should do.
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-md"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {index + 1}.
                  </span>
                  <span className="text-sm text-gray-900 dark:text-white">
                    {actionTypes.find((a) => a.value === step.action_type)?.label || step.action_type}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingStep(step)}
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteStep(step.id)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step Editor Modal */}
      {editingStep && (
        <StepEditor
          step={editingStep}
          onSave={handleSaveStep}
          onCancel={() => setEditingStep(null)}
        />
      )}
    </div>
  );
}

function StepEditor({
  step,
  onSave,
  onCancel,
}: {
  step: AutomationStep;
  onSave: (step: AutomationStep) => void;
  onCancel: () => void;
}) {
  const [actionType, setActionType] = useState(step.action_type);
  const [actionConfig, setActionConfig] = useState(step.action_config || {});

  const handleSave = () => {
    onSave({
      ...step,
      action_type: actionType,
      action_config: actionConfig,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Action</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Action Type
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
            >
              <option value="send_email">Send email</option>
              <option value="insert_record">Insert record</option>
              <option value="update_record">Update record</option>
              <option value="webhook">Webhook</option>
              <option value="post_to_table">Post to table</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Configuration (JSON)
            </label>
            <textarea
              value={JSON.stringify(actionConfig, null, 2)}
              onChange={(e) => {
                try {
                  setActionConfig(JSON.parse(e.target.value));
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm font-mono"
              rows={6}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
