"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { ChartPageConfig } from "@/lib/pages/pageConfig";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import dynamic from "next/dynamic";

// Dynamically import ChartComponent to avoid build-time errors if recharts isn't installed
// Using a function that handles the import error gracefully
const ChartComponent = dynamic(
  () => import("./ChartComponent").catch(() => ({
    default: () => (
      <div className="p-6 text-center text-gray-500 border border-gray-200 dark:border-gray-700 rounded-lg">
        <p className="mb-2">Chart library not installed</p>
        <p className="text-sm">
          Please install recharts: <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">npm install recharts</code>
        </p>
      </div>
    ),
  })),
  { ssr: false }
);

interface ChartPageProps {
  page: InterfacePage;
  config: ChartPageConfig | null;
  isEditing?: boolean;
}

export default function ChartPage({ page, config, isEditing }: ChartPageProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { fields: allFields } = useFields(config?.table || "");

  const xField = allFields.find((f) => f.key === config?.xField);
  const yField = allFields.find((f) => f.key === config?.yField);

  // Load and aggregate data
  useEffect(() => {
    if (!config?.table || !config.xField || !config.yField) return;

    const loadData = async () => {
      setLoading(true);
      try {
        let query = supabase.from(config.table).select("*");

        // Apply filters
        if (config.filters && config.filters.length > 0) {
          for (const filter of config.filters) {
            if (filter.operator === "equals") {
              query = query.eq(filter.field, filter.value);
            }
          }
        }

        const { data: records, error } = await query;

        if (error) throw error;

        // Aggregate data for chart
        const aggregated: Record<string, number> = {};
        (records || []).forEach((record) => {
          const xValue = String(record[config.xField] || "");
          const yValue = parseFloat(record[config.yField]) || 0;
          
          if (aggregated[xValue]) {
            aggregated[xValue] += yValue;
          } else {
            aggregated[xValue] = yValue;
          }
        });

        // Convert to chart data format
        const chartData = Object.entries(aggregated).map(([name, value]) => ({
          name,
          value,
        }));

        setData(chartData);
      } catch (error: any) {
        console.error("Error loading chart data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [config]);

  if (!config?.table || !config.xField || !config.yField) {
    return (
      <div className="p-6 text-center text-gray-500">
        {isEditing ? (
          <p>Configure this page by selecting a table, x field, and y field in settings.</p>
        ) : (
          <p>This page is not configured yet.</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading chart data...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        No data available for chart.
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4">
          {xField?.label || config.xField} vs {yField?.label || config.yField}
        </h3>
        <ChartComponent
          data={data}
          chartType={config.chartType}
          xField={config.xField}
          yField={config.yField}
        />
      </div>
    </div>
  );
}
