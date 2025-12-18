"use client"

import { useState, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Paperclip, X } from 'lucide-react'

// Using crypto.randomUUID() instead of uuid package for browser compatibility
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export interface Attachment {
  url: string
  name: string
  size: number
  type: string
}

interface AttachmentCellProps {
  value: Attachment[] | null
  fieldName: string
  rowId: string
  tableName: string
  editable?: boolean
  onSave: (value: Attachment[]) => Promise<void>
  placeholder?: string
}

export default function AttachmentCell({
  value,
  fieldName,
  rowId,
  tableName,
  editable = true,
  onSave,
  placeholder = '—',
}: AttachmentCellProps) {
  const [uploading, setUploading] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)

  const attachments = useMemo(() => value || [], [value])

  const handleFiles = useCallback(
    async (files: FileList) => {
      if (!editable || uploading) return

      setUploading(true)
      const uploaded: Attachment[] = []

      try {
        for (const file of Array.from(files)) {
          const ext = file.name.split('.').pop() || 'bin'
          const filePath = `attachments/${tableName}/${rowId}/${fieldName}/${generateUUID()}.${ext}`

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('attachments')
            .upload(filePath, file, { upsert: false })

          if (uploadError) {
            console.error('Upload error:', uploadError)
            continue
          }

          const { data: urlData } = supabase.storage
            .from('attachments')
            .getPublicUrl(filePath)

          uploaded.push({
            url: urlData.publicUrl,
            name: file.name,
            size: file.size,
            type: file.type,
          })
        }

        if (uploaded.length > 0) {
          await onSave([...attachments, ...uploaded])
        }
      } catch (error) {
        console.error('Error uploading files:', error)
      } finally {
        setUploading(false)
      }
    },
    [editable, uploading, attachments, tableName, rowId, fieldName, onSave]
  )

  const handleDelete = useCallback(
    async (index: number) => {
      if (!editable) return

      const file = attachments[index]
      if (!file) return

      try {
        // Extract storage path from public URL
        const urlParts = file.url.split('/storage/v1/object/public/attachments/')
        const storagePath = urlParts[1]

        if (storagePath) {
          await supabase.storage.from('attachments').remove([storagePath])
        }

        const updated = attachments.filter((_, i) => i !== index)
        await onSave(updated)
      } catch (error) {
        console.error('Error deleting file:', error)
      }
    },
    [editable, attachments, onSave]
  )

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (editable) setDragActive(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragActive(false)
    if (editable && e.dataTransfer.files.length > 0) {
      await handleFiles(e.dataTransfer.files)
    }
  }

  const openFilePicker = () => {
    if (editable) fileInputRef.current?.click()
  }

  const isImage = (type: string) => type.startsWith('image/')

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      <div
        className={`w-full h-full px-2 py-1 flex items-center gap-1 text-sm ${
          editable ? 'cursor-pointer hover:bg-blue-50' : ''
        } rounded transition-colors`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={openFilePicker}
      >
        {attachments.length === 0 ? (
          <span className="text-gray-400 flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            {placeholder}
          </span>
        ) : (
          <div className="flex items-center gap-1 flex-wrap">
            {attachments.slice(0, 3).map((file, index) => (
              <div
                key={index}
                className="relative group"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreviewIndex(index)
                }}
              >
                {isImage(file.type) ? (
                  <div className="w-8 h-8 rounded border border-gray-300 overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={file.url}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded border border-gray-300 bg-gray-100 flex items-center justify-center text-xs text-gray-600">
                    {file.name.split('.').pop()?.toUpperCase().slice(0, 3)}
                  </div>
                )}
                {editable && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(index)
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-2 w-2" />
                  </button>
                )}
              </div>
            ))}
            {attachments.length > 3 && (
              <span className="text-xs text-gray-500">+{attachments.length - 3}</span>
            )}
            {uploading && <span className="text-xs text-gray-500">Uploading...</span>}
          </div>
        )}
      </div>

      {previewIndex !== null && (
        <AttachmentPreviewModal
          attachments={attachments}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onDelete={handleDelete}
          setIndex={setPreviewIndex}
        />
      )}
    </>
  )
}

function AttachmentPreviewModal({
  attachments,
  index,
  onClose,
  onDelete,
  setIndex,
}: {
  attachments: Attachment[]
  index: number
  onClose: () => void
  onDelete: (index: number) => void
  setIndex: (n: number) => void
}) {
  const file = attachments[index]
  if (!file) return null

  const isImage = file.type.startsWith('image/')

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-4 max-w-3xl w-full relative max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-xl text-gray-600 hover:text-black z-10"
        >
          ✕
        </button>

        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt={file.name} className="max-h-[60vh] mx-auto rounded" />
        ) : (
          <div className="text-center py-12">
            <p className="text-lg font-medium">{file.name}</p>
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Download
            </a>
          </div>
        )}

        <div className="flex justify-between mt-4">
          <button
            onClick={() => index > 0 && setIndex(index - 1)}
            disabled={index === 0}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300"
          >
            ← Prev
          </button>

          <button
            onClick={() => {
              onDelete(index)
              if (index >= attachments.length - 1 && index > 0) {
                setIndex(index - 1)
              } else if (index < attachments.length - 1) {
                setIndex(index)
              } else {
                onClose()
              }
            }}
            className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Delete
          </button>

          <button
            onClick={() => index < attachments.length - 1 && setIndex(index + 1)}
            disabled={index === attachments.length - 1}
            className="px-3 py-1 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}
