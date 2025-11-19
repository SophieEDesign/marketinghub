"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, EventDropArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { useFields } from "@/lib/useFields";
import { Field } from "@/lib/fields";
import FieldRenderer from "../fields/FieldRenderer";

interface CalendarViewProps {
  tableId: string;
}

export default function CalendarView({ tableId }: CalendarViewProps) {
  const [events, setEvents] = useState<EventInput[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const { fields: allFields, loading: fieldsLoading } = useFields(tableId);
  const calendarRef = useRef<FullCalendar>(null);

  // Detect date field: prefer "Publish Date", otherwise first date field
  const dateField = allFields.find(
    (f) => f.label.toLowerCase() === "publish date" && f.type === "date"
  ) || allFields.find((f) => f.type === "date") || null;

  // Find title field
  const titleField = allFields.find((f) => f.label.toLowerCase() === "title") || allFields[0];

  // Find status field
  const statusField = allFields.find(
    (f) => f.type === "single_select" && f.label.toLowerCase().includes("status")
  );

  // Find channels field
  const channelsField = allFields.find(
    (f) => f.type === "multi_select" && f.label.toLowerCase().includes("channel")
  );

  // Find thumbnail field
  const thumbnailField = allFields.find((f) => f.type === "attachment");

  useEffect(() => {
    async function load() {
      // Load records
      const { data } = await supabase.from(tableId).select("*");

      if (data) {
        setRows(data);

        if (dateField) {
          const mapped = data
            .filter((row) => row[dateField.field_key])
            .map((row) => ({
              id: row.id.toString(),
              title: titleField ? row[titleField.field_key] || "Untitled" : "Untitled",
              start: row[dateField.field_key],
              extendedProps: {
                ...row,
              },
            }));

          setEvents(mapped);
        }
      }
    }
    load();
  }, [tableId, dateField, titleField]);

  const handleDateClick = (info: DateClickArg) => {
    const dateStr = info.dateStr || info.date.toISOString().split("T")[0];
    console.log("Clicked date:", dateStr);
    // TODO: Open new record modal with date pre-filled
  };

  const handleEventDrop = async (info: EventDropArg) => {
    if (!dateField) return;
    
    const newDate = info.event.start;
    if (newDate) {
      await supabase
        .from(tableId)
        .update({ [dateField.field_key]: newDate.toISOString().split("T")[0] })
        .eq("id", info.event.id);
    }
  };

  const renderEventContent = (info: any) => {
    const row = info.event.extendedProps;

    return (
      <div className="flex flex-col gap-1 p-1">
        {thumbnailField && row[thumbnailField.field_key] && (
          <img
            src={Array.isArray(row[thumbnailField.field_key])
              ? row[thumbnailField.field_key][0]
              : row[thumbnailField.field_key]}
            alt={info.event.title}
            className="h-6 w-full object-cover rounded"
          />
        )}
        <div className="text-xs font-medium truncate">{info.event.title}</div>
        {statusField && (
          <div className="flex items-center">
            <FieldRenderer
              field={statusField}
              value={row[statusField.field_key]}
              record={row}
            />
          </div>
        )}
        {channelsField && row[channelsField.field_key] && Array.isArray(row[channelsField.field_key]) && row[channelsField.field_key].length > 0 && (
          <div className="flex flex-wrap gap-1">
            {row[channelsField.field_key].slice(0, 2).map((c: string, idx: number) => (
              <FieldRenderer
                key={idx}
                field={channelsField}
                value={[c]}
                record={row}
              />
            ))}
            {row[channelsField.field_key].length > 2 && (
              <span className="text-[10px] text-gray-500">
                +{row[channelsField.field_key].length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  if (fieldsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!dateField) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">
          No date field found. Please configure a date field for Calendar view.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        events={events}
        dateClick={handleDateClick}
        editable={true}
        eventDrop={handleEventDrop}
        eventContent={renderEventContent}
        height="auto"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth",
        }}
      />
    </div>
  );
}

