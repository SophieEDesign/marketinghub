"use client"

import { useState, useEffect } from "react"
import { Check, Loader2, WifiOff, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "offline"

interface SaveStatusIndicatorProps {
  status?: SaveStatus
  className?: string
}

export default function SaveStatusIndicator({ 
  status = "idle",
  className 
}: SaveStatusIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const displayStatus = !isOnline ? "offline" : status

  const statusConfig = {
    idle: {
      icon: null,
      text: null,
      className: "text-gray-400",
    },
    saving: {
      icon: <Loader2 className="h-3 w-3 animate-spin" />,
      text: "Saving...",
      className: "text-blue-600",
    },
    saved: {
      icon: <Check className="h-3 w-3" />,
      text: "All changes saved",
      className: "text-green-600",
    },
    error: {
      icon: <AlertCircle className="h-3 w-3" />,
      text: "Save failed",
      className: "text-red-600",
    },
    offline: {
      icon: <WifiOff className="h-3 w-3" />,
      text: "Offline – changes pending",
      className: "text-amber-600",
    },
  }

  const config = statusConfig[displayStatus]

  if (displayStatus === "idle" || !config.text) {
    return null
  }

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs font-medium",
        config.className,
        className
      )}
      title={config.text}
    >
      {config.icon}
      <span className="hidden sm:inline">{config.text}</span>
    </div>
  )
}

