"use client";

import { useState, useEffect } from "react";
import { Zap, CheckCircle, AlertCircle, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

export default function AutomationsTab() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load automation rules (if stored in database)
    // For now, show built-in automations
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
  }, []);

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

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800 hover:shadow-sm transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    {rule.name}
                  </h3>
                  {rule.enabled ? (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      Disabled
                    </span>
                  )}
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
            </div>
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

