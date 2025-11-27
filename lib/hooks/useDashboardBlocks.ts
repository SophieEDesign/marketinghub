"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { validateAndFixContent, getDefaultContentForType, getDefaultContent, BlockType } from "@/lib/utils/dashboardBlockContent";

export interface DashboardBlock {
  id: string;
  dashboard_id: string;
  type: "text" | "image" | "embed" | "kpi" | "table" | "calendar" | "html";
  content: any;
  position: number; // Legacy - kept for backward compatibility
  position_x?: number; // Grid X position
  position_y?: number; // Grid Y position
  width?: number; // Grid width
  height?: number; // Grid height
  created_at: string;
  updated_at: string;
}

const DEFAULT_DASHBOARD_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Ensure default dashboard exists
 */
async function ensureDefaultDashboard(): Promise<void> {
  try {
    const DEFAULT_ID = "00000000-0000-0000-0000-000000000001";
    
    // Try to insert/update without description first (in case column doesn't exist)
    const dashboardData: any = {
      id: DEFAULT_ID,
      name: "Main Dashboard",
    };
    
    // Only include description if the column exists (we'll let the error tell us)
    const { error } = await supabase
      .from("dashboards")
      .upsert([dashboardData], { onConflict: "id" });

    if (error) {
      // If error is about missing description column, try without it
      if (error.message?.includes("description") || error.code === "PGRST204") {
        // Retry without description
        const { error: retryError } = await supabase
          .from("dashboards")
          .upsert([{ id: DEFAULT_ID, name: "Main Dashboard" }], { onConflict: "id" });
        
        if (retryError && retryError.code !== "23505") {
          console.warn("Could not ensure default dashboard:", retryError);
        }
      } else if (error.code !== "23505") {
        // Ignore duplicate key errors (23505)
        console.warn("Could not ensure default dashboard:", error);
      }
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

      // Validate and fix content for all blocks - normalize with defaults for backwards compatibility
      const validatedBlocks = (data || []).map((block) => {
        const baseDefaults = getDefaultContent(block.type);
        const typeDefaults = getDefaultContentForType(block.type);
        const defaultContent = { ...baseDefaults, ...typeDefaults };
        const existingContent = block.content || {};
        // Merge defaults with existing content to ensure all fields exist
        const normalizedContent = { ...defaultContent, ...validateAndFixContent(block.type, existingContent) };
        return {
          ...block,
          content: normalizedContent,
        };
      });

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

        // Validate block type - must match database constraint
        const validTypes: BlockType[] = ["text", "image", "embed", "kpi", "table", "calendar", "html"];
        if (!type || !validTypes.includes(type)) {
          throw new Error(`Invalid block type: ${type}. Must be one of: ${validTypes.join(", ")}`);
        }

        // Calculate default grid position (place new block after existing ones)
        const maxY = blocks.length > 0
          ? Math.max(...blocks.map((b) => (b.position_y ?? b.position ?? 0)))
          : -1;
        const maxX = blocks.length > 0
          ? Math.max(...blocks.filter((b) => (b.position_y ?? b.position ?? 0) === maxY).map((b) => (b.position_x ?? 0)))
          : -1;
        
        // Default position: next row if current row is full (4 blocks), otherwise next column
        const defaultX = maxX >= 9 ? 0 : (maxX + 3);
        const defaultY = maxX >= 9 ? maxY + 4 : maxY;

        // Get default content structure (includes title, limit, filters, etc.)
        const baseDefaults = getDefaultContent(type);
        const typeDefaults = getDefaultContentForType(type);
        
        // Merge base defaults with type-specific defaults
        const defaultContent = { ...baseDefaults, ...typeDefaults };

        // Use provided content if valid, otherwise use default
        // Normalize content: merge with defaults to ensure all fields exist
        const contentToUse = 
          initialContent && 
          typeof initialContent === "object" && 
          Object.keys(initialContent).length > 0
            ? { ...defaultContent, ...validateAndFixContent(type, initialContent) }
            : defaultContent;

        // Ensure content is never null and has all required fields
        const validatedContent = contentToUse || defaultContent;

        // Try inserting with grid layout columns first
        let insertData: any = {
          dashboard_id: dashboardId,
          type: type as string,
          content: validatedContent || defaultContent[type],
          position: maxY + 1, // Legacy position
        };

        // Get default block height from settings (default: 3)
        const getDefaultBlockHeight = () => {
          if (typeof window === 'undefined') return 3;
          const saved = localStorage.getItem('dashboardDefaultBlockHeight');
          return saved ? parseInt(saved, 10) : 3;
        };
        
        // Try to include grid layout columns, but fallback if they don't exist
        try {
          insertData.position_x = defaultX;
          insertData.position_y = defaultY;
          insertData.width = 3;
          insertData.height = getDefaultBlockHeight();
        } catch (e) {
          // Ignore - columns may not exist
        }

        let { data, error: insertError } = await supabase
          .from("dashboard_blocks")
          .insert([insertData])
          .select()
          .single();

        // If error is about missing columns (height, width, position_x, position_y), retry without them
        if (insertError && (insertError.code === "PGRST204" || insertError.message?.includes("column"))) {
          console.warn("Grid layout columns not available, inserting without them:", insertError.message);
          // Retry with only basic columns
          const basicInsertData = {
            dashboard_id: dashboardId,
            type: type as string,
            content: validatedContent || defaultContent[type],
            position: maxY + 1,
          };
          
          const retryResult = await supabase
            .from("dashboard_blocks")
            .insert([basicInsertData])
            .select()
            .single();
          
          if (retryResult.error) {
            console.error("Error inserting block (retry):", retryResult.error);
            throw retryResult.error;
          }
          
          data = retryResult.data;
          insertError = null;
        }

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

        // Build update data - explicitly include all fields that might be updated
        const updateData: any = {};
        
        // Handle content updates
        if (updates.content !== undefined) {
          updateData.content = validateAndFixContent(existingBlock.type, updates.content);
        }
        
        // Handle position updates - only include if they're defined
        if (updates.position !== undefined) updateData.position = updates.position;
        
        // Try to include grid layout columns, but handle gracefully if they don't exist
        const gridColumns: any = {};
        if (updates.position_x !== undefined) gridColumns.position_x = updates.position_x;
        if (updates.position_y !== undefined) gridColumns.position_y = updates.position_y;
        if (updates.width !== undefined) gridColumns.width = updates.width;
        if (updates.height !== undefined) gridColumns.height = updates.height;
        
        // Merge grid columns into updateData
        Object.assign(updateData, gridColumns);

        // First, try to update with all columns
        let { data, error: updateError } = await supabase
          .from("dashboard_blocks")
          .update(updateData)
          .eq("id", id)
          .select();

        // If error is about missing columns, retry without grid layout columns
        if (updateError && (updateError.code === "PGRST204" || updateError.message?.includes("column"))) {
          console.warn("Grid layout columns not available, updating without them:", updateError.message);
          // Retry with only basic columns
          const basicUpdateData: any = {};
          if (updates.content !== undefined) {
            basicUpdateData.content = validateAndFixContent(existingBlock.type, updates.content);
          }
          if (updates.position !== undefined) {
            basicUpdateData.position = updates.position;
          }
          
          const retryResult = await supabase
            .from("dashboard_blocks")
            .update(basicUpdateData)
            .eq("id", id)
            .select();
          
          if (retryResult.error) {
            console.error("Error updating block (retry):", retryResult.error);
            throw retryResult.error;
          }
          
          data = retryResult.data?.[0] || null;
          updateError = null;
        } else if (updateError) {
          throw updateError;
        } else {
          // Get the first result if multiple, or the single result
          data = Array.isArray(data) ? (data[0] || null) : data;
        }

        // If no data returned, fetch the updated block
        if (!data) {
          const { data: fetchedData, error: fetchError } = await supabase
            .from("dashboard_blocks")
            .select("*")
            .eq("id", id)
            .maybeSingle();
          
          if (fetchError) {
            console.error("Error fetching updated block:", fetchError);
            // Still update local state optimistically
            setBlocks((prev) =>
              prev.map((b) => {
                if (b.id === id) {
                  return {
                    ...b,
                    ...updates,
                    content: updates.content !== undefined 
                      ? validateAndFixContent(b.type, updates.content)
                      : b.content,
                  };
                }
                return b;
              })
            );
            return existingBlock;
          }
          
          data = fetchedData;
        }

        // Validate the returned data
        if (!data || Array.isArray(data)) {
          // If still no data or data is an array, update optimistically
          setBlocks((prev) =>
            prev.map((b) => {
              if (b.id === id) {
                return {
                  ...b,
                  ...updates,
                  content: updates.content !== undefined 
                    ? validateAndFixContent(b.type, updates.content)
                    : b.content,
                };
              }
              return b;
            })
          );
          return existingBlock;
        }

        // At this point, data is guaranteed to be a single object, not an array
        const blockData = data as DashboardBlock;
        const validatedBlock = {
          ...blockData,
          content: validateAndFixContent(blockData.type, blockData.content),
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

