"use client";

import { useSettings } from "@/lib/useSettings";
import { getBrand } from "@/lib/brand";

export default function WorkspaceHeader() {
  const { settings, isLoading } = useSettings();
  const brand = getBrand();

  return (
    <div className="px-3 py-4 border-b border-gray-200 dark:border-gray-700 bg-brand-light dark:bg-gray-900">
      <div className="flex items-center gap-3">
        {(settings.logo_url || brand.logo) && !isLoading && (
          <img
            src={settings.logo_url || brand.logo}
            alt="Logo"
            className="h-8 w-auto object-contain"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = "none";
            }}
          />
        )}
        <div className="flex-1">
          <h1 className="text-lg font-heading font-semibold text-brand-blue dark:text-gray-100 tracking-wide">
            {settings.workspace_name || brand.name}
          </h1>
        </div>
      </div>
    </div>
  );
}

