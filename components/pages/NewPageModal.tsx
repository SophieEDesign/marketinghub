"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Button from "@/components/ui/Button";
import { toast } from "@/components/ui/Toast";
import { PAGE_TYPES } from "@/lib/pages/pageTypes";
import type { PageTypeId } from "@/lib/pages/pageTypes";

export type PageLayout = 
  | "grid" 
  | "kanban" 
  | "calendar" 
  | "timeline" 
  | "gallery" 
  | "list" 
  | "dashboard" 
  | "form" 
  | "team"
  | "overview"
  | "record_review"
  | "custom";

interface NewPageModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, layout: PageLayout, pageType?: string) => Promise<void>;
}

export default function NewPageModal({ open, onClose, onCreate }: NewPageModalProps) {
  const [name, setName] = useState("");
  const [selectedPageType, setSelectedPageType] = useState<PageTypeId>("custom");
  const [creating, setCreating] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Page name is required",
        type: "error",
      });
      return;
    }

    setCreating(true);
    try {
      await onCreate(name.trim(), selectedLayout);
      setName("");
      setSelectedLayout("custom");
      onClose();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create page",
        type: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create New Page</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Page Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
                placeholder="e.g., Content Overview"
                autoFocus
              />
            </div>
          </div>

          {/* Page Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Choose Page Type *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {PAGE_TYPES.map((pageType) => {
                const Icon = pageType.icon;
                const isSelected = selectedPageType === pageType.id;
                return (
                  <button
                    key={pageType.id}
                    type="button"
                    onClick={() => setSelectedPageType(pageType.id as PageTypeId)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-2 ${isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}`} />
                    <div className={`text-sm font-medium mb-1 ${isSelected ? "text-blue-900 dark:text-blue-100" : "text-gray-900 dark:text-white"}`}>
                      {pageType.label}
                    </div>
                    {pageType.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {pageType.description}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={creating || !name.trim()}>
              {creating ? "Creating..." : "Create Page"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

