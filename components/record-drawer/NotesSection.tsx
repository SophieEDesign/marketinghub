"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { FileText } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
// Simple debounce implementation
function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

interface NotesSectionProps {
  tableId: string;
  recordId: string;
  record: any;
}

export default function NotesSection({
  tableId,
  recordId,
  record,
}: NotesSectionProps) {
  const [notes, setNotes] = useState(record?.notes || "");
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Add notes about this record...",
      }),
    ],
    content: notes,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4",
      },
    },
  });

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (content: string) => {
      if (!recordId || !tableId) return;

      setSaving(true);
      try {
        const { error } = await supabase
          .from(tableId)
          .update({ notes: content })
          .eq("id", recordId);

        if (error) throw error;
      } catch (error) {
        console.error("Error saving notes:", error);
      } finally {
        setSaving(false);
      }
    }, 500),
    [recordId, tableId]
  );

  useEffect(() => {
    if (editor) {
      editor.on("update", ({ editor }) => {
        const html = editor.getHTML();
        setNotes(html);
        debouncedSave(html);
      });
    }

    return () => {
      if (editor) {
        editor.off("update");
      }
    };
  }, [editor, debouncedSave]);

  useEffect(() => {
    if (editor && record?.notes && record.notes !== notes) {
      editor.commands.setContent(record.notes);
      setNotes(record.notes);
    }
  }, [record?.notes, editor]);

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Notes
        </h3>
        {saving && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Saving...
          </span>
        )}
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        {editor && <EditorContent editor={editor} />}
      </div>
    </div>
  );
}

