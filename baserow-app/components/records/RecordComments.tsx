"use client"

import { useState, useEffect, useCallback } from "react"
import { ChevronDown, ChevronRight, MessageSquare, Send, Trash2, Pencil } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getUserDisplayNames } from "@/lib/users/userDisplay"
import { useToast } from "@/components/ui/use-toast"

export interface RecordComment {
  id: string
  user_id: string
  body: string
  created_at: string
  updated_at?: string
}

interface RecordCommentsProps {
  tableId: string
  recordId: string
  canAddComment?: boolean
}

function formatCommentDate(dateValue: string | null | undefined) {
  if (!dateValue) return ""
  try {
    const d = new Date(dateValue)
    if (Number.isNaN(d.getTime())) return ""
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  } catch {
    return ""
  }
}

export default function RecordComments({
  tableId,
  recordId,
  canAddComment = true,
}: RecordCommentsProps) {
  const [comments, setComments] = useState<RecordComment[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [userNames, setUserNames] = useState<Map<string, string>>(new Map())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState("")
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => setCurrentUserId(user?.id ?? null))
  }, [])

  const loadComments = useCallback(async () => {
    if (!tableId || !recordId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/tables/${tableId}/records/${recordId}/comments`)
      if (!res.ok) throw new Error("Failed to load comments")
      const { comments: data } = await res.json()
      setComments(data ?? [])

      const userIds = [...new Set((data ?? []).map((c: RecordComment) => c.user_id))]
      if (userIds.length > 0) {
        const names = await getUserDisplayNames(userIds)
        setUserNames(names)
      }
    } catch (err) {
      console.error("Error loading comments:", err)
      toast({
        variant: "destructive",
        title: "Could not load comments",
        description: "Please try again.",
      })
    } finally {
      setLoading(false)
    }
  }, [tableId, recordId, toast])

  useEffect(() => {
    loadComments()
  }, [loadComments])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = newComment.trim()
    if (!text || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/tables/${tableId}/records/${recordId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({}))
        throw new Error(error || "Failed to add comment")
      }
      setNewComment("")
      await loadComments()
      toast({ title: "Comment added" })
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Could not add comment",
        description: err.message || "Please try again.",
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEdit(commentId: string, body: string) {
    const text = body.trim()
    if (!text) return
    try {
      const res = await fetch(
        `/api/tables/${tableId}/records/${recordId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        }
      )
      if (!res.ok) throw new Error("Failed to update comment")
      setEditingId(null)
      setEditBody("")
      await loadComments()
      toast({ title: "Comment updated" })
    } catch {
      toast({
        variant: "destructive",
        title: "Could not update comment",
      })
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm("Delete this comment?")) return
    try {
      const res = await fetch(
        `/api/tables/${tableId}/records/${recordId}/comments/${commentId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error("Failed to delete comment")
      await loadComments()
      toast({ title: "Comment deleted" })
    } catch {
      toast({
        variant: "destructive",
        title: "Could not delete comment",
      })
    }
  }

  return (
    <div className="border-t border-gray-200 pt-6">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between text-left"
        aria-expanded={!collapsed}
      >
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments
          {comments.length > 0 && (
            <span className="text-gray-500 font-normal">({comments.length})</span>
          )}
        </h3>
        <span className="text-gray-400">
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </span>
      </button>

      {!collapsed && (
        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="text-sm text-gray-500">Loading comments…</div>
          ) : (
            <div className="space-y-3">
              {comments.length === 0 ? (
                <p className="text-sm text-gray-500">No comments yet.</p>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-gray-100 bg-gray-50/80 p-3 text-sm"
                  >
                    {editingId === c.id ? (
                      <div className="space-y-2">
                        <Textarea
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                          placeholder="Edit comment..."
                          rows={2}
                          className="min-h-[60px] resize-none"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleEdit(c.id, editBody)}
                            disabled={!editBody.trim()}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingId(null)
                              setEditBody("")
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-900">
                              {userNames.get(c.user_id) ?? "Unknown"}
                            </span>
                            <span className="ml-2 text-gray-400 text-xs">
                              {formatCommentDate(c.created_at)}
                            </span>
                          </div>
                          {currentUserId === c.user_id && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(c.id)
                                setEditBody(c.body)
                              }}
                              className="p-1 rounded hover:bg-gray-200 text-gray-500"
                              title="Edit"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(c.id)}
                              className="p-1 rounded hover:bg-red-100 text-gray-500 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                          )}
                        </div>
                        <p className="mt-1 text-gray-700 whitespace-pre-wrap break-words">
                          {c.body}
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {canAddComment && (
            <form onSubmit={handleSubmit} className="space-y-2">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="min-h-[60px] resize-none"
                disabled={submitting}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!newComment.trim() || submitting}
                className="gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? "Sending…" : "Send"}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
