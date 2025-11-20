"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Search, ArrowRight, FileText, Calendar, Users, Lightbulb, Image, CheckSquare } from "lucide-react";
import { useSearch } from "./SearchProvider";
import { supabase } from "@/lib/supabaseClient";
import { useModal } from "@/lib/modalState";
import { useDrawer } from "@/lib/drawerState";
import { useDebounce } from "@/lib/hooks/useDebounce";

// Dynamically import Fuse.js if available
let Fuse: any = null;
if (typeof window !== "undefined") {
  try {
    Fuse = require("fuse.js");
  } catch {
    // Fuse.js not installed, will use simple search
  }
}

interface SearchResult {
  id: string;
  table: string;
  title: string;
  subtitle?: string;
  data: any;
}

interface GroupedResults {
  [table: string]: SearchResult[];
}

const TABLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  content: FileText,
  campaigns: Calendar,
  contacts: Users,
  ideas: Lightbulb,
  media: Image,
  tasks: CheckSquare,
};

const TABLE_LABELS: Record<string, string> = {
  content: "Content",
  campaigns: "Campaigns",
  contacts: "Contacts",
  ideas: "Ideas",
  media: "Media",
  tasks: "Tasks",
};

// Search configuration for each table
const SEARCH_CONFIG: Record<string, { fields: string[]; titleField: string; subtitleField?: string }> = {
  content: {
    fields: ["title", "description", "channels", "status"],
    titleField: "title",
    subtitleField: "publish_date",
  },
  campaigns: {
    fields: ["name", "description", "status"],
    titleField: "name",
    subtitleField: "start_date",
  },
  contacts: {
    fields: ["name", "email", "phone", "company"],
    titleField: "name",
    subtitleField: "company",
  },
  ideas: {
    fields: ["title", "description", "category"],
    titleField: "title",
    subtitleField: "category",
  },
  media: {
    fields: ["publication", "url", "notes"],
    titleField: "publication",
    subtitleField: "date",
  },
  tasks: {
    fields: ["title", "description", "status"],
    titleField: "title",
    subtitleField: "due_date",
  },
};

