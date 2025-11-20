"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Clock } from "lucide-react";

interface ActivityLogProps {
  table: string;
  recordId: string;
}

interface ActivityEntry {
  id: string;
  field: string;
  old_value: any;
  new_value: any;
  triggered_by: "user" | "automation";
  created_at: string;
}

export default function ActivityLog({ table, recordId }: ActivityLogProps) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadActivities() {
      setLoading(true);
      
      // Try to load from activity_log table if it exists
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

  if (loading) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">Loading activity...</div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No activity recorded yet
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="flex gap-3 p-3 rounded-md bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        >
          <Clock className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {formatDate(activity.created_at)} – {formatTime(activity.created_at)}
            </div>
            <div className="text-sm">
              <span className="font-medium">{activity.field}</span> changed:{" "}
              <span className="text-gray-600 dark:text-gray-400">
                {activity.old_value ? String(activity.old_value) : "—"}
              </span>{" "}
              →{" "}
              <span className="text-brand-blue font-medium">
                {activity.new_value ? String(activity.new_value) : "—"}
              </span>
            </div>
            {activity.triggered_by === "automation" && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Triggered by automation
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

