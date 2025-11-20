"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useFields } from "@/lib/useFields";
import { useRecordDrawer } from "./RecordDrawerProvider";

// Export openRecord function for use in views
export { useRecordDrawer };
import { Sheet, SheetContent } from "./Sheet";
import FieldInput from "../fields/FieldInput";
import LinkedRecordsList from "./LinkedRecordsList";
import ActivityTimeline from "./ActivityTimeline";
import { runAutomations } from "@/lib/automations/automationEngine";
import { toast } from "../ui/Toast";
import { invalidateCache, CacheKeys } from "@/lib/cache/metadataCache";
import { logFieldChanges, logRecordCreation, logRecordDeletion } from "@/lib/activityLogger";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  FileText,
  Calendar,
  Users,
  Lightbulb,
  Image,
  CheckSquare,
  Trash2,
  Copy,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  Check,
  ArrowLeft,
} from "lucide-react";
import { getTable } from "@/lib/tables";
import { useRouter } from "next/navigation";

const TABLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  content: FileText,
  campaigns: Calendar,
  contacts: Users,
  ideas: Lightbulb,
  media: Image,
  tasks: CheckSquare,
};

export default function RecordDrawer() {
  const { open, table, recordId, closeRecord } = useRecordDrawer();
  const router = useRouter();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [fieldSaveStates, setFieldSaveStates] = useState<Record<string, "saving" | "saved" | null>>({});

  const { fields: allFields, loading: fieldsLoading } = useFields(table || "");
  const fields = allFields.filter((f) => f.visible !== false && f.field_key !== "id");

  // Find title field
  const titleField = fields.find((f) => f.field_key === "title" || f.field_key === "name") || fields[0];
  const statusField = fields.find(
    (f) => f.type === "single_select" && f.label.toLowerCase().includes("status")
  );

  // Load record
  useEffect(() => {
    if (!recordId || !table) {
      setRecord(null);
      return;
    }

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .eq("id", recordId)
        .maybeSingle();

      if (error) {
        console.error("Error loading record:", error);
        toast({
          title: "Error",
          description: "Failed to load record",
          type: "error",
        });
        setLoading(false);
        return;
      }

      setRecord(data);
      setLoading(false);
    }

    load();
  }, [recordId, table]);

  // Debounced field updates
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, any>>({});
  const debouncedUpdates = useDebounce(pendingUpdates, 200);

  useEffect(() => {
    if (Object.keys(debouncedUpdates).length === 0 || !table || !recordId) return;

    async function saveField(fieldKey: string, value: any) {
      setFieldSaveStates((prev) => ({ ...prev, [fieldKey]: "saving" }));

      try {
        // Store previous record for logging
        const previousRecord = { ...record };
        
        const { error, data: updatedRecord } = await supabase
          .from(table!)
          .update({ [fieldKey]: value })
          .eq("id", recordId!)
          .select()
          .single();

        if (error) throw error;

        // Log the field change
        await logFieldChanges(previousRecord, updatedRecord, table!, "user");

        // Run automations
        try {
          const automationResult = await runAutomations(table!, updatedRecord, previousRecord);
          
          if (automationResult.updated && Object.keys(automationResult.updated).length > 0) {
            const { data: finalRecord } = await supabase
              .from(table!)
              .update(automationResult.updated)
              .eq("id", recordId!)
              .select()
              .single();
            
            if (finalRecord) {
              // Log automation changes
              await logFieldChanges(updatedRecord, finalRecord, table!, "automation");
              // Update local record with automation changes
              setRecord((prev: any) => ({ ...prev, ...automationResult.updated }));
            }
          }

          automationResult.notifications.forEach((notification) => {
            toast({
              title: "Automation",
              description: notification,
              type: "success",
            });
          });
        } catch (automationError) {
          console.error("Error running automations:", automationError);
        }

        // Update local record
        setRecord((prev: any) => ({ ...prev, [fieldKey]: value }));

        setFieldSaveStates((prev) => ({ ...prev, [fieldKey]: "saved" }));
        setTimeout(() => {
          setFieldSaveStates((prev) => {
            const next = { ...prev };
            delete next[fieldKey];
            return next;
          });
        }, 2000);

        // Invalidate cache
        invalidateCache(CacheKeys.tableRecords(table!, "*"));
      } catch (error: any) {
        console.error("Error saving field:", error);
        setFieldSaveStates((prev) => {
          const next = { ...prev };
          delete next[fieldKey];
          return next;
        });
        toast({
          title: "Error",
          description: `Failed to save ${fieldKey}`,
          type: "error",
        });
      }
    }

    Object.entries(debouncedUpdates).forEach(([fieldKey, value]) => {
      saveField(fieldKey, value);
    });

    setPendingUpdates({});
  }, [debouncedUpdates, table, recordId, record]);

  const handleFieldChange = useCallback((fieldKey: string, value: any) => {
    setRecord((prev: any) => ({ ...prev, [fieldKey]: value }));
    setPendingUpdates((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const handleDelete = async () => {
    if (!record || !table) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete this record? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      // Log deletion before deleting
      await logRecordDeletion(table, record.id, record);

      const { error } = await supabase.from(table).delete().eq("id", record.id);

      if (error) throw error;

      invalidateCache(CacheKeys.tableRecords(table, "*"));
      toast({
        title: "Success",
        description: "Record deleted successfully",
        type: "success",
      });

      closeRecord();
      window.location.reload();
    } catch (error: any) {
      console.error("Error deleting record:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete record",
        type: "error",
      });
      setDeleting(false);
    }
  };

  const handleDuplicate = async () => {
    if (!record || !table) return;

    try {
      const { id, created_at, updated_at, ...recordData } = record;
      const { data: newRecord, error } = await supabase
        .from(table)
        .insert([recordData])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Record duplicated successfully",
        type: "success",
      });

      if (newRecord) {
        closeRecord();
        setTimeout(() => {
          openRecord(table, newRecord.id);
        }, 300);
      }
    } catch (error: any) {
      console.error("Error duplicating record:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to duplicate record",
        type: "error",
      });
    }
  };

  const handleConvertToContent = async () => {
    if (!record || table !== "ideas") return;

    try {
      const { data: newContent, error } = await supabase
        .from("content")
        .insert([
          {
            title: record.title || "Untitled",
            description: record.description || "",
            content_type: record.category || null,
            status: "Draft",
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Log content creation
      await logRecordCreation("content", newContent.id, newContent);

      // Update idea status
      const { data: updatedIdea } = await supabase
        .from("ideas")
        .update({ status: "Converted", linked_content_id: newContent.id })
        .eq("id", record.id)
        .select()
        .single();

      if (updatedIdea) {
        // Log idea status change
        await logFieldChanges(record, updatedIdea, "ideas", "user");
      }

      toast({
        title: "Success",
        description: "Idea converted to content",
        type: "success",
      });

      closeRecord();
      setTimeout(() => {
        openRecord("content", newContent.id);
      }, 300);
    } catch (error: any) {
      console.error("Error converting idea:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to convert idea",
        type: "error",
      });
    }
  };

  const toggleSection = (section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const isSectionCollapsed = (section: string) => collapsedSections.has(section);

  const tableConfig = table ? getTable(table) : null;
  const TableIcon = table ? TABLE_ICONS[table] || FileText : FileText;

  return (
    <Sheet open={open} onOpenChange={closeRecord} side="right">
      <SheetContent
        className="w-full md:w-[480px] lg:w-[620px] xl:w-[720px] p-0"
        onClose={closeRecord}
      >
        {loading || fieldsLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 dark:text-gray-400">Loading...</div>
          </div>
        ) : record ? (
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 rounded-lg bg-brand-blue/10">
                  <TableIcon className="w-5 h-5 text-brand-blue" />
                </div>
                <div className="flex-1 min-w-0">
                  {titleField && (
                    <div className="relative">
                      <input
                        type="text"
                        value={record[titleField.field_key] || ""}
                        onChange={(e) => handleFieldChange(titleField.field_key, e.target.value)}
                        className="text-xl font-heading font-semibold text-brand-blue bg-transparent border-none outline-none focus:ring-2 focus:ring-brand-red rounded px-2 -ml-2 w-full"
                        placeholder="Untitled"
                      />
                      {fieldSaveStates[titleField.field_key] === "saved" && (
                        <Check className="w-4 h-4 text-green-500 absolute right-2 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  )}
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {tableConfig?.name || table}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              {statusField && record[statusField.field_key] && (
                <div className="mb-4">
                  <FieldInput
                    field={statusField}
                    value={record[statusField.field_key]}
                    onChange={(value) => handleFieldChange(statusField.field_key, value)}
                    table={table || undefined}
                    recordId={recordId || null}
                  />
                </div>
              )}

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                {table === "ideas" && (
                  <button
                    onClick={handleConvertToContent}
                    className="btn-secondary text-sm"
                  >
                    Convert to Content
                  </button>
                )}
                <button onClick={handleDuplicate} className="btn-secondary text-sm">
                  <Copy className="w-4 h-4 mr-1 inline" />
                  Duplicate
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-secondary text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                >
                  <Trash2 className="w-4 h-4 mr-1 inline" />
                  Delete
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Details Section */}
              <Section
                title="Details"
                collapsed={isSectionCollapsed("details")}
                onToggle={() => toggleSection("details")}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {fields
                    .filter((f) => f.field_key !== titleField?.field_key && f.field_key !== statusField?.field_key)
                    .map((field) => {
                      const saveState = fieldSaveStates[field.field_key];
                      return (
                        <div key={field.id} className="relative">
                          <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 block mb-2">
                            {field.label} {field.required && "*"}
                          </label>
                          <FieldInput
                            field={field}
                            value={record[field.field_key]}
                            onChange={(value) => handleFieldChange(field.field_key, value)}
                            table={table || undefined}
                            recordId={recordId || null}
                          />
                          {saveState === "saved" && (
                            <div className="absolute top-8 right-2">
                              <Check className="w-4 h-4 text-green-500" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </Section>

              {/* Attachments Section */}
              {fields.some((f) => f.type === "attachment") && (
                <Section
                  title="Attachments"
                  collapsed={isSectionCollapsed("attachments")}
                  onToggle={() => toggleSection("attachments")}
                >
                  {fields
                    .filter((f) => f.type === "attachment")
                    .map((field) => (
                      <div key={field.id}>
                        <label className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 block mb-2">
                          {field.label}
                        </label>
                        <FieldInput
                          field={field}
                          value={record[field.field_key]}
                          onChange={(value) => handleFieldChange(field.field_key, value)}
                          table={table || undefined}
                          recordId={recordId || null}
                        />
                      </div>
                    ))}
                </Section>
              )}

              {/* Linked Records Section */}
              {fields.some((f) => f.type === "linked_record") && (
                <Section
                  title="Linked Records"
                  collapsed={isSectionCollapsed("linked")}
                  onToggle={() => toggleSection("linked")}
                >
                  <LinkedRecordsList
                    table={table!}
                    recordId={recordId!}
                    fields={fields}
                    record={record}
                  />
                </Section>
              )}

              {/* Activity Timeline Section */}
              <Section
                title="Activity"
                collapsed={isSectionCollapsed("activity")}
                onToggle={() => toggleSection("activity")}
              >
                <ActivityTimeline table={table!} recordId={recordId!} />
              </Section>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 dark:text-gray-400">Record not found</div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
}

function Section({ title, children, collapsed, onToggle }: SectionProps) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <h3 className="text-sm font-heading font-semibold text-brand-blue uppercase tracking-wide">
          {title}
        </h3>
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-gray-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400" />
        )}
      </button>
      {!collapsed && <div className="p-4">{children}</div>}
    </div>
  );
}

