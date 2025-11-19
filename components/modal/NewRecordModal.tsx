"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useModal } from "@/lib/modalState";
import { useFields } from "@/lib/useFields";
import FieldInput from "../fields/FieldInput";

export default function NewRecordModal() {
  const { open, setOpen, tableId } = useModal();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const { fields: allFields, loading: fieldsLoading } = useFields(tableId || "");

  // Filter visible fields, exclude id
  const fields = allFields.filter((f) => f.visible !== false && f.field_key !== "id");

  useEffect(() => {
    if (open && tableId) {
      // Initialize form data with defaults
      const initial: Record<string, any> = {};
      fields.forEach((field) => {
        if (field.type === "boolean") {
          initial[field.field_key] = false;
        } else if (field.type === "multi_select") {
          initial[field.field_key] = [];
        } else {
          initial[field.field_key] = null;
        }
      });
      setFormData(initial);
    }
  }, [open, tableId, fields]);

  const moveTempFile = async (tempUrl: string, newRecordId: string): Promise<string | null> => {
    try {
      // Extract path from temp URL
      const urlParts = tempUrl.split("/attachments/");
      if (urlParts.length < 2) return tempUrl; // Not a temp file, return as-is

      const tempPath = urlParts[1].split("?")[0];
      
      // New path: {table}/{recordId}/{filename}
      const fileName = tempPath.split("/").pop() || "";
      const newPath = `${tableId}/${newRecordId}/${fileName}`;

      console.log("Moving temp file:", { tempPath, newPath });

      // Download temp file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("attachments")
        .download(tempPath);

      if (downloadError || !fileData) {
        console.error("Error downloading temp file:", downloadError);
        return tempUrl; // Return original URL if move fails
      }

      // Upload to new location
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(newPath, fileData, {
          contentType: fileData.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        console.error("Error uploading to new location:", uploadError);
        return tempUrl; // Return original URL if move fails
      }

      // Delete temp file
      await supabase.storage.from("attachments").remove([tempPath]);

      // Get new public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("attachments").getPublicUrl(newPath);

      return publicUrl || tempUrl;
    } catch (err) {
      console.error("Error moving temp file:", err);
      return tempUrl; // Return original URL if move fails
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableId) return;
    
    // Validate required fields
    const missingRequired = fields.filter(
      (field) => field.required && (formData[field.field_key] === null || formData[field.field_key] === undefined || formData[field.field_key] === "")
    );
    
    if (missingRequired.length > 0) {
      alert(`Please fill in required fields: ${missingRequired.map((f) => f.label).join(", ")}`);
      return;
    }
    
    setLoading(true);

    // Prepare data for insert (without temp attachment URLs)
    const insertData: Record<string, any> = {};
    const tempAttachments: { fieldKey: string; url: string }[] = [];

    fields.forEach((field) => {
      const value = formData[field.field_key];
      if (value !== null && value !== undefined && value !== "") {
        // Check if this is a temp attachment URL
        if (field.type === "attachment" && value.includes("/temp/")) {
          tempAttachments.push({ fieldKey: field.field_key, url: value });
          // Don't include in initial insert, will update after moving file
        } else {
          insertData[field.field_key] = value;
        }
      }
    });

    // Insert record
    const { data: newRecord, error } = await supabase
      .from(tableId)
      .insert([insertData])
      .select()
      .single();

    if (error || !newRecord) {
      console.error("Error creating record:", error);
      alert("Failed to create record. Please try again.");
      setLoading(false);
      return;
    }

    // Move temp attachment files to final location
    if (tempAttachments.length > 0) {
      const updates: Record<string, any> = {};
      
      for (const attachment of tempAttachments) {
        const finalUrl = await moveTempFile(attachment.url, newRecord.id);
        if (finalUrl) {
          updates[attachment.fieldKey] = finalUrl;
        }
      }

      // Update record with final attachment URLs
      if (Object.keys(updates).length > 0) {
        await supabase
          .from(tableId)
          .update(updates)
          .eq("id", newRecord.id);
      }
    }

    setOpen(false);
    setFormData({});
    window.location.reload();
    setLoading(false);
  };

  if (!open || !tableId) return null;

  if (fieldsLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl p-6">
          <div className="text-gray-500 dark:text-gray-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Create New Record</h2>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {fields.map((field) => (
              <div key={field.id}>
                <label className="text-sm opacity-70 block mb-1">
                  {field.label} {field.required && "*"}
                </label>
                <FieldInput
                  field={field}
                  value={formData[field.field_key]}
                  onChange={(value) =>
                    setFormData({ ...formData, [field.field_key]: value })
                  }
                  table={tableId || undefined}
                  recordId={null} // New record, no ID yet
                />
              </div>
            ))}

            {/* Buttons */}
            <div className="flex gap-2 justify-end mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Record"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

