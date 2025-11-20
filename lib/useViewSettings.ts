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
      const { data, error: fetchError } = await supabase
        .from("view_settings")
        .select("*")
        .eq("table_id", tableId)
        .eq("view_id", viewId)
        .maybeSingle();

      if (fetchError) {
        // If table doesn't exist, just return default settings (don't block UI)
        if (fetchError.message?.includes("does not exist") || fetchError.code === "42P01") {
          console.warn("view_settings table does not exist yet. Using default settings. Run the SQL migration to enable persistence.");
          const defaultSettings: ViewSettings = {
            id: "",
            table_id: tableId,
            view_id: viewId,
            filters: [],
            sort: [],
            updated_at: new Date().toISOString(),
          };
          setSettings(defaultSettings);
          return defaultSettings;
        }
        console.error("Error fetching view settings:", fetchError);
        setError(fetchError.message);
        // Still return default settings to not block UI
        const defaultSettings: ViewSettings = {
          id: "",
          table_id: tableId,
          view_id: viewId,
          filters: [],
          sort: [],
          updated_at: new Date().toISOString(),
        };
        setSettings(defaultSettings);
        return defaultSettings;
      }

      if (data) {
        const viewSettings: ViewSettings = {
          ...data,
          filters: (typeof data.filters === "string" ? JSON.parse(data.filters) : data.filters) || [],
          sort: (typeof data.sort === "string" ? JSON.parse(data.sort) : data.sort) || [],
          visible_fields: (typeof data.visible_fields === "string" ? JSON.parse(data.visible_fields) : data.visible_fields) || [],
          field_order: (typeof data.field_order === "string" ? JSON.parse(data.field_order) : data.field_order) || [],
          card_fields: (typeof data.card_fields === "string" ? JSON.parse(data.card_fields) : data.card_fields) || [],
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
        const filtersJson = JSON.stringify(filters);

        // Check if settings exist
        const { data: existing } = await supabase
          .from("view_settings")
          .select("id")
          .eq("table_id", tableId)
          .eq("view_id", viewId)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from("view_settings")
            .update({
              filters: filtersJson,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) {
            setError(updateError.message);
            return false;
          }
        } else {
          // Insert new
          const { error: insertError } = await supabase.from("view_settings").insert([
            {
              table_id: tableId,
              view_id: viewId,
              filters: filtersJson,
              sort: "[]",
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
              sort: [],
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
    [tableId, viewId, getViewSettings]
  );

  const saveSort = useCallback(
    async (sort: Sort[]): Promise<boolean> => {
      setLoading(true);
      setError(null);
      try {
        const sortJson = JSON.stringify(sort);

        // Check if settings exist
        const { data: existing } = await supabase
          .from("view_settings")
          .select("id")
          .eq("table_id", tableId)
          .eq("view_id", viewId)
          .maybeSingle();

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from("view_settings")
            .update({
              sort: sortJson,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id);

          if (updateError) {
            setError(updateError.message);
            return false;
          }
        } else {
          // Insert new
          const { error: insertError } = await supabase.from("view_settings").insert([
            {
              table_id: tableId,
              view_id: viewId,
              filters: "[]",
              sort: sortJson,
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
              filters: [],
              sort,
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
    [tableId, viewId, getViewSettings]
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
        // Check if settings exist
        const { data: existing } = await supabase
          .from("view_settings")
          .select("id")
          .eq("table_id", tableId)
          .eq("view_id", viewId)
          .maybeSingle();

        const updateData: any = {
          updated_at: new Date().toISOString(),
        };

        // Convert arrays to JSON strings
        if (updates.visible_fields !== undefined) {
          updateData.visible_fields = JSON.stringify(updates.visible_fields);
        }
        if (updates.field_order !== undefined) {
          updateData.field_order = JSON.stringify(updates.field_order);
        }
        if (updates.card_fields !== undefined) {
          updateData.card_fields = JSON.stringify(updates.card_fields);
        }
        if (updates.kanban_group_field !== undefined) {
          updateData.kanban_group_field = updates.kanban_group_field;
        }
        if (updates.calendar_date_field !== undefined) {
          updateData.calendar_date_field = updates.calendar_date_field;
        }
        if (updates.timeline_date_field !== undefined) {
          updateData.timeline_date_field = updates.timeline_date_field;
        }
        if (updates.row_height !== undefined) {
          updateData.row_height = updates.row_height;
        }

        if (existing) {
          // Update existing
          const { error: updateError } = await supabase
            .from("view_settings")
            .update(updateData)
            .eq("id", existing.id);

          if (updateError) {
            setError(updateError.message);
            return false;
          }
        } else {
          // Insert new with defaults
          const { error: insertError } = await supabase.from("view_settings").insert([
            {
              table_id: tableId,
              view_id: viewId,
              filters: "[]",
              sort: "[]",
              visible_fields: "[]",
              field_order: "[]",
              row_height: "medium",
              card_fields: "[]",
              ...updateData,
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
              filters: [],
              sort: [],
              visible_fields: [],
              field_order: [],
              row_height: "medium",
              card_fields: [],
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
  };
}

