"use client";

import { useTables } from "@/lib/hooks/useTables";

interface TableSelectorProps {
  value: string;
  onChange: (tableId: string) => void;
  disabled?: boolean;
}

export default function TableSelector({ value, onChange, disabled }: TableSelectorProps) {
  const { tables, loading } = useTables();

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        Table
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || loading}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-sm"
      >
        <option value="">{loading ? "Loading tables..." : "Select a table..."}</option>
        {tables.map((table) => (
          <option key={table.id} value={table.id}>
            {table.label} ({table.name})
          </option>
        ))}
      </select>
    </div>
  );
}
