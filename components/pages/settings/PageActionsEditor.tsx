"use client";

import { useState } from "react";
import { PageAction, PageActionType } from "@/lib/pages/pageActions";
import Button from "@/components/ui/Button";
import { Plus, X, Trash2, Edit2, Save, Check, Copy, ExternalLink, Mail, Webhook, Zap, FileEdit, FilePlus, FileMinus, Navigation, Eye, Clipboard } from "lucide-react";
import { useInterfacePages } from "@/lib/hooks/useInterfacePages";
import { useAutomations } from "@/lib/hooks/useAutomations";

interface PageActionsEditorProps {
  actions: PageAction[];
  onChange: (actions: PageAction[]) => void;
  tableId?: string;
}

const ACTION_TYPES: { value: PageActionType; label: string; icon: any; scope: "page" | "record" | "both" }[] = [
  { value: "update_record", label: "Update Record", icon: FileEdit, scope: "both" },
  { value: "create_record", label: "Create Record", icon: FilePlus, scope: "page" },
  { value: "delete_record", label: "Delete Record", icon: FileMinus, scope: "record" },
  { value: "duplicate_record", label: "Duplicate Record", icon: Copy, scope: "record" },
  { value: "navigate_to_page", label: "Navigate to Page", icon: Navigation, scope: "both" },
  { value: "open_record", label: "Open Record", icon: Eye, scope: "record" },
  { value: "send_email", label: "Send Email", icon: Mail, scope: "both" },
  { value: "webhook", label: "Webhook", icon: Webhook, scope: "both" },
  { value: "run_automation", label: "Run Automation", icon: Zap, scope: "both" },
  { value: "open_url", label: "Open URL", icon: ExternalLink, scope: "both" },
  { value: "set_field_value", label: "Set Field Value", icon: Check, scope: "record" },
  { value: "copy_to_clipboard", label: "Copy to Clipboard", icon: Clipboard, scope: "record" },
];

const ICON_OPTIONS = [
  { value: "Check", label: "Check" },
  { value: "X", label: "X" },
  { value: "Plus", label: "Plus" },
  { value: "Edit", label: "Edit" },
  { value: "Trash", label: "Trash" },
  { value: "Copy", label: "Copy" },
  { value: "Eye", label: "Eye" },
  { value: "Mail", label: "Mail" },
  { value: "Zap", label: "Zap" },
  { value: "ExternalLink", label: "External Link" },
  { value: "Navigation", label: "Navigation" },
];

