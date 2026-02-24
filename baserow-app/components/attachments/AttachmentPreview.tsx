"use client"

import { useState, useMemo } from 'react'
import { 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive, 
  File,
  FileSpreadsheet,
  FileCode,
  Download,
  Trash2,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Attachment {
  url: string
  name: string
  size?: number | null
  type?: string | null
}

interface AttachmentPreviewProps {
  attachments: Attachment[]
  maxVisible?: number // Max previews to show (for grid view)
  size?: 'small' | 'medium' | 'large' // Preview size
  displayStyle?: 'thumbnails' | 'list' | 'hero' | 'cover' | 'gallery' // Display style
  onPreviewClick?: (index: number) => void // Optional: custom click handler
  onDelete?: (index: number) => void | Promise<void> // Optional: delete handler (shows Delete in modal when editable)
  editable?: boolean // When true and onDelete provided, modal shows Delete button
  className?: string
  compact?: boolean // For grid cells - show minimal previews
}

/**
 * Unified Attachment Preview Component
 * 
 * Handles:
 * - Image thumbnails with aspect ratio preservation
 * - Non-image file tiles with type icons
 * - Multiple attachments with overflow handling
 * - Click to open modal/lightbox
 * - Field-based settings (size, display style)
 */
export default function AttachmentPreview({
  attachments,
  maxVisible = 3,
  size = 'medium',
  displayStyle = 'thumbnails',
  onPreviewClick,
  onDelete,
  editable = false,
  className,
  compact = false,
}: AttachmentPreviewProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())

  const visibleAttachments = useMemo(() => {
    return attachments.slice(0, maxVisible)
  }, [attachments, maxVisible])

  const remainingCount = attachments.length - visibleAttachments.length

  const isImage = (type?: string | null): boolean => {
    return (type || '').startsWith('image/')
  }

  const getFileTypeIcon = (attachment: Attachment) => {
    return getFileIconForAttachment(attachment)
  }

  const formatFileSize = (bytes?: number | null): string => {
    if (bytes === null || bytes === undefined) return '—'
    return formatBytes(bytes)
  }

  const handleAttachmentClick = (index: number) => {
    if (onPreviewClick) {
      onPreviewClick(index)
    } else {
      setPreviewIndex(index)
    }
  }

  const sizeClasses = {
    small: {
      thumbnail: 'h-12 w-12',
      icon: 'h-3 w-3',
      text: 'text-xs',
    },
    medium: {
      thumbnail: 'h-16 w-16',
      icon: 'h-4 w-4',
      text: 'text-sm',
    },
    large: {
      thumbnail: 'h-24 w-24',
      icon: 'h-5 w-5',
      text: 'text-base',
    },
  }

  const sizeConfig = sizeClasses[size]

  if (attachments.length === 0) {
    return null
  }

  // Compact mode for grid cells
  if (compact) {
    const firstAttachment = attachments[0]
    const isFirstImage = isImage(firstAttachment.type) && !failedImages.has(0)

    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {isFirstImage ? (
          <div
            className={cn(
              "relative rounded overflow-hidden bg-gray-100 flex-shrink-0",
              sizeConfig.thumbnail
            )}
            onClick={() => handleAttachmentClick(0)}
          >
            <img
              src={firstAttachment.url}
              alt={firstAttachment.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={() => {
                setFailedImages(prev => new Set(prev).add(0))
              }}
            />
          </div>
        ) : (
          <div
            className={cn(
              "flex items-center justify-center rounded bg-gray-100 flex-shrink-0",
              sizeConfig.thumbnail
            )}
            onClick={() => handleAttachmentClick(0)}
          >
            {getFileTypeIcon(firstAttachment)}
          </div>
        )}
        {attachments.length > 1 && (
          <span className={cn("text-gray-600 font-medium", sizeConfig.text)}>
            +{attachments.length - 1}
          </span>
        )}
      </div>
    )
  }

  // Hero mode - large featured image with others as thumbnails below
  if (displayStyle === 'hero') {
    const firstAttachment = attachments[0]
    const isFirstImage = isImage(firstAttachment?.type) && !failedImages.has(0)
    const otherAttachments = attachments.slice(1, maxVisible)

    return (
      <>
        <div className={cn("space-y-3", className)}>
          {/* Hero image */}
          {firstAttachment && (
            <div
              className="relative w-full rounded-lg overflow-hidden bg-gray-100 cursor-pointer group"
              style={{ aspectRatio: '16/9' }}
              onClick={() => handleAttachmentClick(0)}
            >
              {isFirstImage ? (
                <img
                  src={firstAttachment.url}
                  alt={firstAttachment.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                  onError={() => {
                    setFailedImages(prev => new Set(prev).add(0))
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8">
                  {getFileTypeIcon(firstAttachment)}
                  <p className="mt-2 text-sm text-gray-600">{firstAttachment.name}</p>
                </div>
              )}
            </div>
          )}

          {/* Thumbnail grid below */}
          {otherAttachments.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {otherAttachments.map((attachment, index) => {
                const actualIndex = index + 1
                const isImg = isImage(attachment.type) && !failedImages.has(actualIndex)
                return (
                  <div
                    key={actualIndex}
                    className="relative aspect-square rounded overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => handleAttachmentClick(actualIndex)}
                  >
                    {isImg ? (
                      <img
                        src={attachment.url}
                        alt={attachment.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={() => {
                          setFailedImages(prev => new Set(prev).add(actualIndex))
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {getFileTypeIcon(attachment)}
                      </div>
                    )}
                  </div>
                )
              })}
              {remainingCount > 0 && (
                <div
                  className="aspect-square flex items-center justify-center rounded bg-gray-100 text-gray-600 font-medium cursor-pointer hover:bg-gray-200 transition-colors"
                  onClick={() => handleAttachmentClick(visibleAttachments.length)}
                >
                  +{remainingCount}
                </div>
              )}
            </div>
          )}
        </div>
        {previewIndex !== null && (
          <AttachmentModal
            attachments={attachments}
            index={previewIndex}
            onClose={() => setPreviewIndex(null)}
            onNavigate={(newIndex) => setPreviewIndex(newIndex)}
            onDelete={onDelete}
            editable={editable}
          />
        )}
      </>
    )
  }

  // Cover mode - full-width banner image
  if (displayStyle === 'cover') {
    const firstAttachment = attachments[0]
    const isFirstImage = isImage(firstAttachment?.type) && !failedImages.has(0)

    return (
      <>
        <div className={cn("relative w-full rounded-lg overflow-hidden bg-gray-100", className)}>
          {firstAttachment && (
            <div
              className="relative w-full cursor-pointer group"
              style={{ aspectRatio: '21/9', minHeight: '200px' }}
              onClick={() => handleAttachmentClick(0)}
            >
              {isFirstImage ? (
                <img
                  src={firstAttachment.url}
                  alt={firstAttachment.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                  onError={() => {
                    setFailedImages(prev => new Set(prev).add(0))
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8">
                  {getFileTypeIcon(firstAttachment)}
                  <p className="mt-2 text-sm text-gray-600">{firstAttachment.name}</p>
                </div>
              )}
              {attachments.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  +{attachments.length - 1} more
                </div>
              )}
            </div>
          )}
        </div>
        {previewIndex !== null && (
          <AttachmentModal
            attachments={attachments}
            index={previewIndex}
            onClose={() => setPreviewIndex(null)}
            onNavigate={(newIndex) => setPreviewIndex(newIndex)}
            onDelete={onDelete}
            editable={editable}
          />
        )}
      </>
    )
  }

  // Gallery mode - responsive grid of images
  if (displayStyle === 'gallery') {
    return (
      <>
        <div className={cn("grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2", className)}>
          {visibleAttachments.map((attachment, index) => {
            const isImg = isImage(attachment.type) && !failedImages.has(index)
            return (
              <div
                key={index}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-pointer group"
                onClick={() => handleAttachmentClick(index)}
              >
                {isImg ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-110"
                    loading="lazy"
                    onError={() => {
                      setFailedImages(prev => new Set(prev).add(index))
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-2">
                    {getFileTypeIcon(attachment)}
                    <span className="text-xs text-gray-600 truncate w-full text-center mt-1">
                      {(attachment.name || '').split('.').pop()?.toUpperCase() || 'FILE'}
                    </span>
                  </div>
                )}
              </div>
            )
          })}
          {remainingCount > 0 && (
            <div
              className="aspect-square flex items-center justify-center rounded-lg bg-gray-100 text-gray-600 font-medium cursor-pointer hover:bg-gray-200 transition-colors"
              onClick={() => handleAttachmentClick(visibleAttachments.length)}
            >
              +{remainingCount}
            </div>
          )}
        </div>
        {previewIndex !== null && (
          <AttachmentModal
            attachments={attachments}
            index={previewIndex}
            onClose={() => setPreviewIndex(null)}
            onNavigate={(newIndex) => setPreviewIndex(newIndex)}
            onDelete={onDelete}
            editable={editable}
          />
        )}
      </>
    )
  }

  // List mode
  if (displayStyle === 'list') {
    return (
      <>
        <div className={cn("space-y-1.5", className)}>
          {visibleAttachments.map((attachment, index) => {
            const isImg = isImage(attachment.type) && !failedImages.has(index)
            return (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => handleAttachmentClick(index)}
              >
                {isImg ? (
                  <img
                    src={attachment.url}
                    alt={attachment.name}
                    className={cn("rounded object-cover", sizeConfig.thumbnail)}
                    loading="lazy"
                    onError={() => {
                      setFailedImages(prev => new Set(prev).add(index))
                    }}
                  />
                ) : (
                  <div className={cn("flex items-center justify-center rounded bg-gray-100", sizeConfig.thumbnail)}>
                    {getFileTypeIcon(attachment)}
                  </div>
                )}
              <div className="flex-1 min-w-0">
                <div className={cn("font-medium text-gray-900 truncate", sizeConfig.text)}>
                  {attachment.name}
                </div>
                <div className="text-xs text-gray-500">
                  {formatFileSize(attachment.size)}
                </div>
              </div>
            </div>
            )
          })}
          {remainingCount > 0 && (
            <div className="text-xs text-gray-500 px-2 py-1">
              +{remainingCount} more
            </div>
          )}
        </div>
        {previewIndex !== null && (
          <AttachmentModal
            attachments={attachments}
            index={previewIndex}
            onClose={() => setPreviewIndex(null)}
            onNavigate={(newIndex) => setPreviewIndex(newIndex)}
            onDelete={onDelete}
            editable={editable}
          />
        )}
      </>
    )
  }

  // Thumbnails mode (default)
  return (
    <>
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {visibleAttachments.map((attachment, index) => {
          const isImg = isImage(attachment.type) && !failedImages.has(index)
          return (
            <div
              key={index}
              className={cn(
                "relative rounded overflow-hidden bg-gray-100 flex-shrink-0 cursor-pointer transition-transform hover:scale-105",
                sizeConfig.thumbnail
              )}
              onClick={() => handleAttachmentClick(index)}
              title={attachment.name}
            >
              {isImg ? (
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => {
                    setFailedImages(prev => new Set(prev).add(index))
                  }}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-1">
                  {getFileTypeIcon(attachment)}
                  <span className={cn("text-gray-600 truncate w-full text-center px-0.5", sizeConfig.text)}>
                    {(attachment.name || '').split('.').pop()?.toUpperCase() || 'FILE'}
                  </span>
                </div>
              )}
            </div>
          )
        })}
        {remainingCount > 0 && (
          <div
            className={cn(
              "flex items-center justify-center rounded bg-gray-100 text-gray-600 font-medium cursor-pointer hover:bg-gray-200",
              sizeConfig.thumbnail
            )}
            onClick={() => handleAttachmentClick(visibleAttachments.length)}
            title={`${remainingCount} more attachment${remainingCount !== 1 ? 's' : ''}`}
          >
            +{remainingCount}
          </div>
        )}
      </div>
      {previewIndex !== null && (
        <AttachmentModal
          attachments={attachments}
          index={previewIndex}
          onClose={() => setPreviewIndex(null)}
          onNavigate={(newIndex) => setPreviewIndex(newIndex)}
          onDelete={onDelete}
          editable={editable}
        />
      )}
    </>
  )
}

/**
 * Attachment Modal/Lightbox
 * Shows full-size preview with navigation and optional delete
 */
function AttachmentModal({
  attachments,
  index,
  onClose,
  onNavigate,
  onDelete,
  editable = false,
}: {
  attachments: Attachment[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
  onDelete?: (index: number) => void | Promise<void>
  editable?: boolean
}) {
  const [deleting, setDeleting] = useState(false)
  const attachment = attachments[index]
  if (!attachment) return null

  const isImage = (attachment.type || '').startsWith('image/')
  const canDelete = editable && onDelete

  const handleDelete = async () => {
    if (!canDelete) return
    setDeleting(true)
    try {
      await onDelete(index)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 md:left-64 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-4 max-w-4xl w-full mx-4 relative max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {isImage && (
            <a
              href={attachment.url}
              download={attachment.name || 'image'}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-full hover:bg-gray-200 transition-colors"
              aria-label="Download"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4 text-gray-600" />
            </a>
          )}
          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              disabled={deleting}
              className="p-1.5 rounded-full hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors disabled:opacity-50"
              aria-label="Delete"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {isImage ? (
          <img
            src={attachment.url}
            alt={attachment.name}
            className="max-h-[70vh] mx-auto rounded"
            loading="lazy"
          />
        ) : (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              {getFileIconForAttachment(attachment)}
            </div>
            <p className="text-lg font-medium mb-2">{attachment.name}</p>
            <p className="text-sm text-gray-500 mb-4">
              {formatBytes(attachment.size ?? 0)}
            </p>
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </div>
        )}

        <div className="flex justify-between items-center mt-4 gap-2">
          <button
            onClick={() => index > 0 && onNavigate(index - 1)}
            disabled={index === 0 || deleting}
            className="px-3 py-1.5 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors"
          >
            ← Prev
          </button>

          <span className="text-sm text-gray-600 flex-1 text-center">
            {index + 1} of {attachments.length}
          </span>

          {canDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleDelete()
              }}
              disabled={deleting}
              className="px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          )}

          <button
            onClick={() => index < attachments.length - 1 && onNavigate(index + 1)}
            disabled={index === attachments.length - 1 || deleting}
            className="px-3 py-1.5 bg-gray-200 rounded disabled:opacity-50 hover:bg-gray-300 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper functions exported for use elsewhere
function getFileIconForAttachment(attachment: Attachment) {
  const ext = (attachment.name || '').split('.').pop()?.toLowerCase() || ''
  const type = (attachment.type || '').toLowerCase()

  // Check by MIME type first
  if (type.includes('pdf')) return <FileText className="h-4 w-4 text-red-600" />
  if (type.includes('spreadsheet') || type.includes('excel') || ['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />
  }
  if (type.includes('word') || type.includes('document') || ['doc', 'docx'].includes(ext)) {
    return <FileText className="h-4 w-4 text-blue-600" />
  }
  if (type.includes('video') || ['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
    return <Video className="h-4 w-4 text-pink-600" />
  }
  if (type.includes('audio') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
    return <Music className="h-4 w-4 text-purple-600" />
  }
  if (type.includes('zip') || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className="h-4 w-4 text-yellow-600" />
  }
  if (type.includes('code') || ['js', 'ts', 'jsx', 'tsx', 'json', 'xml', 'html', 'css'].includes(ext)) {
    return <FileCode className="h-4 w-4 text-gray-600" />
  }

  return <File className="h-4 w-4 text-gray-600" />
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
