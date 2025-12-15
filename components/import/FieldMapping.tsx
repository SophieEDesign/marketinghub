"use client";

import { useState, useEffect } from "react";
import { Field } from "@/lib/fields";
import { FieldMapping as FieldMappingType } from "@/lib/import/transformRow";
import { detectFieldType, suggestTypeFromColumnName } from "@/lib/import/typeDetection";
import FieldTypeConfirmModal from "./FieldTypeConfirmModal";

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
    const initialMappings = fields.map((field) => {
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
    // Notify parent of initial mappings
    onMappingChange(initialMappings);
    return initialMappings;
  });

  // Track created fields to remove them from unmapped list
  const [createdFields, setCreatedFields] = useState<Set<string>>(new Set());

  // Update mappings when fields change (e.g., after creating a new field)
  useEffect(() => {
    setMappings((currentMappings) => {
      const currentFieldIds = new Set(currentMappings.map(m => m.fieldId));
      const newFields = fields.filter(f => !currentFieldIds.has(f.id));
      
      if (newFields.length > 0) {
        const newMappings = newFields.map((field) => {
          // Try to find matching CSV column for the new field
          // First check if we created this field from a specific column
          const createdFromColumn = Array.from(createdFields).find(col => 
            col.toLowerCase() === field.field_key.toLowerCase() ||
            col.toLowerCase() === field.label.toLowerCase()
          );
          
          const matchingHeader = createdFromColumn || csvHeaders.find(
            (header) => header.toLowerCase() === field.field_key.toLowerCase() ||
                        header.toLowerCase() === field.label.toLowerCase()
          );
          
          if (matchingHeader) {
            // Mark this column as mapped
            setCreatedFields(prev => {
              const next = new Set(prev);
              next.delete(matchingHeader);
              return next;
            });
          }
          
          return {
            fieldId: field.id,
            fieldKey: field.field_key,
            csvColumn: matchingHeader || null,
          };
        });
        const updated = [...currentMappings, ...newMappings];
        onMappingChange(updated);
        return updated;
      }
      return currentMappings;
    });
  }, [fields, csvHeaders, onMappingChange, createdFields]);

  const handleMappingChange = (fieldId: string, csvColumn: string | null) => {
    const updated = mappings.map((m) =>
      m.fieldId === fieldId ? { ...m, csvColumn } : m
    );
    setMappings(updated);
    onMappingChange(updated);
  };

  const [creatingField, setCreatingField] = useState<string | null>(null);
  const [showTypeConfirm, setShowTypeConfirm] = useState(false);
  const [pendingField, setPendingField] = useState<{
    columnName: string;
    suggestedType: string;
    sampleValues: string[];
    linkedRecordOptions?: { to_table?: string; display_field?: string };
  } | null>(null);

  const handleCreateField = (csvColumn: string) => {
    if (!onCreateField || creatingField === csvColumn) return;
    
    if (!csvColumn || !csvColumn.trim()) {
      alert("Column name cannot be empty");
      return;
    }
    
    // Mark as being created to prevent duplicate clicks
    setCreatedFields(prev => new Set(prev).add(csvColumn));
    
    // Get sample values for type detection
    const sampleValues = csvRows.slice(0, 10).map((row) => row[csvColumn]).filter(Boolean);
    const detectedType = detectFieldType(sampleValues);
    const suggestedType = suggestTypeFromColumnName(csvColumn);
    // Prioritize detected type over column name suggestion
    const finalType = detectedType !== "text" ? detectedType : suggestedType;

    // Show confirmation modal with predicted type pre-selected
    setPendingField({
      columnName: csvColumn.trim(),
      suggestedType: finalType,
      sampleValues,
    });
    setShowTypeConfirm(true);
  };

  const handleConfirmFieldType = async (fieldType: string, options?: { to_table?: string; display_field?: string }) => {
    if (!pendingField || !onCreateField) return;
    
    const columnName = pendingField.columnName;
    setCreatingField(columnName);
    try {
      // Store options for linked_record fields
      if (fieldType === "linked_record" && options) {
        setPendingField({ ...pendingField, linkedRecordOptions: options });
      }
      
      const success = await onCreateField(columnName, fieldType, options);
      
      if (success) {
        // Field created successfully - it will be removed from unmapped list
        // The parent component will reload fields and update mappings
        // The useEffect will handle adding it to the mappings table
      } else {
        // Creation failed - remove from createdFields so user can try again
        setCreatedFields(prev => {
          const next = new Set(prev);
          next.delete(columnName);
          return next;
        });
      }
    } catch (error) {
      console.error("Error creating field:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to create field "${columnName}": ${errorMessage}\n\nPlease check:\n- The column name is valid\n- The field doesn't already exist\n- Check the browser console for details`);
      
      // Remove from createdFields on error so user can retry
      setCreatedFields(prev => {
        const next = new Set(prev);
        next.delete(columnName);
        return next;
      });
    } finally {
      setCreatingField(null);
      setPendingField(null);
      setShowTypeConfirm(false);
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
        (header) => !mappings.some((m) => m.csvColumn === header) && !createdFields.has(header)
      ).length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Unmapped CSV Columns
          </h4>
          <div className="flex flex-wrap gap-2">
            {csvHeaders
              .filter((header) => !mappings.some((m) => m.csvColumn === header) && !createdFields.has(header))
              .map((header) => {
                const sampleValues = csvRows.slice(0, 10).map((row) => row[header]).filter(Boolean);
                const detectedType = detectFieldType(sampleValues);
                const suggestedType = suggestTypeFromColumnName(header);
                // Prioritize detected type - it's more accurate than column name
                const finalType = detectedType !== "text" ? detectedType : suggestedType;

                return (
                  <div
                    key={header}
                    className={`flex items-center gap-2 px-3 py-2 rounded border transition-all ${
                      creatingField === header
                        ? "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                        : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                    }`}
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{header}</span>
                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                      {finalType}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleCreateField(header);
                      }}
                      disabled={creatingField === header || !onCreateField}
                      className="text-xs px-3 py-1.5 bg-brand-red text-white rounded-md hover:bg-brand-redDark transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      title={`Create field "${header}" with predicted type: ${finalType}`}
                    >
                      {creatingField === header ? "Creating..." : "Create Field"}
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Field Type Confirmation Modal */}
      {pendingField && (
        <FieldTypeConfirmModal
          open={showTypeConfirm}
          onClose={() => {
            setShowTypeConfirm(false);
            setPendingField(null);
          }}
          columnName={pendingField.columnName}
          suggestedType={pendingField.suggestedType as any}
          sampleValues={pendingField.sampleValues}
          onConfirm={(fieldType, options) => handleConfirmFieldType(fieldType, options)}
        />
      )}
    </div>
  );
}

