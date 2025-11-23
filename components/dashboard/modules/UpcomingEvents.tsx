"use client";

import { useMemo } from "react";
import { Calendar } from "lucide-react";

interface UpcomingEventsConfig {
  title?: string;
  table?: string;
  dateField?: string;
  titleField?: string;
  limit?: number;
}

interface UpcomingEventsModuleProps {
  config: UpcomingEventsConfig;
  width: number;
  height: number;
  onUpdate?: (config: Partial<UpcomingEventsConfig>) => void;
  isEditing?: boolean;
  data?: any[];
}

export default function UpcomingEventsModule({ config, width, height, onUpdate, isEditing = false, data = [] }: UpcomingEventsModuleProps) {
  const events = useMemo(() => {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const dateField = config.dateField || "publish_date";
    const titleField = config.titleField || "title";

    return data
      .filter((event) => {
        const eventDate = event[dateField];
        if (!eventDate) return false;
        const date = new Date(eventDate);
        return date >= now && date <= nextMonth;
      })
      .sort((a, b) => {
        const dateA = new Date(a[dateField] || 0);
        const dateB = new Date(b[dateField] || 0);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, config.limit || 10);
  }, [data, config]);

  return (
    <div
      className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ minHeight: `${height * 50}px` }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-brand-blue" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {config.title || "Upcoming Events"}
          </h3>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto">
          {events.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No upcoming events
            </div>
          ) : (
            events.map((event) => {
              const title = event[config.titleField || "title"] || "Untitled";
              const eventDate = new Date(event[config.dateField || "publish_date"]);
              const formattedDate = eventDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const formattedTime = eventDate.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-shrink-0 w-12 text-center">
                    <div className="text-xs font-medium text-gray-900 dark:text-gray-100">
                      {eventDate.getDate()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                      {eventDate.toLocaleDateString("en-US", { month: "short" })}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {title}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formattedTime}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

