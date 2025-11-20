"use client";

import { useState, useCallback } from "react";
import { supabase } from "./supabaseClient";
import { Filter, Sort, ViewSettings } from "./types/filters";

export function useViewSettings(tableId: string, viewId: string) {
  const [settings, setSettings] = useState<ViewSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getViewSettings = useCallback(async (): Promise<ViewSettings | null> => {
    setLoading(true);
    setError(null);
    try {
      // Use settings table with key format: view_settings_{tableId}_{viewId}
      const settingsKey = `view_settings_${tableId}_${viewId}`;
      const { data, error: fetchError } = await supabase
        .from("settings")
        .select("*")
        .eq("key", settingsKey)
        .maybeSingle();

      if (fetchError) {
        // If error, just return default settings (don't block UI)
        console.warn("Error fetching view settings:", fetchError);
        const defaultSettings: ViewSettings = {
          id: "",
          table_id: tableId,
          view_id: viewId,
          filters: [],
          sort: [],
          visible_fields: [],
          field_order: [],
          row_height: "medium",
          card_fields: [],
          updated_at: new Date().toISOString(),
        };
        setSettings(defaultSettings);
        return defaultSettings;
      }

      if (data && data.value) {
        // Parse the JSONB value from settings table
        const value = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        const viewSettings: ViewSettings = {
          id: data.id || "",
          table_id: tableId,
          view_id: viewId,
          filters: value.filters || [],
          sort: value.sort || [],
          visible_fields: value.visible_fields || [],
          field_order: value.field_order || [],
          kanban_group_field: value.kanban_group_field,
          calendar_date_field: value.calendar_date_field,
          timeline_date_field: value.timeline_date_field,
          row_height: value.row_height || "medium",
          card_fields: value.card_fields || [],
          column_widths: value.column_widths || {},
          groupings: value.groupings || [],
          updated_at: data.updated_at || new Date().toISOString(),
        };
        setSettings(viewSettings);
        return viewSettings;
      }

      // Create default settings if none exist
      const defaultSettings: ViewSettings = {
        id: "",
        table_id: tableId,
        view_id: viewId,
        filters: [],
        sort: [],
        visible_fields: [],
        field_order: [],
        row_height: "medium",
        card_fields: [],
        updated_at: new Date().toISOString(),
      };
      setSettings(defaultSettings);
      return defaultSettings;
    } catch (err: any) {
      console.error("Error in getViewSettings:", err);
      // Return default settings even on error to not block UI
      const defaultSettings: ViewSettings = {
        id: "",
        table_id: tableId,
        view_id: viewId,
        filters: [],
        sort: [],
        visible_fields: [],
        field_order: [],
        row_height: "medium",
        card_fields: [],
        updated_at: new Date().toISOString(),
      };
      setSettings(defaultSettings);
      return defaultSettings;
    } finally {
      setLoading(false);
    }
  }, [tableId, viewId]);

  const saveFilters = useCallback(
    async (filters: Filter[]): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const settingsKey = `view_settings_${tableId}_${viewId}`;
        
        // Get existing settings or create default
        const { data: existing } = await supabase
          .from("settings")
          .select("id, value")
          .eq("key", settingsKey)
          .maybeSingle();

        const currentValue = existing?.value 
          ? (typeof existing.value === "string" ? JSON.parse(existing.value) : existing.value)
          : { filters: [], sort: [], visible_fields: [], field_order: [], row_height: "medium", card_fields: [] };
        
        const updatedValue = {
          ...currentValue,
          filters,
        };

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from("settings")
            .update({
              value: updatedValue,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) {
            setError(updateError.message);
            return false;
          }
        } else {
          // Insert new
          const { error: insertError } = await supabase.from("settings").insert([
            {
              key: settingsKey,
              value: updatedValue,
            },
          ]);

          if (insertError) {
            setError(insertError.message);
            return false;
          }
        }

        // Update local state directly (don't refetch to avoid loops)
        setSettings((prev) => {
          if (!prev) {
            return {
              id: existing?.id || "",
              table_id: tableId,
              view_id: viewId,
              filters,
              sort: currentValue.sort || [],
              visible_fields: currentValue.visible_fields || [],
              field_order: currentValue.field_order || [],
              row_height: currentValue.row_height || "medium",
              card_fields: currentValue.card_fields || [],
              updated_at: new Date().toISOString(),
            };
          }
          return { ...prev, filters, updated_at: new Date().toISOString() };
        });
        return true;
      } catch (err: any) {
        console.error("Error in saveFilters:", err);
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [tableId, viewId]
  );

  const saveSort = useCallback(
    async (sort: Sort[]): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const settingsKey = `view_settings_${tableId}_${viewId}`;
        
        // Get existing settings or create default
        const { data: existing } = await supabase
          .from("settings")
          .select("id, value")
          .eq("key", settingsKey)
          .maybeSingle();

        const currentValue = existing?.value 
          ? (typeof existing.value === "string" ? JSON.parse(existing.value) : existing.value)
          : { filters: [], sort: [], visible_fields: [], field_order: [], row_height: "medium", card_fields: [] };
        
        const updatedValue = {
          ...currentValue,
          sort,
        };

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from("settings")
            .update({
              value: updatedValue,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) {
            setError(updateError.message);
            return false;
          }
        } else {
          // Insert new
          const { error: insertError } = await supabase.from("settings").insert([
            {
              key: settingsKey,
              value: updatedValue,
            },
          ]);

          if (insertError) {
            setError(insertError.message);
            return false;
          }
        }

        // Update local state directly
        setSettings((prev) => {
          if (!prev) {
            return {
              id: existing?.id || "",
              table_id: tableId,
              view_id: viewId,
              filters: currentValue.filters || [],
              sort,
              visible_fields: currentValue.visible_fields || [],
              field_order: currentValue.field_order || [],
              row_height: currentValue.row_height || "medium",
              card_fields: currentValue.card_fields || [],
              updated_at: new Date().toISOString(),
            };
          }
          return { ...prev, sort, updated_at: new Date().toISOString() };
        });
        return true;
      } catch (err: any) {
        console.error("Error in saveSort:", err);
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [tableId, viewId]
  );

  const resetFilters = useCallback(async (): Promise<boolean> => {
    return saveFilters([]);
  }, [saveFilters]);

  const resetSort = useCallback(async (): Promise<boolean> => {
    return saveSort([]);
  }, [saveSort]);

  // Generic update function for view settings
  const updateSetting = useCallback(
    async (updates: Partial<ViewSettings>): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const settingsKey = `view_settings_${tableId}_${viewId}`;
        
        // Get existing settings or create default
        const { data: existing } = await supabase
          .from("settings")
          .select("id, value")
          .eq("key", settingsKey)
          .maybeSingle();

        const currentValue = existing?.value 
          ? (typeof existing.value === "string" ? JSON.parse(existing.value) : existing.value)
          : { filters: [], sort: [], visible_fields: [], field_order: [], row_height: "medium", card_fields: [] };
        
        // Build updated value object
        const updatedValue: any = {
          ...currentValue,
        };

        // Update only the fields that are provided
        if (updates.visible_fields !== undefined) {
          updatedValue.visible_fields = updates.visible_fields;
        }
        if (updates.field_order !== undefined) {
          updatedValue.field_order = updates.field_order;
        }
        if (updates.card_fields !== undefined) {
          updatedValue.card_fields = updates.card_fields;
        }
        if (updates.kanban_group_field !== undefined) {
          updatedValue.kanban_group_field = updates.kanban_group_field;
        }
        if (updates.calendar_date_field !== undefined) {
          updatedValue.calendar_date_field = updates.calendar_date_field;
        }
        if (updates.timeline_date_field !== undefined) {
          updatedValue.timeline_date_field = updates.timeline_date_field;
        }
        if (updates.row_height !== undefined) {
          updatedValue.row_height = updates.row_height;
        }
        if (updates.column_widths !== undefined) {
          updatedValue.column_widths = updates.column_widths;
        }
        if (updates.groupings !== undefined) {
          updatedValue.groupings = updates.groupings;
        }

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from("settings")
            .update({
              value: updatedValue,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) {
            setError(updateError.message);
            return false;
          }
        } else {
          // Insert new with defaults
          const { error: insertError } = await supabase.from("settings").insert([
            {
              key: settingsKey,
              value: updatedValue,
            },
          ]);

          if (insertError) {
            setError(insertError.message);
            return false;
          }
        }

        // Update local state
        setSettings((prev) => {
          if (!prev) {
            return {
              id: existing?.id || "",
              table_id: tableId,
              view_id: viewId,
              filters: currentValue.filters || [],
              sort: currentValue.sort || [],
              visible_fields: updatedValue.visible_fields || [],
              field_order: updatedValue.field_order || [],
              row_height: updatedValue.row_height || "medium",
              card_fields: updatedValue.card_fields || [],
              kanban_group_field: updatedValue.kanban_group_field,
              calendar_date_field: updatedValue.calendar_date_field,
              timeline_date_field: updatedValue.timeline_date_field,
              ...updates,
              updated_at: new Date().toISOString(),
            };
          }
          return { ...prev, ...updates, updated_at: new Date().toISOString() };
        });
        return true;
      } catch (err: any) {
        console.error("Error updating view setting:", err);
        setError(err.message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [tableId, viewId]
  );

  // Convenience setters
  const setVisibleFields = useCallback(
    async (fields: string[]) => {
      return updateSetting({ visible_fields: fields });
    },
    [updateSetting]
  );

  const setFieldOrder = useCallback(
    async (order: string[]) => {
      return updateSetting({ field_order: order });
    },
    [updateSetting]
  );

  const setKanbanGroupField = useCallback(
    async (field: string | null) => {
      return updateSetting({ kanban_group_field: field || undefined });
    },
    [updateSetting]
  );

  const setCalendarDateField = useCallback(
    async (field: string | null) => {
      return updateSetting({ calendar_date_field: field || undefined });
    },
    [updateSetting]
  );

  const setTimelineDateField = useCallback(
    async (field: string | null) => {
      return updateSetting({ timeline_date_field: field || undefined });
    },
    [updateSetting]
  );

  const setRowHeight = useCallback(
    async (height: "compact" | "medium" | "tall") => {
      return updateSetting({ row_height: height });
    },
    [updateSetting]
  );

  const setCardFields = useCallback(
    async (fields: string[]) => {
      return updateSetting({ card_fields: fields });
    },
    [updateSetting]
  );

  const setColumnWidths = useCallback(
    async (columnWidths: Record<string, number>): Promise<boolean> => {
      return updateSetting({ column_widths: columnWidths });
    },
    [updateSetting]
  );

  const setGroupings = useCallback(
    async (groupings: Array<{ name: string; fields: string[] }>): Promise<boolean> => {
      return updateSetting({ groupings: groupings });
    },
    [updateSetting]
  );

  return {
    settings,
    loading,
    error,
    getViewSettings,
    saveFilters,
    saveSort,
    resetFilters,
    resetSort,
    // New setters
    setVisibleFields,
    setFieldOrder,
    setKanbanGroupField,
    setCalendarDateField,
    setTimelineDateField,
    setRowHeight,
    setCardFields,
    setColumnWidths,
    setGroupings,
  };
}
