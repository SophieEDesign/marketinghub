/**
 * ICS generation and calendar deep-links for Event Calendar export (Phase 1).
 */

import { addDays, format } from "date-fns"
import type { MarketingEventItem } from "@/lib/marketing/events"

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

function formatIcsUtc(d: Date): string {
  return format(d, "yyyyMMdd'T'HHmmss'Z'")
}

function formatIcsDate(d: Date): string {
  return format(d, "yyyyMMdd")
}

function eventDateBounds(item: MarketingEventItem): { start: Date; end: Date; allDay: boolean } {
  const start = item.startDate ?? new Date()
  const end = item.endDate ?? start
  if (item.allDay) {
    return { start, end: addDays(end, 1), allDay: true }
  }
  const startIso = item.startTime
    ? new Date(`${format(start, "yyyy-MM-dd")}T${item.startTime.length === 5 ? item.startTime : item.startTime.slice(0, 5)}:00`)
    : start
  const endDay = item.endDate ?? start
  const endIso = item.endTime
    ? new Date(`${format(endDay, "yyyy-MM-dd")}T${item.endTime.length === 5 ? item.endTime : item.endTime.slice(0, 5)}:00`)
    : addDays(startIso, 1)
  return { start: startIso, end: endIso, allDay: false }
}

/** Build a single VEVENT block inside VCALENDAR (RFC 5545 subset). */
export function buildEventIcs(item: MarketingEventItem, uid?: string): string {
  const { start, end, allDay } = eventDateBounds(item)
  const eventUid = uid || `event-${item.id}@marketing-hub`
  const dtStamp = formatIcsUtc(new Date())
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marketing Hub//Event Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${eventUid}`,
    `DTSTAMP:${dtStamp}`,
    allDay
      ? `DTSTART;VALUE=DATE:${formatIcsDate(start)}`
      : `DTSTART:${formatIcsUtc(start)}`,
    allDay
      ? `DTEND;VALUE=DATE:${formatIcsDate(end)}`
      : `DTEND:${formatIcsUtc(end)}`,
    `SUMMARY:${escapeIcsText(item.eventName)}`,
  ]
  if (item.locationLabel) {
    lines.push(`LOCATION:${escapeIcsText(item.locationLabel)}`)
  }
  if (item.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(item.description)}`)
  }
  if (item.websiteUrl) {
    lines.push(`URL:${item.websiteUrl.startsWith("http") ? item.websiteUrl : `https://${item.websiteUrl}`}`)
  }
  lines.push("END:VEVENT", "END:VCALENDAR")
  return lines.join("\r\n")
}

export function downloadEventIcs(item: MarketingEventItem, filename?: string): void {
  const ics = buildEventIcs(item)
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename || `${item.eventName.replace(/[^\w.-]+/g, "_")}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

function googleDates(item: MarketingEventItem): string {
  const { start, end, allDay } = eventDateBounds(item)
  if (allDay) {
    return `${formatIcsDate(start)}/${formatIcsDate(end)}`
  }
  return `${formatIcsUtc(start).replace(/Z$/, "Z")}/${formatIcsUtc(end).replace(/Z$/, "Z")}`
}

export function googleCalendarAddUrl(item: MarketingEventItem): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: item.eventName,
    dates: googleDates(item),
  })
  if (item.locationLabel) params.set("location", item.locationLabel)
  if (item.description) params.set("details", item.description)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function outlookCalendarAddUrl(item: MarketingEventItem): string {
  const { start, end } = eventDateBounds(item)
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: item.eventName,
    startdt: start.toISOString(),
    enddt: end.toISOString(),
  })
  if (item.locationLabel) params.set("location", item.locationLabel)
  if (item.description) params.set("body", item.description)
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}
