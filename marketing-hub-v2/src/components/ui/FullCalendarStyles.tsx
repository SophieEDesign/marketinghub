"use client";

import { useEffect } from "react";

/** Loads FullCalendar CSS once — version must match package.json (@fullcalendar/*). */
const FC_VERSION = "6.1.21";

export function FullCalendarStyles() {
  useEffect(() => {
    const hrefs = [
      `https://cdn.jsdelivr.net/npm/@fullcalendar/core@${FC_VERSION}/index.global.min.css`,
      `https://cdn.jsdelivr.net/npm/@fullcalendar/daygrid@${FC_VERSION}/index.global.min.css`,
      `https://cdn.jsdelivr.net/npm/@fullcalendar/list@${FC_VERSION}/index.global.min.css`,
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
      // Keep styles mounted — other calendar pages may still need them.
    };
  }, []);
  return null;
}
