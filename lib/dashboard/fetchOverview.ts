import { supabase } from "@/lib/supabaseClient";

export interface OverviewData {
  contentThisMonth: number;
  tasksDue: number;
  activeCampaigns: number;
  itemsNeedingAttention: number;
}

/**
 * Fetch overview statistics for dashboard
 */
export async function fetchOverview(): Promise<OverviewData> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  today.setHours(0, 0, 0, 0);

  // A) Content scheduled/published this month
  const { count: contentCount } = await supabase
    .from("content")
    .select("*", { count: "exact", head: true })
    .gte("publish_date", startOfMonth.toISOString().split("T")[0]);

  // B) Tasks due (status != "Done" and due_date >= today)
  const { count: tasksCount } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .neq("status", "done")
    .gte("due_date", today.toISOString().split("T")[0]);

  // C) Active campaigns (end_date >= today)
  const { count: campaignsCount } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .gte("end_date", today.toISOString().split("T")[0])
    .or("end_date.is.null");

  // D) Items needing attention
  // - content.needs_attention = true
  // - overdue tasks
  // - publish dates missed (publish_date < today AND status not Published/Completed)
  // - content without campaign (campaign_id is null)
  // - content missing thumbnail (thumbnail_url is null)

  const { count: needsAttentionCount } = await supabase
    .from("content")
    .select("*", { count: "exact", head: true })
    .eq("needs_attention", true);

  const { count: overdueTasksCount } = await supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .neq("status", "done")
    .lt("due_date", today.toISOString().split("T")[0]);

  const { count: missedPublishCount } = await supabase
    .from("content")
    .select("*", { count: "exact", head: true })
    .lt("publish_date", today.toISOString().split("T")[0])
    .not("status", "in", "(completed,Completed (Published),Published)");

  const { count: noCampaignCount } = await supabase
    .from("content")
    .select("*", { count: "exact", head: true })
    .is("campaign_id", null);

  const { count: noThumbnailCount } = await supabase
    .from("content")
    .select("*", { count: "exact", head: true })
    .is("thumbnail_url", null);

  const itemsNeedingAttention =
    (needsAttentionCount || 0) +
    (overdueTasksCount || 0) +
    (missedPublishCount || 0) +
    (noCampaignCount || 0) +
    (noThumbnailCount || 0);

  return {
    contentThisMonth: contentCount || 0,
    tasksDue: tasksCount || 0,
    activeCampaigns: campaignsCount || 0,
    itemsNeedingAttention,
  };
}

