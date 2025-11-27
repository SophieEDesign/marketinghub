"use client";

import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import BlockHeader from "./BlockHeader";

interface TextBlockProps {
  id: string;
  content: any;
  onUpdate?: (id: string, content: any) => void;
  onDelete?: (id: string) => void;
  onOpenSettings?: () => void;
  isDragging?: boolean;
  editing?: boolean;
}

export default function TextBlock({
  id,
  content,
  onUpdate,
  onDelete,
  onOpenSettings,
  isDragging = false,
  editing = false,
}: TextBlockProps) {
  const [isFocused, setIsFocused] = useState(false);
  // Support both content.text and content.html for backward compatibility
  const [localContent, setLocalContent] = useState(content?.html || content?.text || "");
  
  // Get title from content or use default
  const title = content?.title || "Text Block";
  const maxHeight = content?.maxHeight || 200;

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
        onUpdate?.(id, { html: html, text: html }); // Save as both for compatibility
      }, 500);
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[100px] p-4",
      },
    },
  });

  useEffect(() => {
    const newContent = content?.html || content?.text || "";
    if (editor && newContent && newContent !== localContent) {
      editor.commands.setContent(newContent);
      setLocalContent(newContent);
    }
  }, [content?.html, content?.text, editor, localContent]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  if (!editor) {
    return (
      <>
        <BlockHeader
          title={title}
          editing={editing}
          onOpenSettings={onOpenSettings || (() => {})}
          onDelete={onDelete ? () => onDelete(id) : undefined}
          isDragging={isDragging}
        />
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-gray-500">Loading editor...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <BlockHeader
        title={title}
        editing={editing}
        onOpenSettings={onOpenSettings || (() => {})}
        onDelete={onDelete ? () => onDelete(id) : undefined}
        isDragging={isDragging}
      />
      <div
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: `${maxHeight}px` }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <div className="p-4">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}

