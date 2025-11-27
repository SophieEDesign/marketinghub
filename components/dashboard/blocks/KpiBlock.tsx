"use client";

import { useState, useEffect } from "react";
import { BarChart3 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import BlockHeader from "./BlockHeader";
import { getDefaultContent } from "@/lib/utils/dashboardBlockContent";

interface KpiBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  isDragging?: boolean;
  editing?: boolean;
}

export default function KpiBlock({
  id,
  content,
  onUpdate,
  onDelete,
  onOpenSettings,
  isDragging = false,
  editing = false,
}: KpiBlockProps) {
  // Normalize content with defaults for backwards compatibility
  const defaults = getDefaultContent("kpi");
  const normalizedContent = { ...defaults, ...content };
  
  const [value, setValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Load KPI value
  useEffect(() => {
    if (normalizedContent.table) {
      loadKpiValue();
    }
  }, [normalizedContent.table, normalizedContent.aggregate, normalizedContent.filters, normalizedContent.field]);

  const loadKpiValue = async () => {
    if (!normalizedContent.table) return;

    setLoading(true);
    try {
      let query: any = supabase.from(normalizedContent.table);

      // Apply filters if provided
      if (normalizedContent.filters && Array.isArray(normalizedContent.filters)) {
        normalizedContent.filters.forEach((filter: any) => {
          if (filter.field && filter.operator && filter.value !== undefined) {
            switch (filter.operator) {
              case "eq":
                query = query.eq(filter.field, filter.value);
                break;
              case "neq":
                query = query.neq(filter.field, filter.value);
                break;
              case "gt":
                query = query.gt(filter.field, filter.value);
                break;
              case "lt":
                query = query.lt(filter.field, filter.value);
                break;
              case "gte":
                query = query.gte(filter.field, filter.value);
                break;
              case "lte":
                query = query.lte(filter.field, filter.value);
                break;
            }
          }
        });
      }

      if (normalizedContent.aggregate === "count") {
        const { count, error } = await query.select("*", { count: "exact", head: true });
        if (error) throw error;
        setValue(count || 0);
      } else if (normalizedContent.aggregate === "sum" && normalizedContent.field) {
        const { data, error } = await query.select(normalizedContent.field);
        if (error) throw error;
        const sum = (data || []).reduce((acc: number, row: any) => {
          const val = parseFloat(row[normalizedContent.field]) || 0;
          return acc + val;
        }, 0);
        setValue(sum);
      } else if (normalizedContent.aggregate === "avg" && normalizedContent.field) {
        const { data, error } = await query.select(normalizedContent.field);
        if (error) throw error;
        const values = (data || []).map((row: any) => parseFloat(row[normalizedContent.field]) || 0);
        const avg = values.length > 0 ? values.reduce((a: number, b: number) => a + b, 0) / values.length : 0;
        setValue(avg);
      } else if (normalizedContent.aggregate === "min" && normalizedContent.field) {
        const { data, error } = await query.select(normalizedContent.field).order(normalizedContent.field, { ascending: true }).limit(1);
        if (error) throw error;
        setValue(data && data[0] ? parseFloat(data[0][normalizedContent.field]) || 0 : 0);
      } else if (normalizedContent.aggregate === "max" && normalizedContent.field) {
        const { data, error } = await query.select(normalizedContent.field).order(normalizedContent.field, { ascending: false }).limit(1);
        if (error) throw error;
        setValue(data && data[0] ? parseFloat(data[0][normalizedContent.field]) || 0 : 0);
      } else {
        // Default to count
        const { count, error } = await query.select("*", { count: "exact", head: true });
        if (error) throw error;
        setValue(count || 0);
      }
    } catch (error) {
      console.error("Error loading KPI:", error);
      setValue(null);
    } finally {
      setLoading(false);
    }
  };

  const title = normalizedContent.title || normalizedContent.label || "KPI";
  const label = normalizedContent.label || "Total Records";

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <BlockHeader
        title={title}
        editing={editing}
        onOpenSettings={onOpenSettings || (() => {})}
        onDelete={onDelete ? () => onDelete(id) : undefined}
        isDragging={isDragging}
      />

      <div className="p-6 text-center flex-1 flex flex-col items-center justify-center">
        {!normalizedContent.table ? (
          <>
            <BarChart3 className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No table selected</p>
            <p className="text-xs mt-1 text-gray-400">Configure in settings</p>
          </>
        ) : (
          <>
            <BarChart3 className="w-8 h-8 mx-auto text-gray-400 mb-2" />
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {label}
            </div>
            {loading ? (
              <div className="text-2xl font-bold text-gray-400">...</div>
            ) : (
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {value !== null ? value.toLocaleString() : "—"}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
