"use client";

import { Field } from "@/lib/fields";
import { FieldMapping } from "@/lib/import/transformRow";
import { transformRow } from "@/lib/import/transformRow";
import FieldRenderer from "../fields/FieldRenderer";

interface ImportPreviewProps {
  csvRows: Record<string, string>[];
  mappings: FieldMapping[];
  fields: Field[];
  onBack: () => void;
  onConfirm: () => void;
}

export default function ImportPreview({
  csvRows,
  mappings,
  fields,
  onBack,
  onConfirm,
}: ImportPreviewProps) {
  // Transform first 20 rows for preview
  const previewRows = csvRows.slice(0, 20).map((csvRow, index) => {
    const result = transformRow(csvRow, mappings, fields);
    return {
      rowNumber: index + 1,
      data: result.row,
      warnings: result.warnings,
      errors: result.errors,
    };
  });

  const totalWarnings = previewRows.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalErrors = previewRows.reduce((sum, r) => sum + r.errors.length, 0);

  return (
    <div className="space-y-6">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
          Preview Import ({csvRows.length} rows total)
        </h3>
        <p className="text-sm text-yellow-700 dark:text-yellow-300">
          Showing first 20 transformed rows. {totalWarnings > 0 && `${totalWarnings} warnings. `}
          {totalErrors > 0 && `${totalErrors} errors.`}
        </p>
      </div>

      {totalErrors > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h4 className="font-semibold text-red-900 dark:text-red-100 mb-2">
            Errors Found
          </h4>
          <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
            {previewRows
              .filter((r) => r.errors.length > 0)
              .map((r) =>
                r.errors.map((error, idx) => (
                  <li key={idx}>
                    Row {r.rowNumber}: {error}
                  </li>
                ))
              )}
          </ul>
        </div>
      )}

      {totalWarnings > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
            Warnings
          </h4>
          <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1">
            {previewRows
              .filter((r) => r.warnings.length > 0)
              .slice(0, 10)
              .map((r) =>
                r.warnings.map((warning, idx) => (
                  <li key={idx}>
                    Row {r.rowNumber}: {warning}
                  </li>
                ))
              )}
          </ul>
        </div>
      )}

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Row
                </th>
                {mappings
                  .filter((m) => m.csvColumn && m.csvColumn !== "IGNORE")
                  .map((m) => {
                    const field = fields.find((f) => f.id === m.fieldId);
                    return (
                      <th
                        key={m.fieldId}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300"
                      >
                        {field?.label || m.fieldKey}
                      </th>
                    );
                  })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {previewRows.map((previewRow) => (
                <tr
                  key={previewRow.rowNumber}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    previewRow.errors.length > 0
                      ? "bg-red-50 dark:bg-red-900/10"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                    {previewRow.rowNumber}
                  </td>
                  {mappings
                    .filter((m) => m.csvColumn && m.csvColumn !== "IGNORE")
                    .map((m) => {
                      const field = fields.find((f) => f.id === m.fieldId);
                      const value = previewRow.data[m.fieldKey];
                      return (
                        <td key={m.fieldId} className="px-4 py-3 text-sm">
                          {field ? (
                            <FieldRenderer
                              field={field}
                              value={value}
                              record={previewRow.data}
                            />
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {csvRows.length > 20 && (
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          ... and {csvRows.length - 20} more rows
        </div>
      )}

      <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
        >
          Back to Mapping
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition font-medium"
        >
          Confirm & Import
        </button>
      </div>
    </div>
  );
}

