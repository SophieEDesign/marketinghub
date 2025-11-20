"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import dayjs from "dayjs";

interface CalendarEvent {
  date: string;
  count: number;
}

export default function PublishCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const startOfMonth = currentMonth.startOf("month").toISOString().split("T")[0];
      const endOfMonth = currentMonth.endOf("month").toISOString().split("T")[0];

      // Fetch content publish dates
      const { data: content } = await supabase
        .from("content")
        .select("publish_date")
        .gte("publish_date", startOfMonth)
        .lte("publish_date", endOfMonth);

      // Fetch task due dates
      const { data: tasks } = await supabase
        .from("tasks")
        .select("due_date")
        .gte("due_date", startOfMonth)
        .lte("due_date", endOfMonth)
        .neq("status", "done");

      // Count events by date
      const eventMap: Record<string, number> = {};

      content?.forEach((item) => {
        if (item.publish_date) {
          eventMap[item.publish_date] = (eventMap[item.publish_date] || 0) + 1;
        }
      });

      tasks?.forEach((item) => {
        if (item.due_date) {
          eventMap[item.due_date] = (eventMap[item.due_date] || 0) + 1;
        }
      });

      const eventList = Object.entries(eventMap).map(([date, count]) => ({
        date,
        count,
      }));

      setEvents(eventList);
      setLoading(false);
    }

    load();
  }, [currentMonth]);

  const handleDateClick = (date: string) => {
    router.push(`/content/grid?publish_date=${date}`);
  };

  const daysInMonth = currentMonth.daysInMonth();
  const firstDay = currentMonth.startOf("month").day();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-heading text-brand-blue mb-4">Upcoming Events</h2>
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-heading text-brand-blue">Upcoming Events</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentMonth(currentMonth.subtract(1, "month"))}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ←
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[120px] text-center">
            {currentMonth.format("MMMM YYYY")}
          </span>
          <button
            onClick={() => setCurrentMonth(currentMonth.add(1, "month"))}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-xs font-medium text-gray-500 dark:text-gray-400 text-center py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          const dateStr = currentMonth.date(day).format("YYYY-MM-DD");
          const event = events.find((e) => e.date === dateStr);
          const isToday = dateStr === dayjs().format("YYYY-MM-DD");

          return (
            <button
              key={day}
              onClick={() => handleDateClick(dateStr)}
              className={`aspect-square rounded-md text-xs font-medium transition hover:bg-gray-100 dark:hover:bg-gray-800 ${
                isToday
                  ? "bg-brand-red/20 text-brand-red border border-brand-red"
                  : event
                  ? "bg-brand-blue/10 text-brand-blue"
                  : "text-gray-600 dark:text-gray-400"
              }`}
            >
              <div>{day}</div>
              {event && (
                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                  {Array.from({ length: Math.min(event.count, 3) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full bg-current opacity-60"
                    />
                  ))}
                  {event.count > 3 && (
                    <span className="text-[8px] opacity-60">+{event.count - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

