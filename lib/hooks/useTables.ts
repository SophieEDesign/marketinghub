"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface Table {
  id: string;
  name: string;
  label: string;
  description?: string;
  icon?: string;
  color?: string;
}

export function useTables() {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTables();
  }, []);

  const loadTables = async () => {
    try {
      setLoading(true);
      
      // Try loading from new tables system first
      const response = await fetch("/api/tables");
      if (response.ok) {
        const data = await response.json();
        if (data && data.length > 0) {
          setTables(data);
          setLoading(false);
          return;
        }
      }
      
      // Fallback to old table_metadata system
      const { data: oldTables, error } = await supabase
        .from("table_metadata")
        .select("table_name, display_name, description")
        .order("display_name", { ascending: true });
      
      if (!error && oldTables && oldTables.length > 0) {
        const convertedTables = oldTables.map((row) => ({
          id: row.table_name,
          name: row.table_name,
          label: row.display_name || row.table_name,
          description: row.description || '',
        }));
        setTables(convertedTables);
      } else {
        // No tables found - return empty array
        setTables([]);
      }
    } catch (error) {
      console.error("Error loading tables:", error);
      // Return empty array on error - no hardcoded fallback
      setTables([]);
    } finally {
      setLoading(false);
    }
  };

  return { tables, loading, reload: loadTables };
}

