"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LayoutGrid, Columns3, Calendar, Clock, FileText, Plus } from "lucide-react";
import { useViewConfigs } from "@/lib/useViewConfigs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import CreateViewModal from "./CreateViewModal";

const viewTypeIcons = {
  grid: LayoutGrid,
  kanban: Columns3,
  calendar: Calendar,
  timeline: Clock,
  cards: FileText,
};

interface ViewTabsProps {
  tableId: string;
  tableName: string;
}

export default function ViewTabs({ tableId, tableName }: ViewTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { views, currentView, createView, reloadViews } = useViewConfigs(tableId);
  const permissions = usePermissions();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Get current view name from URL or use currentView
  const pathParts = pathname.split("/").filter(Boolean);
  // Path is /tables/[tableId]/[viewName] so viewName is at index 2
  const currentViewName = pathParts[2] || currentView?.view_name;

  const handleViewClick = (viewName: string, viewType: string) => {
    router.push(`/tables/${tableId}/${viewName}`);
  };

  const handleCreateView = async (viewName: string, viewType: "grid" | "kanban" | "calendar" | "timeline" | "cards") => {
    const baseConfig = {
      view_type: viewType,
      column_order: [],
      column_widths: {},
      hidden_columns: [],
      filters: [],
      sort: [],
      groupings: [],
      row_height: "medium" as const,
    };
    await createView(viewName, baseConfig as any);
    await reloadViews();
    setShowCreateModal(false);
    // Navigate to the new view
    router.push(`/tables/${tableId}/${viewName}`);
  };

  if (views.length === 0) {
    return (
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">No views yet</span>
          {permissions.canModifyViews && (
            <>
              <button
                onClick={() => setShowCreateModal(true)}
                className="ml-auto px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                New View
              </button>
              <CreateViewModal
                open={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onCreate={handleCreateView}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {views.map((view) => {
            const Icon = viewTypeIcons[view.view_type as keyof typeof viewTypeIcons] || LayoutGrid;
            const isActive = currentViewName === view.view_name || (currentViewName === undefined && view.is_default);
            
            return (
              <button
                key={view.id}
                onClick={() => handleViewClick(view.view_name, view.view_type)}
                className={`
                  flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${
                    isActive
                      ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                      : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{view.view_name}</span>
                {view.is_default && (
                  <span className="text-xs text-gray-400 dark:text-gray-500">(default)</span>
                )}
              </button>
            );
          })}
          {permissions.canModifyViews && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="ml-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New View
            </button>
          )}
        </div>
      </div>
      <CreateViewModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateView}
      />
    </>
  );
}

