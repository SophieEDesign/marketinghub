"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { CalendarPageConfig } from "@/lib/pages/pageConfig";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";

interface CalendarPageProps {
  page: InterfacePage;
  config: CalendarPageConfig | null;
  isEditing?: boolean;
}

export default function CalendarPage({ page, config, isEditing }: CalendarPageProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dateRecords, setDateRecords] = useState<any[]>([]);
  const { fields: allFields } = useFields(config?.table || "");

  const dateField = allFields.find((f) => f.key === config?.dateField);

  // Load records and convert to calendar events
  useEffect(() => {
    if (!config?.table || !config.dateField) return;

    const loadRecords = async () => {
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

        const { data, error } = await query;

        if (error) throw error;

        // Convert records to calendar events
        const calendarEvents = (data || []).map((record) => {
          const dateValue = record[config.dateField];
          const date = dateValue ? new Date(dateValue) : new Date();

          // Find a title field (prefer name, title, or first text field)
          const titleField = allFields.find(
            (f) => f.key === "name" || f.key === "title" || f.type === "text"
          );
          const title = titleField ? String(record[titleField.key] || "") : `Record ${record.id}`;

          return {
            id: record.id,
            title,
            start: date.toISOString().split("T")[0],
            extendedProps: { record },
          };
        });

        setEvents(calendarEvents);
      } catch (error: any) {
        console.error("Error loading records:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [config, allFields]);

  const handleDateClick = (info: any) => {
    const clickedDate = info.date;
    setSelectedDate(clickedDate);
    
    // Find records for this date
    const dateStr = clickedDate.toISOString().split("T")[0];
    const recordsForDate = events
      .filter((e) => e.start === dateStr)
      .map((e) => e.extendedProps.record);
    setDateRecords(recordsForDate);
  };

  if (!config?.table || !config.dateField) {
    return (
      <div className="p-6 text-center text-gray-500">
        {isEditing ? (
          <p>Configure this page by selecting a table and date field in settings.</p>
        ) : (
          <p>This page is not configured yet.</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading calendar...
      </div>
    );
  }

  return (
    <div className="p-6">
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={handleDateClick}
        height="auto"
      />

      {/* Records for selected date */}
      {selectedDate && dateRecords.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold mb-3">
            Records for {selectedDate.toLocaleDateString()}
          </h3>
          <div className="space-y-2">
            {dateRecords.map((record) => (
              <div
                key={record.id}
                className="p-2 bg-white dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-700"
              >
                {allFields.slice(0, 3).map((field) => (
                  <div key={field.key} className="text-sm">
                    <span className="text-gray-500">{field.label}:</span>{" "}
                    <span className="text-gray-900 dark:text-white">
                      {String(record[field.key] || "-")}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setSelectedDate(null);
              setDateRecords([]);
            }}
            className="mt-3 text-sm text-blue-600 hover:text-blue-700"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
