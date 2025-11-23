"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Columns3,
  Calendar,
  Timer,
  SquareStack,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Settings,
  Check,
  X,
} from "lucide-react";
import { useViewConfigs } from "@/lib/useViewConfigs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import CreateViewModal from "@/components/views/CreateViewModal";

const viewIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  grid: LayoutGrid,
  kanban: Columns3,
  calendar: Calendar,
  timeline: Timer,
  cards: SquareStack,
};

interface TableViewsListProps {
  tableId: string;
  tableName: string;
  isExpanded?: boolean;
}

export default function TableViewsList({ tableId, tableName, isExpanded = false }: TableViewsListProps) {
  const pathname = usePathname();
  const { views, currentView, createView, updateView, deleteView, setDefaultView, reloadViews } = useViewConfigs(tableId);
  const permissions = usePermissions();
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const pathParts = pathname.split("/").filter(Boolean);
  const currentTable = pathParts[0];
  const currentViewName = pathParts[1];

  const handleRename = async (viewId: string, currentName: string) => {
    setEditingViewId(viewId);
    setEditingName(currentName);
  };

  const handleSaveRename = async (viewId: string) => {
    if (editingName.trim() && editingName !== views.find(v => v.id === viewId)?.view_name) {
      await updateView(viewId, { view_name: editingName.trim() });
      await reloadViews();
    }
    setEditingViewId(null);
    setEditingName("");
  };

  const handleCancelRename = () => {
    setEditingViewId(null);
    setEditingName("");
  };

  const handleDelete = async (viewId: string, viewName: string) => {
    if (views.length <= 1) {
      alert("Cannot delete the last view. Please create another view first.");
      return;
    }
    if (confirm(`Delete view "${viewName}"?`)) {
      await deleteView(viewId);
      await reloadViews();
      setMenuOpenId(null);
    }
  };

  const handleSetDefault = async (viewId: string) => {
    await setDefaultView(viewId);
    await reloadViews();
    setMenuOpenId(null);
  };

  const handleCreateView = async (viewName: string, viewType: "grid" | "kanban" | "calendar" | "timeline" | "cards") => {
    // Create view with the specified type by passing a config object
    // The createView function expects (viewName, cloneFrom?) where cloneFrom is a ViewConfig
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
    // Pass baseConfig as the cloneFrom parameter (it will be used as the base config)
    await createView(viewName, baseConfig as any);
    await reloadViews();
    setShowCreateModal(false);
  };

  if (!isExpanded || !permissions.canModifyViews) {
    return null;
  }

  return (
    <>
      <div className="ml-8 mt-1 space-y-1">
        {views.map((view) => {
          const isActive = currentTable === tableId && currentViewName === view.view_name;
          const Icon = viewIcons[view.view_type || "grid"] || LayoutGrid;
          const isEditing = editingViewId === view.id;

          return (
            <div
              key={view.id}
              className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition ${
                isActive
                  ? "bg-brand-blue/10 text-brand-blue dark:bg-brand-blue/20 dark:text-brand-blue"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {isEditing ? (
                <>
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleSaveRename(view.id);
                      } else if (e.key === "Escape") {
                        handleCancelRename();
                      }
                    }}
                    className="flex-1 px-2 py-0.5 text-xs border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveRename(view.id)}
                    className="p-0.5 text-green-600 hover:text-green-700 dark:text-green-400 rounded"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCancelRename}
                    className="p-0.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={`/${tableId}/${view.view_name}`}
                    className="flex items-center gap-2 flex-1 min-w-0"
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate">{view.view_name}</span>
                  </Link>
                  {permissions.canModifyViews && (
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === view.id ? null : view.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                      {menuOpenId === view.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpenId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[160px] z-20">
                            <button
                              onClick={() => {
                                handleRename(view.id, view.view_name);
                                setMenuOpenId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Rename</span>
                            </button>
                            <button
                              onClick={() => {
                                handleSetDefault(view.id);
                              }}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Set as default</span>
                            </button>
                            <Link
                              href={`/${tableId}/${view.view_name}`}
                              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                              onClick={() => setMenuOpenId(null)}
                            >
                              <Settings className="w-3.5 h-3.5" />
                              <span>Settings</span>
                            </Link>
                            {views.length > 1 && (
                              <button
                                onClick={() => {
                                  handleDelete(view.id, view.view_name);
                                }}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        {permissions.canModifyViews && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="ml-8 flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New view</span>
          </button>
        )}
      </div>
      {showCreateModal && (
        <CreateViewModal
          open={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateView}
          currentViewType="grid"
        />
      )}
    </>
  );
}