export default function GlobalSearch() {
  const { showSearch, closeSearch } = useSearch();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 150);
  const [results, setResults] = useState<GroupedResults>({});
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const { setOpen: setModalOpen, setTableId: setModalTableId } = useModal();
  const { setOpen: setDrawerOpen, setRecordId, setTableId: setDrawerTableId } = useDrawer();

  // Load all data on mount (for client-side search) - optimized with caching
  useEffect(() => {
    if (!showSearch) return;

    async function loadAllData() {
      setLoading(true);
      
      // Try to get from cache first
      const cacheKey = "globalSearch:all";
      const { getOrFetch } = await import("@/lib/cache/metadataCache");
      
      const loadData = async () => {
        const allData: SearchResult[] = [];

        // Load from all tables in parallel
        const promises = Object.keys(SEARCH_CONFIG).map(async (table) => {
          try {
            const config = SEARCH_CONFIG[table];
            // Select only needed columns for search
            const columns = `id, ${config.titleField}, ${config.subtitleField || ""}, description, status, channels, company, email, phone, category, publication, url, notes`.split(", ").filter(Boolean).join(", ");
            
            const { data, error } = await supabase
              .from(table)
              .select(columns)
              .limit(500); // Reduced from 1000
              
            if (error) {
              console.error(`Error loading ${table}:`, error);
              return [];
            }

            if (data) {
              return data.map((record) => {
                const recordData = record as Record<string, any>;
                const title = recordData[config.titleField] || "Untitled";
                const subtitle = config.subtitleField
                  ? formatSubtitle(recordData[config.subtitleField], config.subtitleField)
                  : undefined;

                return {
                  id: recordData.id,
                  table,
                  title: String(title),
                  subtitle,
                  data: recordData,
                };
              });
            }
            return [];
          } catch (err) {
            console.error(`Error fetching ${table}:`, err);
            return [];
          }
        });

        const results = await Promise.all(promises);
        return results.flat();
      };

      const data = await getOrFetch(cacheKey, loadData, 5 * 60 * 1000); // 5 min cache
      setAllResults(data);
      setLoading(false);
    }

    loadAllData();
  }, [showSearch]);

  // Search with debounce
  useEffect(() => {
    if (!showSearch) return;

    if (!debouncedQuery.trim()) {
      setResults({});
      setSelectedIndex(0);
      return;
    }

    let filtered: SearchResult[] = [];

    if (Fuse && allResults.length > 0) {
      // Use Fuse.js for fuzzy matching
      const fuse = new Fuse.default(allResults, {
        keys: allResults.map((r) => {
          const config = SEARCH_CONFIG[r.table];
          return config.fields.map((field) => `data.${field}`);
        }).flat(),
        threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
        includeScore: true,
        minMatchCharLength: 2,
      });

      const fuseResults = fuse.search(debouncedQuery);
      filtered = fuseResults.map((result: any) => result.item).slice(0, 30);
    } else {
      // Fallback to simple client-side search
      const searchLower = debouncedQuery.toLowerCase();
      
      allResults.forEach((result) => {
        const config = SEARCH_CONFIG[result.table];
        let matches = false;

        // Check if query matches any searchable field
        for (const field of config.fields) {
          const value = result.data[field];
          if (value) {
            const valueStr = Array.isArray(value) ? value.join(" ") : String(value);
            if (valueStr.toLowerCase().includes(searchLower)) {
              matches = true;
              break;
            }
          }
        }

        if (matches) {
          filtered.push(result);
        }
      });

      // Limit to 30 results
      filtered = filtered.slice(0, 30);
    }

    // Group by table
    const grouped: GroupedResults = {};
    filtered.forEach((result) => {
      if (!grouped[result.table]) {
        grouped[result.table] = [];
      }
      grouped[result.table].push(result);
    });

    setResults(grouped);
    setSelectedIndex(0);
  }, [debouncedQuery, allResults, showSearch]);

  // Keyboard navigation
  useEffect(() => {
    if (!showSearch) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const total = getTotalResults(results);
          return prev < total - 1 ? prev + 1 : prev;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleSelectResult();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSearch, results, selectedIndex]);

  // Focus input when modal opens
  useEffect(() => {
    if (showSearch && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [showSearch]);

  const getTotalResults = (grouped: GroupedResults): number => {
    return Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
  };

  const getResultByIndex = (index: number): SearchResult | null => {
    let current = 0;
    for (const table of Object.keys(results)) {
      for (const result of results[table]) {
        if (current === index) return result;
        current++;
      }
    }
    return null;
  };

  const handleSelectResult = () => {
    const result = getResultByIndex(selectedIndex);
    if (result) {
      handleOpenRecord(result);
    }
  };

  const handleOpenRecord = (result: SearchResult) => {
    closeSearch();
    setQuery("");
    
    // Navigate to table view and open drawer
    router.push(`/${result.table}/grid`);
    
    // Open drawer with the record
    setTimeout(() => {
      setDrawerTableId(result.table);
      setRecordId(result.id);
      setDrawerOpen(true);
    }, 100);
  };

  const handleCreateNew = (table: string, query: string) => {
    closeSearch();
    setQuery("");
    setModalTableId(table);
    setModalOpen(true);
    // Note: The NewRecordModal would need to be updated to accept initial data
    // For now, it will open with empty form
  };

  const formatSubtitle = (value: any, field: string): string | undefined => {
    if (!value) return undefined;
    
    if (field.includes("date") || field.includes("Date")) {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    }
    
    return String(value);
  };

  if (!showSearch) return null;

  const totalResults = getTotalResults(results);
  const hasResults = totalResults > 0;
  const showQuickActions = !hasResults && query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeSearch}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all tables... (Cmd+K, Ctrl+K, or /)"
              className="flex-1 bg-transparent outline-none text-lg placeholder-gray-400 dark:placeholder-gray-500"
              autoFocus
            />
            <button
              onClick={closeSearch}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
              title="Close (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : hasResults ? (
            <div className="p-2">
              {Object.entries(results).map(([table, tableResults]) => {
                const Icon = TABLE_ICONS[table] || FileText;
                let resultIndex = 0;
                
                // Calculate starting index for this table
                for (const t of Object.keys(results)) {
                  if (t === table) break;
                  resultIndex += results[t].length;
                }

                return (
                  <div key={table} className="mb-4">
                    {/* Category Header */}
                    <div className="px-3 py-2 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                      {TABLE_LABELS[table]} ({tableResults.length})
                    </div>

                    {/* Results */}
                    {tableResults.map((result, idx) => {
                      const globalIndex = resultIndex + idx;
                      const isSelected = globalIndex === selectedIndex;

                      return (
                        <div
                          key={result.id}
                          onClick={() => handleOpenRecord(result)}
                          className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition ${
                            isSelected
                              ? "bg-brand-red/10 text-brand-red border border-brand-red"
                              : "hover:bg-gray-100 dark:hover:bg-gray-800"
                          }`}
                        >
                          <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{result.title}</div>
                            {result.subtitle && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                                {result.subtitle}
                              </div>
                            )}
                          </div>
                          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ) : showQuickActions ? (
            <div className="p-4">
              <div className="text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold mb-3">
                Create New
              </div>
              {["content", "ideas", "contacts"].map((table) => {
                const Icon = TABLE_ICONS[table] || FileText;
                return (
                  <div
                    key={table}
                    onClick={() => handleCreateNew(table, query)}
                    className="flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  >
                    <Icon className="w-4 h-4 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-medium">
                        + Create new {TABLE_LABELS[table]} "{query}"
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : query.trim() ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No results found
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Start typing to search...
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
          <div>
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
              ↑↓
            </kbd>{" "}
            Navigate{" "}
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
              Enter
            </kbd>{" "}
            Open{" "}
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600">
              Esc
            </kbd>{" "}
            Close
          </div>
          {totalResults > 0 && (
            <div>{totalResults} result{totalResults !== 1 ? "s" : ""}</div>
          )}
        </div>
      </div>
    </div>
  );
}

