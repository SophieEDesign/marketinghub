"use client";

export const dynamic = 'force-dynamic';

import { useState, useCallback, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { loadFields, Field } from "@/lib/fields";
import { FieldMapping } from "@/lib/import/transformRow";
import { runImport, ImportResult } from "@/lib/import/runImport";
import FieldMappingComponent from "@/components/import/FieldMapping";
import ImportPreview from "@/components/import/ImportPreview";
import { useFieldManager } from "@/lib/useFieldManager";
import { getAllTables, getTableLabel } from "@/lib/tableMetadata";

// Papa will be imported dynamically when needed

type Step = "upload" | "mapping" | "preview" | "importing" | "results";

function ImportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tableId, setTableId] = useState(searchParams.get("table") || "content");
  const allTables = getAllTables();

  const [step, setStep] = useState<Step>("upload");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { addField } = useFieldManager(tableId);

  // Load fields on mount
  useEffect(() => {
    loadFields(tableId).then(setFields);
  }, [tableId]);

  // Helper function to determine upsert key for a table
  const getUpsertKeyForTable = (table: string, tableFields: Field[]): string => {
    // Try to find a unique identifier field
    const idField = tableFields.find(f => f.field_key === "id");
    if (idField) return "id";
    
    // Try common name fields
    const nameField = tableFields.find(f => 
      f.field_key === "name" || f.field_key === "title"
    );
    if (nameField) return nameField.field_key;
    
    // Default based on table
    const defaults: Record<string, string> = {
      content: "title",
      campaigns: "name",
      contacts: "name",
      ideas: "title",
      media: "publication",
      tasks: "title",
      briefings: "title",
      sponsorships: "name",
      strategy: "title",
      assets: "filename",
    };
    
    return defaults[table] || "id";
  };

  const handleFileSelect = useCallback(
    async (file: File) => {
      try {
        if (!file) {
          alert("No file selected");
          return;
        }

        if (!file.name.endsWith(".csv")) {
          alert("Please select a CSV file (.csv extension required)");
          return;
        }

        if (file.size === 0) {
          alert("The selected file is empty");
          return;
        }

        setCsvFile(file);

        // Dynamically import Papa
        const PapaModule = await import("papaparse");
        const Papa = PapaModule.default;

        // Parse CSV
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0) {
              console.error("CSV parse errors:", results.errors);
              const errorMessage = results.errors[0]?.message || "Unknown parsing error";
              alert(`Error parsing CSV: ${errorMessage}\n\nPlease check your CSV file format.`);
              setCsvFile(null);
              return;
            }

            const data = results.data as Record<string, string>[];
            if (!data || data.length === 0) {
              alert("CSV file is empty or contains no valid rows");
              setCsvFile(null);
              return;
            }

            const headers = Object.keys(data[0]);
            if (headers.length === 0) {
              alert("CSV file has no headers. Please ensure the first row contains column names.");
              setCsvFile(null);
              return;
            }

            setCsvHeaders(headers);
            setCsvRows(data);
            setStep("mapping");
          },
          error: (error) => {
            console.error("CSV parse error:", error);
            alert(`Failed to parse CSV file: ${error.message || "Unknown error"}`);
            setCsvFile(null);
          },
        });
      } catch (error: any) {
        console.error("Error handling file:", error);
        alert(`Error processing file: ${error.message || "Unknown error"}`);
        setCsvFile(null);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect]
  );

  const handleMappingChange = useCallback((newMappings: FieldMapping[]) => {
    setMappings(newMappings);
  }, []);

  const handleCreateField = useCallback(
    async (columnName: string, suggestedType: string) => {
      try {
        if (!columnName || !columnName.trim()) {
          alert("Column name is required");
          return;
        }

        // Create new field
        const newField = await addField(columnName.trim(), suggestedType as any, false);
        if (newField) {
          // Reload fields
          const updatedFields = await loadFields(tableId);
          setFields(updatedFields);

          // Auto-map the new field - add to existing mappings
          const existingMappings = mappings || [];
          const updatedMappings = [
            ...existingMappings,
            {
              fieldId: newField.id,
              fieldKey: newField.field_key,
              csvColumn: columnName,
            },
          ];
          setMappings(updatedMappings);
          handleMappingChange(updatedMappings);
        } else {
          const errorMsg = "Failed to create field. This might be due to:\n- Duplicate field name\n- Invalid field type\n- Database error\n\nPlease check the console for details.";
          alert(errorMsg);
        }
      } catch (error: any) {
        console.error("Error in handleCreateField:", error);
        alert(`Failed to create field: ${error.message || "Unknown error"}`);
      }
    },
    [addField, tableId, mappings, handleMappingChange]
  );

  const handlePreviewConfirm = useCallback(async () => {
    setStep("importing");

    try {
      if (!csvRows || csvRows.length === 0) {
        alert("No data to import");
        setStep("preview");
        return;
      }

      if (!mappings || mappings.length === 0) {
        alert("No field mappings configured");
        setStep("mapping");
        return;
      }

      // Determine upsert key based on table
      const upsertKey = getUpsertKeyForTable(tableId, fields);
      
      console.log("[Import] Starting import:", { tableId, upsertKey, rowCount: csvRows.length });

      const result = await runImport(csvRows, mappings, fields, {
        tableId,
        mode: "upsert",
        upsertKey,
      });
      
      console.log("[Import] Import complete:", result);

      setImportResult(result);
      setStep("results");
    } catch (error: any) {
      console.error("Import error:", error);
      alert(`Import failed: ${error.message || "Unknown error"}\n\nCheck the browser console for details.`);
      setStep("preview");
    }
  }, [csvRows, mappings, fields, tableId]);

  const handleDownloadErrors = useCallback(async () => {
    if (!importResult || importResult.errors.length === 0) return;

    const errorRows = importResult.errors.map((err) => ({
      row: err.row,
      error: err.error,
    }));

    const PapaModule = await import("papaparse");
    const Papa = PapaModule.default;
    const csv = Papa.unparse(errorRows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "import-errors.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [importResult]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Import CSV
          </h1>
          <div className="flex items-center gap-4 mt-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Target Table:
            </label>
            <select
              value={tableId}
              onChange={(e) => {
                setTableId(e.target.value);
                // Reset import state when table changes
                setStep("upload");
                setCsvFile(null);
                setCsvHeaders([]);
                setCsvRows([]);
                setMappings([]);
                setImportResult(null);
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {allTables.map((tableId) => (
                <option key={tableId} value={tableId}>
                  {getTableLabel(tableId)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Import data from a CSV file into the {getTableLabel(tableId)} table
          </p>
        </div>

        {/* Stepper */}
        <div className="mb-8 flex items-center gap-4">
          {[
            { id: "upload", label: "1. Upload CSV" },
            { id: "mapping", label: "2. Map Columns" },
            { id: "preview", label: "3. Preview" },
            { id: "importing", label: "4. Import" },
          ].map((s, index) => {
            const stepIndex = ["upload", "mapping", "preview", "importing", "results"].indexOf(step);
            const isActive = index === stepIndex;
            const isCompleted = index < stepIndex;

            return (
              <div key={s.id} className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isCompleted
                      ? "bg-green-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>
                <span
                  className={`text-sm font-medium ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : isCompleted
                      ? "text-green-600 dark:text-green-400"
                      : "text-gray-500 dark:text-gray-500"
                  }`}
                >
                  {s.label}
                </span>
                {index < 3 && (
                  <div className="w-8 h-0.5 bg-gray-200 dark:bg-gray-700 mx-2" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          {step === "upload" && (
            <div>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition ${
                  isDragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900"
                }`}
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="csv-upload"
                />
                <label
                  htmlFor="csv-upload"
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <svg
                      className="w-8 h-8 text-blue-600 dark:text-blue-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Drop your CSV file here, or click to browse
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      CSV files only
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === "mapping" && (
            <div>
              <FieldMappingComponent
                fields={fields}
                csvHeaders={csvHeaders}
                csvRows={csvRows}
                onMappingChange={handleMappingChange}
                onCreateField={handleCreateField}
              />
              <div className="flex justify-end mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setStep("preview")}
                  disabled={!mappings || mappings.filter((m) => m.csvColumn && m.csvColumn !== "IGNORE" && m.csvColumn !== null).length === 0}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-400"
                >
                  Continue to Preview
                </button>
              </div>
            </div>
          )}

          {step === "preview" && mappings.length > 0 && (
            <ImportPreview
              csvRows={csvRows}
              mappings={mappings}
              fields={fields}
              onBack={() => setStep("mapping")}
              onConfirm={handlePreviewConfirm}
            />
          )}

          {step === "importing" && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red mb-4"></div>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Importing data...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Please wait while we import your {csvRows.length} rows
              </p>
            </div>
          )}

          {step === "results" && importResult && (
            <div className="space-y-6">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
                <h2 className="text-2xl font-bold text-green-900 dark:text-green-100 mb-4">
                  Import Complete!
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-green-700 dark:text-green-300">
                      {importResult.inserted}
                    </span>
                    <span className="text-green-600 dark:text-green-400">rows inserted</span>
                  </div>
                  {importResult.updated > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-green-700 dark:text-green-300">
                        {importResult.updated}
                      </span>
                      <span className="text-green-600 dark:text-green-400">rows updated</span>
                    </div>
                  )}
                  {importResult.skipped > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-orange-700 dark:text-orange-300">
                        {importResult.skipped}
                      </span>
                      <span className="text-orange-600 dark:text-orange-400">rows skipped</span>
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-red-700 dark:text-red-300">
                        {importResult.errors.length}
                      </span>
                      <span className="text-red-600 dark:text-red-400">errors</span>
                    </div>
                  )}
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-red-900 dark:text-red-100">
                      Errors ({importResult.errors.length})
                    </h3>
                    <button
                      onClick={handleDownloadErrors}
                      className="text-sm btn-primary"
                    >
                      Download Errors CSV
                    </button>
                  </div>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 max-h-64 overflow-y-auto">
                    {importResult.errors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => router.push(`/${tableId}/grid`)}
                  className="btn-primary"
                >
                  View Data
                </button>
                <button
                  onClick={() => {
                    setStep("upload");
                    setCsvFile(null);
                    setCsvHeaders([]);
                    setCsvRows([]);
                    setMappings([]);
                    setImportResult(null);
                  }}
                  className="btn-secondary"
                >
                  Import Another File
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-brand-red mb-4"></div>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Loading...
            </p>
          </div>
        </div>
      </div>
    }>
      <ImportPageContent />
    </Suspense>
  );
}

