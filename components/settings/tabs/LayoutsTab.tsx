"use client";

import { useState } from "react";
import { tables } from "@/lib/tables";
import { Info } from "lucide-react";

export default function LayoutsTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-heading font-semibold text-brand-blue mb-2">Layout Settings</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Layout customization is managed directly within each view. Use the "Edit Layout" buttons in:
        </p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Drawer Layouts
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Reorder sections in the Record Drawer by clicking "Edit Layout" in any drawer header.
            Settings are saved per table automatically.
          </p>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Field Order
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Reorder fields within the Record Drawer Details section by clicking "Edit Field Order" in the Details section header.
            Settings are saved per table automatically.
          </p>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            View Settings
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Customize field visibility, order, and view-specific options using the "⚙️ Settings" button in each view header.
            Settings are saved per view automatically.
          </p>
        </div>

        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
            <Info className="w-4 h-4" />
            Sidebar & Dashboard Layouts
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Reorder sidebar items and dashboard modules using "Edit Layout" buttons in the sidebar and dashboard.
            Settings are saved globally automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

