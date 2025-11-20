"use client";

import { ReactNode } from "react";

interface OverviewCardProps {
  title: string;
  value: number;
  icon?: ReactNode;
  trend?: number;
  onClick?: () => void;
  color?: "blue" | "red" | "green" | "yellow";
}

export default function OverviewCard({
  title,
  value,
  icon,
  trend,
  onClick,
  color = "blue",
}: OverviewCardProps) {
  const colorClasses = {
    blue: "bg-brand-blue/10 border-brand-blue/20 text-brand-blue",
    red: "bg-brand-red/10 border-brand-red/20 text-brand-red",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
    yellow: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300",
  };

  const baseClasses = "rounded-lg border p-6 shadow-sm transition hover:shadow-md";
  const clickableClasses = onClick ? "cursor-pointer hover:scale-[1.02]" : "";

  return (
    <div
      className={`${baseClasses} ${colorClasses[color]} ${clickableClasses}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium opacity-80">{title}</h3>
        {icon && <div className="opacity-60">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-heading font-bold">{value}</span>
        {trend !== undefined && (
          <span className={`text-sm ${trend >= 0 ? "text-green-600" : "text-red-600"}`}>
            {trend >= 0 ? "+" : ""}{trend}%
          </span>
        )}
      </div>
    </div>
  );
}

