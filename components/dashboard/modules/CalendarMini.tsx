"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarMiniConfig {
  title?: string;
  table?: string;
  dateField?: string;
  highlightField?: string;
}

interface CalendarMiniModuleProps {
  config: CalendarMiniConfig;
  width: number;
  height: number;
  onUpdate?: (config: Partial<CalendarMiniConfig>) => void;
  isEditing?: boolean;
  data?: any[];
}

export default function CalendarMiniModule({ config, width, height, onUpdate, isEditing = false, data = [] }: CalendarMiniModuleProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const eventsByDate = useMemo(() => {
    const dateField = config.dateField || "publish_date";
    const events: Record<string, number> = {};
    data.forEach((item) => {
      const date = item[dateField];
      if (date) {
        const dateStr = new Date(date).toISOString().split("T")[0];
        events[dateStr] = (events[dateStr] || 0) + 1;
      }
    });
    return events;
  }, [data, config.dateField]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getDateKey = (day: number) => {
    const date = new Date(year, month, day);
    return date.toISOString().split("T")[0];
  };

  return (
    <div
      className="h-full bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 shadow-sm hover:shadow-md transition-shadow"
      style={{ minHeight: `${height * 50}px` }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {config.title || "Calendar"}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={goToPreviousMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 min-w-[100px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={goToNextMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="grid grid-cols-7 gap-1 text-xs">
            {dayNames.map((day) => (
              <div key={day} className="text-center font-medium text-gray-500 dark:text-gray-400 py-1">
                {day}
              </div>
            ))}
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateKey = getDateKey(day);
              const eventCount = eventsByDate[dateKey] || 0;
              const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();

              return (
                <div
                  key={day}
                  className={`aspect-square flex flex-col items-center justify-center rounded text-xs ${
                    isToday
                      ? "bg-brand-red text-white font-medium"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  <span>{day}</span>
                  {eventCount > 0 && (
                    <div className="w-1 h-1 rounded-full bg-brand-blue mt-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

