"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventInput, EventDropArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { useFields } from "@/lib/useFields";
import { useViewConfigs } from "@/lib/useViewConfigs";
import { applyFiltersAndSort } from "@/lib/query/applyFiltersAndSort";
import { Field } from "@/lib/fields";
import { Filter, Sort } from "@/lib/types/filters";
import FieldRenderer from "../fields/FieldRenderer";
import ViewHeader from "./ViewHeader";

interface CalendarViewProps {
  tableId: string;
}

export default function CalendarView({ tableId }: CalendarViewProps) {
  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);
  const viewId = pathParts[1] || "calendar";

  const [events, setEvents] = useState<EventInput[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const { fields: allFields, loading: fieldsLoading } = useFields(tableId);
  const {
    currentView,
    loading: viewConfigLoading,
    saveCurrentView,
    switchToViewByName,
  } = useViewConfigs(tableId);
  const calendarRef = useRef<FullCalendar>(null);

  // Switch to view by name when viewId changes
  useEffect(() => {
    if (viewId && currentView && currentView.view_name !== viewId && currentView.id !== viewId) {
      switchToViewByName(viewId);
    }
  }, [viewId, currentView, switchToViewByName]);

  const filters = currentView?.filters || [];
  const sort = currentView?.sort || [];
  const calendarDateFieldKey = (currentView as any)?.calendar_date_field;
  
  const handleViewSettingsUpdate = async (updates: {
    calendar_date_field?: string;
  }): Promise<void> => {
    try {
      await saveCurrentView(updates as any);
    } catch (error) {
      console.error("Error updating view settings:", error);
    }
  };

  // Detect date field: use calendar_date_field from settings, or fallback to "Publish Date", otherwise first date field
  const dateField = calendarDateFieldKey
    ? allFields.find((f) => f.field_key === calendarDateFieldKey && f.type === "date")
    : allFields.find(
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
    if (!tableId) return;
    
    async function load() {
      let query = supabase.from(tableId).select("*");
      
      // Apply filters and sort
      query = applyFiltersAndSort(query, filters, sort);

      const { data, error } = await query;

      if (error) {
        console.error("Error loading records:", error);
        return;
      }

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
  }, [tableId, dateField, titleField, filters, sort]);

  const handleFiltersChange = async (newFilters: Filter[]) => {
    await saveCurrentView({ filters: newFilters });
  };

  const handleSortChange = async (newSort: Sort[]) => {
    await saveCurrentView({ sort: newSort });
  };

  const handleRemoveFilter = async (filterId: string) => {
    const newFilters = filters.filter((f) => f.id !== filterId);
    await saveCurrentView({ filters: newFilters });
  };

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
    <div>
      <ViewHeader
        tableId={tableId}
        viewId={viewId}
        fields={allFields}
        filters={filters}
        sort={sort}
        onFiltersChange={handleFiltersChange}
        onSortChange={handleSortChange}
        onRemoveFilter={handleRemoveFilter}
        viewSettings={{
          calendar_date_field: calendarDateFieldKey,
        }}
        onViewSettingsUpdate={handleViewSettingsUpdate}
      />

      <div className="overflow-auto">
        <div className="p-4 bg-white dark:bg-gray-900 rounded-lg shadow-sm min-w-0">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            events={events}
            dateClick={handleDateClick}
            editable={true}
            eventDrop={handleEventDrop}
            eventContent={renderEventContent}
            displayEventTime={false}
            eventDisplay="block"
            height="auto"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth",
            }}
          />
        </div>
      </div>
    </div>
  );
}

