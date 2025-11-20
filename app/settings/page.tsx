"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  Database,
  Palette,
  Layout,
  Building2,
  Zap,
  ChevronRight,
} from "lucide-react";
import FieldManagerTab from "@/components/settings/tabs/FieldManagerTab";
import AppearanceTab from "@/components/settings/tabs/AppearanceTab";
import LayoutsTab from "@/components/settings/tabs/LayoutsTab";
import WorkspaceTab from "@/components/settings/tabs/WorkspaceTab";
import AutomationsTab from "@/components/settings/tabs/AutomationsTab";

const SETTINGS_TABS = [
  { id: "fields", label: "Fields", icon: Database, component: FieldManagerTab },
  { id: "appearance", label: "Appearance", icon: Palette, component: AppearanceTab },
  { id: "layouts", label: "Layouts", icon: Layout, component: LayoutsTab },
  { id: "automations", label: "Automations", icon: Zap, component: AutomationsTab },
  { id: "workspace", label: "Workspace", icon: Building2, component: WorkspaceTab },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "fields";

  const currentTab = SETTINGS_TABS.find((t) => t.id === activeTab) || SETTINGS_TABS[0];
  const TabComponent = currentTab.component;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-heading font-bold text-brand-blue mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your workspace configuration, fields, appearance, and layouts
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === activeTab;
            return (
              <a
                key={tab.id}
                href={`/settings?tab=${tab.id}`}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-brand-red text-brand-red"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <TabComponent />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6">
          <div className="text-sm text-gray-500">Loading settings...</div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}

