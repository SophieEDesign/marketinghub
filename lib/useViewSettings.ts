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
        console.error("Error fetching view settings:", fetchError);
        setError(fetchError.message);
        return null;
      }

      if (data) {
        const viewSettings: ViewSettings = {
          ...data,
          filters: (typeof data.filters === "string" ? JSON.parse(data.filters) : data.filters) || [],
          sort: (typeof data.sort === "string" ? JSON.parse(data.sort) : data.sort) || [],
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
        updated_at: new Date().toISOString(),
      };
      setSettings(defaultSettings);
      return defaultSettings;
    } catch (err: any) {
      console.error("Error in getViewSettings:", err);
      setError(err.message);
      return null;
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

        // Update local state
        setSettings((prev) => (prev ? { ...prev, filters, updated_at: new Date().toISOString() } : null));
        await getViewSettings();
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

        // Update local state
        setSettings((prev) => (prev ? { ...prev, sort, updated_at: new Date().toISOString() } : null));
        await getViewSettings();
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

  return {
    settings,
    loading,
    error,
    getViewSettings,
    saveFilters,
    saveSort,
    resetFilters,
    resetSort,
  };
}

