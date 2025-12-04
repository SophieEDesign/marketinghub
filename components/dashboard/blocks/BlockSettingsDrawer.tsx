"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { DashboardBlock } from "@/lib/hooks/useDashboardBlocks";
import { useTables } from "@/lib/hooks/useTables";
import { useFields } from "@/lib/useFields";
import Button from "@/components/ui/Button";

interface BlockSettingsDrawerProps {
  block: DashboardBlock | null;
  open: boolean;
  onClose: () => void;
  onUpdate: (id: string, content: any) => void;
}

// Get default content structure
const getDefaultContent = (type: string) => ({
  title: "",
  limit: 3,
  filters: [],
  table: "",
  fields: [],
  aggregate: "",
  dateField: "",
  html: "",
  url: "",
  caption: "",
  maxHeight: 200,
  style: "contain",
  height: 400,
});

export default function BlockSettingsDrawer({
  block,
  open,
  onClose,
  onUpdate,
}: BlockSettingsDrawerProps) {
  const { tables } = useTables();
  const [content, setContent] = useState<any>({});
  const [blockSize, setBlockSize] = useState({ width: 3, height: 3 });

  // Load fields when table is selected
  const { fields: tableFields } = useFields(content.table || "");

  // Rich text editor for text/html blocks
  const textEditor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start typing...",
      }),
    ],
    content: content.html || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800",
      },
    },
  });

  useEffect(() => {
    if (block) {
      // Normalize content with defaults
      const defaultContent = getDefaultContent(block.type);
      const normalizedContent = { ...defaultContent, ...block.content };
      setContent(normalizedContent);
      // Update block size state
      setBlockSize({
        width: block.width ?? 3,
        height: block.height ?? 3,
      });
    }
  }, [block]);

  // Update editor content when content changes
  useEffect(() => {
    if (textEditor && block?.type === "text" && content.html !== undefined) {
      const currentContent = textEditor.getHTML();
      if (currentContent !== content.html) {
        textEditor.commands.setContent(content.html || "");
      }
    }
  }, [content.html, textEditor, block?.type]);

  // Update content when editor changes
  useEffect(() => {
    if (!textEditor || block?.type !== "text") return;

    const handleUpdate = () => {
      const html = textEditor.getHTML();
      if (html !== content.html) {
        setContent((prev: any) => ({ ...prev, html }));
      }
    };

    textEditor.on("update", handleUpdate);
    return () => {
      textEditor.off("update", handleUpdate);
    };
  }, [textEditor, block?.type, content.html]);

  if (!open || !block) return null;

  const updateContent = (key: string, value: any) => {
    setContent((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    if (block) {
      // Ensure all required fields are present
      const defaultContent = getDefaultContent(block.type);
      const finalContent = { ...defaultContent, ...content };
      onUpdate(block.id, finalContent);
      onClose();
    }
  };

  const handleAddFilter = () => {
    const newFilter = { field: "", operator: "eq", value: "" };
    updateContent("filters", [...(content.filters || []), newFilter]);
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = [...(content.filters || [])];
    newFilters.splice(index, 1);
    updateContent("filters", newFilters);
  };

  const handleUpdateFilter = (index: number, updates: any) => {
    const newFilters = [...(content.filters || [])];
    newFilters[index] = { ...newFilters[index], ...updates };
    updateContent("filters", newFilters);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-[9999] flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {block.type.charAt(0).toUpperCase() + block.type.slice(1)} Block Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Universal Settings */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title
          </label>
          <input
            type="text"
            value={content.title || ""}
            onChange={(e) => updateContent("title", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
            placeholder="Block title"
          />
        </div>

        {/* Grid Size Settings */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Block Size
          </h3>
          <div className={`grid gap-4 ${block?.type === "table" ? "grid-cols-1" : "grid-cols-2"}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Width (columns)
              </label>
              <input
                type="number"
                value={blockSize.width}
                onChange={async (e) => {
                  const width = parseInt(e.target.value) || 3;
                  const clampedWidth = Math.max(2, Math.min(12, width));
                  setBlockSize(prev => ({ ...prev, width: clampedWidth }));
                  await onUpdate(block.id, { width: clampedWidth });
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                min="2"
                max="12"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Grid columns (2-12)
              </p>
            </div>
            {block?.type !== "table" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Height (rows)
                </label>
                <input
                  type="number"
                  value={blockSize.height}
                  onChange={async (e) => {
                    const height = parseInt(e.target.value) || 3;
                    const clampedHeight = Math.max(2, Math.min(20, height));
                    setBlockSize(prev => ({ ...prev, height: clampedHeight }));
                    await onUpdate(block.id, { height: clampedHeight });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                  min="2"
                  max="20"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Grid rows (2-20)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Text Block Settings */}
        {block.type === "text" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rich Text Content
              </label>
              {textEditor ? (
                <div className="border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 min-h-[200px]">
                  <EditorContent editor={textEditor} />
                </div>
              ) : (
                <div className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-400">
                  Loading editor...
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Height (px)
              </label>
              <input
                type="number"
                value={content.maxHeight || 200}
                onChange={(e) => updateContent("maxHeight", parseInt(e.target.value) || 200)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                min="100"
                max="1000"
              />
            </div>
          </>
        )}

        {/* Image Block Settings */}
        {block.type === "image" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Image URL
              </label>
              <input
                type="url"
                value={content.url || ""}
                onChange={(e) => updateContent("url", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Caption
              </label>
              <input
                type="text"
                value={content.caption || ""}
                onChange={(e) => updateContent("caption", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                placeholder="Image caption"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Style
              </label>
              <select
                value={content.style || "contain"}
                onChange={(e) => updateContent("style", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="contain">Contain</option>
                <option value="cover">Cover</option>
                <option value="fit">Fit</option>
              </select>
            </div>
          </>
        )}

        {/* Embed Block Settings */}
        {block.type === "embed" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Embed URL
              </label>
              <input
                type="url"
                value={content.url || ""}
                onChange={(e) => updateContent("url", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                placeholder="https://example.com/embed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Height (px)
              </label>
              <input
                type="number"
                value={content.height || 400}
                onChange={(e) => updateContent("height", parseInt(e.target.value) || 400)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                min="200"
                max="2000"
              />
            </div>
          </>
        )}

        {/* KPI Block Settings */}
        {block.type === "kpi" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table
              </label>
              <select
                value={content.table || ""}
                onChange={(e) => updateContent("table", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Aggregate
              </label>
              <select
                value={content.aggregate || "count"}
                onChange={(e) => updateContent("aggregate", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="count">Count</option>
                <option value="sum">Sum</option>
                <option value="avg">Average</option>
                <option value="min">Minimum</option>
                <option value="max">Maximum</option>
              </select>
            </div>
            {content.aggregate && content.aggregate !== "count" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Field
                </label>
                <select
                  value={content.field || ""}
                  onChange={(e) => updateContent("field", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                >
                  <option value="">Select a field...</option>
                  {tableFields
                    .filter((f) => f.type === "number")
                    .map((field) => (
                      <option key={field.id} value={field.field_key}>
                        {field.label}
                      </option>
                    ))}
                </select>
              </div>
            )}
            {/* Filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filters
                </label>
                <button
                  onClick={handleAddFilter}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  + Add Filter
                </button>
              </div>
              {content.filters?.map((filter: any, index: number) => (
                <div key={index} className="flex gap-2 mb-2">
                  <select
                    value={filter.field || ""}
                    onChange={(e) => handleUpdateFilter(index, { field: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                  >
                    <option value="">Field</option>
                    {tableFields.map((field) => (
                      <option key={field.id} value={field.field_key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filter.operator || "eq"}
                    onChange={(e) => handleUpdateFilter(index, { operator: e.target.value })}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                  >
                    <option value="eq">=</option>
                    <option value="neq">≠</option>
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="gte">≥</option>
                    <option value="lte">≤</option>
                  </select>
                  <input
                    type="text"
                    value={filter.value || ""}
                    onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => handleRemoveFilter(index)}
                    className="px-2 py-1 text-red-600 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Table Block Settings */}
        {block.type === "table" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table
              </label>
              <select
                value={content.table || ""}
                onChange={(e) => updateContent("table", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>
            {content.table && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Fields
                  </label>
                  <button
                    onClick={() => {
                      const currentFields = content.fields || [];
                      const allFieldKeys = tableFields.map((f) => f.field_key);
                      const allSelected = allFieldKeys.every((key) => currentFields.includes(key));
                      
                      if (allSelected) {
                        // Deselect all
                        updateContent("fields", []);
                      } else {
                        // Select all
                        updateContent("fields", allFieldKeys);
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    type="button"
                  >
                    {(() => {
                      const currentFields = content.fields || [];
                      const allFieldKeys = tableFields.map((f) => f.field_key);
                      const allSelected = allFieldKeys.length > 0 && allFieldKeys.every((key) => currentFields.includes(key));
                      return allSelected ? "Deselect All" : "Select All";
                    })()}
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-md p-2">
                  {tableFields.map((field) => (
                    <label key={field.id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={(content.fields || []).includes(field.field_key)}
                        onChange={(e) => {
                          const currentFields = content.fields || [];
                          if (e.target.checked) {
                            updateContent("fields", [...currentFields, field.field_key]);
                          } else {
                            updateContent(
                              "fields",
                              currentFields.filter((f: string) => f !== field.field_key)
                            );
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{field.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Limit (rows)
              </label>
              <input
                type="number"
                value={content.limit || 3}
                onChange={(e) => updateContent("limit", parseInt(e.target.value) || 3)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                min="1"
                max="50"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Default: 3 rows. Users can click "Show more" to expand.
              </p>
            </div>
            {/* Filters */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Filters
                </label>
                <button
                  onClick={handleAddFilter}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  + Add Filter
                </button>
              </div>
              {content.filters?.map((filter: any, index: number) => (
                <div key={index} className="flex gap-2 mb-2">
                  <select
                    value={filter.field || ""}
                    onChange={(e) => handleUpdateFilter(index, { field: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                  >
                    <option value="">Field</option>
                    {tableFields.map((field) => (
                      <option key={field.id} value={field.field_key}>
                        {field.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={filter.operator || "eq"}
                    onChange={(e) => handleUpdateFilter(index, { operator: e.target.value })}
                    className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                  >
                    <option value="eq">=</option>
                    <option value="neq">≠</option>
                    <option value="gt">&gt;</option>
                    <option value="lt">&lt;</option>
                    <option value="gte">≥</option>
                    <option value="lte">≤</option>
                  </select>
                  <input
                    type="text"
                    value={filter.value || ""}
                    onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => handleRemoveFilter(index)}
                    className="px-2 py-1 text-red-600 hover:text-red-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Calendar Block Settings */}
        {block.type === "calendar" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Table
              </label>
              <select
                value={content.table || ""}
                onChange={(e) => updateContent("table", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
              >
                <option value="">Select a table...</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.name}>
                    {table.label}
                  </option>
                ))}
              </select>
            </div>
            {content.table && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date Field
                  </label>
                  <select
                    value={content.dateField || ""}
                    onChange={(e) => updateContent("dateField", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                  >
                    <option value="">Select a date field...</option>
                    {tableFields
                      .filter((f) => f.type === "date")
                      .map((field) => (
                        <option key={field.id} value={field.field_key}>
                          {field.label}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Fields to Display
                    </label>
                    <button
                      onClick={() => {
                        const currentFields = content.fields || [];
                        const allFieldKeys = tableFields.map((f) => f.field_key);
                        const allSelected = allFieldKeys.every((key) => currentFields.includes(key));
                        
                        if (allSelected) {
                          // Deselect all
                          updateContent("fields", []);
                        } else {
                          // Select all
                          updateContent("fields", allFieldKeys);
                        }
                      }}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                      type="button"
                    >
                      {(() => {
                        const currentFields = content.fields || [];
                        const allFieldKeys = tableFields.map((f) => f.field_key);
                        const allSelected = allFieldKeys.length > 0 && allFieldKeys.every((key) => currentFields.includes(key));
                        return allSelected ? "Deselect All" : "Select All";
                      })()}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-700 rounded-md p-2">
                    {tableFields.map((field) => (
                      <label key={field.id} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={(content.fields || []).includes(field.field_key)}
                          onChange={(e) => {
                            const currentFields = content.fields || [];
                            if (e.target.checked) {
                              updateContent("fields", [...currentFields, field.field_key]);
                            } else {
                              updateContent(
                                "fields",
                                currentFields.filter((f: string) => f !== field.field_key)
                              );
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{field.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Display Limit (events)
                  </label>
                  <input
                    type="number"
                    value={content.limit || 10}
                    onChange={(e) => updateContent("limit", parseInt(e.target.value) || 10)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                    min="1"
                    max="100"
                  />
                </div>
                {/* Filters */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Filters
                    </label>
                    <button
                      onClick={handleAddFilter}
                      className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      + Add Filter
                    </button>
                  </div>
                  {content.filters?.map((filter: any, index: number) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <select
                        value={filter.field || ""}
                        onChange={(e) => handleUpdateFilter(index, { field: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                      >
                        <option value="">Field</option>
                        {tableFields.map((field) => (
                          <option key={field.id} value={field.field_key}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                      <select
                        value={filter.operator || "eq"}
                        onChange={(e) => handleUpdateFilter(index, { operator: e.target.value })}
                        className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                      >
                        <option value="eq">=</option>
                        <option value="neq">≠</option>
                        <option value="gt">&gt;</option>
                        <option value="lt">&lt;</option>
                        <option value="gte">≥</option>
                        <option value="lte">≤</option>
                      </select>
                      <input
                        type="text"
                        value={filter.value || ""}
                        onChange={(e) => handleUpdateFilter(index, { value: e.target.value })}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800"
                        placeholder="Value"
                      />
                      <button
                        onClick={() => handleRemoveFilter(index)}
                        className="px-2 py-1 text-red-600 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* HTML Block Settings */}
        {block.type === "html" && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Raw HTML
              </label>
              <textarea
                value={content.html || ""}
                onChange={(e) => updateContent("html", e.target.value)}
                className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 font-mono text-sm"
                placeholder="Enter HTML code..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Height (px)
              </label>
              <input
                type="number"
                value={content.height || 400}
                onChange={(e) => updateContent("height", parseInt(e.target.value) || 400)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                min="100"
                max="2000"
              />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <Button onClick={handleSave} className="w-full">
          Save Changes
        </Button>
      </div>
      </div>
    </>
  );
}

