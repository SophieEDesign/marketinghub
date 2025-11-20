import { createClient } from "@supabase/supabase-js";

// Use service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Allowed tables for deletion
const ALLOWED_TABLES = [
  "content",
  "campaigns",
  "contacts",
  "ideas",
  "media",
  "tasks",
  "briefings",
  "sponsorships",
  "strategy",
  "assets",
];

/**
 * Delete a record from a table
 */
export async function deleteRecord(table: string, id: string): Promise<{ success: boolean; error?: string }> {
  // Validate table name
  if (!ALLOWED_TABLES.includes(table)) {
    return {
      success: false,
      error: `Table "${table}" is not allowed for deletion`,
    };
  }

  // Validate ID
  if (!id) {
    return {
      success: false,
      error: "Record ID is required",
    };
  }

  try {
    const { error } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("id", id);

    if (error) {
      console.error(`[deleteRecord] Error deleting ${table}/${id}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`[deleteRecord] Successfully deleted ${table}/${id}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[deleteRecord] Exception deleting ${table}/${id}:`, err);
    return {
      success: false,
      error: err.message || "Unknown error",
    };
  }
}

/**
 * Delete multiple records (bulk delete)
 */
export async function deleteRecords(
  table: string,
  ids: string[]
): Promise<{ success: boolean; deleted: number; errors: string[] }> {
  // Validate table name
  if (!ALLOWED_TABLES.includes(table)) {
    return {
      success: false,
      deleted: 0,
      errors: [`Table "${table}" is not allowed for deletion`],
    };
  }

  if (!ids || ids.length === 0) {
    return {
      success: false,
      deleted: 0,
      errors: ["No record IDs provided"],
    };
  }

  const errors: string[] = [];
  let deleted = 0;

  // Delete records one by one (Supabase doesn't support bulk delete with WHERE IN easily)
  for (const id of ids) {
    const result = await deleteRecord(table, id);
    if (result.success) {
      deleted++;
    } else {
      errors.push(`Failed to delete ${id}: ${result.error}`);
    }
  }

  return {
    success: errors.length === 0,
    deleted,
    errors,
  };
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteStorageFile(bucket: string, path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);

    if (error) {
      console.error(`[deleteStorageFile] Error deleting ${bucket}/${path}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`[deleteStorageFile] Successfully deleted ${bucket}/${path}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[deleteStorageFile] Exception deleting ${bucket}/${path}:`, err);
    return {
      success: false,
      error: err.message || "Unknown error",
    };
  }
}

/**
 * Extract bucket and path from a Supabase storage URL
 */
export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  try {
    // Supabase storage URLs look like: https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
    const match = url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)$/);
    if (match) {
      return {
        bucket: match[1],
        path: match[2],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Delete an asset record and its associated file
 */
export async function deleteAsset(assetId: string, fileUrl?: string): Promise<{ success: boolean; error?: string }> {
  // First delete the file from storage if URL is provided
  if (fileUrl) {
    const parsed = parseStorageUrl(fileUrl);
    if (parsed) {
      const fileResult = await deleteStorageFile(parsed.bucket, parsed.path);
      if (!fileResult.success) {
        console.warn(`[deleteAsset] Failed to delete file, continuing with record deletion:`, fileResult.error);
      }
    }
  }

  // Then delete the record
  return deleteRecord("assets", assetId);
}

