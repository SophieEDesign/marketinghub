"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import { Search, X, FileText, Grid, Calendar, Kanban, Clock, Layout, Plus } from "lucide-react";
import { getAllTables, getTableLabel } from "@/lib/tableMetadata";
import { supabase } from "@/lib/supabaseClient";

interface CommandItem {
  id: string;
  type: "table" | "view" | "action";
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
}

export default function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tables, setTables] = useState<string[]>([]);
  const [views, setViews] = useState<Array<{ id: string; table_name: string; view_name: string; view_type: string }>>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Load tables and views
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    // Load tables
    const allTables = getAllTables();
    setTables(allTables);

    // Load views for all tables
    try {
      const { data: viewsData } = await supabase
        .from("table_view_configs")
        .select("id, table_name, view_name, view_type")
        .order("table_name")
        .order("view_name");

      if (viewsData) {
        setViews(viewsData);
      }
    } catch (error) {
      console.warn("Error loading views:", error);
      setViews([]);
    }
  };

  // Build command items
  const commandItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // Action items are now handled dynamically via table navigation

    // Add table items
    tables.forEach((tableId) => {
      const tableLabel = getTableLabel(tableId);
      items.push({
        id: `table-${tableId}`,
        type: "table",
        label: `Switch to ${tableLabel}`,
        description: `Open ${tableLabel} table`,
        icon: <FileText className="w-4 h-4" />,
        action: () => {
          router.push(`/${tableId}/grid`);
          setIsOpen(false);
        },
      });
    });

    // Add view items
    views.forEach((view) => {
      const tableLabel = getTableLabel(view.table_name);
      const viewTypeIcons: Record<string, React.ReactNode> = {
        grid: <Grid className="w-4 h-4" />,
        kanban: <Kanban className="w-4 h-4" />,
        calendar: <Calendar className="w-4 h-4" />,
        timeline: <Clock className="w-4 h-4" />,
        cards: <Layout className="w-4 h-4" />,
      };

      items.push({
        id: `view-${view.id}`,
        type: "view",
        label: `${view.view_name} (${tableLabel})`,
        description: `${tableLabel} - ${view.view_type} view`,
        icon: viewTypeIcons[view.view_type] || <Grid className="w-4 h-4" />,
        action: () => {
          router.push(`/${view.table_name}/${view.view_type}`);
          setIsOpen(false);
        },
      });
    });

    return items;
  }, [tables, views, router]);

  // Fuzzy search
  const fuse = useMemo(
    () =>
      new Fuse(commandItems, {
        keys: ["label", "description"],
        threshold: 0.3,
        includeScore: true,
      }),
    [commandItems]
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      return commandItems.slice(0, 10); // Show first 10 items when no query
    }
    const results = fuse.search(query);
    return results.map((result) => result.item).slice(0, 10);
  }, [query, fuse, commandItems]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K to open
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }

      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        setSelectedIndex(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Handle navigation in results
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex]);

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh] p-4"
      onClick={() => {
        setIsOpen(false);
        setQuery("");
        setSelectedIndex(0);
      }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full max-w-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tables, views, or actions..."
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400"
            autoFocus
          />
          <button
            onClick={() => {
              setIsOpen(false);
              setQuery("");
              setSelectedIndex(0);
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
              No results found
            </div>
          ) : (
            <div className="py-2">
              {filteredItems.map((item, index) => (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                    index === selectedIndex ? "bg-gray-100 dark:bg-gray-800" : ""
                  }`}
                >
                  <div className="text-gray-400">{item.icon}</div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.label}
                    </div>
                    {item.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {item.description}
                      </div>
                    )}
                  </div>
                  {item.type === "action" && (
                    <div className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                      Action
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">↓</kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Enter</kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">Esc</kbd>
              <span>Close</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

