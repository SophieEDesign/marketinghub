"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { GalleryPageConfig } from "@/lib/pages/pageConfig";
import { InterfacePage } from "@/lib/hooks/useInterfacePages";

interface GalleryPageProps {
  page: InterfacePage;
  config: GalleryPageConfig | null;
  isEditing?: boolean;
}

export default function GalleryPage({ page, config, isEditing }: GalleryPageProps) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const { fields: allFields } = useFields(config?.table || "");

  const imageField = allFields.find((f) => f.key === config?.imageField);
  const titleField = config?.titleField ? allFields.find((f) => f.key === config.titleField) : null;
  const subtitleField = config?.subtitleField ? allFields.find((f) => f.key === config.subtitleField) : null;

  // Load records
  useEffect(() => {
    if (!config?.table) return;

    const loadRecords = async () => {
      setLoading(true);
      try {
        let query = supabase.from(config.table).select("*");

        // Apply filters
        if (config.filters && config.filters.length > 0) {
          for (const filter of config.filters) {
            if (filter.operator === "equals") {
              query = query.eq(filter.field, filter.value);
            }
            // Add more filter operators as needed
          }
        }

        // Apply sorts
        if (config.sorts && config.sorts.length > 0) {
          for (const sort of config.sorts) {
            query = query.order(sort.field, { ascending: sort.direction === "asc" });
          }
        }

        const { data, error } = await query.limit(100);

        if (error) throw error;
        setRecords(data || []);
      } catch (error: any) {
        console.error("Error loading records:", error);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [config]);

  const getImageUrl = (record: any) => {
    if (!imageField) return null;
    const imageValue = record[imageField.key];
    
    if (Array.isArray(imageValue) && imageValue.length > 0) {
      return imageValue[0].url || imageValue[0];
    }
    
    if (typeof imageValue === "string") {
      return imageValue;
    }
    
    return null;
  };

  if (!config?.table || !config.imageField) {
    return (
      <div className="p-6 text-center text-gray-500">
        {isEditing ? (
          <p>Configure this page by selecting a table and image field in settings.</p>
        ) : (
          <p>This page is not configured yet.</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading gallery...
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-6">
        {records.map((record) => {
          const imageUrl = getImageUrl(record);
          return (
            <div
              key={record.id}
              onClick={() => setSelectedRecord(record)}
              className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={titleField ? String(record[titleField.key] || "") : "Gallery item"}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No image</span>
                </div>
              )}
              <div className="p-3">
                {titleField && (
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                    {String(record[titleField.key] || "")}
                  </h3>
                )}
                {subtitleField && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {String(record[subtitleField.key] || "")}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Record Detail Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-xl font-semibold mb-4">
                {titleField ? String(selectedRecord[titleField.key] || "") : "Record Details"}
              </h2>
              <div className="space-y-3">
                {allFields.slice(0, 10).map((field) => (
                  <div key={field.key}>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {field.label}:
                    </span>{" "}
                    <span className="text-sm text-gray-900 dark:text-white">
                      {selectedRecord[field.key] ? String(selectedRecord[field.key]) : "-"}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setSelectedRecord(null)}
                className="mt-4 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
