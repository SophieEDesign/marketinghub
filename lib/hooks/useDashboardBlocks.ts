"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface DashboardBlock {
  id: string;
  dashboard_id: string;
  type: "text" | "image" | "embed" | "kpi" | "table" | "calendar" | "html";
  content: any;
  position: number;
  created_at: string;
  updated_at: string;
}

const DEFAULT_DASHBOARD_ID = "00000000-0000-0000-0000-000000000001";

export function useDashboardBlocks(dashboardId: string = DEFAULT_DASHBOARD_ID) {
  const [blocks, setBlocks] = useState<DashboardBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load blocks
  const loadBlocks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("dashboard_blocks")
        .select("*")
        .eq("dashboard_id", dashboardId)
        .order("position", { ascending: true });

      if (fetchError) {
        // Check if table doesn't exist
        const errorMessage = fetchError.message || '';
        const errorCode = fetchError.code || '';
        const isTableMissing = 
          errorCode === 'PGRST116' || 
          errorCode === '42P01' ||
          errorMessage.toLowerCase().includes('relation') || 
          errorMessage.toLowerCase().includes('does not exist') ||
          (errorMessage.toLowerCase().includes('table') && errorMessage.toLowerCase().includes('not found'));
        
        if (isTableMissing) {
          console.error("Dashboard blocks table missing. Please run supabase-dashboard-complete-fix.sql");
          setError("Dashboard blocks table not found. Please run the migration: supabase-dashboard-complete-fix.sql");
          setBlocks([]);
          return;
        }
        
        throw fetchError;
      }

      setBlocks(data || []);
    } catch (err: any) {
      console.error("Error loading dashboard blocks:", err);
      setError(err.message || "Failed to load blocks");
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  // Add a new block
  const addBlock = useCallback(
    async (type: DashboardBlock["type"], initialContent: any = {}) => {
      try {
        const maxPosition =
          blocks.length > 0
            ? Math.max(...blocks.map((b) => b.position))
            : -1;

        const defaultContent: Record<string, any> = {
          text: type === "text" ? { html: "" } : {},
          image: type === "image" ? { url: "", caption: "" } : {},
          embed: type === "embed" ? { url: "" } : {},
          kpi: type === "kpi" ? { table: "", label: "", filter: "", aggregate: "count" } : {},
          table: type === "table" ? { table: "", fields: [], limit: 5 } : {},
          calendar: type === "calendar" ? { table: "", dateField: "", limit: 5 } : {},
          html: type === "html" ? { html: "" } : {},
        };

        const { data, error: insertError } = await supabase
          .from("dashboard_blocks")
          .insert([
            {
              dashboard_id: dashboardId,
              type,
              content: initialContent || defaultContent[type] || {},
              position: maxPosition + 1,
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;

        setBlocks((prev) => [...prev, data]);
        return data;
      } catch (err: any) {
        console.error("Error adding block:", err);
        throw err;
      }
    },
    [dashboardId, blocks]
  );

  // Update a block
  const updateBlock = useCallback(
    async (id: string, updates: Partial<DashboardBlock>) => {
      try {
        const { data, error: updateError } = await supabase
          .from("dashboard_blocks")
          .update(updates)
          .eq("id", id)
          .select()
          .single();

        if (updateError) throw updateError;

        setBlocks((prev) =>
          prev.map((b) => (b.id === id ? { ...b, ...data } : b))
        );
        return data;
      } catch (err: any) {
        console.error("Error updating block:", err);
        throw err;
      }
    },
    []
  );

  // Delete a block
  const deleteBlock = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("dashboard_blocks")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;

      setBlocks((prev) => prev.filter((b) => b.id !== id));
    } catch (err: any) {
      console.error("Error deleting block:", err);
      throw err;
    }
  }, []);

  // Reorder blocks
  const reorderBlocks = useCallback(
    async (newOrder: string[]) => {
      try {
        const updates = newOrder.map((blockId, index) => ({
          id: blockId,
          position: index,
        }));

        await Promise.all(
          updates.map((update) =>
            supabase
              .from("dashboard_blocks")
              .update({ position: update.position })
              .eq("id", update.id)
          )
        );

        // Update local state
        const reorderedBlocks = newOrder
          .map((id) => blocks.find((b) => b.id === id))
          .filter(Boolean) as DashboardBlock[];

        setBlocks(reorderedBlocks);
      } catch (err: any) {
        console.error("Error reordering blocks:", err);
        // Reload on error
        loadBlocks();
        throw err;
      }
    },
    [blocks, loadBlocks]
  );

  return {
    blocks,
    loading,
    error,
    addBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
    reload: loadBlocks,
  };
}

