"use client";

import { useEffect, useState } from "react";
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

interface PreviewRow {
  rowNumber: number;
  data: any;
  warnings: string[];
  errors: string[];
}

export default function ImportPreview({
  csvRows,
  mappings,
  fields,
  onBack,
  onConfirm,
}: ImportPreviewProps) {
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Transform first 20 rows for preview
  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      try {
        setLoading(true);
        const rowsToPreview = csvRows.slice(0, 20);

        const transformed = await Promise.all(
          rowsToPreview.map(async (csvRow, index) => {
            const result = await transformRow(csvRow, mappings, fields);
            return {
              rowNumber: index + 1,
              data: result.row,
              warnings: result.warnings,
              errors: result.errors,
            } as PreviewRow;
          })
        );

        if (isMounted) {
          setPreviewRows(transformed);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadPreview();

    return () => {
      isMounted = false;
    };
  }, [csvRows, mappings, fields]);

  const totalWarnings = previewRows.reduce((sum, r) => sum + r.warnings.length, 0);
  const totalErrors = previewRows.reduce((sum, r) => sum + r.errors.length, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-red mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Transforming rows for preview...</p>
        </div>
      </div>
    );
  }

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
                  <li key={`${r.rowNumber}-error-${idx}`}>
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
                  <li key={`${r.rowNumber}-warning-${idx}`}>
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
                <th className="px-4 py-3 text-left text-xs font-heading uppercase tracking-wide text-brand-grey">
                  Row
                </th>
                {mappings
                  .filter((m) => m.csvColumn && m.csvColumn !== "IGNORE")
                  .map((m) => {
                    const field = fields.find((f) => f.id === m.fieldId);
                    return (
                      <th
                        key={m.fieldId}
                        className="px-4 py-3 text-left text-xs font-heading uppercase tracking-wide text-brand-grey"
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
          className="btn-secondary"
        >
          Back to Mapping
        </button>
        <button
          onClick={onConfirm}
          className="btn-primary"
        >
          Confirm & Import
        </button>
      </div>
    </div>
  );
}

