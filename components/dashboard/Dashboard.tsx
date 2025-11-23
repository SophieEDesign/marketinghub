"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardEditor from "./DashboardEditor";
import DashboardBlocks from "./DashboardBlocks";
import { supabase } from "@/lib/supabaseClient";

interface Dashboard {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface DashboardModule {
  id: string;
  dashboard_id: string;
  type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  config: any;
}

export default function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashboardId = searchParams.get("id") || "00000000-0000-0000-0000-000000000001";

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [modules, setModules] = useState<DashboardModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, any[]>>({});

  // Load dashboard and modules
  useEffect(() => {
    async function loadDashboard() {
      try {
        setError(null);
        const response = await fetch(`/api/dashboards/${dashboardId}`);
        const result = await response.json();
        
        if (!response.ok) {
          const errorMsg = result.error || "Failed to load dashboard";
          const details = result.details || "";
          const code = result.code || "";
          
          // Check if it's a missing table error
          if (code === 'PGRST116' || code === '42P01' || 
              errorMsg.includes('does not exist') || 
              errorMsg.includes('migration')) {
            setError(
              `Dashboard tables not found. Please run the database migration:\n\n` +
              `1. Open Supabase Dashboard\n` +
              `2. Go to SQL Editor\n` +
              `3. Run: supabase-all-tables-migration.sql\n\n` +
              `Error: ${errorMsg}`
            );
          } else {
            setError(`Failed to load dashboard: ${errorMsg}`);
          }
          return;
        }
        
        setDashboard(result.dashboard);
        setModules(result.modules || []);
      } catch (error: any) {
        console.error("Error loading dashboard:", error);
        setError(`Error loading dashboard: ${error.message || "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [dashboardId]);

  // Load data for modules that need it
  useEffect(() => {
    async function loadData() {
      const tables = new Set<string>();
      modules.forEach((module) => {
        if (module.config?.table) {
          tables.add(module.config.table);
        }
      });

      const dataMap: Record<string, any[]> = {};
      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select("*")
            .limit(100);

          if (!error && data) {
            dataMap[table] = data;
          }
        } catch (error) {
          console.error(`Error loading data for ${table}:`, error);
        }
      }

      setData(dataMap);
    }

    if (modules.length > 0) {
      loadData();
    }
  }, [modules]);

  const handleModuleUpdate = useCallback(
    async (moduleId: string, updates: Partial<DashboardModule>) => {
      try {
        const response = await fetch(`/api/dashboard-modules/${moduleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) throw new Error("Failed to update module");

        const result = await response.json();
        setModules((prev) =>
          prev.map((m) => (m.id === moduleId ? { ...m, ...result.module } : m))
        );
      } catch (error) {
        console.error("Error updating module:", error);
      }
    },
    []
  );

  const handleModuleDelete = useCallback(async (moduleId: string) => {
    try {
      const response = await fetch(`/api/dashboard-modules/${moduleId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete module");

      setModules((prev) => prev.filter((m) => m.id !== moduleId));
    } catch (error) {
      console.error("Error deleting module:", error);
    }
  }, []);

  const handleModuleCreate = useCallback(
    async (module: Omit<DashboardModule, "id" | "dashboard_id">): Promise<string> => {
      try {
        const response = await fetch("/api/dashboard-modules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...module,
            dashboard_id: dashboardId,
          }),
        });

        if (!response.ok) throw new Error("Failed to create module");

        const result = await response.json();
        setModules((prev) => [...prev, result.module]);
        return result.module.id;
      } catch (error) {
        console.error("Error creating module:", error);
        throw error;
      }
    },
    [dashboardId]
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          Loading dashboard...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-[1600px] mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-4">
            Dashboard Error
          </h2>
          <pre className="whitespace-pre-wrap text-sm text-red-700 dark:text-red-300 font-mono bg-red-100 dark:bg-red-900/40 p-4 rounded">
            {error}
          </pre>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
              window.location.reload();
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-semibold text-gray-900 dark:text-white">
          Dashboard
        </h1>
      </div>

      {/* Dashboard Modules Grid */}
      {modules.length > 0 ? (
        <DashboardEditor
          dashboardId={dashboardId}
          modules={modules}
          onModuleUpdate={handleModuleUpdate}
          onModuleDelete={handleModuleDelete}
          onModuleCreate={handleModuleCreate}
          data={data}
        />
      ) : (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p className="mb-4">No modules yet. Add a module to get started.</p>
        </div>
      )}

      {/* Dashboard Blocks (Notion-style) */}
      {modules.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Blocks
          </h2>
          <DashboardBlocks dashboardId={dashboardId} />
        </div>
      )}
    </div>
  );
}
