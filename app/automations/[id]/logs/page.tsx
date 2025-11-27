"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAutomations } from "@/lib/hooks/useAutomations";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";
import Button from "@/components/ui/Button";

export default function AutomationLogsPage() {
  const params = useParams();
  const router = useRouter();
  const automationId = params.id as string;
  const { getAutomation, getAutomationLogs } = useAutomations();
  const [automation, setAutomation] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [automationData, logsData] = await Promise.all([
          getAutomation(automationId),
          getAutomationLogs(automationId, 100),
        ]);
        setAutomation(automationData);
        setLogs(logsData);
      } catch (error) {
        console.error("Error loading automation logs:", error);
      } finally {
        setLoading(false);
      }
    };

    if (automationId) {
      loadData();
    }
  }, [automationId, getAutomation, getAutomationLogs]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Loading logs...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => router.push("/automations")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {automation?.name || "Automation"} Logs
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Execution history and results
          </p>
        </div>
      </div>

      {/* Logs Table */}
      {logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <p>No logs yet. Run the automation to see execution logs.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Error
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {log.status === "success" ? (
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                        <span
                          className={`text-sm ${
                            log.status === "success"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {log.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {log.duration_ms ? `${log.duration_ms}ms` : "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400 max-w-xs truncate">
                      {log.error || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <details className="cursor-pointer">
                        <summary className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                          View
                        </summary>
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                          <div className="mb-2">
                            <strong>Input:</strong>
                            <pre className="mt-1 overflow-auto max-h-32">
                              {JSON.stringify(log.input, null, 2)}
                            </pre>
                          </div>
                          {log.output && (
                            <div>
                              <strong>Output:</strong>
                              <pre className="mt-1 overflow-auto max-h-32">
                                {JSON.stringify(log.output, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

