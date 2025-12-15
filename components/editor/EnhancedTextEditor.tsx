"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { Highlight } from "@tiptap/extension-highlight";
import { TextAlign } from "@tiptap/extension-text-align";
import { FontSize } from "@/lib/editor/fontSize";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Code,
  Palette,
  Type,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Code2 } from "lucide-react";

interface EnhancedTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
  showToolbar?: boolean;
}

export default function EnhancedTextEditor({
  content,
  onChange,
  editable = true,
  placeholder = "Start typing...",
  className = "",
  showToolbar = true,
}: EnhancedTextEditorProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState(content);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextStyle,
      Color,
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "left",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline cursor-pointer",
        },
      }),
      FontSize,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none focus:outline-none min-h-[100px] p-4 ${className}`,
      },
    },
  });

  // Update editor content when prop changes
  useEffect(() => {
    if (editor && content !== editor.getHTML() && !isHtmlMode) {
      editor.commands.setContent(content);
    }
  }, [content, editor, isHtmlMode]);

  // Sync HTML content when switching modes
  useEffect(() => {
    if (isHtmlMode) {
      setHtmlContent(editor?.getHTML() || content);
    }
  }, [isHtmlMode, editor, content]);

  if (!editor) {
    return <div className="text-sm text-gray-500 p-4">Loading editor...</div>;
  }

  const setColor = (color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
    setShowColorPicker(false);
  };

  const setHighlight = (color: string) => {
    if (!editor) return;
    editor.chain().focus().toggleHighlight({ color }).run();
    setShowColorPicker(false);
  };

  const setFontSize = (size: string) => {
    if (!editor) return;
    // Remove 'px' if present and use setMark with fontSize
    const sizeValue = size.replace('px', '');
    // Use setMark directly since TypeScript doesn't recognize custom commands
    editor.chain().focus().setMark('textStyle', { fontSize: sizeValue }).run();
    setShowFontSizePicker(false);
  };

  const toggleHtmlMode = () => {
    if (isHtmlMode) {
      // Switching from HTML to visual - update editor with HTML content
      if (editor) {
        editor.commands.setContent(htmlContent);
        onChange(htmlContent);
      }
    } else {
      // Switching to HTML mode - get current HTML
      if (editor) {
        setHtmlContent(editor.getHTML());
      }
    }
    setIsHtmlMode(!isHtmlMode);
  };

  const handleHtmlChange = (newHtml: string) => {
    setHtmlContent(newHtml);
    onChange(newHtml);
  };

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl("");
      setShowLinkDialog(false);
    }
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setShowLinkDialog(false);
  };

  const Toolbar = () => {
    if (!showToolbar || !editable) return null;

    return (
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {/* Text Formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("bold") ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Bold (Ctrl+B)"
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
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("underline") ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("code") ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Code"
        >
          <Code className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("heading", { level: 1 }) ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Heading 1"
        >
          <Heading1 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("heading", { level: 2 }) ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Heading 2"
        >
          <Heading2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("heading", { level: 3 }) ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Heading 3"
        >
          <Heading3 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Lists */}
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

        {/* Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("textAlign", { align: "left" }) ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Align Left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("textAlign", { align: "center" }) ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Align Center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
            editor.isActive("textAlign", { align: "right" }) ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title="Align Right"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Font Size */}
        <div className="relative font-size-picker-container">
          <button
            type="button"
            onClick={() => setShowFontSizePicker(!showFontSizePicker)}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Font Size"
          >
            <Type className="w-4 h-4" />
          </button>
          {showFontSizePicker && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 p-2">
              <div className="grid grid-cols-2 gap-1">
                {["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "36px", "48px"].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => {
                      editor.chain().focus().setMark("textStyle", { fontSize: size }).run();
                      setShowFontSizePicker(false);
                    }}
                    className="px-2 py-1 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-left"
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Color */}
        <div className="relative color-picker-container">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
            title="Text Color"
          >
            <Palette className="w-4 h-4" />
          </button>
          {showColorPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 p-3">
              <div className="mb-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Text Color
                </label>
                <div className="grid grid-cols-8 gap-1">
                  {[
                    "#000000", "#333333", "#666666", "#999999",
                    "#FF0000", "#00FF00", "#0000FF", "#FFFF00",
                    "#FF00FF", "#00FFFF", "#FFA500", "#800080",
                    "#FFC0CB", "#A52A2A", "#000080", "#008000",
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setColor(color)}
                      className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  onChange={(e) => setColor(e.target.value)}
                  className="mt-2 w-full h-8 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                  Highlight Color
                </label>
                <div className="grid grid-cols-8 gap-1">
                  {[
                    "#FFFF00", "#FFE5B4", "#90EE90", "#87CEEB",
                    "#FFB6C1", "#DDA0DD", "#F0E68C", "#98FB98",
                  ].map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setHighlight(color)}
                      className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  onChange={(e) => setHighlight(e.target.value)}
                  className="mt-2 w-full h-8 rounded border border-gray-300 dark:border-gray-700 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>

        {/* Link */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLinkDialog(!showLinkDialog)}
            className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${
              editor.isActive("link") ? "bg-gray-300 dark:bg-gray-600" : ""
            }`}
            title="Insert Link"
          >
            <LinkIcon className="w-4 h-4" />
          </button>
          {showLinkDialog && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-10 p-3 min-w-[250px]">
              {editor.isActive("link") ? (
                <div className="space-y-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Current link: {editor.getAttributes("link").href}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={removeLink}
                      className="flex-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                    >
                      Remove Link
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLinkDialog(false)}
                      className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-900"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addLink();
                      }
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={addLink}
                      disabled={!linkUrl}
                      className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add Link
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowLinkDialog(false);
                        setLinkUrl("");
                      }}
                      className="px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />

        {/* Undo/Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Redo (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </button>

        {/* HTML Toggle */}
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1" />
        <button
          type="button"
          onClick={toggleHtmlMode}
          className={`p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-xs ${
            isHtmlMode ? "bg-gray-300 dark:bg-gray-600" : ""
          }`}
          title={isHtmlMode ? "Switch to Visual Editor" : "Switch to HTML Editor"}
        >
          <Code2 className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.color-picker-container') && !target.closest('button[title="Text Color"]')) {
        setShowColorPicker(false);
      }
      if (!target.closest('.font-size-picker-container') && !target.closest('button[title="Font Size"]')) {
        setShowFontSizePicker(false);
      }
    };

    if (showColorPicker || showFontSizePicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showColorPicker, showFontSizePicker]);

  return (
    <div className="flex flex-col">
      <Toolbar />
      <div className="flex-1">
        {isHtmlMode ? (
          <textarea
            value={htmlContent}
            onChange={(e) => handleHtmlChange(e.target.value)}
            className="w-full min-h-[200px] p-4 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 font-mono text-sm"
            placeholder="Enter HTML content..."
            style={{ fontFamily: 'monospace' }}
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}
