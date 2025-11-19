"use client";

import { useEffect, useState } from "react";
import { searchLinkedRecords, getRecordDisplayValue } from "@/lib/linkedRecords";
import { X, Search } from "lucide-react";

interface LinkedRecordPickerProps {
  table: string; // target table e.g. "campaigns"
  displayField: string; // field to show e.g. "name"
  value: string | null; // current linked record id
  onChange: (id: string | null) => void;
  onClose?: () => void;
  multi?: boolean; // future: support multiple records
}

export default function LinkedRecordPicker({
  table,
  displayField,
  value,
  onChange,
  onClose,
  multi = false,
}: LinkedRecordPickerProps) {
  const [search, setSearch] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    value ? [value] : []
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      const results = await searchLinkedRecords(table, displayField, search);
      setRecords(results);
      setLoading(false);
    }
    load();
  }, [table, displayField, search]);

  const handleSelect = (id: string) => {
    if (multi) {
      setSelectedIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
      onChange(id);
      if (onClose) onClose();
    }
  };

  const handleConfirm = () => {
    if (multi) {
      onChange(selectedIds.length > 0 ? selectedIds[0] : null); // For now, single only
      if (onClose) onClose();
    }
  };

  const handleClear = () => {
    onChange(null);
    setSelectedIds([]);
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Picker Modal */}
      <div className="relative bg-white dark:bg-gray-950 rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden m-4 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-heading text-brand-blue">
              Select from {table}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-red"
              placeholder={`Search ${table}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-[50vh]">
          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-brand-red mb-2"></div>
              <p className="text-sm">Loading...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p className="text-sm">No records found</p>
              {search && (
                <p className="text-xs mt-1">Try a different search term</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {records.map((record) => {
                const isSelected = selectedIds.includes(record.id);
                const displayValue = getRecordDisplayValue(record, displayField);
                return (
                  <div
                    key={record.id}
                    onClick={() => handleSelect(record.id)}
                    className={`p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition ${
                      isSelected
                        ? "bg-brand-red/10 dark:bg-brand-red/20 border-l-2 border-brand-red"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {multi && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelect(record.id)}
                          className="rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {displayValue}
                      </span>
                      {isSelected && !multi && (
                        <span className="ml-auto text-xs text-brand-red font-semibold">
                          ✓ Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <button
            onClick={handleClear}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition"
          >
            Clear selection
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Cancel
            </button>
            {multi && (
              <button
                onClick={handleConfirm}
                disabled={selectedIds.length === 0}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Select {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

