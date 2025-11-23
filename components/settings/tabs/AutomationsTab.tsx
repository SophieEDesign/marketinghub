"use client";

import { useState, useEffect } from "react";
import { Zap, CheckCircle, AlertCircle, Info, Edit2, Trash2, X, Save, Plus } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  config?: any; // Additional configuration
}

export default function AutomationsTab() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    name: "",
    description: "",
    trigger: "",
    action: "",
    enabled: true,
  });

  useEffect(() => {
    loadRules();
  }, []);

  async function loadRules() {
    // Try to load from database first
    const { data: dbRules } = await supabase
      .from("automation_rules")
      .select("*")
      .order("name");

    if (dbRules && dbRules.length > 0) {
      setRules(dbRules as AutomationRule[]);
      setLoading(false);
      return;
    }

    // Fallback to built-in automations
    const builtInRules: AutomationRule[] = [
      {
        id: "status-to-task",
        name: "Status → Task Creation",
        description: "Automatically creates a task when content status changes to specific values",
        trigger: "Status field changes",
        action: "Create task",
        enabled: true,
      },
      {
        id: "auto-tag-channels",
        name: "Auto-tag Content by Channels",
        description: "Automatically tags content based on selected channels",
        trigger: "Channels field updated",
        action: "Apply tags",
        enabled: true,
      },
      {
        id: "campaign-linking",
        name: "Campaign Linking",
        description: "Automatically links content to campaigns based on keywords",
        trigger: "Content created/updated",
        action: "Link to campaign",
        enabled: true,
      },
      {
        id: "publish-reminder",
        name: "Publish Date Reminder",
        description: "Sends reminders when publish date approaches",
        trigger: "Publish date within 7 days",
        action: "Create reminder task",
        enabled: true,
      },
      {
        id: "auto-fill-fields",
        name: "Auto-fill Fields",
        description: "Automatically fills fields based on other field values",
        trigger: "Field value changes",
        action: "Update related fields",
        enabled: true,
      },
      {
        id: "auto-progress",
        name: "Auto-progress Workflow",
        description: "Automatically moves records through workflow stages",
        trigger: "Conditions met",
        action: "Update status",
        enabled: true,
      },
      {
        id: "idea-to-content",
        name: "Idea → Content Creation",
        description: "Converts ideas to content when status changes",
        trigger: "Idea status = 'Ready'",
        action: "Create content record",
        enabled: true,
      },
    ];

    setRules(builtInRules);
    setLoading(false);
  }

  async function handleToggleEnabled(ruleId: string) {
    const rule = rules.find((r) => r.id === ruleId);
    if (!rule) return;

    const updated = { ...rule, enabled: !rule.enabled };
    
    // Try to save to database
    const { error } = await supabase
      .from("automation_rules")
      .upsert(updated, { onConflict: "id" });

    if (error) {
      console.error("Error updating automation:", error);
      // Still update local state
    }

    setRules(rules.map((r) => (r.id === ruleId ? updated : r)));
  }

  async function handleSaveRule(rule: AutomationRule) {
    // Try to save to database
    const { error } = await supabase
      .from("automation_rules")
      .upsert({ ...rule }, { onConflict: "id" });

    if (error) {
      console.error("Error saving automation:", error);
      // Still update local state
    }

    setRules(rules.map((r) => (r.id === rule.id ? rule : r)));
    setEditingRule(null);
  }

  async function handleDeleteRule(ruleId: string) {
    if (!confirm("Are you sure you want to delete this automation?")) return;

    // Try to delete from database
    const { error } = await supabase
      .from("automation_rules")
      .delete()
      .eq("id", ruleId);

    if (error) {
      console.error("Error deleting automation:", error);
      // Still update local state
    }

    setRules(rules.filter((r) => r.id !== ruleId));
  }

  async function handleAddRule() {
    if (!newRule.name || !newRule.description) return;

    const rule: AutomationRule = {
      id: `custom-${Date.now()}`,
      name: newRule.name!,
      description: newRule.description!,
      trigger: newRule.trigger || "",
      action: newRule.action || "",
      enabled: newRule.enabled ?? true,
    };

    // Try to save to database
    const { error } = await supabase
      .from("automation_rules")
      .insert([rule]);

    if (error) {
      console.error("Error creating automation:", error);
      // Still update local state
    }

    setRules([...rules, rule]);
    setNewRule({ name: "", description: "", trigger: "", action: "", enabled: true });
    setShowAddForm(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading automations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
              Automation Rules
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Automations run automatically when records are created or updated. They help streamline
              your workflow by performing actions based on triggers.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Automation Rules</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Automation
        </button>
      </div>

      {showAddForm && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Add New Automation</h3>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewRule({ name: "", description: "", trigger: "", action: "", enabled: true });
              }}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name
              </label>
              <input
                type="text"
                value={newRule.name || ""}
                onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                placeholder="Automation name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={newRule.description || ""}
                onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                placeholder="What does this automation do?"
                rows={2}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Trigger
              </label>
              <input
                type="text"
                value={newRule.trigger || ""}
                onChange={(e) => setNewRule({ ...newRule, trigger: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                placeholder="When should this run?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Action
              </label>
              <input
                type="text"
                value={newRule.action || ""}
                onChange={(e) => setNewRule({ ...newRule, action: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                placeholder="What should happen?"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="new-enabled"
                checked={newRule.enabled ?? true}
                onChange={(e) => setNewRule({ ...newRule, enabled: e.target.checked })}
                className="rounded border-gray-300"
              />
              <label htmlFor="new-enabled" className="text-sm text-gray-700 dark:text-gray-300">
                Enabled
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddRule} className="btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewRule({ name: "", description: "", trigger: "", action: "", enabled: true });
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-sm transition"
          >
            {editingRule?.id === rule.id ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">Edit Automation</h3>
                  <button
                    onClick={() => setEditingRule(null)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingRule.name}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editingRule.description}
                    onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Trigger
                  </label>
                  <input
                    type="text"
                    value={editingRule.trigger}
                    onChange={(e) => setEditingRule({ ...editingRule, trigger: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Action
                  </label>
                  <input
                    type="text"
                    value={editingRule.action}
                    onChange={(e) => setEditingRule({ ...editingRule, action: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`enabled-${rule.id}`}
                    checked={editingRule.enabled}
                    onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor={`enabled-${rule.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                    Enabled
                  </label>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveRule(editingRule)}
                    className="btn-primary flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Save
                  </button>
                  <button onClick={() => setEditingRule(null)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {rule.name}
                    </h3>
                    <button
                      onClick={() => handleToggleEnabled(rule.id)}
                      className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 transition-colors ${
                        rule.enabled
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      }`}
                    >
                      <CheckCircle className="w-3 h-3" />
                      {rule.enabled ? "Active" : "Disabled"}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {rule.description}
                  </p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-500">
                    <div>
                      <span className="font-medium">Trigger:</span> {rule.trigger}
                    </div>
                    <div>
                      <span className="font-medium">Action:</span> {rule.action}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingRule(rule)}
                    className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              Automation Notifications
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              When automations run, you'll see notifications in the top-right corner showing what
              actions were taken.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

