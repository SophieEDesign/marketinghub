"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
}

export function Skeleton({ className, variant = "rectangular" }: SkeletonProps) {
  const baseStyles = "animate-pulse bg-gray-200 dark:bg-gray-700";
  
  const variants = {
    text: "h-4 rounded",
    circular: "rounded-full",
    rectangular: "rounded-lg",
  };

  return (
    <div
      className={cn(baseStyles, variants[variant], className)}
      style={{
        background: "linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
      }}
    />
  );
}

export function ContentSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-10 w-10" variant="circular" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" variant="text" />
            <Skeleton className="h-4 w-1/2" variant="text" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ rows = 10, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse">
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <Skeleton className="h-4 w-24" variant="text" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              {Array.from({ length: cols }).map((_, j) => (
                <td key={j} className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                  <Skeleton className="h-4 w-full" variant="text" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KanbanSkeleton({ columns = 3 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-64 space-y-3">
          <Skeleton className="h-8 w-full" variant="rectangular" />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-24 w-full" variant="rectangular" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DrawerSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-8 w-3/4" variant="text" />
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" variant="text" />
            <Skeleton className="h-10 w-full" variant="rectangular" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Skeleton className="h-40 w-full" variant="rectangular" />
          <div className="p-4 space-y-2">
            <Skeleton className="h-5 w-3/4" variant="text" />
            <Skeleton className="h-4 w-1/2" variant="text" />
          </div>
        </div>
      ))}
    </div>
  );
}
