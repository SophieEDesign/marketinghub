"use client";

import { useState, useEffect, useRef } from "react";
import { X, Grid, Layout, Calendar, Clock, FileText } from "lucide-react";

interface CreateViewModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (viewName: string, viewType: "grid" | "kanban" | "calendar" | "timeline" | "cards") => Promise<void>;
  currentViewType?: string;
}

const viewTypes = [
  { id: "grid", label: "Grid", icon: Grid, description: "Spreadsheet-style view" },
  { id: "kanban", label: "Kanban", icon: Layout, description: "Board with columns" },
  { id: "calendar", label: "Calendar", icon: Calendar, description: "Calendar view" },
  { id: "timeline", label: "Timeline", icon: Clock, description: "Timeline view" },
  { id: "cards", label: "Cards", icon: FileText, description: "Card-based view" },
] as const;

export default function CreateViewModal({
  open,
  onClose,
  onCreate,
  currentViewType = "grid",
}: CreateViewModalProps) {
  const [viewName, setViewName] = useState("");
  const [selectedType, setSelectedType] = useState<"grid" | "kanban" | "calendar" | "timeline" | "cards">(currentViewType as any || "grid");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setViewName("");
      setSelectedType(currentViewType as any || "grid");
    }
  }, [open, currentViewType]);

  const handleCreate = async () => {
    if (!viewName.trim()) {
      return;
    }

    setCreating(true);
    try {
      await onCreate(viewName.trim(), selectedType);
      onClose();
      setViewName("");
    } catch (error) {
      console.error("Error creating view:", error);
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create New View
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* View Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              View Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreate();
                } else if (e.key === "Escape") {
                  onClose();
                }
              }}
              placeholder="Enter view name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* View Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              View Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {viewTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id)}
                    className={`p-3 rounded-lg border-2 transition-all text-left ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-400"}`} />
                      <span className={`text-sm font-medium ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-700 dark:text-gray-300"}`}>
                        {type.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {type.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || !viewName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            {creating ? "Creating..." : "Create View"}
          </button>
        </div>
      </div>
    </div>
  );
}

