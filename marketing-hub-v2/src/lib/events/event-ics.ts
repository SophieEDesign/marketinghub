/**
 * ICS generation and calendar deep-links for Events sync / export.
 */

import { addDays, format, parseISO } from "date-fns";
import type { EventItem } from "@/lib/types";
import { plainTextFromHtml } from "@/lib/sanitize";

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcsUtc(d: Date): string {
  return format(d, "yyyyMMdd'T'HHmmss'Z'");
}

function formatIcsDate(d: Date): string {
  return format(d, "yyyyMMdd");
}

function isDateOnlyIso(iso: string): boolean {
  if (!iso.includes("T")) return true;
  return iso.slice(11, 16) === "00:00";
}

function eventDateBounds(item: EventItem): {
  start: Date;
  end: Date;
  allDay: boolean;
} | null {
  if (!item.starts_at) return null;
  const start = parseISO(item.starts_at);
  if (Number.isNaN(start.getTime())) return null;

  const allDay = isDateOnlyIso(item.starts_at);
  if (item.ends_at) {
    const end = parseISO(item.ends_at);
    if (!Number.isNaN(end.getTime())) {
      if (allDay) {
        // ICS all-day DTEND is exclusive
        return { start, end: addDays(end, 1), allDay: true };
      }
      return { start, end, allDay: false };
    }
  }

  if (allDay) {
    return { start, end: addDays(start, 1), allDay: true };
  }
  return { start, end: addDays(start, 1), allDay: false };
}

function buildVeventLines(item: EventItem, uid?: string): string[] | null {
  const bounds = eventDateBounds(item);
  if (!bounds) return null;
  const { start, end, allDay } = bounds;
  const eventUid = uid || `event-${item.id}@marketing-hub`;
  const dtStamp = formatIcsUtc(new Date());
  const lines = [
    "BEGIN:VEVENT",
    `UID:${eventUid}`,
    `DTSTAMP:${dtStamp}`,
    allDay
      ? `DTSTART;VALUE=DATE:${formatIcsDate(start)}`
      : `DTSTART:${formatIcsUtc(start)}`,
    allDay
      ? `DTEND;VALUE=DATE:${formatIcsDate(end)}`
      : `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(item.title)}`,
  ];
  if (item.location) {
    lines.push(`LOCATION:${escapeIcsText(item.location)}`);
  }
  const descriptionParts = [
    plainTextFromHtml(item.notes),
    item.event_type,
    item.division,
  ].filter(Boolean);
  if (descriptionParts.length) {
    lines.push(`DESCRIPTION:${escapeIcsText(descriptionParts.join(" · "))}`);
  }
  if (item.link_url) {
    const url = item.link_url.startsWith("http")
      ? item.link_url
      : `https://${item.link_url}`;
    lines.push(`URL:${url}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

/** Build a single-event VCALENDAR (RFC 5545 subset). */
export function buildEventIcs(item: EventItem, uid?: string): string | null {
  const vevent = buildVeventLines(item, uid);
  if (!vevent) return null;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marketing Hub//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevent,
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Multiple dated events in one calendar file. */
export function buildCalendarIcs(items: EventItem[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marketing Hub//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const item of items) {
    const vevent = buildVeventLines(item);
    if (vevent) lines.push(...vevent);
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadIcsContent(ics: string, filename: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadEventIcs(
  item: EventItem,
  filename?: string
): boolean {
  const ics = buildEventIcs(item);
  if (!ics) return false;
  downloadIcsContent(
    ics,
    filename || `${item.title.replace(/[^\w.-]+/g, "_") || "event"}.ics`
  );
  return true;
}

export function downloadCalendarIcs(
  items: EventItem[],
  filename = "marketing-events.ics"
): number {
  const dated = items.filter((i) => i.starts_at);
  if (dated.length === 0) return 0;
  downloadIcsContent(buildCalendarIcs(dated), filename);
  return dated.length;
}

function googleDates(item: EventItem): string | null {
  const bounds = eventDateBounds(item);
  if (!bounds) return null;
  const { start, end, allDay } = bounds;
  if (allDay) {
    return `${formatIcsDate(start)}/${formatIcsDate(end)}`;
  }
  return `${formatIcsUtc(start)}/${formatIcsUtc(end)}`;
}

export function googleCalendarAddUrl(item: EventItem): string | null {
  const dates = googleDates(item);
  if (!dates) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.title,
    dates,
  });
  if (item.location) params.set("location", item.location);
  if (item.notes) params.set("details", plainTextFromHtml(item.notes));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarAddUrl(item: EventItem): string | null {
  const bounds = eventDateBounds(item);
  if (!bounds) return null;
  const { start, end } = bounds;
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: item.title,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  });
  if (item.location) params.set("location", item.location);
  if (item.notes) params.set("body", plainTextFromHtml(item.notes));
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/** webcal:// URL for calendar subscription (same path as HTTPS feed). */
export function eventsFeedWebcalUrl(origin: string): string {
  const https = `${origin.replace(/\/$/, "")}/api/events/feed`;
  return https.replace(/^https:/, "webcal:").replace(/^http:/, "webcal:");
}
