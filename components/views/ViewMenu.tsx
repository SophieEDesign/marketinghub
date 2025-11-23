"use client";

import { useState, useRef, useEffect } from "react";
import { Edit2, Copy, Trash2, Check, X, MoreVertical, Grid, Layout, Calendar, Clock, FileText } from "lucide-react";
import { ViewConfig } from "@/lib/types/viewConfig";

interface ViewMenuProps {
  view: ViewConfig | null;
  views: ViewConfig[];
  onRename: (newName: string) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
  onSetDefault: () => Promise<void>;
  onChangeViewType: (viewType: "grid" | "kanban" | "calendar" | "timeline" | "cards") => Promise<void>;
  onResetLayout: () => Promise<void>;
  onCreateView: () => Promise<void>;
}

const viewTypeIcons = {
  grid: Grid,
  kanban: Layout,
  calendar: Calendar,
  timeline: Clock,
  cards: FileText,
};

export default function ViewMenu({
  view,
  views,
  onRename,
  onDuplicate,
  onDelete,
  onSetDefault,
  onChangeViewType,
  onResetLayout,
  onCreateView,
}: ViewMenuProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(view?.view_name || "");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view) {
      setNewName(view.view_name);
    }
  }, [view]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

  const handleRename = async () => {
    if (newName.trim() && newName !== view?.view_name) {
      try {
        await onRename(newName.trim());
      } catch (error) {
        console.error("Error renaming view:", error);
        // Reset to original name on error
        setNewName(view?.view_name || "");
      }
    } else {
      // Reset to original name if empty or unchanged
      setNewName(view?.view_name || "");
    }
    setIsRenaming(false);
  };

  if (!view) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onCreateView}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition"
        >
          + New View
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 relative" ref={menuRef}>
      {isRenaming ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setIsRenaming(false);
                setNewName(view.view_name);
              }
            }}
            className="px-2 py-1 text-sm font-semibold border border-blue-500 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[150px]"
            placeholder="View name"
          />
          <button
            onClick={handleRename}
            className="p-1.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 rounded hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            title="Save"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setIsRenaming(false);
              setNewName(view.view_name);
            }}
            className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 group">
            <button
              onClick={() => setIsRenaming(true)}
              onDoubleClick={() => setIsRenaming(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition"
              title="Click or double-click to rename"
            >
              <span>{view.view_name}</span>
            </button>
            <button
              onClick={() => setIsRenaming(true)}
              className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity rounded hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Rename view"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px] z-50">
                <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">View Type</div>
                  <div className="flex flex-wrap gap-1">
                    {(["grid", "kanban", "calendar", "timeline", "cards"] as const).map((type) => {
                      const Icon = viewTypeIcons[type];
                      const isActive = view.view_type === type;
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            onChangeViewType(type);
                            setShowMenu(false);
                          }}
                          className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition ${
                            isActive
                              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                              : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          <span className="capitalize">{type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => {
                    onDuplicate();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  <span>Duplicate view</span>
                </button>

                {!view.is_default && (
                  <button
                    onClick={() => {
                      onSetDefault();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Set as default</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    onResetLayout();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span>Reset layout</span>
                </button>

                {views.length > 1 && (
                  <>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                    <button
                      onClick={() => {
                        if (confirm(`Delete view "${view.view_name}"?`)) {
                          onDelete();
                        }
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete view</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

