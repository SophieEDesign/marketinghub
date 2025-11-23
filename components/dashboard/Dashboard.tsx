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
  const [data, setData] = useState<Record<string, any[]>>({});

  // Load dashboard and modules
  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch(`/api/dashboards/${dashboardId}`);
        if (!response.ok) throw new Error("Failed to load dashboard");
        const result = await response.json();
        setDashboard(result.dashboard);
        setModules(result.modules || []);
      } catch (error) {
        console.error("Error loading dashboard:", error);
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

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      {/* Dashboard Modules Grid */}
      <DashboardEditor
        dashboardId={dashboardId}
        modules={modules}
        onModuleUpdate={handleModuleUpdate}
        onModuleDelete={handleModuleDelete}
        onModuleCreate={handleModuleCreate}
        data={data}
      />

      {/* Dashboard Blocks (Notion-style) */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Blocks
        </h2>
        <DashboardBlocks dashboardId={dashboardId} />
      </div>
    </div>
  );
}
