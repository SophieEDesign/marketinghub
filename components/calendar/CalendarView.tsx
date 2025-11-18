"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, DateClickArg, EventDropArg } from "@fullcalendar/core";
import StatusChip from "../chips/StatusChip";
import ChannelChip from "../chips/ChannelChip";

export default function CalendarView() {
  const [events, setEvents] = useState<EventInput[]>([]);
  const calendarRef = useRef<FullCalendar>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("content")
        .select("id, title, publish_date, status, channels, thumbnail_url");

      if (data) {
        const mapped = data
          .filter((row) => row.publish_date)
          .map((row) => ({
            id: row.id.toString(),
            title: row.title || "Untitled",
            start: row.publish_date,
            extendedProps: {
              status: row.status,
              channels: row.channels || [],
              thumbnail_url: row.thumbnail_url,
            },
          }));

        setEvents(mapped);
      }
    }
    load();
  }, []);

  const handleDateClick = (info: DateClickArg) => {
    // open new content modal later
    const dateStr = info.dateStr || info.date.toISOString().split("T")[0];
    console.log("Clicked date:", dateStr);
  };

  const handleEventDrop = async (info: EventDropArg) => {
    const newDate = info.event.start;
    if (newDate) {
      await supabase
        .from("content")
        .update({ publish_date: newDate.toISOString().split("T")[0] })
        .eq("id", info.event.id);
    }
  };

  const renderEventContent = (info: any) => {
    const status = info.event.extendedProps.status;
    const channels = info.event.extendedProps.channels || [];
    const thumbnail = info.event.extendedProps.thumbnail_url;

    return (
      <div className="flex flex-col gap-1 p-1">
        {thumbnail && (
          <img
            src={thumbnail}
            alt={info.event.title}
            className="h-6 w-full object-cover rounded"
          />
        )}
        <div className="text-xs font-medium truncate">{info.event.title}</div>
        {status && <StatusChip value={status} size="sm" />}
        {channels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {channels.slice(0, 2).map((c: string) => (
              <ChannelChip key={c} label={c} size="sm" />
            ))}
            {channels.length > 2 && (
              <span className="text-[10px] text-gray-500">+{channels.length - 2}</span>
            )}
          </div>
        )}
      </div>
    );
  };

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

