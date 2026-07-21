"use client";

import { useEffect, useState } from "react";
import type { FieldOption } from "@/lib/data/collections";

/**
 * Keep Field Manager options fresh on hub pages.
 * SSR props are a starting point; we re-fetch so option edits show up
 * without requiring a full hard reload.
 */
export function useManagedFieldOptions(
  collection: string,
  initial?: Record<string, FieldOption[]>
) {
  const [fieldOptions, setFieldOptions] = useState<
    Record<string, FieldOption[]>
  >(initial ?? {});

  useEffect(() => {
    setFieldOptions(initial ?? {});
  }, [initial]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/data?collection=${encodeURIComponent(collection)}&fieldsOnly=1`
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (
          !cancelled &&
          data.fieldOptions &&
          typeof data.fieldOptions === "object"
        ) {
          setFieldOptions(data.fieldOptions as Record<string, FieldOption[]>);
        }
      } catch {
        // Keep SSR / previous options on failure.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [collection]);

  return fieldOptions;
}
