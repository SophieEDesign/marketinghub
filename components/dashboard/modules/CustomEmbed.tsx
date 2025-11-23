"use client";

import { useState } from "react";
import { ExternalLink, AlertCircle } from "lucide-react";

interface CustomEmbedConfig {
  title?: string;
  url: string;
  height?: number;
}

interface CustomEmbedModuleProps {
  config: CustomEmbedConfig;
  width: number;
  height: number;
  onUpdate?: (config: Partial<CustomEmbedConfig>) => void;
  isEditing?: boolean;
}

export default function CustomEmbedModule({ config, width, height, onUpdate, isEditing = false }: CustomEmbedModuleProps) {
  const [loadError, setLoadError] = useState(false);

  if (!config.url) {
    return (
      <div className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No URL configured</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"
      style={{ minHeight: `${height * 50}px` }}
    >
      <div className="flex flex-col h-full">
        {config.title && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {config.title}
            </h3>
            <a
              href={config.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand-blue hover:text-brand-red flex items-center gap-1"
            >
              Open
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          {loadError ? (
            <div className="h-full flex items-center justify-center p-4">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Failed to load embed
                </p>
                <a
                  href={config.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-blue hover:text-brand-red"
                >
                  Open in new tab
                </a>
              </div>
            </div>
          ) : (
            <iframe
              src={config.url}
              className="w-full h-full border-0"
              onError={() => setLoadError(true)}
              title={config.title || "Embedded content"}
            />
          )}
        </div>
      </div>
    </div>
  );
}

