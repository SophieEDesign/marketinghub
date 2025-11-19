"use client";

import { supabase } from "./supabaseClient";

/**
 * Fetch a single linked record by ID
 */
export async function fetchLinkedRecord(
  table: string,
  id: string | null,
  displayField: string
): Promise<{ id: string; displayValue: string; record: any } | null> {
  if (!id) return null;

  try {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      console.error("Error fetching linked record:", error);
      return null;
    }

    const displayValue = getRecordDisplayValue(data, displayField);
    return {
      id: data.id,
      displayValue,
      record: data,
    };
  } catch (err) {
    console.error("Error in fetchLinkedRecord:", err);
    return null;
  }
}

/**
 * Search linked records in a table
 */
export async function searchLinkedRecords(
  table: string,
  displayField: string,
  query: string = "",
  limit: number = 50
): Promise<any[]> {
  try {
    let supabaseQuery = supabase.from(table).select("*");

    if (query) {
      supabaseQuery = supabaseQuery.ilike(displayField, `%${query}%`);
    }

    const { data, error } = await supabaseQuery.limit(limit);

    if (error) {
      console.error("Error searching linked records:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("Error in searchLinkedRecords:", err);
    return [];
  }
}

/**
 * Get the display value from a record using the display field
 */
export function getRecordDisplayValue(record: any, displayField: string): string {
  if (!record) return "Untitled";
  
  // Try direct field access
  if (record[displayField]) {
    return String(record[displayField]);
  }

  // Try common field names
  if (record.name) return String(record.name);
  if (record.title) return String(record.title);
  if (record.label) return String(record.label);

  // Fallback to ID
  return record.id ? String(record.id) : "Untitled";
}

