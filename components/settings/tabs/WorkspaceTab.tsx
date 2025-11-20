"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/lib/useSettings";
import LogoUploader from "@/components/settings/LogoUploader";
import { toast } from "@/components/ui/Toast";

export default function WorkspaceTab() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [workspaceName, setWorkspaceName] = useState(settings.workspace_name || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.workspace_name) {
      setWorkspaceName(settings.workspace_name);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        workspace_name: workspaceName,
      });
      toast({
        title: "Success",
        description: "Workspace settings saved successfully!",
        type: "success",
      });
    } catch (error) {
      console.error("Error saving workspace settings:", error);
      toast({
        title: "Error",
        description: "Failed to save workspace settings",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading workspace settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-heading font-semibold text-brand-blue mb-4">Workspace Settings</h2>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Workspace Name
          </label>
          <input
            type="text"
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            className="w-full max-w-md px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            placeholder="Marketing Hub"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Logo
          </label>
          <LogoUploader />
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? "Saving..." : "Save Workspace Settings"}
        </button>
      </div>
    </div>
  );
}

