"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AppLogo from "./branding/AppLogo";
import { tables } from "@/lib/tables";

export default function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  // Parse current route to determine active table and view
  const pathParts = path.split("/").filter(Boolean);
  const currentTable = pathParts[0] || null;
  const currentView = pathParts[1] || null;

  if (collapsed) {
    return (
      <aside className="w-16 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 p-2 flex flex-col items-center">
        <button
          onClick={() => setCollapsed(false)}
          className="mb-4 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
          title="Expand sidebar"
        >
          ☰
        </button>
        <AppLogo />
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <AppLogo />
        <button
          onClick={() => setCollapsed(true)}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
          title="Collapse sidebar"
        >
          ◀
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tables.map((table) => {
          const isTableActive = currentTable === table.id;
          return (
            <div key={table.id} className="mb-1">
              <div
                className={`px-3 py-2 font-semibold text-xs uppercase tracking-wide mb-1 ${
                  isTableActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {table.name}
              </div>
              <div className="ml-1 flex flex-col gap-0.5">
                {table.views.map((view) => {
                  const href = `/${table.id}/${view}`;
                  const isActive = currentTable === table.id && currentView === view;
                  return (
                    <Link
                      key={view}
                      href={href}
                      className={`px-3 py-1.5 rounded text-sm transition ${
                        isActive
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium border-l-2 border-blue-600 dark:border-blue-400"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {view.charAt(0).toUpperCase() + view.slice(1)}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

