"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Calendar, Columns3, Timer, SquareStack, ChevronDown, ChevronRight, Settings, FileSpreadsheet } from "lucide-react";
import { tables } from "@/lib/tables";
import WorkspaceHeader from "./WorkspaceHeader";

// Map view types to icons
const viewIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  grid: LayoutGrid,
  kanban: Columns3,
  calendar: Calendar,
  timeline: Timer,
  cards: SquareStack,
};

// Get icon for view type
function getViewIcon(view: string) {
  const Icon = viewIcons[view] || LayoutGrid;
  return <Icon className="w-4 h-4" />;
}

// Capitalize view name
function capitalizeView(view: string): string {
  return view.charAt(0).toUpperCase() + view.slice(1);
}

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());

  // Parse current route to determine active table and view
  const pathParts = pathname.split("/").filter(Boolean);
  const currentTable = pathParts[0] || null;
  const currentView = pathParts[1] || null;

  // Initialize collapsed state: all collapsed except active table
  useEffect(() => {
    const initialCollapsed = new Set<string>();
    tables.forEach((table) => {
      if (table.id !== currentTable) {
        initialCollapsed.add(table.id);
      }
    });
    setCollapsedTables(initialCollapsed);
  }, [currentTable]);

  const toggleTable = (tableId: string) => {
    setCollapsedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };

  const isTableCollapsed = (tableId: string) => collapsedTables.has(tableId);
  const isTableActive = (tableId: string) => currentTable === tableId;
  const isViewActive = (tableId: string, view: string) =>
    currentTable === tableId && currentView === view;

  return (
    <aside className="w-64 min-h-screen bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Workspace Header */}
      <WorkspaceHeader />

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* Tables */}
        <div className="space-y-1">
          {tables.map((table) => {
            const isActive = isTableActive(table.id);
            const isCollapsed = isTableCollapsed(table.id);

            return (
              <div key={table.id} className="mb-2">
                {/* Table Header */}
                <button
                  onClick={() => toggleTable(table.id)}
                  className={`w-full flex items-center justify-between px-2 py-2 text-sm font-heading text-brand-blue tracking-wide uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition ${
                    isActive ? "bg-gray-100 dark:bg-gray-800" : ""
                  }`}
                >
                  <span>{table.name}</span>
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {/* Views */}
                {!isCollapsed && (
                  <div className="ml-1 mt-0.5 space-y-0.5">
                    {table.views.map((view) => {
                      const href = `/${table.id}/${view}`;
                      const isActiveView = isViewActive(table.id, view);

                      return (
                        <Link
                          key={view}
                          href={href}
                          className={`flex items-center gap-2 pl-6 pr-2 py-1.5 rounded text-sm transition ${
                            isActiveView
                              ? "bg-brand-red text-white font-semibold"
                              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                        >
                          {getViewIcon(view)}
                          <span>{capitalizeView(view)}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Settings Section */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Settings
          </div>
          <div className="space-y-0.5">
            <Link
              href="/settings/fields"
              className={`flex items-center gap-2 pl-6 pr-2 py-1.5 rounded text-sm transition ${
                pathname === "/settings/fields"
                  ? "bg-brand-red text-white font-semibold"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Fields</span>
            </Link>
          </div>
        </div>

        {/* Tools Section */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Tools
          </div>
          <div className="space-y-0.5">
            <Link
              href="/import"
              className={`flex items-center gap-2 pl-6 pr-2 py-1.5 rounded text-sm transition ${
                pathname === "/import"
                  ? "bg-brand-red text-white font-semibold"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Import CSV</span>
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}

