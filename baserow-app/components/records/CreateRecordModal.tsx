"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

interface CreateRecordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableName?: string | null
  primaryFieldLabel?: string | null
  primaryFieldPlaceholder?: string
  isSaving?: boolean
  onCreate: (primaryFieldValue: string) => Promise<void>
}

export default function CreateRecordModal({
  open,
  onOpenChange,
  tableName,
  primaryFieldLabel,
  primaryFieldPlaceholder,
  isSaving = false,
  onCreate,
}: CreateRecordModalProps) {
  const { toast } = useToast()
  const [primaryValue, setPrimaryValue] = useState("")

  useEffect(() => {
    if (!open) setPrimaryValue("")
  }, [open])

  const handleOpenChange = (next: boolean) => {
    if (isSaving) return
    onOpenChange(next)
  }

  const handleSave = async () => {
    if (isSaving) return
    try {
      await onCreate(primaryValue.trim())
      handleOpenChange(false)
    } catch (e: any) {
      const message = e?.message || "Please try again."
      toast({
        title: "Failed to create record",
        description: message,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>New record</DialogTitle>
          <DialogDescription>
            {tableName ? (
              <>This will create a new record in <span className="font-medium">{tableName}</span> when you click Save.</>
            ) : (
              <>This will create a new record when you click Save.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {primaryFieldLabel ? (
          <div className="grid gap-2">
            <Label htmlFor="create-record-primary">{primaryFieldLabel}</Label>
            <Input
              id="create-record-primary"
              value={primaryValue}
              onChange={(e) => setPrimaryValue(e.target.value)}
              placeholder={primaryFieldPlaceholder || `Enter ${primaryFieldLabel.toLowerCase()}`}
              disabled={isSaving}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleSave()
                }
              }}
            />
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No fields to fill in here — this will create a blank record.
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

