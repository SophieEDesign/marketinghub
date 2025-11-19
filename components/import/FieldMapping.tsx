"use client";

import { useState } from "react";
import { Field } from "@/lib/fields";
import { FieldMapping as FieldMappingType } from "@/lib/import/transformRow";
import { detectFieldType, suggestTypeFromColumnName } from "@/lib/import/typeDetection";

interface FieldMappingProps {
  fields: Field[];
  csvHeaders: string[];
  csvRows: Record<string, string>[];
  onMappingChange: (mappings: FieldMappingType[]) => void;
  onCreateField?: (columnName: string, suggestedType: string) => void;
}

export default function FieldMapping({
  fields,
  csvHeaders,
  csvRows,
  onMappingChange,
  onCreateField,
}: FieldMappingProps) {
  const [mappings, setMappings] = useState<FieldMappingType[]>(() => {
    // Auto-map based on field_key matching CSV header (case-insensitive)
    return fields.map((field) => {
      const matchingHeader = csvHeaders.find(
        (header) => header.toLowerCase() === field.field_key.toLowerCase() ||
                    header.toLowerCase() === field.label.toLowerCase()
      );
      return {
        fieldId: field.id,
        fieldKey: field.field_key,
        csvColumn: matchingHeader || null,
      };
    });
  });

  const handleMappingChange = (fieldId: string, csvColumn: string | null) => {
    const updated = mappings.map((m) =>
      m.fieldId === fieldId ? { ...m, csvColumn } : m
    );
    setMappings(updated);
    onMappingChange(updated);
  };

  const handleCreateField = (csvColumn: string) => {
    // Get sample values for type detection
    const sampleValues = csvRows.slice(0, 10).map((row) => row[csvColumn]).filter(Boolean);
    const detectedType = detectFieldType(sampleValues);
    const suggestedType = suggestTypeFromColumnName(csvColumn);
    const finalType = detectedType !== "text" ? detectedType : suggestedType;

    if (onCreateField) {
      onCreateField(csvColumn, finalType);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          Map CSV Columns to Fields
        </h3>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Match each field in your table to a column from your CSV file. Unmapped columns will be ignored.
        </p>
      </div>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-heading uppercase tracking-wide text-brand-grey">
                Supabase Field
              </th>
              <th className="px-4 py-3 text-left text-xs font-heading uppercase tracking-wide text-brand-grey">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-heading uppercase tracking-wide text-brand-grey">
                CSV Column
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {fields.map((field) => {
              const mapping = mappings.find((m) => m.fieldId === field.id);
              return (
                <tr key={field.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {field.label}
                      </span>
                      {field.required && (
                        <span className="text-xs text-red-600 dark:text-red-400">*</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {field.field_key}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {field.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mapping?.csvColumn || "IGNORE"}
                      onChange={(e) =>
                        handleMappingChange(
                          field.id,
                          e.target.value === "IGNORE" ? null : e.target.value
                        )
                      }
                      className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="IGNORE">Ignore</option>
                      {csvHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Unmapped CSV Columns */}
      {csvHeaders.filter(
        (header) => !mappings.some((m) => m.csvColumn === header)
      ).length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Unmapped CSV Columns
          </h4>
          <div className="flex flex-wrap gap-2">
            {csvHeaders
              .filter((header) => !mappings.some((m) => m.csvColumn === header))
              .map((header) => {
                const sampleValues = csvRows.slice(0, 10).map((row) => row[header]).filter(Boolean);
                const detectedType = detectFieldType(sampleValues);
                const suggestedType = suggestTypeFromColumnName(header);
                const finalType = detectedType !== "text" ? detectedType : suggestedType;

                return (
                  <div
                    key={header}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{header}</span>
                    <button
                      onClick={() => handleCreateField(header)}
                      className="text-xs btn-primary"
                      title={`Create field "${header}" (type: ${finalType})`}
                    >
                      Create Field ({finalType})
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

