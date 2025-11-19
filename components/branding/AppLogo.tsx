"use client";

import { useSettings } from "@/lib/useSettings";

export default function AppLogo() {
  const { settings, isLoading } = useSettings();

  if (isLoading) {
    return (
      <div className="text-lg font-bold opacity-70">
        Workspace
      </div>
    );
  }

  if (!settings.logo_url) {
    return (
      <div className="text-lg font-bold opacity-70">
        Workspace
      </div>
    );
  }

  return (
    <img
      src={settings.logo_url}
      alt="Logo"
      className="h-8 w-auto object-contain"
      onError={(e) => {
        // If image fails to load, show fallback
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const parent = target.parentElement;
        if (parent && !parent.querySelector('.logo-fallback')) {
          const fallback = document.createElement('div');
          fallback.className = 'text-lg font-bold opacity-70 logo-fallback';
          fallback.textContent = 'Workspace';
          parent.appendChild(fallback);
        }
      }}
    />
  );
}

