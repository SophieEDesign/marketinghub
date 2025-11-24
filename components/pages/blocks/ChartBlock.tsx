"use client";

import { useState, useEffect } from "react";
import { InterfacePageBlock } from "@/lib/hooks/useInterfacePages";
import { supabase } from "@/lib/supabaseClient";
import { usePageContext } from "../PageContext";
import { queryTable } from "@/lib/query/queryTable";
import { BarChart3, TrendingUp } from "lucide-react";

interface ChartBlockProps {
  block: InterfacePageBlock;
}

export default function ChartBlock({ block }: ChartBlockProps) {
  const config = block.config || {};
  const tableName = config.table || "";
  const chartType = config.chartType || "bar";
  const xField = config.xField || null;
  const yField = config.yField || null;
  const { getSharedFilters } = usePageContext();
  
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get shared filters from FilterBlock components
  const sharedFilters = tableName ? getSharedFilters(tableName) : [];

  useEffect(() => {
    if (tableName && xField && yField) {
      loadData();
    }
  }, [tableName, xField, yField, sharedFilters]);

  const loadData = async () => {
    if (!tableName || !xField || !yField) {
      setRows([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      // Combine block filters with shared filters
      const allFilters = [
        ...(config.filters || []),
        ...sharedFilters
      ];

      const result = await queryTable({
        table: tableName,
        fields: [xField, yField],
        filters: allFilters.length > 0 ? allFilters : undefined,
        sort: config.sort || [{ field: xField, direction: "asc" }],
        limit: 100, // Limit for chart data
      });

      setRows(result.data || []);
    } catch (err: any) {
      console.error("Error loading chart data:", err);
      setError(err.message || "Failed to load data");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  if (!tableName) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded">
        <div className="text-center">
          <p className="font-medium mb-1">Chart Block Not Configured</p>
          <p className="text-xs">Click the settings icon to configure table and fields</p>
        </div>
      </div>
    );
  }

  if (!xField || !yField) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded">
        <div className="text-center">
          <p className="font-medium mb-1">Chart Fields Not Set</p>
          <p className="text-xs">Configure X and Y fields in settings</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading chart data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full p-4">
        <div className="text-sm text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="w-full h-full p-4 flex items-center justify-center">
        <div className="text-sm text-gray-500 dark:text-gray-400">No data available</div>
      </div>
    );
  }

  // Calculate max value for scaling
  const maxValue = Math.max(...rows.map(r => {
    const val = parseFloat(r[yField]) || 0;
    return val;
  }), 1);

  return (
    <div className="w-full h-full p-4">
      <div className="mb-4 flex items-center gap-2">
        {chartType === "bar" ? (
          <BarChart3 className="w-5 h-5 text-gray-400" />
        ) : (
          <TrendingUp className="w-5 h-5 text-gray-400" />
        )}
        <div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {yField.replace(/_/g, " ")} by {xField.replace(/_/g, " ")}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {rows.length} data points
          </div>
        </div>
      </div>

      {chartType === "bar" ? (
        <div className="space-y-2">
          {rows.slice(0, 10).map((row, idx) => {
            const xValue = row[xField] || "—";
            const yValue = parseFloat(row[yField]) || 0;
            const percentage = (yValue / maxValue) * 100;
            
            return (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-24 text-xs text-gray-600 dark:text-gray-400 truncate">
                  {String(xValue).slice(0, 20)}
                </div>
                <div className="flex-1">
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded overflow-hidden">
                    <div
                      className="h-full bg-blue-600 dark:bg-blue-500 transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
                <div className="w-16 text-xs text-right text-gray-900 dark:text-gray-100 font-medium">
                  {yValue.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-1">
          {rows.slice(0, 10).map((row, idx) => {
            const xValue = row[xField] || "—";
            const yValue = parseFloat(row[yField]) || 0;
            
            return (
              <div key={idx} className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded">
                <div className="text-sm text-gray-900 dark:text-gray-100">
                  {String(xValue).slice(0, 30)}
                </div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {yValue.toLocaleString()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

