import { supabase } from "@/lib/supabaseClient";

export interface AutomationResult {
  updated: any;
  notifications: string[];
  createdRecords: any[];
}

/**
 * Main automation engine - runs all automation rules in order
 * @param table - The table name (e.g., "content", "tasks", "ideas")
 * @param record - The record that was created or updated
 * @param previousRecord - The previous state (for update operations, to detect changes)
 * @returns Updated record with all automations applied
 */
export async function runAutomations(
  table: string,
  record: any,
  previousRecord?: any
): Promise<AutomationResult> {
  // Prevent infinite loops - if record was already automated, skip
  if (record.__automated) {
    return {
      updated: record,
      notifications: [],
      createdRecords: [],
    };
  }

  let updated = { ...record };
  const notifications: string[] = [];
  const createdRecords: any[] = [];

  // Run automations in order
  const result1 = await statusTaskAutomation(table, updated, previousRecord);
  updated = result1.updated;
  notifications.push(...result1.notifications);
  createdRecords.push(...result1.createdRecords);

  const result2 = await autoTagAutomation(table, updated, previousRecord);
  updated = result2.updated;
  notifications.push(...result2.notifications);

  const result3 = await campaignLinkAutomation(table, updated, previousRecord);
  updated = result3.updated;
  notifications.push(...result3.notifications);

  const result4 = await publishDateReminder(table, updated, previousRecord);
  updated = result4.updated;
  notifications.push(...result4.notifications);

  const result5 = await autoFieldFillAutomation(table, updated, previousRecord);
  updated = result5.updated;
  notifications.push(...result5.notifications);

  const result6 = await workflowProgressAutomation(table, updated, previousRecord);
  updated = result6.updated;
  notifications.push(...result6.notifications);
  createdRecords.push(...result6.createdRecords);

  const result7 = await ideaConversionAutomation(table, updated, previousRecord);
  updated = result7.updated;
  notifications.push(...result7.notifications);
  createdRecords.push(...result7.createdRecords);

  // Remove automation flag before returning
  delete updated.__automated;

  return {
    updated,
    notifications: notifications.filter(Boolean),
    createdRecords,
  };
}

/**
 * A) Status → Task Creation Automation
 * When content.status moves to "Approved" or "Scheduled", create a task
 */
async function statusTaskAutomation(
  table: string,
  record: any,
  previousRecord?: any
): Promise<AutomationResult> {
  if (table !== "content") {
    return { updated: record, notifications: [], createdRecords: [] };
  }

  const currentStatus = record.status;
  const previousStatus = previousRecord?.status;

  // Only trigger if status changed to one of these values
  // Handle both exact matches and case-insensitive
  const normalizedCurrent = String(currentStatus || "").toLowerCase();
  const normalizedPrevious = String(previousStatus || "").toLowerCase();
  
  if (
    currentStatus &&
    normalizedCurrent !== normalizedPrevious &&
    (normalizedCurrent === "approved" || 
     normalizedCurrent === "scheduled" ||
     normalizedCurrent === "approved – ready to schedule" ||
     normalizedCurrent === "to schedule")
  ) {
    const taskTitle = `Schedule: ${record.title || "Untitled Content"}`;
    const taskDescription = `Automatically generated task for scheduling content: ${record.title || "Untitled"}`;

    const { data: newTask, error } = await supabase.from("tasks").insert([
      {
        title: taskTitle,
        description: taskDescription,
        status: "todo",
        due_date: record.publish_date || null,
        content_id: record.id,
        __automated: true, // Prevent infinite loop
      },
    ]).select().single();

    if (!error && newTask) {
      return {
        updated: record,
        notifications: [`Task created: "${taskTitle}"`],
        createdRecords: [newTask],
      };
    }
  }

  return { updated: record, notifications: [], createdRecords: [] };
}

/**
 * B) Auto-tag content based on Channels
 * If content.channels includes specific values, add auto_tags
 */
