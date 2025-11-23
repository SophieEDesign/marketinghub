"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPIConfig {
  title: string;
  value: string | number;
  previousValue?: string | number;
  trend?: "up" | "down" | "neutral";
  color?: string;
  icon?: string;
  table?: string;
  field?: string;
  filter?: any;
}

interface KPIModuleProps {
  config: KPIConfig;
  width: number;
  height: number;
  onUpdate?: (config: Partial<KPIConfig>) => void;
  isEditing?: boolean;
  data?: any[];
}

export default function KPIModule({ config, width, height, onUpdate, isEditing = false, data }: KPIModuleProps) {
  const trendIcon = useMemo(() => {
    if (config.trend === "up") return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (config.trend === "down") return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  }, [config.trend]);

  const trendColor = useMemo(() => {
    if (config.trend === "up") return "text-green-600";
    if (config.trend === "down") return "text-red-600";
    return "text-gray-400";
  }, [config.trend]);

  const formatValue = (val: string | number | undefined) => {
    if (val === undefined || val === null) return "—";
    if (typeof val === "number") {
      return val.toLocaleString();
    }
    return String(val);
  };

  const calculateTrend = () => {
    if (config.previousValue === undefined || config.value === undefined) return null;
    const current = typeof config.value === "number" ? config.value : parseFloat(String(config.value));
    const previous = typeof config.previousValue === "number" ? config.previousValue : parseFloat(String(config.previousValue));
    if (isNaN(current) || isNaN(previous)) return null;
    const diff = current - previous;
    const percent = previous !== 0 ? ((diff / previous) * 100).toFixed(1) : "0";
    return { diff, percent, trend: diff > 0 ? "up" : diff < 0 ? "down" : "neutral" as const };
  };

  // Calculate value from table data if configured
  const calculatedValue = useMemo(() => {
    if (config.table && config.calculation && data) {
      const tableData = Array.isArray(data) ? data : [];
      
      switch (config.calculation) {
        case "count":
          return tableData.length;
        case "sum":
          if (!config.field) return config.value || 0;
          return tableData.reduce((sum, row) => {
            const val = parseFloat(row[config.field!]) || 0;
            return sum + val;
          }, 0);
        case "average":
          if (!config.field) return config.value || 0;
          const sum = tableData.reduce((sum, row) => {
            const val = parseFloat(row[config.field!]) || 0;
            return sum + val;
          }, 0);
          return tableData.length > 0 ? sum / tableData.length : 0;
        case "min":
          if (!config.field) return config.value || 0;
          const values = tableData.map(row => parseFloat(row[config.field!]) || 0).filter(v => !isNaN(v));
          return values.length > 0 ? Math.min(...values) : 0;
        case "max":
          if (!config.field) return config.value || 0;
          const maxValues = tableData.map(row => parseFloat(row[config.field!]) || 0).filter(v => !isNaN(v));
          return maxValues.length > 0 ? Math.max(...maxValues) : 0;
        default:
          return config.value || 0;
      }
    }
    return config.value || 0;
  }, [config.table, config.calculation, config.field, config.value, data]);

  const trend = calculateTrend();

  return (
    <div
      className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ minHeight: `${height * 50}px` }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
            {config.title || "KPI"}
          </h3>
          {trend && trendIcon}
        </div>
        <div className="flex-1 flex items-center">
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {formatValue(calculatedValue)}
          </div>
        </div>
        {trend && (
          <div className={`text-xs mt-2 flex items-center gap-1 ${trendColor}`}>
            {trendIcon}
            <span>
              {Math.abs(trend.diff).toLocaleString()} ({trend.percent}%)
            </span>
            <span className="text-gray-500">vs previous</span>
          </div>
        )}
      </div>
    </div>
  );
}

