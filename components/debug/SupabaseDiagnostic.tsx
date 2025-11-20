"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { CheckCircle, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface DiagnosticResult {
  name: string;
  status: "success" | "error" | "warning" | "pending";
  message: string;
  details?: any;
}

export default function SupabaseDiagnostic() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [running, setRunning] = useState(false);

  const runDiagnostic = async () => {
    setRunning(true);
    const newResults: DiagnosticResult[] = [];

    // Check 1: Environment Variables
    const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const urlValue = process.env.NEXT_PUBLIC_SUPABASE_URL || "undefined";
    const keyValue = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "undefined";

    newResults.push({
      name: "Environment Variables",
      status: hasUrl && hasKey ? "success" : "error",
      message: hasUrl && hasKey 
        ? "Both environment variables are defined" 
        : `Missing: ${!hasUrl ? "NEXT_PUBLIC_SUPABASE_URL" : ""} ${!hasKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : ""}`,
      details: {
        url: urlValue.substring(0, 30) + (urlValue.length > 30 ? "..." : ""),
        keyLength: keyValue !== "undefined" ? keyValue.length : 0,
        keyPrefix: keyValue !== "undefined" ? keyValue.substring(0, 20) + "..." : "undefined",
      },
    });

    // Check 2: Service Role Key (should NOT be public)
    const hasServiceKey = !!process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    newResults.push({
      name: "Service Role Key Check",
      status: hasServiceKey ? "error" : "success",
      message: hasServiceKey 
        ? "⚠️ CRITICAL: Service Role Key is exposed as NEXT_PUBLIC_* - REMOVE IMMEDIATELY" 
        : "✓ Service Role Key is not exposed (correct)",
      details: hasServiceKey ? {
        warning: "Service Role Key should NEVER be in NEXT_PUBLIC_* variables. It has full database access."
      } : null,
    });

    // Check 3: Supabase Client Initialization
    try {
      if (!hasUrl || !hasKey) {
        throw new Error("Missing environment variables");
      }
      newResults.push({
        name: "Supabase Client",
        status: "success",
        message: "Client initialized successfully",
        details: {
          url: urlValue,
        },
      });
    } catch (err: any) {
      newResults.push({
        name: "Supabase Client",
        status: "error",
        message: `Client initialization failed: ${err.message}`,
      });
      setResults([...newResults]);
      setRunning(false);
      return;
    }

    // Check 4: List Storage Buckets
    try {
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        newResults.push({
          name: "List Storage Buckets",
          status: "error",
          message: `Failed to list buckets: ${bucketsError.message}`,
          details: bucketsError,
        });
      } else {
        const bucketNames = buckets?.map(b => b.name) || [];
        newResults.push({
          name: "List Storage Buckets",
          status: "success",
          message: `Found ${bucketNames.length} bucket(s)`,
          details: {
            buckets: bucketNames,
            hasAttachments: bucketNames.includes("attachments"),
            hasBranding: bucketNames.includes("branding"),
          },
        });
      }
    } catch (err: any) {
      newResults.push({
        name: "List Storage Buckets",
        status: "error",
        message: `Unexpected error: ${err.message}`,
        details: err,
      });
    }

    // Check 5: Access Attachments Bucket
    try {
      const { data: objects, error: objectsError } = await supabase
        .storage
        .from("attachments")
        .list("", { limit: 1 });

      if (objectsError) {
        newResults.push({
          name: "Access Attachments Bucket",
          status: objectsError.message.includes("not found") ? "warning" : "error",
          message: `Cannot access attachments bucket: ${objectsError.message}`,
          details: {
            error: objectsError.message,
            hint: objectsError.message.includes("not found") 
              ? "Bucket may not exist. Create it in Supabase Dashboard > Storage."
              : "Check RLS policies or bucket permissions.",
          },
        });
      } else {
        newResults.push({
          name: "Access Attachments Bucket",
          status: "success",
          message: "Successfully accessed attachments bucket",
          details: {
            objectCount: objects?.length || 0,
            sample: objects?.[0] || null,
          },
        });
      }
    } catch (err: any) {
      newResults.push({
        name: "Access Attachments Bucket",
        status: "error",
        message: `Unexpected error: ${err.message}`,
        details: err,
      });
    }

    // Check 6: Test Database Connection (simple query)
    try {
      const { data, error: dbError } = await supabase
        .from("settings")
        .select("key")
        .limit(1);

      if (dbError) {
        newResults.push({
          name: "Database Connection",
          status: "error",
          message: `Database query failed: ${dbError.message}`,
          details: dbError,
        });
      } else {
        newResults.push({
          name: "Database Connection",
          status: "success",
          message: "Successfully connected to database",
          details: {
            tableAccessible: true,
          },
        });
      }
    } catch (err: any) {
      newResults.push({
        name: "Database Connection",
        status: "error",
        message: `Unexpected error: ${err.message}`,
        details: err,
      });
    }

    setResults(newResults);
    setRunning(false);
  };

  useEffect(() => {
    runDiagnostic();
  }, []);

  const getStatusIcon = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
      case "pending":
        return <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult["status"]) => {
    switch (status) {
      case "success":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
      case "error":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
      case "warning":
        return "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
      case "pending":
        return "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800";
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Supabase Diagnostic
        </h3>
        <button
          onClick={runDiagnostic}
          disabled={running}
          className="btn-secondary text-sm disabled:opacity-50"
        >
          {running ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running...
            </>
          ) : (
            "Run Again"
          )}
        </button>
      </div>

      {running && results.length === 0 && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Running diagnostics...</p>
        </div>
      )}

      <div className="space-y-3">
        {results.map((result, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${getStatusColor(result.status)}`}
          >
            <div className="flex items-start gap-3">
              {getStatusIcon(result.status)}
              <div className="flex-1">
                <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-1">
                  {result.name}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {result.message}
                </p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 dark:text-gray-500 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                      View Details
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto max-h-40">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-2">
          Next Steps:
        </h4>
        <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
          <li>If environment variables are missing, add them to Vercel project settings</li>
          <li>If storage buckets are missing, create them in Supabase Dashboard → Storage</li>
          <li>If RLS errors occur, check Row Level Security policies in Supabase</li>
          <li>Redeploy after updating environment variables</li>
        </ul>
      </div>
    </div>
  );
}

