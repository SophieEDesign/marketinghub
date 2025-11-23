"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface TablePreviewConfig {
  title?: string;
  table: string;
  limit?: number;
  fields?: string[];
}

interface TablePreviewModuleProps {
  config: TablePreviewConfig;
  width: number;
  height: number;
  onUpdate?: (config: Partial<TablePreviewConfig>) => void;
  isEditing?: boolean;
  data?: any[];
}

export default function TablePreviewModule({ config, width, height, onUpdate, isEditing = false, data = [] }: TablePreviewModuleProps) {
  const displayData = useMemo(() => {
    return data.slice(0, config.limit || 5);
  }, [data, config.limit]);

  const getFieldValue = (record: any, fieldKey: string) => {
    return record[fieldKey] || "—";
  };

  const getTitleField = (record: any) => {
    if (config.fields && config.fields.length > 0) {
      return record[config.fields[0]];
    }
    // Try common title fields
    return record.title || record.name || String(record.id);
  };

  return (
    <div
      className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ minHeight: `${height * 50}px` }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {config.title || config.table || "Table Preview"}
          </h3>
          <Link
            href={`/${config.table}/grid`}
            className="text-xs text-brand-blue hover:text-brand-red flex items-center gap-1"
          >
            View all
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          {displayData.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No records
            </div>
          ) : (
            <div className="space-y-2">
              {displayData.map((record) => {
                const title = getTitleField(record);
                return (
                  <Link
                    key={record.id}
                    href={`/${config.table}/grid?record=${record.id}`}
                    className="block p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {title}
                    </div>
                    {config.fields && config.fields.length > 1 && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {config.fields.slice(1, 3).map((field) => getFieldValue(record, field)).join(" • ")}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