async function autoTagAutomation(
  table: string,
  record: any,
  previousRecord?: any
): Promise<AutomationResult> {
  if (table !== "content") {
    return { updated: record, notifications: [], createdRecords: [] };
  }

  const channels = record.channels || [];
  if (!Array.isArray(channels)) {
    return { updated: record, notifications: [], createdRecords: [] };
  }

  const channelTags: Record<string, string> = {
    Facebook: "FB",
    "facebook": "FB",
    Instagram: "IG",
    "instagram": "IG",
    LinkedIn: "LI",
    "linkedin": "LI",
    Blog: "Blog",
    "blog": "Blog",
    Twitter: "TW",
    "twitter": "TW",
    X: "TW",
    "x": "TW",
  };

  const autoTags: string[] = [];
  const existingAutoTags = record.auto_tags || [];

  // Generate tags from channels
  channels.forEach((channel: string) => {
    const tag = channelTags[channel];
    if (tag && !autoTags.includes(tag) && !existingAutoTags.includes(tag)) {
      autoTags.push(tag);
    }
  });

  if (autoTags.length > 0) {
    const updatedAutoTags = [...existingAutoTags, ...autoTags];
    return {
      updated: { ...record, auto_tags: updatedAutoTags },
      notifications: [`Auto-tagged: ${autoTags.join(", ")}`],
      createdRecords: [],
    };
  }

  return { updated: record, notifications: [], createdRecords: [] };
}

/**
 * C) Campaign Linking Automation
 * If content.title or content.description contains keywords, link to campaign
 */
async function campaignLinkAutomation(
  table: string,
  record: any,
  previousRecord?: any
): Promise<AutomationResult> {
  if (table !== "content") {
    return { updated: record, notifications: [], createdRecords: [] };
  }

  // Only link if campaign_id is currently NULL
  if (record.campaign_id) {
    return { updated: record, notifications: [], createdRecords: [] };
  }

  const title = (record.title || "").toLowerCase();
  const description = (record.description || "").toLowerCase();
  const searchText = `${title} ${description}`;

  // Campaign keywords mapping
  const campaignKeywords: Record<string, string[]> = {
    "ARC Campaign": ["arc", "atlantic rally", "cruisers", "atlantic rally for cruisers"],
    "Miami Boat Show": ["miami", "boat show", "miami boat show"],
    "Dubai Movement": ["dubai", "jebel ali", "dubai movement"],
  };

  // Find matching campaign
  let matchedCampaign: string | null = null;
  for (const [campaignName, keywords] of Object.entries(campaignKeywords)) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword.toLowerCase())) {
        matchedCampaign = campaignName;
        break;
      }
    }
    if (matchedCampaign) break;
  }

  if (matchedCampaign) {
    // Load campaigns to find ID
    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, name")
      .ilike("name", `%${matchedCampaign}%`)
      .limit(1)
      .maybeSingle();

    if (campaigns) {
      return {
        updated: { ...record, campaign_id: campaigns.id },
        notifications: [`Auto-linked to campaign: ${matchedCampaign}`],
        createdRecords: [],
      };
    }
  }

  return { updated: record, notifications: [], createdRecords: [] };
}

/**
 * D) Publish Date Reminder Automation
 * If content.publish_date is today, tomorrow, or 3 days away, set needs_attention
 */
