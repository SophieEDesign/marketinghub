"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/useSettings";

export default function FaviconUpdater() {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings.favicon_url) {
      // Remove existing favicon links
      const existingLinks = document.querySelectorAll("link[rel*='icon']");
      existingLinks.forEach((link) => link.remove());

      // Add new favicon
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = settings.favicon_url;
      document.head.appendChild(link);
    }
  }, [settings.favicon_url]);

  return null;
}

