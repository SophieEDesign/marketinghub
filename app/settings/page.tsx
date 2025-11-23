"use client";

export const dynamic = 'force-dynamic';

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  User,
  Building2,
  Database,
  Zap,
  ChevronRight,
} from "lucide-react";
import AccountSettingsTab from "@/components/settings/tabs/AccountSettingsTab";
import WorkspaceSettingsTab from "@/components/settings/tabs/WorkspaceSettingsTab";
import DataTablesTab from "@/components/settings/tabs/DataTablesTab";
import AutomationsTab from "@/components/settings/tabs/AutomationsTab";
import { usePermissions } from "@/lib/hooks/usePermissions";

const SETTINGS_SECTIONS = [
  { 
    id: "account", 
    label: "Account", 
    icon: User, 
    component: AccountSettingsTab,
    description: "Your personal settings"
  },
  { 
    id: "workspace", 
    label: "Workspace", 
    icon: Building2, 
    component: WorkspaceSettingsTab,
    description: "Workspace configuration (Admin only)",
    adminOnly: true
  },
  { 
    id: "data", 
    label: "Data & Tables", 
    icon: Database, 
    component: DataTablesTab,
    description: "Manage tables, fields, views, and imports"
  },
  { 
    id: "automations", 
    label: "Automations", 
    icon: Zap, 
    component: AutomationsTab,
    description: "Build and manage automation workflows"
  },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const activeSection = searchParams.get("section") || "account";
  const permissions = usePermissions();

  const currentSection = SETTINGS_SECTIONS.find((s) => s.id === activeSection) || SETTINGS_SECTIONS[0];
  const TabComponent = currentSection.component;

  // Filter sections based on permissions
  const visibleSections = SETTINGS_SECTIONS.filter((section) => {
    if (section.adminOnly && permissions.role !== "admin") {
      return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-heading font-bold text-brand-blue mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your account, workspace, data, and automations
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-64 flex-shrink-0">
          <nav className="space-y-1">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;
              return (
                <a
                  key={section.id}
                  href={`/settings?section=${section.id}`}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-800"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{section.label}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {section.description}
                    </div>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4" />}
                </a>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <TabComponent />
          </div>
        </div>
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
