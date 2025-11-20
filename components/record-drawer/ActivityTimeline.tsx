"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Clock, User, Zap } from "lucide-react";

interface ActivityTimelineProps {
  table: string;
  recordId: string;
}

interface ActivityEntry {
  id: string;
  field_name: string | null;
  old_value: any;
  new_value: any;
  action: string;
  triggered_by: "user" | "automation" | null;
  created_at: string;
}

interface GroupedActivity {
  date: string;
  entries: ActivityEntry[];
}

export default function ActivityTimeline({ table, recordId }: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    async function loadActivities() {
      setLoading(true);
      
      try {
        const { data, error } = await supabase
          .from("activity_log")
          .select("*")
          .eq("table_name", table)
          .eq("record_id", recordId)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error && error.code !== "42P01") {
          // Table doesn't exist, that's okay
          console.warn("activity_log table not found, skipping activity log");
          setActivities([]);
          setLoading(false);
          return;
        }

        if (data) {
          setActivities(data as ActivityEntry[]);
          setHasMore(data.length === 50); // If we got 50, there might be more
        }
      } catch (err) {
        console.warn("Error loading activity log:", err);
        setActivities([]);
      }
      
      setLoading(false);
    }

    if (recordId) {
      loadActivities();
    }
  }, [table, recordId]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const { data, error } = await supabase
        .from("activity_log")
        .select("*")
        .eq("table_name", table)
        .eq("record_id", recordId)
        .order("created_at", { ascending: false })
        .range(activities.length, activities.length + 49);

      if (data && data.length > 0) {
        setActivities((prev) => [...prev, ...(data as ActivityEntry[])]);
        setHasMore(data.length === 50);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error("Error loading more activities:", err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {};
    
    activities.forEach((entry) => {
      const date = new Date(entry.created_at);
      const dateKey = date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    });

    // Convert to array and sort by date (most recent first)
    return Object.entries(groups)
      .map(([date, entries]) => ({ date, entries }))
      .sort((a, b) => {
        const dateA = new Date(a.entries[0].created_at);
        const dateB = new Date(b.entries[0].created_at);
        return dateB.getTime() - dateA.getTime();
      });
  }, [activities]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (Array.isArray(value)) {
      if (value.length === 0) return "—";
      return value.join(", ");
    }
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return String(value);
  };

  const getActionLabel = (entry: ActivityEntry): string => {
    if (entry.action === "create") {
      return "Record created";
    }
    if (entry.action === "delete") {
      return "Record deleted";
    }
    if (entry.action === "automation") {
      return entry.field_name
        ? `Automation updated ${entry.field_name}`
        : "Automation triggered";
    }
    if (entry.field_name) {
      return `${entry.field_name} changed`;
    }
    return "Record updated";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading activity...</div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          No activity recorded yet
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedActivities.map((group) => (
        <div key={group.date}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            {group.date === new Date().toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
              ? "Today"
              : group.date ===
                  new Date(Date.now() - 86400000).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                ? "Yesterday"
                : group.date}
          </h4>
          <div className="space-y-2">
            {group.entries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg p-3 bg-gray-50 dark:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {entry.triggered_by === "automation" ? (
                      <Zap className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <User className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{getActionLabel(entry)}</span>
                      {entry.triggered_by === "automation" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
                          Automation
                        </span>
                      )}
                    </div>
                    
                    {entry.field_name && entry.old_value !== undefined && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="text-gray-500 dark:text-gray-500 line-through">
                          {formatValue(entry.old_value)}
                        </span>{" "}
                        →{" "}
                        <span className="text-brand-blue font-medium">
                          {formatValue(entry.new_value)}
                        </span>
                      </div>
                    )}
                    
                    {entry.action === "create" && entry.new_value && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Record created with initial values
                      </div>
                    )}
                    
                    {entry.action === "delete" && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Record deleted
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatTime(entry.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-secondary text-sm disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}

