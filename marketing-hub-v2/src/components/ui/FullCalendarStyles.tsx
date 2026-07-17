"use client";

import { useEffect } from "react";

/** Loads FullCalendar CSS once on the client (keeps root layout head clean for Tailwind). */
export function FullCalendarStyles() {
  useEffect(() => {
    const hrefs = [
      "https://cdn.jsdelivr.net/npm/@fullcalendar/core@6.1.15/index.global.min.css",
      "https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@6.1.15/index.global.min.css",
      "https://cdn.jsdelivr.net/npm/@fullcalendar/list@6.1.15/index.global.min.css",
    ];
    const links = hrefs.map((href) => {
      const existing = document.querySelector(`link[data-fc="${href}"]`);
      if (existing) return null;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.setAttribute("data-fc", href);
      document.head.appendChild(link);
      return link;
    });
    return () => {
      links.forEach((link) => link?.remove());
    };
  }, []);
  return null;
}
