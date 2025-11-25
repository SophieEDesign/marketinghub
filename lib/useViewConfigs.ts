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
      const data = await response.json();
      
      if (!response.ok) {
        // Check if it's a missing table error
        if (data.code === 'PGRST116' || data.code === '42P01' || 
            data.error?.includes('does not exist') || 
            data.error?.includes('migration')) {
          console.warn("[useViewConfigs] Views table missing - returning empty array");
          setViews([]);
          setCurrentView(null);
          setError(null); // Don't show error for missing table, just use empty views
        } else {
          throw new Error(data.error || `Failed to load views: ${response.statusText}`);
        }
      } else {
        const allViews = data.views || [];
        setViews(allViews);

        // Find the default view (or first view) to use as the source for shared settings
        const defaultView = allViews.find((v: ViewConfig) => v.is_default) || allViews[0];
        
        // Inherit shared settings (filters, sort, column_order) from default view to all views
        const viewsWithInheritedSettings = allViews.map((view: ViewConfig) => {
          // Skip if this is the default view itself
          if (view.id === defaultView?.id) {
            return view;
          }
          
          // Inherit filters, sort, and column_order from default view if current view doesn't have them
          const hasFilters = view.filters && Array.isArray(view.filters) && view.filters.length > 0;
          const hasSort = view.sort && Array.isArray(view.sort) && view.sort.length > 0;
          const hasColumnOrder = view.column_order && Array.isArray(view.column_order) && view.column_order.length > 0;
          
          if (!hasFilters || !hasSort || !hasColumnOrder) {
            return {
              ...view,
              filters: hasFilters ? view.filters : (defaultView?.filters || []),
              sort: hasSort ? view.sort : (defaultView?.sort || []),
              column_order: hasColumnOrder ? view.column_order : (defaultView?.column_order || []),
            };
          }
          
          return view;
        });
        
        setViews(viewsWithInheritedSettings);

        // Select view by name if provided, otherwise default or first view
        let selectedView: ViewConfig | undefined;
        if (selectViewName) {
          selectedView = viewsWithInheritedSettings.find((v: ViewConfig) => v.view_name === selectViewName || v.id === selectViewName);
        }
        if (!selectedView) {
          selectedView = viewsWithInheritedSettings.find((v: ViewConfig) => v.is_default) || viewsWithInheritedSettings[0];
        }
        if (selectedView) {
          setCurrentView(selectedView);
        } else if (allViews.length === 0) {
          // No views exist - create a default one
          setCurrentView(null);
        }
      }
    } catch (err: any) {
      console.error("[useViewConfigs] Error loading views:", err);
      setError(err.message);
      setViews([]);
      setCurrentView(null);
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
    const defaultView = views.find((v) => v.is_default) || views[0];
    const targetView = views.find((v) => v.view_name === viewNameOrId || v.id === viewNameOrId);
    
    if (targetView) {
      // Inherit shared settings from default view if target view doesn't have them
      const hasFilters = targetView.filters && Array.isArray(targetView.filters) && targetView.filters.length > 0;
      const hasSort = targetView.sort && Array.isArray(targetView.sort) && targetView.sort.length > 0;
      const hasColumnOrder = targetView.column_order && Array.isArray(targetView.column_order) && targetView.column_order.length > 0;
      
      if (defaultView && (targetView.id !== defaultView.id) && (!hasFilters || !hasSort || !hasColumnOrder)) {
        const viewWithInheritedSettings = {
          ...targetView,
          filters: hasFilters ? targetView.filters : (defaultView.filters || []),
          sort: hasSort ? targetView.sort : (defaultView.sort || []),
          column_order: hasColumnOrder ? targetView.column_order : (defaultView.column_order || []),
        };
        setCurrentView(viewWithInheritedSettings);
      } else {
        setCurrentView(targetView);
      }
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

