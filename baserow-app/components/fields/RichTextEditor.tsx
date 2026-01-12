"use client"

import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import { 
  Bold, 
  Italic, 
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface RichTextEditorProps {
  value: string | null
  onChange: (value: string) => void
  onBlur?: () => void
  placeholder?: string
  editable?: boolean
  className?: string
  minHeight?: string
  showToolbar?: boolean
}

/**
 * RichTextEditor - A TipTap-based rich text editor for long text fields
 * Stores content as HTML string
 */
export default function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = 'Start typing...',
  editable = true,
  className,
  minHeight = '120px',
  showToolbar = true,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: 'code-block',
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline hover:text-blue-800',
        },
      }),
      TextStyle,
      Color,
    ],
    content: value || '',
    editable,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-3 py-2 min-h-[60px]',
        style: `min-height: ${minHeight};`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
    },
    onBlur: () => {
      if (onBlur) {
        onBlur()
      }
    },
  })

  // Update editor content when value prop changes (from external source)
  useEffect(() => {
    if (editor && value !== null && value !== undefined) {
      const currentHtml = editor.getHTML()
      // Only update if the value is actually different to avoid unnecessary updates
      if (currentHtml !== value) {
        editor.commands.setContent(value, false) // false = don't emit update event
      }
    } else if (editor && (value === null || value === undefined || value === '')) {
      // Clear editor if value is empty
      const currentHtml = editor.getHTML()
      if (currentHtml !== '<p></p>') {
        editor.commands.clearContent(false)
      }
    }
  }, [editor, value])

  // Update editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable)
    }
  }, [editor, editable])

  if (!editor) {
    return (
      <div className={cn("border border-gray-300 rounded-md p-3", className)}>
        <div className="animate-pulse text-sm text-gray-400">Loading editor...</div>
      </div>
    )
  }

  const Toolbar = () => {
    if (!showToolbar || !editable) return null

    return (
      <div className="flex items-center gap-1 p-1 bg-white border border-gray-200 rounded-md shadow-sm mb-2 flex-wrap">
        {/* Heading selector */}
        <Select
          value={
            editor.isActive('heading', { level: 1 }) ? 'h1' :
            editor.isActive('heading', { level: 2 }) ? 'h2' :
            editor.isActive('heading', { level: 3 }) ? 'h3' :
            'p'
          }
          onValueChange={(value) => {
            editor.chain().focus().run()
            if (value === 'p') {
              editor.chain().focus().setParagraph().run()
            } else if (value === 'h1') {
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            } else if (value === 'h2') {
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            } else if (value === 'h3') {
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          }}
        >
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="p">Paragraph</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
          </SelectContent>
        </Select>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Text formatting buttons */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('bold') && "bg-gray-100")}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('italic') && "bg-gray-100")}
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('strike') && "bg-gray-100")}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (editor.isActive('codeBlock')) {
              editor.chain().focus().toggleCodeBlock().run()
            } else if (editor.state.selection.empty) {
              // If no selection, toggle code block
              editor.chain().focus().toggleCodeBlock().run()
            } else {
              // If text is selected, toggle inline code
              editor.chain().focus().toggleCode().run()
            }
          }}
          className={cn("h-8 w-8 p-0", (editor.isActive('code') || editor.isActive('codeBlock')) && "bg-gray-100")}
        >
          <Code className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* List buttons */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('bulletList') && "bg-gray-100")}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn("h-8 w-8 p-0", editor.isActive('orderedList') && "bg-gray-100")}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {/* Link button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter URL:')
            if (url) {
              editor.chain().focus().setLink({ href: url }).run()
            }
          }}
          className={cn("h-8 w-8 p-0", editor.isActive('link') && "bg-gray-100")}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {showToolbar && editable && <Toolbar />}
      <div className={cn(
        "border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent",
        !editable && "bg-gray-50"
      )}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
