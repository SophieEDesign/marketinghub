/**
 * Calendar anchor-based scrolling utilities (Airtable-style).
 * Presets scroll to target dates without filtering or changing the dataset.
 */

import {
  startOfWeek,
  startOfMonth,
  addWeeks,
  addMonths,
  format,
  startOfDay,
} from "date-fns"

const WEEK_STARTS_ON = 1 as const // Monday (0=Sun, 1=Mon, ... 6=Sat)

type Day = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Start of week (Monday) for a given date */
export function getStartOfWeek(date: Date, weekStartsOn: Day = WEEK_STARTS_ON): Date {
  return startOfWeek(startOfDay(date), { weekStartsOn })
}

/** Start of month (1st) for a given date */
export function getStartOfMonth(date: Date): Date {
  return startOfMonth(startOfDay(date))
}

/** Start of next month */
export function getStartOfNextMonth(date: Date): Date {
  return startOfMonth(addMonths(startOfDay(date), 1))
}

/** Start of next week */
export function getStartOfNextWeek(date: Date, weekStartsOn: Day = WEEK_STARTS_ON): Date {
  return addWeeks(getStartOfWeek(date, weekStartsOn), 1)
}

/**
 * Scroll to a date's row in the calendar.
 * Locates the DOM element for the given date and scrolls it to the top of the scroll container.
 *
 * @param date - Target date to scroll to
 * @param scrollContainer - The scroll container element (not window)
 * @param options - scrollIntoView options
 */
export function scrollToDate(
  date: Date,
  scrollContainer: HTMLElement | null,
  options: ScrollIntoViewOptions = { block: "start", behavior: "smooth" }
): boolean {
  if (!scrollContainer || typeof document === "undefined") return false

  const dateStr = format(startOfDay(date), "yyyy-MM-dd")
  // FullCalendar dayGrid uses .fc-daygrid-day with data-date
  const cell = scrollContainer.querySelector(
    `.fc-daygrid-day[data-date="${dateStr}"]`
  ) as HTMLElement | null

  if (!cell) return false

  cell.scrollIntoView({ ...options, block: options.block ?? "start" })
  return true
}
