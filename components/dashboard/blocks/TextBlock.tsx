"use client";

import { useState, useEffect, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { X, GripVertical } from "lucide-react";

interface TextBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  isDragging?: boolean;
}

export default function TextBlock({
  id,
  content,
  onUpdate,
  onDelete,
  isDragging = false,
}: TextBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState(content?.text || "");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Start typing...",
      }),
    ],
    content: localContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setLocalContent(html);
      // Debounce auto-save
      clearTimeout((window as any)[`saveTimeout_${id}`]);
      (window as any)[`saveTimeout_${id}`] = setTimeout(() => {
        onUpdate?.(id, { text: html });
      }, 500);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[100px] p-4",
      },
    },
  });

  useEffect(() => {
    if (editor && content?.text && content.text !== localContent) {
      editor.commands.setContent(content.text);
      setLocalContent(content.text);
    }
  }, [content?.text, editor]);

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
  };

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`group relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow ${
        isEditing ? "ring-2 ring-blue-500" : ""
      } ${isDragging ? "opacity-50" : ""}`}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* Drag Handle */}
      <div className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab active:cursor-grabbing" />
      </div>

      {/* Delete Button */}
      {onDelete && (
        <button
          onClick={() => onDelete(id)}
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-red-600"
          title="Delete block"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

