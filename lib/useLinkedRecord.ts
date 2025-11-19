"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { fetchLinkedRecord } from "./linkedRecords";

/**
 * Hook to fetch and cache a linked record
 */
export function useLinkedRecord(
  table: string | null | undefined,
  id: string | null | undefined,
  displayField: string
) {
  const cacheKey = table && id ? `linked-record-${table}-${id}` : null;

  const { data, error, isLoading } = useSWR(
    cacheKey,
    () => fetchLinkedRecord(table!, id!, displayField),
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
    }
  );

  return {
    linkedRecord: data,
    loading: isLoading,
    error,
  };
}

