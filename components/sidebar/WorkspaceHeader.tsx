"use client";

import { useSettings } from "@/lib/useSettings";

export default function WorkspaceHeader() {
  const { settings, isLoading } = useSettings();

  return (
    <div className="px-3 py-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-3">
        {settings.logo_url && !isLoading && (
          <img
            src={settings.logo_url}
            alt="Logo"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        )}
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {settings.workspace_name || "Workspace"}
          </h1>
        </div>
      </div>
    </div>
  );
}

