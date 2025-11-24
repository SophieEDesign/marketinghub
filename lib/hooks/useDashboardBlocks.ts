"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { validateAndFixContent, getDefaultContentForType, BlockType } from "@/lib/utils/dashboardBlockContent";

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

/**
 * Ensure default dashboard exists
 */
async function ensureDefaultDashboard(): Promise<void> {
  try {
    const { error } = await supabase
      .from("dashboards")
      .upsert(
        {
          id: DEFAULT_DASHBOARD_ID,
          name: "Main Dashboard",
          description: "Default dashboard",
        },
        { onConflict: "id" }
      );

    if (error && error.code !== "23505") {
      // Ignore duplicate key errors
      console.warn("Could not ensure default dashboard:", error);
    }
  } catch (err) {
    console.warn("Error ensuring default dashboard:", err);
  }
}

export function useDashboardBlocks(dashboardId: string = DEFAULT_DASHBOARD_ID) {
  const [blocks, setBlocks] = useState<DashboardBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load blocks
  const loadBlocks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Ensure default dashboard exists
      if (dashboardId === DEFAULT_DASHBOARD_ID) {
        await ensureDefaultDashboard();
      }

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
          console.error("Dashboard blocks table missing. Please run supabase-dashboard-system-complete.sql");
          setError("Dashboard blocks table not found. Please run the migration: supabase-dashboard-system-complete.sql");
          setBlocks([]);
          return;
        }
        
        throw fetchError;
      }

      // Validate and fix content for all blocks
      const validatedBlocks = (data || []).map((block) => ({
        ...block,
        content: validateAndFixContent(block.type, block.content),
      }));

      setBlocks(validatedBlocks);
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
    async (type: BlockType, initialContent: any = {}) => {
      try {
        // Ensure default dashboard exists
        if (dashboardId === DEFAULT_DASHBOARD_ID) {
          await ensureDefaultDashboard();
        }

        const maxPosition =
          blocks.length > 0
            ? Math.max(...blocks.map((b) => b.position))
            : -1;

        // Validate and fix content
        const validatedContent = validateAndFixContent(
          type,
          initialContent && Object.keys(initialContent).length > 0
            ? initialContent
            : getDefaultContentForType(type)
        );

        const { data, error: insertError } = await supabase
          .from("dashboard_blocks")
          .insert([
            {
              dashboard_id: dashboardId,
              type,
              content: validatedContent,
              position: maxPosition + 1,
            },
          ])
          .select()
          .single();

        if (insertError) {
          console.error("Error inserting block:", insertError);
          throw insertError;
        }

        // Validate the returned data
        const validatedBlock = {
          ...data,
          content: validateAndFixContent(data.type, data.content),
        };

        setBlocks((prev) => [...prev, validatedBlock]);
        return validatedBlock;
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
        // Find the block to get its type
        const existingBlock = blocks.find((b) => b.id === id);
        if (!existingBlock) {
          throw new Error(`Block with id ${id} not found`);
        }

        // If updating content, validate it
        const updateData: Partial<DashboardBlock> = { ...updates };
        if (updates.content !== undefined) {
          updateData.content = validateAndFixContent(existingBlock.type, updates.content);
        }

        const { data, error: updateError } = await supabase
          .from("dashboard_blocks")
          .update(updateData)
          .eq("id", id)
          .select()
          .single();

        if (updateError) {
          console.error("Error updating block:", updateError);
          throw updateError;
        }

        // Validate the returned data
        const validatedBlock = {
          ...data,
          content: validateAndFixContent(data.type, data.content),
        };

        setBlocks((prev) =>
          prev.map((b) => (b.id === id ? validatedBlock : b))
        );
        return validatedBlock;
      } catch (err: any) {
        console.error("Error updating block:", err);
        throw err;
      }
    },
    [blocks]
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
        if (newOrder.length === 0) return;

        // Update positions in database
        const updates = newOrder.map((blockId, index) => ({
          id: blockId,
          position: index,
        }));

        const updatePromises = updates.map((update) =>
          supabase
            .from("dashboard_blocks")
            .update({ position: update.position })
            .eq("id", update.id)
        );

        const results = await Promise.all(updatePromises);
        
        // Check for errors
        const errors = results.filter((r) => r.error);
        if (errors.length > 0) {
          console.error("Errors updating positions:", errors);
          throw new Error("Failed to update some block positions");
        }

        // Update local state optimistically
        const reorderedBlocks = newOrder
          .map((id, index) => {
            const block = blocks.find((b) => b.id === id);
            return block ? { ...block, position: index } : null;
          })
          .filter((b): b is DashboardBlock => b !== null);

        setBlocks(reorderedBlocks);
      } catch (err: any) {
        console.error("Error reordering blocks:", err);
        // Reload on error to get correct state
        await loadBlocks();
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

