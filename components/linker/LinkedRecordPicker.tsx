"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useLinker } from "@/lib/linkerState";

export default function LinkedRecordPicker() {
  const { open, setOpen, mode, multiSelect, onSelect } = useLinker();
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !mode) return;

    async function load() {
      setLoading(true);
      // mode is guaranteed to be non-null due to check above
      let query = supabase.from(mode!).select("*");

      if (search) {
        const searchField = mode! === "campaigns" ? "name" : "name";
        query = query.ilike(searchField, `%${search}%`);
      }

      const { data } = await query.limit(50);
      setRecords(data || []);
      setLoading(false);
    }

    load();
  }, [open, mode, search]);

  const handleSelect = (id: string) => {
    if (multiSelect) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const handleConfirm = () => {
    if (onSelect && selectedIds.length > 0) {
      onSelect(selectedIds);
      setOpen(false);
      setSelectedIds([]);
      setSearch("");
    }
  };

  if (!open || !mode) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      {/* Picker */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden m-4">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              Select {mode === "campaigns" ? "Campaign" : "Contact"}
              {multiSelect ? "s" : ""}
            </h2>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            className="w-full p-2 rounded bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700"
            placeholder={`Search ${mode}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              Loading...
            </div>
          ) : records.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              No {mode} found
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {records.map((record) => {
                const isSelected = selectedIds.includes(record.id);
                return (
                  <div
                    key={record.id}
                    onClick={() => handleSelect(record.id)}
                    className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      isSelected ? "bg-blue-100 dark:bg-blue-900" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {multiSelect && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelect(record.id)}
                          className="rounded"
                        />
                      )}
                      <span className="font-medium">
                        {record.name || record.title || "Untitled"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={() => setOpen(false)}
            className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