async function publishDateReminder(
  table: string,
  record: any,
  previousRecord?: any
): Promise<AutomationResult> {
  if (table !== "content") {
    return { updated: record, notifications: [], createdRecords: [] };
  }

  const publishDate = record.publish_date;
  if (!publishDate) {
    return { updated: record, notifications: [], createdRecords: [] };
  }

  try {
    const publish = new Date(publishDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    publish.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((publish.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffDays === 1 || diffDays === 3) {
      const message =
        diffDays === 0
          ? "Publishing today!"
          : diffDays === 1
          ? "Publishing tomorrow!"
          : "Publishing in 3 days!";

      console.log(`[Automation] ${message} - ${record.title || "Untitled"}`);

      return {
        updated: { ...record, needs_attention: true },
        notifications: [message],
        createdRecords: [],
      };
    }
  } catch (error) {
    console.error("Error in publishDateReminder:", error);
  }

  return { updated: record, notifications: [], createdRecords: [] };
}

/**
 * E) Auto-fill fields
 * Fill empty fields with default values
 */
async function autoFieldFillAutomation(
  table: string,
  record: any,
  previousRecord?: any
): Promise<AutomationResult> {
  const updated = { ...record };
  const notifications: string[] = [];

  if (table === "content") {
    // If description is empty, auto-fill with creation date
    if (!updated.description || updated.description.trim() === "") {
      const createdDate = new Date().toLocaleDateString();
      updated.description = `This content was created on ${createdDate}.`;
      notifications.push("Auto-filled description");
    }
  }

  if (table === "tasks") {
    // If due_date is empty and created_at exists, set due_date = created_at + 7 days
    if (!updated.due_date && updated.created_at) {
      try {
        const created = new Date(updated.created_at);
        created.setDate(created.getDate() + 7);
        updated.due_date = created.toISOString().split("T")[0];
        notifications.push("Auto-set due date (7 days from creation)");
      } catch (error) {
        console.error("Error setting due_date:", error);
      }
    }
  }

  return {
    updated,
    notifications,
    createdRecords: [],
  };
}

/**
 * F) Auto-progress workflow
 * Automatically update status based on conditions
 */
async function workflowProgressAutomation(
  table: string,
  record: any,
  previousRecord?: any
): Promise<AutomationResult> {
  const updated = { ...record };
  const notifications: string[] = [];
  const createdRecords: any[] = [];

  if (table === "tasks") {
    // If task status = "done" and linked content status = "To Schedule", update content to "Scheduled"
    if (updated.status === "done" && updated.content_id) {
      const { data: content } = await supabase
        .from("content")
        .select("id, status")
        .eq("id", updated.content_id)
        .maybeSingle();

      if (content) {
        const normalizedStatus = String(content.status || "").toLowerCase();
        if (normalizedStatus === "to schedule" || normalizedStatus.includes("schedule")) {
          await supabase
            .from("content")
            .update({ status: "scheduled", __automated: true })
            .eq("id", content.id);

          notifications.push("Content status updated to Scheduled");
        }
      }
    }
  }

  if (table === "content") {
    // If publish_date < today AND status not "Published" or "Completed", set to "Out Of Date"
    if (updated.publish_date) {
      try {
        const publish = new Date(updated.publish_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        publish.setHours(0, 0, 0, 0);

        if (
          publish < today &&
          updated.status !== "completed" &&
          updated.status !== "Completed (Published)" &&
          updated.status !== "Published"
        ) {
          updated.status = "Out Of Date";
          notifications.push("Content marked as Out Of Date (publish date passed)");
        }
      } catch (error) {
        console.error("Error checking publish_date:", error);
      }
    }
  }

  return {
    updated,
    notifications,
    createdRecords,
  };
}

/**
 * G) Idea → Content Creation Automation
 * If idea.status = "Ready to Create", automatically generate content record
 */
async function ideaConversionAutomation(
  table: string,
  record: any,
  previousRecord?: any
): Promise<AutomationResult> {
  if (table !== "ideas") {
    return { updated: record, notifications: [], createdRecords: [] };
  }

  const currentStatus = record.status;
  const previousStatus = previousRecord?.status;

  // Only trigger if status changed to "Ready to Create" or "ready"
  if (
    currentStatus &&
    currentStatus !== previousStatus &&
    (currentStatus === "Ready to Create" || currentStatus === "ready")
  ) {
    // Create content record from idea
    const { data: newContent, error } = await supabase
      .from("content")
      .insert([
        {
          title: record.title || "Untitled",
          description: record.description || "",
          content_type: record.category || null,
          status: "Draft",
          __automated: true, // Prevent infinite loop
        },
      ])
      .select()
      .single();

    if (!error && newContent) {
      // Update idea with linked content and status
      // First update the idea in the database
      await supabase
        .from("ideas")
        .update({
          linked_content_id: newContent.id,
          status: "Converted",
          __automated: true,
        })
        .eq("id", record.id);

      const updatedIdea = {
        ...record,
        linked_content_id: newContent.id,
        status: "Converted",
      };

      return {
        updated: updatedIdea,
        notifications: [`Content created from idea: "${record.title || "Untitled"}"`],
        createdRecords: [newContent],
      };
    }
  }

  return { updated: record, notifications: [], createdRecords: [] };
}

