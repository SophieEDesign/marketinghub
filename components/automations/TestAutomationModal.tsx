"use client";

import { useState, useEffect } from "react";
import { X, Play, CheckCircle, XCircle, AlertCircle, Loader } from "lucide-react";
import { useTables } from "@/lib/hooks/useTables";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/ui/Button";
import { Automation } from "@/lib/types/automations";

interface TestAutomationModalProps {
  automation: Partial<Automation>;
  open: boolean;
  onClose: () => void;
}

export default function TestAutomationModal({
  automation,
  open,
  onClose,
}: TestAutomationModalProps) {
  const { tables } = useTables();
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [sampleRecords, setSampleRecords] = useState<any[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);

  const trigger = automation.trigger as any;
  const needsRecord =
    trigger &&
    (trigger.type === "record_created" ||
      trigger.type === "record_updated" ||
      trigger.type === "field_match" ||
      trigger.type === "date_approaching");

  useEffect(() => {
    if (open && needsRecord && trigger.table_id) {
      setSelectedTableId(trigger.table_id);
      loadSampleRecords(trigger.table_id);
    }
  }, [open, needsRecord, trigger]);

  const loadSampleRecords = async (tableId: string) => {
    try {
      const table = tables.find((t) => t.id === tableId);
      if (!table) return;

      const { data, error } = await supabase
        .from(table.name)
        .select("*")
        .limit(5)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSampleRecords(data || []);
      if (data && data.length > 0) {
        setSelectedRecordId(data[0].id);
      }
    } catch (error: any) {
      console.error("Error loading sample records:", error);
      alert(`Failed to load records: ${error.message}`);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    setTestResults(null);

    try {
      const sampleRecord = needsRecord && selectedRecordId
        ? sampleRecords.find((r) => r.id === selectedRecordId)
        : undefined;

      const response = await fetch("/api/automations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          automation,
          sampleRecord,
          forceTrigger: !needsRecord,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Test failed");
      }

      const results = await response.json();
      setTestResults(results);
    } catch (error: any) {
      setTestResults({
        errors: [error.message],
        triggerMatched: false,
        conditionsPassed: false,
        actionResults: [],
        logs: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-[9999] p-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Test Automation
            </h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {needsRecord && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Select Table
                  </label>
                  <select
                    value={selectedTableId}
                    onChange={(e) => {
                      setSelectedTableId(e.target.value);
                      if (e.target.value) {
                        loadSampleRecords(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                  >
                    <option value="">Select a table...</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.label} ({table.name})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTableId && sampleRecords.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Select Sample Record
                    </label>
                    <select
                      value={selectedRecordId}
                      onChange={(e) => setSelectedRecordId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    >
                      {sampleRecords.map((record) => (
                        <option key={record.id} value={record.id}>
                          {record.name || record.title || record.id} (ID: {record.id.slice(0, 8)}...)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedTableId && sampleRecords.length === 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    No records found in this table. Create a record first to test.
                  </div>
                )}
              </div>
            )}

            {!needsRecord && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                This automation uses a {trigger?.type || "manual"} trigger. No sample record needed.
              </div>
            )}

            {/* Test Results */}
            {testResults && (
              <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Test Results
                </h3>

                {/* Trigger Status */}
                <div className="flex items-center gap-2">
                  {testResults.triggerMatched ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className="text-sm">
                    Trigger: {testResults.triggerMatched ? "Matched" : "Not Matched"}
                  </span>
                </div>

                {/* Conditions Status */}
                {testResults.conditionsPassed !== undefined && (
                  <div className="flex items-center gap-2">
                    {testResults.conditionsPassed ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                    <span className="text-sm">
                      Conditions: {testResults.conditionsPassed ? "Passed" : "Failed"}
                    </span>
                  </div>
                )}

                {/* Action Results */}
                {testResults.actionResults && testResults.actionResults.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Action Results
                    </h4>
                    <div className="space-y-2">
                      {testResults.actionResults.map((result: any, index: number) => (
                        <div
                          key={index}
                          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {result.success ? (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="text-sm font-medium">
                              Action {index + 1}: {result.actionType}
                            </span>
                            <span className="text-xs text-gray-500">
                              (Simulated)
                            </span>
                          </div>
                          {result.output && (
                            <pre className="text-xs bg-white dark:bg-gray-900 p-2 rounded mt-2 overflow-auto">
                              {JSON.stringify(result.output, null, 2)}
                            </pre>
                          )}
                          {result.error && (
                            <div className="text-xs text-red-600 mt-1">{result.error}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logs */}
                {testResults.logs && testResults.logs.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Execution Logs
                    </h4>
                    <div className="space-y-1">
                      {testResults.logs.map((log: any, index: number) => (
                        <div
                          key={index}
                          className={`text-xs p-2 rounded ${
                            log.type === "error"
                              ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                              : log.type === "warning"
                              ? "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300"
                              : log.type === "success"
                              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          {log.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Errors */}
                {testResults.errors && testResults.errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">
                      Errors
                    </h4>
                    <div className="space-y-1">
                      {testResults.errors.map((error: string, index: number) => (
                        <div
                          key={index}
                          className="text-xs p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded"
                        >
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleTest}
              disabled={loading || (needsRecord && !selectedRecordId)}
              className="flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Test
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
