"use client";

import { useState, useEffect, useCallback } from "react";
import { ViewConfig } from "./types/viewConfig";

export function useViewConfigs(tableName: string) {
  const [views, setViews] = useState<ViewConfig[]>([]);
  const [currentView, setCurrentView] = useState<ViewConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load all views for the table
  const loadViews = useCallback(async (selectViewName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/views?table=${tableName}`);
      if (!response.ok) {
        throw new Error(`Failed to load views: ${response.statusText}`);
      }
      const data = await response.json();
      setViews(data.views || []);

      // Select view by name if provided, otherwise default or first view
      let selectedView: ViewConfig | undefined;
      if (selectViewName) {
        selectedView = data.views?.find((v: ViewConfig) => v.view_name === selectViewName || v.id === selectViewName);
      }
      if (!selectedView) {
        selectedView = data.views?.find((v: ViewConfig) => v.is_default) || data.views?.[0];
      }
      if (selectedView) {
        setCurrentView(selectedView);
      }
    } catch (err: any) {
      console.error("[useViewConfigs] Error loading views:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tableName]);

  // Store the view name to select
  const [selectViewName, setSelectViewName] = useState<string | undefined>(undefined);

  // Load views on mount and when table changes
  useEffect(() => {
    loadViews(selectViewName);
  }, [loadViews, selectViewName]);

  // Create a new view
  const createView = useCallback(async (viewName: string, cloneFrom?: ViewConfig): Promise<ViewConfig | null> => {
    try {
      const defaultConfig: Partial<ViewConfig> = {
        view_type: "grid",
        column_order: [],
        column_widths: {},
        hidden_columns: [],
        filters: [],
        sort: [],
        groupings: [],
        row_height: "medium",
      };
      
      const baseConfig = cloneFrom || currentView || defaultConfig;

      const response = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_name: tableName,
          view_name: viewName,
          view_type: baseConfig.view_type || "grid",
          column_order: baseConfig.column_order || [],
          column_widths: baseConfig.column_widths || {},
          hidden_columns: baseConfig.hidden_columns || [],
          filters: baseConfig.filters || [],
          sort: baseConfig.sort || [],
          groupings: baseConfig.groupings || [],
          row_height: baseConfig.row_height || "medium",
          is_default: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create view: ${response.statusText}`);
      }

      const data = await response.json();
      await loadViews(); // Reload views
      setCurrentView(data.view);
      return data.view;
    } catch (err: any) {
      console.error("[useViewConfigs] Error creating view:", err);
      setError(err.message);
      return null;
    }
  }, [tableName, currentView, loadViews]);

  // Update a view
  const updateView = useCallback(async (viewId: string, updates: Partial<ViewConfig>): Promise<boolean> => {
    try {
      const response = await fetch(`/api/views/${viewId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`Failed to update view: ${response.statusText}`);
      }

      await loadViews(); // Reload views
      if (currentView?.id === viewId) {
        const data = await response.json();
        setCurrentView(data.view);
      }
      return true;
    } catch (err: any) {
      console.error("[useViewConfigs] Error updating view:", err);
      setError(err.message);
      return false;
    }
  }, [currentView, loadViews]);

  // Delete a view
  const deleteView = useCallback(async (viewId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/views/${viewId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete view: ${response.statusText}`);
      }

      await loadViews(); // Reload views
      return true;
    } catch (err: any) {
      console.error("[useViewConfigs] Error deleting view:", err);
      setError(err.message);
      return false;
    }
  }, [loadViews]);

  // Set a view as default
  const setDefaultView = useCallback(async (viewId: string): Promise<boolean> => {
    return updateView(viewId, { is_default: true });
  }, [updateView]);

  // Switch to a view
  const switchToView = useCallback((view: ViewConfig) => {
    setCurrentView(view);
  }, []);

  // Switch to a view by name or ID
  const switchToViewByName = useCallback((viewNameOrId: string) => {
    const view = views.find((v) => v.view_name === viewNameOrId || v.id === viewNameOrId);
    if (view) {
      setCurrentView(view);
    } else {
      // If view not found in current views, reload and try to select it
      setSelectViewName(viewNameOrId);
    }
  }, [views]);

  // Auto-save current view settings
  const saveCurrentView = useCallback(async (updates: Partial<ViewConfig>): Promise<boolean> => {
    if (!currentView?.id) return false;
    return updateView(currentView.id, updates);
  }, [currentView, updateView]);

  return {
    views,
    currentView,
    loading,
    error,
    createView,
    updateView,
    deleteView,
    setDefaultView,
    switchToView,
    switchToViewByName,
    saveCurrentView,
    reloadViews: () => loadViews(selectViewName),
  };
}

