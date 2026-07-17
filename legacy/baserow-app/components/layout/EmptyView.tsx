"use client"

interface EmptyViewProps {
  message?: string
  icon?: React.ReactNode
}

export default function EmptyView({ 
  message = "Coming soon…",
  icon 
}: EmptyViewProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
      {icon && (
        <div className="mb-4 text-muted-foreground">
          {icon}
        </div>
      )}
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  )
}
