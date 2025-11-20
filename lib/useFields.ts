"use client";

import useSWR from "swr";
import { loadFields, Field } from "./fields";
import { getOrFetch, CacheKeys, invalidateCache } from "./cache/metadataCache";

/**
 * SWR-based hook for loading fields with live updates and caching
 * Automatically refetches when fields change in table_fields
 */
export function useFields(tableId: string) {
  const { data, error, isLoading, mutate } = useSWR<Field[]>(
    tableId ? `fields-${tableId}` : null,
    async () => {
      const cacheKey = CacheKeys.fields(tableId);
      return getOrFetch(cacheKey, () => loadFields(tableId), 10 * 60 * 1000); // 10 min cache
    },
    {
      revalidateOnFocus: false, // Reduce unnecessary refetches
      revalidateOnReconnect: true,
      refreshInterval: 0, // Disable auto-refresh, rely on manual refresh
    }
  );

  // Filter visible fields and sort by order
  const fields = data
    ? data.filter((f) => f.visible !== false).sort((a, b) => a.order - b.order)
    : [];

  // Enhanced mutate that also invalidates cache
  const mutateWithCache = async () => {
    if (tableId) {
      invalidateCache(CacheKeys.fields(tableId));
    }
    return mutate();
  };

  return {
    fields,
    allFields: data || [], // Includes hidden fields
    loading: isLoading,
    error,
    mutate: mutateWithCache, // Manual refresh function with cache invalidation
  };
}

