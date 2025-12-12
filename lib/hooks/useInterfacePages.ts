"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PageLayout } from "@/components/pages/NewPageModal";

export interface InterfacePage {
  id: string;
  name: string;
  layout: PageLayout;
  page_type?: string; // New: page type (grid, record, kanban, etc.)
  settings?: any; // Page configuration (JSONB)
  actions?: any[]; // Page actions (JSONB)
  quick_automations?: any[]; // Quick automations (JSONB)
  created_at: string;
  updated_at: string;
}

export interface InterfacePageBlock {
  id: string;
  page_id: string;
  type: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  config: any;
  created_at: string;
  updated_at: string;
}

export function useInterfacePages() {
  const [pages, setPages] = useState<InterfacePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("pages")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setPages(data || []);
    } catch (err: any) {
      console.error("Error loading pages:", err);
      setError(err.message || "Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const createPage = useCallback(async (
    name: string,
    layout: PageLayout,
    pageType?: string
  ): Promise<InterfacePage> => {
    // Use pageType if provided, otherwise derive from layout
    const finalPageType = pageType || (layout === 'custom' ? 'custom' : layout) || 'custom';
    
    const { data, error: createError } = await supabase
      .from("pages")
      .insert({
        name,
        layout,
        page_type: finalPageType,
      })
      .select()
      .single();

    if (createError) throw createError;
    
    // Create default blocks based on layout (only for custom pages or if no page_type specific logic)
    if (finalPageType === 'custom') {
      await createDefaultBlocks(data.id, layout);
    }
    // For other page types, default templates will be used by the renderer
    
    await loadPages();
    return data;
  }, [loadPages]);

  const updatePage = useCallback(async (
    id: string,
    updates: Partial<InterfacePage>
  ): Promise<void> => {
    const { error: updateError } = await supabase
      .from("pages")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) throw updateError;
    await loadPages();
  }, [loadPages]);

  const deletePage = useCallback(async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from("pages")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;
    await loadPages();
  }, [loadPages]);

  return {
    pages,
    loading,
    error,
    loadPages,
    createPage,
    updatePage,
    deletePage,
  };
}

async function createDefaultBlocks(pageId: string, layout: PageLayout) {
  const defaultBlocks: Array<{
    page_id: string;
    type: string;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
    config: any;
  }> = [];

  switch (layout) {
    case "grid":
      defaultBlocks.push({
        page_id: pageId,
        type: "grid",
        position_x: 0,
        position_y: 0,
        width: 12,
        height: 12,
        config: { table: null, fields: [], filters: [], sort: [] },
      });
      break;
    case "kanban":
      defaultBlocks.push({
        page_id: pageId,
        type: "kanban",
        position_x: 0,
        position_y: 0,
        width: 12,
        height: 12,
        config: { table: null, groupField: null, filters: [], sort: [] },
      });
      break;
    case "calendar":
      defaultBlocks.push({
        page_id: pageId,
        type: "calendar",
        position_x: 0,
        position_y: 0,
        width: 12,
        height: 12,
        config: { table: null, dateField: null, filters: [], sort: [] },
      });
      break;
    case "timeline":
      defaultBlocks.push({
        page_id: pageId,
        type: "timeline",
        position_x: 0,
        position_y: 0,
        width: 12,
        height: 12,
        config: { table: null, dateField: null, filters: [], sort: [] },
      });
      break;
    case "gallery":
      defaultBlocks.push({
        page_id: pageId,
        type: "gallery",
        position_x: 0,
        position_y: 0,
        width: 12,
        height: 12,
        config: { table: null, cardFields: [], filters: [], sort: [] },
      });
      break;
    case "list":
      defaultBlocks.push({
        page_id: pageId,
        type: "list",
        position_x: 0,
        position_y: 0,
        width: 12,
        height: 12,
        config: { table: null, fields: [], filters: [], sort: [] },
      });
      break;
    case "dashboard":
      defaultBlocks.push(
        {
          page_id: pageId,
          type: "kpi",
          position_x: 0,
          position_y: 0,
          width: 4,
          height: 4,
          config: { table: null, label: "Total", aggregate: "count" },
        },
        {
          page_id: pageId,
          type: "chart",
          position_x: 4,
          position_y: 0,
          width: 8,
          height: 6,
          config: { table: null, chartType: "bar", xField: null, yField: null },
        }
      );
      break;
    case "form":
      defaultBlocks.push({
        page_id: pageId,
        type: "form",
        position_x: 0,
        position_y: 0,
        width: 12,
        height: 12,
        config: { table: null, fields: [] },
      });
      break;
    // "custom" has no default blocks
  }

  if (defaultBlocks.length > 0) {
      const { error } = await supabase
        .from("page_blocks")
        .insert(defaultBlocks);

    if (error) {
      console.error("Error creating default blocks:", error);
    }
  }
}

