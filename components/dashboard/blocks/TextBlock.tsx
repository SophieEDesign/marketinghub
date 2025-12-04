"use client";

import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Italic, Underline, List, ListOrdered, Quote, Undo, Redo } from "lucide-react";
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
    editable: editing, // Only editable when in editing mode
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

  // Update editor editable state when editing prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(editing);
    }
  }, [editor, editing]);

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

  // Toolbar component for WYSIWYG editing
  const Toolbar = () => {
    if (!editing) return null;

    return (
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("bold") ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("italic") ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("bulletList") ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("orderedList") ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("blockquote") ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // When not editing, show rendered HTML (WYSIWYG display)
  if (!editing) {
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
        >
          <div 
            className="p-4 prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: localContent || "" }}
          />
        </div>
      </>
    );
  }

  // When editing, show editor with toolbar (WYSIWYG editing)
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
        className="flex-1 overflow-y-auto flex flex-col"
        style={{ maxHeight: `${maxHeight}px` }}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <Toolbar />
        <div className="p-4 flex-1">
          <EditorContent editor={editor} />
        </div>
      </div>
    </>
  );
}

