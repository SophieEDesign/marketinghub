"use client";

import { useState, useEffect } from "react";
import BlockHeader from "./BlockHeader";
import EnhancedTextEditor from "@/components/editor/EnhancedTextEditor";

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
  // Support both content.text and content.html for backward compatibility
  const [localContent, setLocalContent] = useState(content?.html || content?.text || "");
  
  // Get title from content or use default
  const title = content?.title || "Text Block";
  const maxHeight = content?.maxHeight || 200;

  useEffect(() => {
    const newContent = content?.html || content?.text || "";
    if (newContent && newContent !== localContent) {
      setLocalContent(newContent);
    }
  }, [content?.html, content?.text]);

  const handleContentChange = (html: string) => {
    setLocalContent(html);
    // Debounce auto-save
    clearTimeout((window as any)[`saveTimeout_${id}`]);
    (window as any)[`saveTimeout_${id}`] = setTimeout(() => {
      onUpdate?.(id, { html: html, text: html }); // Save as both for compatibility
    }, 500);
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

  // When editing, show enhanced editor with full toolbar
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
      >
        <EnhancedTextEditor
          content={localContent}
          onChange={handleContentChange}
          editable={editing}
          placeholder="Start typing..."
          showToolbar={true}
        />
      </div>
    </>
  );
}