export default function PageActionsEditor({ actions, onChange, tableId }: PageActionsEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingAction, setEditingAction] = useState<PageAction | null>(null);
  const { pages } = useInterfacePages();
  const { automations } = useAutomations();

  const handleAdd = () => {
    const newAction: PageAction = {
      id: `action-${Date.now()}`,
      type: "update_record",
      label: "New Action",
      scope: "page",
      table: tableId,
    };
    setEditingAction(newAction);
    setEditingId(newAction.id);
  };

  const handleEdit = (action: PageAction) => {
    setEditingAction({ ...action });
    setEditingId(action.id);
  };

  const handleSave = () => {
    if (!editingAction) return;

    const updated = editingId && actions.find(a => a.id === editingId)
      ? actions.map(a => a.id === editingId ? editingAction : a)
      : [...actions, editingAction];

    onChange(updated);
    setEditingId(null);
    setEditingAction(null);
  };

  const handleDelete = (id: string) => {
    if (confirm("Delete this action?")) {
      onChange(actions.filter(a => a.id !== id));
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingAction(null);
  };

  if (editingAction) {
    return (
      <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{editingId ? "Edit Action" : "New Action"}</h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave}>
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Label</label>
            <input
              type="text"
              value={editingAction.label}
              onChange={(e) => setEditingAction({ ...editingAction, label: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={editingAction.type}
              onChange={(e) => {
                const newType = e.target.value as PageActionType;
                const typeInfo = ACTION_TYPES.find(t => t.value === newType);
                setEditingAction({
                  ...editingAction,
                  type: newType,
                  scope: typeInfo?.scope === "both" ? editingAction.scope : (typeInfo?.scope || "page"),
                });
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
            >
              {ACTION_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Scope</label>
            <select
              value={editingAction.scope || "page"}
              onChange={(e) => setEditingAction({ ...editingAction, scope: e.target.value as "page" | "record" })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
            >
              <option value="page">Page (Top-level button)</option>
              <option value="record">Record (Row/Card menu)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Icon (optional)</label>
            <select
              value={editingAction.icon || ""}
              onChange={(e) => setEditingAction({ ...editingAction, icon: e.target.value || undefined })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
            >
              <option value="">None</option>
              {ICON_OPTIONS.map(icon => (
                <option key={icon.value} value={icon.value}>{icon.label}</option>
              ))}
            </select>
          </div>

          {/* Type-specific fields */}
          {(editingAction.type === "update_record" || editingAction.type === "create_record" || editingAction.type === "set_field_value") && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Table</label>
                <input
                  type="text"
                  value={editingAction.table || ""}
                  onChange={(e) => setEditingAction({ ...editingAction, table: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
                  placeholder="table_name"
                />
              </div>
              {editingAction.type === "set_field_value" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Field Key</label>
                    <input
                      type="text"
                      value={editingAction.fieldKey || ""}
                      onChange={(e) => setEditingAction({ ...editingAction, fieldKey: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Field Value</label>
                    <input
                      type="text"
                      value={editingAction.fieldValue || ""}
                      onChange={(e) => setEditingAction({ ...editingAction, fieldValue: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
                    />
                  </div>
                </>
              )}
              {editingAction.type === "update_record" && (
                <div>
                  <label className="block text-sm font-medium mb-1">Updates (JSON)</label>
                  <textarea
                    value={JSON.stringify(editingAction.updates || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setEditingAction({ ...editingAction, updates: parsed });
                      } catch {}
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md font-mono text-sm"
                    rows={4}
                  />
                </div>
              )}
            </>
          )}

          {editingAction.type === "navigate_to_page" && (
            <div>
              <label className="block text-sm font-medium mb-1">Page</label>
              <select
                value={editingAction.pageId || ""}
                onChange={(e) => setEditingAction({ ...editingAction, pageId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
              >
                <option value="">Select a page...</option>
                {pages.map(page => (
                  <option key={page.id} value={page.id}>{page.name}</option>
                ))}
              </select>
            </div>
          )}

          {editingAction.type === "run_automation" && (
            <div>
              <label className="block text-sm font-medium mb-1">Automation</label>
              <select
                value={editingAction.automationId || ""}
                onChange={(e) => setEditingAction({ ...editingAction, automationId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
              >
                <option value="">Select an automation...</option>
                {automations.map(auto => (
                  <option key={auto.id} value={auto.id}>{auto.name}</option>
                ))}
              </select>
            </div>
          )}

          {editingAction.type === "webhook" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Webhook URL</label>
                <input
                  type="url"
                  value={editingAction.webhookUrl || ""}
                  onChange={(e) => setEditingAction({ ...editingAction, webhookUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={editingAction.webhookMethod || "POST"}
                  onChange={(e) => setEditingAction({ ...editingAction, webhookMethod: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
            </>
          )}

          {editingAction.type === "send_email" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">To</label>
                <input
                  type="email"
                  value={editingAction.emailTo || ""}
                  onChange={(e) => setEditingAction({ ...editingAction, emailTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  type="text"
                  value={editingAction.emailSubject || ""}
                  onChange={(e) => setEditingAction({ ...editingAction, emailSubject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Body</label>
                <textarea
                  value={editingAction.emailBody || ""}
                  onChange={(e) => setEditingAction({ ...editingAction, emailBody: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
                  rows={3}
                />
              </div>
            </>
          )}

          {editingAction.type === "open_url" && (
            <div>
              <label className="block text-sm font-medium mb-1">URL</label>
              <input
                type="url"
                value={editingAction.url || ""}
                onChange={(e) => setEditingAction({ ...editingAction, url: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md"
                placeholder="https://example.com or use {field_name} for record values"
              />
            </div>
          )}

          {/* Condition */}
          <div className="border-t pt-3">
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={!!editingAction.condition}
                onChange={(e) => setEditingAction({
                  ...editingAction,
                  condition: e.target.checked ? { field: "", operator: "equals", value: "" } : undefined,
                })}
                className="rounded"
              />
              <span className="text-sm font-medium">Visibility Condition</span>
            </label>
            {editingAction.condition && (
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Field"
                  value={editingAction.condition.field}
                  onChange={(e) => setEditingAction({
                    ...editingAction,
                    condition: { ...editingAction.condition!, field: e.target.value },
                  })}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm"
                />
                <select
                  value={editingAction.condition.operator}
                  onChange={(e) => setEditingAction({
                    ...editingAction,
                    condition: { ...editingAction.condition!, operator: e.target.value as any },
                  })}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm"
                >
                  <option value="equals">equals</option>
                  <option value="not_equals">not equals</option>
                  <option value="contains">contains</option>
                  <option value="greater_than">greater than</option>
                  <option value="less_than">less than</option>
                  <option value="is_empty">is empty</option>
                  <option value="is_not_empty">is not empty</option>
                </select>
                <input
                  type="text"
                  placeholder="Value"
                  value={editingAction.condition.value || ""}
                  onChange={(e) => setEditingAction({
                    ...editingAction,
                    condition: { ...editingAction.condition!, value: e.target.value },
                  })}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-700 rounded text-sm"
                />
              </div>
            )}
          </div>

          {/* Confirmation */}
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingAction.requiresConfirmation || false}
                onChange={(e) => setEditingAction({
                  ...editingAction,
                  requiresConfirmation: e.target.checked,
                })}
                className="rounded"
              />
              <span className="text-sm font-medium">Require Confirmation</span>
            </label>
            {editingAction.requiresConfirmation && (
              <input
                type="text"
                placeholder="Confirmation message"
                value={editingAction.confirmationMessage || ""}
                onChange={(e) => setEditingAction({
                  ...editingAction,
                  confirmationMessage: e.target.value,
                })}
                className="w-full mt-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm"
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Page Actions</h3>
        <Button size="sm" onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-1" />
          Add Action
        </Button>
      </div>

      {actions.length === 0 ? (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4 border border-gray-200 dark:border-gray-700 rounded">
          No actions. Click "Add Action" to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((action) => {
            const typeInfo = ACTION_TYPES.find(t => t.value === action.type);
            const Icon = typeInfo?.icon || FileEdit;
            return (
              <div
                key={action.id}
                className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded"
              >
                <div className="flex items-center gap-2 flex-1">
                  <Icon className="w-4 h-4 text-gray-500" />
                  <div>
                    <div className="font-medium">{action.label}</div>
                    <div className="text-xs text-gray-500">
                      {typeInfo?.label} • {action.scope || "page"}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleEdit(action)}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(action.id)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
