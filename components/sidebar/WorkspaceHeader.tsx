"use client";

import { useSettings } from "@/lib/useSettings";
import { getBrand } from "@/lib/brand";

interface WorkspaceHeaderProps {
  collapsed?: boolean;
}

export default function WorkspaceHeader({ collapsed = false }: WorkspaceHeaderProps) {
  const { settings, isLoading } = useSettings();
  const brand = getBrand();

  const logoUrl = settings.logo_url || brand.logo;
  const workspaceName = settings.workspace_name || brand.name;

  return (
    <div className="flex items-center gap-3 transition-all duration-200 ease-in-out">
      {logoUrl && !isLoading && (
        <img
          src={logoUrl}
          alt="Logo"
          className={`object-contain transition-all duration-200 ease-in-out ${
            collapsed ? "h-6 w-6" : "h-8 w-auto"
          }`}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
          }}
        />
      )}
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-heading font-semibold text-brand-blue dark:text-gray-100 tracking-wide truncate">
            {workspaceName}
          </h1>
        </div>
      )}
    </div>
  );
}

