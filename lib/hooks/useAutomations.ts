"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface Automation {
  id: string;
  name: string;
  status: "active" | "paused";
  trigger: any;
  conditions?: any[];
  actions: any[];
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  automation_id: string;
  timestamp: string;
  status: "success" | "error";
  input?: any;
  output?: any;
  error?: string;
  duration_ms?: number;
}

/**
 * Hook for managing automations
 */
export function useAutomations() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load automations
  const loadAutomations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/automations");
      if (!response.ok) {
        throw new Error("Failed to fetch automations");
      }

      const data = await response.json();
      setAutomations(data.automations || []);
    } catch (err: any) {
      console.error("Error loading automations:", err);
      setError(err.message || "Failed to load automations");
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAutomations();
  }, [loadAutomations]);

  // Get a single automation
  const getAutomation = useCallback(async (id: string): Promise<Automation | null> => {
    try {
      const response = await fetch(`/api/automations/${id}`);
      if (!response.ok) {
        throw new Error("Failed to fetch automation");
      }

      const data = await response.json();
      return data.automation || null;
    } catch (err: any) {
      console.error("Error fetching automation:", err);
      return null;
    }
  }, []);

  // Create automation
  const createAutomation = useCallback(
    async (automation: Omit<Automation, "id" | "created_at" | "updated_at">): Promise<Automation | null> => {
      try {
        const response = await fetch("/api/automations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(automation),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to create automation");
        }

        const data = await response.json();
        const newAutomation = data.automation;

        setAutomations((prev) => [newAutomation, ...prev]);
        return newAutomation;
      } catch (err: any) {
        console.error("Error creating automation:", err);
        throw err;
      }
    },
    []
  );

  // Update automation
  const updateAutomation = useCallback(
    async (id: string, updates: Partial<Automation>): Promise<Automation | null> => {
      try {
        const response = await fetch(`/api/automations/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to update automation");
        }

        const data = await response.json();
        const updatedAutomation = data.automation;

        setAutomations((prev) =>
          prev.map((a) => (a.id === id ? updatedAutomation : a))
        );
        return updatedAutomation;
      } catch (err: any) {
        console.error("Error updating automation:", err);
        throw err;
      }
    },
    []
  );

  // Delete automation
  const deleteAutomation = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/automations/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete automation");
      }

      setAutomations((prev) => prev.filter((a) => a.id !== id));
    } catch (err: any) {
      console.error("Error deleting automation:", err);
      throw err;
    }
  }, []);

  // Run automation manually
  const runAutomation = useCallback(
    async (id: string, context?: { record?: any; oldRecord?: any; newRecord?: any }): Promise<any> => {
      try {
        const response = await fetch(`/api/automations/${id}/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(context || {}),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to run automation");
        }

        const data = await response.json();
        return data;
      } catch (err: any) {
        console.error("Error running automation:", err);
        throw err;
      }
    },
    []
  );

  // Get automation logs
  const getAutomationLogs = useCallback(
    async (id: string, limit: number = 100): Promise<AutomationLog[]> => {
      try {
        const response = await fetch(`/api/automations/${id}/logs?limit=${limit}`);
        if (!response.ok) {
          throw new Error("Failed to fetch logs");
        }

        const data = await response.json();
        return data.logs || [];
      } catch (err: any) {
        console.error("Error fetching automation logs:", err);
        return [];
      }
    },
    []
  );

  return {
    automations,
    loading,
    error,
    loadAutomations,
    getAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    runAutomation,
    getAutomationLogs,
  };
}

