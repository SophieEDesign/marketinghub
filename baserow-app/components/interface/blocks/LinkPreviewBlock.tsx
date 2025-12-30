"use client"

import { useState, useEffect } from "react"
import type { PageBlock } from "@/lib/interface/types"
import { ExternalLink, File, FileText, Image, Video, Music, Archive } from "lucide-react"

interface LinkPreviewBlockProps {
  block: PageBlock
  isEditing?: boolean
}

interface LinkMetadata {
  provider: string
  fileName: string
  fileType: string
  icon: React.ReactNode
  thumbnailUrl?: string
}

export default function LinkPreviewBlock({ block, isEditing = false }: LinkPreviewBlockProps) {
  const { config } = block
  const url = config?.url || config?.link_url || ""
  const title = config?.title || config?.link_title
  const description = config?.description || config?.link_description
  
  const [metadata, setMetadata] = useState<LinkMetadata | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (url) {
      detectProvider(url)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  function detectProvider(urlString: string): void {
    setLoading(true)
    
    try {
      const urlObj = new URL(urlString)
      const hostname = urlObj.hostname.toLowerCase()
      
      let provider = "External Link"
      let fileName = ""
      let fileType = "file"
      let icon: React.ReactNode = <File className="h-6 w-6" />

      // OneDrive detection
      if (hostname.includes("onedrive.live.com") || hostname.includes("1drv.ms")) {
        provider = "OneDrive"
        fileName = extractFileName(urlString) || "OneDrive File"
        fileType = detectFileType(fileName)
        icon = <File className="h-6 w-6 text-blue-600" />
      }
      // SharePoint detection
      else if (hostname.includes("sharepoint.com") || hostname.includes("sharepoint")) {
        provider = "SharePoint"
        fileName = extractFileName(urlString) || "SharePoint File"
        fileType = detectFileType(fileName)
        icon = <File className="h-6 w-6 text-blue-500" />
      }
      // Google Drive detection
      else if (hostname.includes("drive.google.com") || hostname.includes("docs.google.com")) {
        provider = "Google Drive"
        fileName = extractFileName(urlString) || "Google Drive File"
        fileType = detectFileType(fileName)
        icon = <File className="h-6 w-6 text-green-600" />
      }
      // Dropbox detection
      else if (hostname.includes("dropbox.com")) {
        provider = "Dropbox"
        fileName = extractFileName(urlString) || "Dropbox File"
        fileType = detectFileType(fileName)
        icon = <File className="h-6 w-6 text-blue-500" />
      }
      // Generic file URL
      else {
        const pathParts = urlObj.pathname.split("/")
        fileName = pathParts[pathParts.length - 1] || "File"
        fileType = detectFileType(fileName)
        icon = getFileIcon(fileType)
      }

      setMetadata({
        provider,
        fileName,
        fileType,
        icon,
      })
    } catch (error) {
      // Invalid URL, use defaults
      setMetadata({
        provider: "External Link",
        fileName: url || "Link",
        fileType: "file",
        icon: <ExternalLink className="h-6 w-6" />,
      })
    } finally {
      setLoading(false)
    }
  }

  function extractFileName(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split("/")
      const lastPart = pathParts[pathParts.length - 1]
      
      // Decode URL-encoded filename
      return decodeURIComponent(lastPart).split("?")[0] || ""
    } catch {
      return ""
    }
  }

  function detectFileType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || ""
    
    if (["pdf"].includes(ext)) return "pdf"
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image"
    if (["mp4", "webm", "mov", "avi"].includes(ext)) return "video"
    if (["mp3", "wav", "ogg", "m4a"].includes(ext)) return "audio"
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive"
    if (["doc", "docx", "txt", "rtf"].includes(ext)) return "document"
    if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet"
    
    return "file"
  }

  function getFileIcon(fileType: string): React.ReactNode {
    switch (fileType) {
      case "pdf":
        return <FileText className="h-6 w-6 text-red-600" />
      case "image":
        return <Image className="h-6 w-6 text-purple-600" />
      case "video":
        return <Video className="h-6 w-6 text-pink-600" />
      case "audio":
        return <Music className="h-6 w-6 text-green-600" />
      case "archive":
        return <Archive className="h-6 w-6 text-yellow-600" />
      default:
        return <File className="h-6 w-6 text-gray-600" />
    }
  }

  function handleClick() {
    if (url && !isEditing) {
      window.open(url, "_blank")
    }
  }

  // Apply appearance settings
  const appearance = config.appearance || {}
  const blockStyle: React.CSSProperties = {
    backgroundColor: appearance.background_color,
    borderColor: appearance.border_color,
    borderWidth: appearance.border_width !== undefined ? `${appearance.border_width}px` : '1px',
    borderRadius: appearance.border_radius !== undefined ? `${appearance.border_radius}px` : '8px',
    padding: appearance.padding !== undefined ? `${appearance.padding}px` : '16px',
  }

  const displayTitle = title || metadata?.fileName || "Link"
  const showTitle = appearance.show_title !== false && displayTitle

  // Empty state
  if (!url) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm p-4" style={blockStyle}>
        <div className="text-center">
          <ExternalLink className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="mb-1">{isEditing ? "Configure link preview" : "No link configured"}</p>
          {isEditing && (
            <p className="text-xs text-gray-400">Add a file link URL in settings</p>
          )}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 p-4" style={blockStyle}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400 mx-auto mb-2"></div>
          <p className="text-sm">Detecting link...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`h-full w-full overflow-auto flex flex-col ${!isEditing ? 'cursor-pointer hover:bg-gray-50' : ''}`}
      style={blockStyle}
      onClick={handleClick}
    >
      {showTitle && (
        <div
          className="mb-4 pb-2 border-b"
          style={{
            backgroundColor: appearance.header_background,
            color: appearance.header_text_color || appearance.title_color,
          }}
        >
          <h3 className="text-lg font-semibold">{displayTitle}</h3>
        </div>
      )}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center w-full">
          {metadata?.icon && (
            <div className="mb-4 flex justify-center">
              {metadata.icon}
            </div>
          )}
          <h4 className="text-lg font-semibold mb-2">{metadata?.fileName || displayTitle}</h4>
          {metadata?.provider && (
            <p className="text-sm text-gray-500 mb-1">{metadata.provider}</p>
          )}
          {description && (
            <p className="text-sm text-gray-600 mt-2">{description}</p>
          )}
          {metadata?.fileType && (
            <p className="text-xs text-gray-400 mt-2 uppercase">{metadata.fileType}</p>
          )}
          {!isEditing && (
            <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
              <span>Click to open</span>
              <ExternalLink className="h-3 w-3" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

