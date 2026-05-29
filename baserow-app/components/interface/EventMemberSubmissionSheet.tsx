"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { createClient } from "@/lib/supabase/client"
import type { ContentEventFieldMap } from "@/lib/marketing/events"
import type { EventCalendarWorkflowConfig } from "@/lib/marketing/event-calendar-config"

export interface EventMemberSubmissionSheetProps {
  open: boolean
  onClose: () => void
  supabaseTable: string
  fields: ContentEventFieldMap
  workflow: EventCalendarWorkflowConfig
  onSubmitted: () => void
}

export default function EventMemberSubmissionSheet({
  open,
  onClose,
  supabaseTable,
  fields,
  workflow,
  onSubmitted,
}: EventMemberSubmissionSheetProps) {
  const [title, setTitle] = useState("")
  const [eventType, setEventType] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [website, setWebsite] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Event title is required")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const row: Record<string, unknown> = {}
      if (fields.eventName) row[fields.eventName] = title.trim()
      if (fields.eventType && eventType) row[fields.eventType] = eventType
      if (fields.startDate && startDate) row[fields.startDate] = startDate
      if (fields.endDate && endDate) row[fields.endDate] = endDate
      if (fields.locationName && location) row[fields.locationName] = location
      if (fields.description && description) row[fields.description] = description
      if (fields.website && website) row[fields.website] = website
      if (fields.contentType) row[fields.contentType] = workflow.contentTypeDefault
      if (fields.status) row[fields.status] = workflow.submittedStatus
      if (fields.visibility) row[fields.visibility] = workflow.memberDefaultVisibility

      const supabase = createClient()
      const { error: insertErr } = await supabase.from(supabaseTable).insert(row)
      if (insertErr) throw new Error(insertErr.message)
      onSubmitted()
      onClose()
      setTitle("")
      setEventType("")
      setStartDate("")
      setEndDate("")
      setLocation("")
      setDescription("")
      setWebsite("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit event")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 md:left-64 bg-black/20 z-40"
          onClick={onClose}
          aria-hidden
        />
      ) : null}
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col z-50">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h2 className="text-lg font-semibold">Submit an event</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="px-4 text-sm text-muted-foreground pb-4">
            Your event will be reviewed before it appears on the calendar.
          </p>
          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="es-title">Event title *</Label>
              <Input
                id="es-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Event name"
              />
            </div>
            {fields.eventType ? (
              <div className="space-y-2">
                <Label htmlFor="es-type">Event type</Label>
                <Input
                  id="es-type"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                />
              </div>
            ) : null}
            {fields.startDate ? (
              <div className="space-y-2">
                <Label htmlFor="es-start">Start date</Label>
                <Input
                  id="es-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            ) : null}
            {fields.endDate ? (
              <div className="space-y-2">
                <Label htmlFor="es-end">End date</Label>
                <Input
                  id="es-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            ) : null}
            {fields.locationName ? (
              <div className="space-y-2">
                <Label htmlFor="es-loc">Location</Label>
                <Input
                  id="es-loc"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            ) : null}
            {fields.description ? (
              <div className="space-y-2">
                <Label htmlFor="es-desc">Description</Label>
                <Textarea
                  id="es-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            ) : null}
            {fields.website ? (
              <div className="space-y-2">
                <Label htmlFor="es-web">Website</Label>
                <Input
                  id="es-web"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://"
                />
              </div>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <div className="p-4 border-t border-border/40">
            <Button type="button" className="w-full" disabled={submitting} onClick={handleSubmit}>
              {submitting ? "Submitting…" : "Submit for approval"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
