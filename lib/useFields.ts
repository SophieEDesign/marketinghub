"use client";

import useSWR from "swr";
import { loadFields, Field } from "./fields";

/**
 * SWR-based hook for loading fields with live updates
 * Automatically refetches when fields change in table_fields
 */
export function useFields(tableId: string) {
  const { data, error, isLoading, mutate } = useSWR<Field[]>(
    tableId ? `fields-${tableId}` : null,
    () => loadFields(tableId),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 0, // Disable auto-refresh, rely on manual refresh
    }
  );

  // Filter visible fields and sort by order
  const fields = data
    ? data.filter((f) => f.visible !== false).sort((a, b) => a.order - b.order)
    : [];

  return {
    fields,
    allFields: data || [], // Includes hidden fields
    loading: isLoading,
    error,
    mutate, // Manual refresh function
  };
}

