import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTable } from "@/lib/crud/tables"
import { parseMentions } from "@/lib/comments/parse-mentions"
import { sendMentionNotification } from "@/lib/email/send-mention-notification"
import { formatUserDisplayName } from "@/lib/users/userDisplay"

/**
 * GET /api/tables/[tableId]/records/[recordId]/comments
 * List comments for a record.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string; recordId: string }> }
) {
  try {
    const { tableId, recordId } = await params
    const table = await getTable(tableId)
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    const supabase = await createClient()
    const { data: comments, error } = await supabase
      .from("record_comments")
      .select("id, user_id, body, created_at, updated_at")
      .eq("table_id", tableId)
      .eq("record_id", recordId)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("Error fetching comments:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ comments: comments ?? [] })
  } catch (error: unknown) {
    console.error("Error in comments GET:", error)
    const msg = (error as { message?: string })?.message || "Failed to fetch comments"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/**
 * POST /api/tables/[tableId]/records/[recordId]/comments
 * Add a comment to a record.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string; recordId: string }> }
) {
  try {
    const { tableId, recordId } = await params
    const table = await getTable(tableId)
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 })
    }

    const body = await request.json()
    const text = typeof body.body === "string" ? body.body.trim() : ""
    if (!text) {
      return NextResponse.json(
        { error: "Comment body is required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify record exists
    const { data: record, error: recordError } = await supabase
      .from(table.supabase_table)
      .select("id")
      .eq("id", recordId)
      .maybeSingle()

    if (recordError) {
      return NextResponse.json({ error: "Failed to verify record" }, { status: 500 })
    }
    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    const { data: comment, error } = await supabase
      .from("record_comments")
      .insert({
        table_id: tableId,
        record_id: recordId,
        user_id: user.id,
        body: text,
      })
      .select("id, user_id, body, created_at, updated_at")
      .single()

    if (error) {
      console.error("Error inserting comment:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Process @mentions: resolve emails to users, insert comment_mentions, send emails
    const mentionedEmails = parseMentions(text)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36a8f0'},body:JSON.stringify({sessionId:'36a8f0',location:'comments/route.ts:parseMentions',message:'Mentions parsed',data:{mentionedEmails,textLen:text.length},hypothesisId:'B',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const commentAuthorName = formatUserDisplayName(user.email ?? null)
    const tableName = table.name || "Record"
    let baseUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!baseUrl) {
      baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"
    }
    if (!baseUrl.startsWith("http")) baseUrl = `https://${baseUrl}`
    const recordUrl = `${baseUrl}/tables/${tableId}?openRecord=${recordId}`
    const commentPreview = text.length > 150 ? `${text.slice(0, 150)}...` : text

    if (mentionedEmails.length > 0 && comment?.id) {
      for (const email of mentionedEmails) {
        const { data: profile, error: profileErr } = await supabase
          .from("user_profile_sync_status")
          .select("user_id")
          .ilike("email", email)
          .maybeSingle()

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36a8f0'},body:JSON.stringify({sessionId:'36a8f0',location:'comments/route.ts:profileLookup',message:'Profile lookup',data:{email,found:!!profile?.user_id,profileUserId:profile?.user_id,isSelf:profile?.user_id===user.id,profileError:profileErr?.message},hypothesisId:'C',timestamp:Date.now()})}).catch(()=>{});
        // #endregion

        if (!profile?.user_id || profile.user_id === user.id) continue

        await supabase.from("comment_mentions").insert({
          comment_id: comment.id,
          mentioned_user_id: profile.user_id,
        })

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36a8f0'},body:JSON.stringify({sessionId:'36a8f0',location:'comments/route.ts:beforeSend',message:'About to send mention email',data:{toEmail:email},hypothesisId:'A',timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        sendMentionNotification({
          toEmail: email,
          commentAuthorName,
          recordUrl,
          commentPreview,
          tableName,
        }).then((r)=>{ fetch('http://127.0.0.1:7242/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36a8f0'},body:JSON.stringify({sessionId:'36a8f0',location:'comments/route.ts:afterSend',message:'sendMentionNotification resolved',data:r,hypothesisId:'A',timestamp:Date.now()})}).catch(()=>{}); }).catch((err) => { console.error("[comments] Mention email failed:", err); fetch('http://127.0.0.1:7242/ingest/9d016980-ed95-431c-a758-912799743da1',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'36a8f0'},body:JSON.stringify({sessionId:'36a8f0',location:'comments/route.ts:sendError',message:'sendMentionNotification rejected',data:{err:String(err)},hypothesisId:'E',timestamp:Date.now()})}).catch(()=>{}); })
      }
    }

    return NextResponse.json({ comment })
  } catch (error: unknown) {
    console.error("Error in comments POST:", error)
    const msg = (error as { message?: string })?.message || "Failed to add comment"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
