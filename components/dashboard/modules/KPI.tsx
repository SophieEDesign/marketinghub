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
}

export default function KPIModule({ config, width, height, onUpdate, isEditing = false }: KPIModuleProps) {
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
            {formatValue(config.value)}
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

