"use client";

import { X } from "lucide-react";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import GridSettings from "./settings/GridSettings";
import RecordSettings from "./settings/RecordSettings";
import KanbanSettings from "./settings/KanbanSettings";
import GallerySettings from "./settings/GallerySettings";
import CalendarSettings from "./settings/CalendarSettings";
import FormSettings from "./settings/FormSettings";
import ChartSettings from "./settings/ChartSettings";

interface PageSettingsDrawerProps {
  page: InterfacePage;
  open: boolean;
  onClose: () => void;
}

export default function PageSettingsDrawer({ page, open, onClose }: PageSettingsDrawerProps) {
  if (!open || !page) return null;

  const pageType = page.page_type || "custom";

  const renderSettings = () => {
    switch (pageType) {
      case "grid":
        return <GridSettings pageId={page.id} onClose={onClose} />;
      case "record":
        return <RecordSettings pageId={page.id} onClose={onClose} />;
      case "kanban":
        return <KanbanSettings pageId={page.id} onClose={onClose} />;
      case "gallery":
        return <GallerySettings pageId={page.id} onClose={onClose} />;
      case "calendar":
        return <CalendarSettings pageId={page.id} onClose={onClose} />;
      case "form":
        return <FormSettings pageId={page.id} onClose={onClose} />;
      case "chart":
        return <ChartSettings pageId={page.id} onClose={onClose} />;
      default:
        return (
          <div className="p-6">
            <p className="text-gray-500">Settings are not available for custom pages.</p>
          </div>
        );
    }
  };

  return (
    <div
      className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold">Page Settings</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="overflow-y-auto h-[calc(100vh-64px)]">
        {renderSettings()}
      </div>
    </div>
  );
}
