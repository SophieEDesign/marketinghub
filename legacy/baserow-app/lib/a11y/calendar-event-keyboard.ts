/** Attach keyboard activation to FullCalendar event DOM nodes. */
export function mountCalendarEventKeyboard(
  element: HTMLElement,
  label: string,
  onActivate: () => void
): void {
  element.tabIndex = 0
  element.setAttribute("role", "button")
  element.setAttribute("aria-label", label)
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      onActivate()
    }
  })
}
